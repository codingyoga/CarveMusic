import { after, NextRequest, NextResponse } from "next/server";
import { getChatResponse, getChatResponseFromPool } from "@/lib/ai";
import {
  playlistSongsForDebugLog,
  poolSongsForDebugLog,
  truncateForLog,
} from "@/lib/carveDebugLog";
import { carveDebugServer } from "@/lib/carveDebugLogFile";
import { multiSearchJioSaavn, formatSongsForContext } from "@/lib/jiosaavn";
import {
  buildCuratorIntentSection,
  formatCatalogSearchPreamble,
} from "@/lib/curatorIntent";
import {
  buildMoodSearchQueries,
  buildMoodSearchQuery,
  detectLanguage,
  expandMoodImperativeVibes,
  isLikelyEraOrDecadeNotArtist,
  isLikelyMoodDescriptorNotArtist,
  isScenarioOnlyArtistFalsePositive,
} from "@/lib/moodSearchQuery";
import { inferSearchIntent } from "@/lib/searchIntent";
import { buildJioSaavnQueriesFromIntent } from "@/lib/jiosaavnQueriesFromIntent";
import type { JioSaavnSong } from "@/lib/jiosaavn";
import {
  capSongPool,
  MIN_POOL_FOR_STRICT,
} from "@/lib/songPoolPlaylist";

function flushLangfuseAfterResponse() {
  after(async () => {
    try {
      const { langfuseSpanProcessor } = await import("../../../instrumentation");
      await langfuseSpanProcessor?.forceFlush();
    } catch {
      /* instrumentation optional in some environments */
    }
  });
}

const MCQ_OPTIONS = new Set([
  "start",
  "happy",
  "sad",
  "energetic",
  "calm",
  "nostalgic",
  "angry",
  "slow & gentle",
  "steady groove",
  "high energy",
  "kannada",
  "hindi",
  "tamil",
  "telugu",
  "english",
  "mix languages",
  "familiar favorites",
  "hidden gems",
  "surprise me",
  "play it",
  "perfect",
  "yes",
  "let's go",
  "new playlist",
  "start over",
]);

