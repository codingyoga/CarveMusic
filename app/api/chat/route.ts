import { NextRequest, NextResponse } from "next/server";
import { getChatResponse } from "@/lib/ai";
import {
  searchJioSaavn,
  multiSearchJioSaavn,
  formatSongsForContext,
} from "@/lib/jiosaavn";

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
      if (name.length > 2) return name;
    }
  }
  return null;
}

function detectLanguage(
  messages: { role: string; content: string }[]
): string | null {
  const languages = ["kannada", "hindi", "tamil", "telugu", "english"];
  for (const m of [...messages].reverse()) {
    const lower = m.content.toLowerCase();
    for (const lang of languages) {
      if (lower.includes(lang)) return lang;
    }
  }
  return null;
}

function buildMoodSearchQuery(
  messages: { role: string; content: string }[]
): string {
  const userMessages = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content.toLowerCase());

  const keywords: string[] = [];
  const lang = detectLanguage(messages);
  if (lang) keywords.push(lang);

  const lastUser = userMessages[userMessages.length - 1] || "";
  const cleanedLast = lastUser
    .replace(/\[remove\]/i, "")
    .replace(/^(give me|play|i want|suggest|find)\s+/i, "")
    .trim();

  if (cleanedLast.length > 3 && !MCQ_OPTIONS.has(cleanedLast)) {
    keywords.push(cleanedLast);
  }

  const moodMap: Record<string, string> = {
    happy: "upbeat cheerful",
    sad: "melancholy emotional",
    energetic: "upbeat dance",
    calm: "peaceful soothing",
    nostalgic: "classic old",
    angry: "intense powerful",
  };

  for (const msg of userMessages) {
    for (const [mood, searchTerms] of Object.entries(moodMap)) {
      if (msg === mood) {
        keywords.push(searchTerms);
        break;
      }
    }
  }

  return keywords.join(" ").trim();
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

    let songContext: string | undefined;

    const lastMsg = chatMessages[chatMessages.length - 1];
    if (lastMsg && shouldSearch(lastMsg.content)) {
      const artistName = extractArtistName(lastMsg.content);
      const lang = detectLanguage(chatMessages);

      if (artistName) {
        const queries = [
          artistName,
          lang ? `${artistName} ${lang}` : null,
          lang ? `${artistName} ${lang} songs` : `${artistName} songs`,
          lang ? `${artistName} ${lang} hits` : null,
        ].filter(Boolean) as string[];

        console.log(`Artist detected: "${artistName}", searching JioSaavn with:`, queries);

        const songs = await multiSearchJioSaavn(queries);
        if (songs.length > 0) {
          songContext = formatSongsForContext(songs, true);
          console.log(`Found ${songs.length} verified songs for "${artistName}"`);
        }
      } else {
        const query = buildMoodSearchQuery(chatMessages);
        if (query.length > 3) {
          const songs = await searchJioSaavn(query);
          if (songs.length > 0) {
            songContext = formatSongsForContext(songs, false);
          }
        }
      }
    }

    const aiResponse = await getChatResponse(chatMessages, songContext);

    return NextResponse.json(aiResponse);
  } catch (error) {
    console.error("Chat API error:", error);
    const isRateLimit =
      error instanceof Error &&
      (error.message.includes("429") || error.message.includes("RESOURCE_EXHAUSTED"));
    if (isRateLimit) {
      return NextResponse.json(
        {
          message:
            "I'm a bit overwhelmed right now — too many requests. Give me a minute and try again!",
          type: "text",
        },
        { status: 200 }
      );
    }
    return NextResponse.json(
      { error: "Failed to get AI response" },
      { status: 500 }
    );
  }
}