function extractArtistName(text: string): string | null {
  if (expandMoodImperativeVibes(text).vibes.length > 0) return null;
  const lower = text.toLowerCase();
  const patterns = [
    /songs?\s+(?:of|by|from)\s+(.+?)(?:\s+(?:in|from)\s+(?:kannada|hindi|tamil|telugu|english))?$/i,
    /(.+?)(?:'s)?\s+(?:songs?|hits?|romantic|melody|melodies)/i,
    /(?:give me|play|suggest|find)\s+(.+?)(?:\s+songs?)/i,
  ];

  for (const pattern of patterns) {
    const match = lower.match(pattern);
    if (match) {
      const name = match[1]
        .replace(/\b(romantic|sad|happy|best|old|new|classic|songs?|hits?|from|kannada|hindi|tamil|telugu|english)\b/gi, "")
        .trim();
      if (
        name.length > 2 &&
        !isScenarioOnlyArtistFalsePositive(name) &&
        !isLikelyMoodDescriptorNotArtist(name) &&
        !isLikelyEraOrDecadeNotArtist(name)
      ) {
        return name;
      }
    }
  }
  return null;
}

function shouldSearch(content: string): boolean {
  const lower = content.toLowerCase().trim();
  if (MCQ_OPTIONS.has(lower)) return false;
  if (lower.length < 8) return false;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 }
      );
    }

    const chatMessages = messages.map(
      (m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })
    );

    const lastUser = [...chatMessages].reverse().find((m) => m.role === "user");
    carveDebugServer("api.chat.request", {
      step: "POST /api/chat",
      messageCount: chatMessages.length,
      roles: chatMessages.map((m) => m.role),
      lastUserPreview: lastUser
        ? truncateForLog(lastUser.content, 200)
        : null,
    });

    let poolSongs: JioSaavnSong[] = [];
    let isArtistPath = false;
    let catalogSearchQueries: string[] = [];
    let resolvedArtistName: string | null = null;

    const lastMsg = chatMessages[chatMessages.length - 1];
    if (lastMsg && shouldSearch(lastMsg.content)) {
      const lang = detectLanguage(chatMessages) as
        | "kannada"
        | "hindi"
        | "tamil"
        | "telugu"
        | "english"
        | null;
      const inferred = await inferSearchIntent({
        lastUserText: lastMsg.content,
        languageHint: lang,
      });

      const artistName =
        inferred?.isArtistRequest && inferred.artistName
          ? inferred.artistName
          : extractArtistName(lastMsg.content);

      if (artistName) {
        isArtistPath = true;
        resolvedArtistName = artistName;
        const queries = [
          artistName,
          lang ? `${artistName} ${lang}` : null,
          lang ? `${artistName} ${lang} songs` : `${artistName} songs`,
          lang ? `${artistName} ${lang} hits` : null,
        ].filter(Boolean) as string[];

        carveDebugServer("api.chat.jiosaavn", {
          step: "JioSaavn lookup (artist)",
          artistName,
          queries,
        });

        catalogSearchQueries = queries;
        const songs = await multiSearchJioSaavn(queries);
        poolSongs = capSongPool(songs);
        carveDebugServer("api.chat.jiosaavn.result", {
          verifiedSongCount: songs.length,
          poolSize: poolSongs.length,
        });
      } else {
        let moodQueries =
          inferred && !inferred.isArtistRequest
            ? buildJioSaavnQueriesFromIntent(inferred, lastMsg.content)
            : buildMoodSearchQueries(chatMessages, (s) => MCQ_OPTIONS.has(s));
        if (moodQueries.length === 0) {
          const one = buildMoodSearchQuery(chatMessages, (s) =>
            MCQ_OPTIONS.has(s)
          );
          if (one.length > 3) moodQueries = [one];
        }

        if (moodQueries.length > 0) {
          catalogSearchQueries = moodQueries;
          carveDebugServer("api.chat.jiosaavn", {
            step: "JioSaavn lookup (mood / multi-query)",
            queries: moodQueries,
          });
          const songs = await multiSearchJioSaavn(moodQueries);
          poolSongs = capSongPool(songs);
          carveDebugServer("api.chat.jiosaavn.result", {
            verifiedSongCount: songs.length,
            poolSize: poolSongs.length,
            queryCount: moodQueries.length,
          });
        }
      }
    } else {
      carveDebugServer("api.chat.jiosaavn.skip", {
        reason: lastMsg ? "query too short or MCQ-style" : "no last message",
      });
    }

    if (poolSongs.length > 0) {
      carveDebugServer("api.chat.pool.tracks", {
        step: "JioSaavn pool (catalog order; indices 1..n are strict-pool pick targets)",
        ...poolSongsForDebugLog(poolSongs),
      });
    }

    const curatorIntent =
      [
        buildCuratorIntentSection(chatMessages),
        formatCatalogSearchPreamble({
          isArtistPath,
          artistName: isArtistPath ? resolvedArtistName : null,
          queries: catalogSearchQueries,
        }),
      ]
        .filter(Boolean)
        .join("\n") || null;
    carveDebugServer("api.chat.curatorIntent", {
      step: "Structured intent for system prompt",
      injected: Boolean(curatorIntent),
      chars: curatorIntent?.length ?? 0,
    });

    let aiResponse: Record<string, unknown>;

    if (poolSongs.length >= MIN_POOL_FOR_STRICT) {
      carveDebugServer("api.chat.gemini", {
        step: "Strict pool (index picks) → Gemini",
        poolSize: poolSongs.length,
      });
      const strictResult = await getChatResponseFromPool(
        chatMessages,
        poolSongs,
        curatorIntent,
        isArtistPath
      );
      if (strictResult && strictResult.type === "playlist" && strictResult.playlist) {
        aiResponse = strictResult;
        carveDebugServer("api.chat.mode", { selection: "strict_pool" });
      } else {
        carveDebugServer("api.chat.mode", {
          selection: "soft_fallback",
          reason: "strict_pool_unmapped",
        });
        const songContext =
          poolSongs.length > 0
            ? formatSongsForContext(poolSongs, isArtistPath, false)
            : undefined;
        aiResponse = await getChatResponse(
          chatMessages,
          songContext,
          curatorIntent
        );
      }
    } else {
      carveDebugServer("api.chat.gemini", {
        step: "Soft mode → Gemini (small or empty pool)",
        poolSize: poolSongs.length,
      });
      const songContext =
        poolSongs.length > 0
          ? formatSongsForContext(poolSongs, isArtistPath, false)
          : undefined;
      if (poolSongs.length > 0 && poolSongs.length < MIN_POOL_FOR_STRICT) {
        carveDebugServer("api.chat.mode", {
          selection: "soft_pool_small",
          poolSize: poolSongs.length,
        });
      } else {
        carveDebugServer("api.chat.mode", { selection: "soft_no_pool" });
      }
      aiResponse = await getChatResponse(
        chatMessages,
        songContext,
        curatorIntent
      );
    }

    const playlistPayload = aiResponse.playlist as
      | { name?: string; songs?: unknown[] }
      | undefined;
    const playlistSongs = playlistPayload?.songs;
    if (
      aiResponse.type === "playlist" &&
      Array.isArray(playlistSongs) &&
      playlistSongs.length > 0
    ) {
      carveDebugServer("api.chat.selection.tracks", {
        step: "Playlist returned to client (order = play order)",
        playlistName: playlistPayload?.name ?? null,
        ...playlistSongsForDebugLog(
          playlistSongs as {
            title: string;
            artist: string;
            year?: string;
            reason?: string;
          }[]
        ),
      });
    }

    carveDebugServer("api.chat.response", {
      step: "Returning JSON to client",
      type: aiResponse.type,
      hasPlaylist: Boolean(aiResponse.playlist),
      songCount: Array.isArray(playlistSongs) ? playlistSongs.length : 0,
    });

    flushLangfuseAfterResponse();
    return NextResponse.json(aiResponse);
  } catch (error) {
    console.error("Chat API error:", error);
    const isRateLimit =
      error instanceof Error &&
      (error.message.includes("429") || error.message.includes("RESOURCE_EXHAUSTED"));
    if (isRateLimit) {
      flushLangfuseAfterResponse();
      return NextResponse.json(
        {
          message:
            "I'm a bit overwhelmed right now — too many requests. Give me a minute and try again!",
          type: "text",
        },
        { status: 200 }
      );
    }
    flushLangfuseAfterResponse();
    return NextResponse.json(
      { error: "Failed to get AI response" },
      { status: 500 }
    );
  }
}
