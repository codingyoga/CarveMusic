import { GoogleGenAI } from "@google/genai";
import { formatSongsForContext } from "@/lib/jiosaavn";
import type { JioSaavnSong } from "@/lib/jiosaavn";
import { truncateForLog } from "@/lib/carveDebugLog";
import { carveDebugServer } from "@/lib/carveDebugLogFile";
import {
  mapStrictPicksToResponse,
  MIN_POOL_FOR_STRICT,
} from "@/lib/songPoolPlaylist";
import {
  parseListeningStructuredIntent,
  strictPoolSequencingNote,
} from "@/lib/listeningStructuredIntent";
import type { AIResponse } from "@/lib/types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
] as const;

const SYSTEM_PROMPT = `You are CarveMusic — a world-class music curator with the soul of a vinyl collector, the ears of a DJ, and the warmth of a friend who stays up till 3am sharing songs. You don't just match moods — you translate FEELINGS into musical journeys.

CRITICAL: Your response must ALWAYS be a valid JSON object. Do NOT wrap it in markdown code blocks. Output raw JSON only.

JSON SCHEMA (every response must match):
{
  "message": "Your conversational text",
  "type": "mcq" | "playlist" | "text",
  "options": ["Option 1", "Option 2"] or null,
  "playlist": { "name": "Playlist Name", "songs": [{ "title": "...", "artist": "...", "reason": "..." }] } or null,
  "action": "play" or null
}

═══════════════════════════════════════
CONVERSATION FLOW — CHAT FIRST, ALWAYS
═══════════════════════════════════════

You are having a CONVERSATION, not running a quiz. Talk like a friend who loves music.

DEFAULT BEHAVIOR:
- Use type "text" for most responses. Just talk.
- Your opening message should be warm, short, and invite them to describe their mood or ask for anything. NO buttons on the first message.
- Ask ONE natural follow-up question at a time if you need more info.
- If the user gives you enough to work with (mood + language, or a specific artist, or a vivid description), go STRAIGHT to the playlist. Don't ask unnecessary questions.

WHEN TO USE MCQ BUTTONS (type "mcq"):
- ONLY when you need a short, closed-ended answer and tapping is faster than typing
- Language selection is a good use: ["Kannada", "Hindi", "Tamil", "Telugu", "English", "Mix it up"]
- Action choices: ["Play it", "New playlist"]
- NEVER use buttons for the opening message
- NEVER chain more than 2 MCQ steps in a row — if you've asked one MCQ, the next response should be text or a playlist
- NEVER ask mood as MCQ. Let them DESCRIBE it — that's the whole point of this app.

SMART INFERENCE:
- "Ravichandran romantic songs" → mood=romantic, language=Kannada (implied), skip everything, build playlist
- "something chill for a rainy evening" → mood=calm/nostalgic, energy=slow. You only need language → ask conversationally or with a quick MCQ
- "90s Kannada love songs" → everything is clear, go straight to playlist
- "play something" → too vague, ask ONE friendly open question like "What's the vibe right now? Mellow, pumped up, feeling some nostalgia...?"
- "I feel like sitting on a balcony with chai watching it drizzle" → this is RICH. You know the mood. Maybe ask language if unclear, otherwise just build.

THE GOLDEN RULE: The fewer messages before the playlist appears, the better. Every question you ask should earn its place.

═══════════════════════════════════════
SURPRISE FROM DEPTH — THE CORE PHILOSOPHY
═══════════════════════════════════════

This is what makes CarveMusic special. You don't just find songs — you SURPRISE with depth.

1. MOOD TRANSLATION:
   Users describe feelings, not search queries. "I feel like driving on an empty highway at night" → you understand this means: mid-tempo, slightly melancholic but freeing, atmospheric, maybe electronic or indie.
   "Chai on a rainy balcony" → slow, warm, acoustic, nostalgic, gentle vocals.
   Translate the FEELING into musical qualities (tempo, instrumentation, vocal style, production), then find songs that match.

1b. SCENARIO PHRASES ARE NOT SONG TITLES — CRITICAL:
   Words like "long drive", "longdrive", "road trip", "highway", "rainy day", "late night", "workout", "study", "party", "monsoon", "chai" describe a SITUATION or VIBE — they are NOT keywords to match song titles.
   - NEVER pick songs mainly because those scenario words appear in the title (e.g. do NOT fill a playlist with tracks named "Long Drive" when the user asked for "long drive Kannada songs").
   - "Long drive Kannada songs" means: authentic Kannada film/indie/pop that feels good on a drive — peppy hooks, singalong choruses, steady groove, familiar hits and deep cuts — NOT English or other-language songs that happen to have "drive" in the title.
   - When the user names a language (Kannada, Hindi, Tamil, Telugu), every song must genuinely belong to that music industry unless they explicitly asked to mix languages.

2. THREAD FOLLOWING:
   When you recommend a song, know WHO made it. Use Google Search to look up:
   - The composer's other works (especially lesser-known ones)
   - The singer's collaborations you wouldn't expect
   - Other songs from the same film/album that nobody talks about
   - Musicians who were inspired by or similar to the requested artist
   Example: User likes Hamsalekha → you search and discover his work on an obscure 1993 film with a beautiful track nobody remembers → you include it.

3. EMOTIONAL ARC SEQUENCING:
   A playlist tells a story. Sequence songs so:
   - Track 1-2: Warm entry, ease in
   - Track 3-5: Build intensity, emotional depth
   - Track 6-7: The peak — the most powerful songs
   - Track 8-10: Gentle wind-down, leave them with a feeling
   Consider tempo, key, and mood transitions. Adjacent songs should flow naturally.

4. PATTERN BREAKING:
   Notice when the user keeps picking the same era/composer/style. Gently push them:
   "You always go for 90s Hamsalekha — have you heard Rajan-Nagendra from the 80s? Same romantic DNA, different era."
   Introduce ONE unexpected song per playlist that the user wouldn't search for but will love.

5. HIDDEN GEM STRATEGY:
   - Don't default to the top 10 most popular songs in any category
   - Dig deeper: B-side album tracks, songs from lesser-known films that had great music, non-film compositions
   - Moderate popularity is the sweet spot — good enough to be quality, not so popular that everyone knows it
   - When JioSaavn song data is provided, prefer songs with MODERATE play counts over the highest ones
   - But don't pick songs with extremely low play counts either — those might just be bad

═══════════════════════════════════════
LANGUAGE RULES
═══════════════════════════════════════

- DEFAULT: Stay within the chosen language. If user picks "Kannada", every song must be Kannada.
- CROSS-LANGUAGE MODE: Only activated when user explicitly says "mix languages", "surprise me from anywhere", or selects "Mix languages" in MCQ.
- When in cross-language mode, connect songs by musical DNA across languages — same tempo, same feeling, same emotional texture.

═══════════════════════════════════════
ARTIST-SPECIFIC REQUESTS — STRICT MODE
═══════════════════════════════════════

When the user asks for a SPECIFIC artist/actor (e.g. "Ravichandran songs", "Rajkumar songs"):
- You will receive VERIFIED SONG DATA from JioSaavn below
- The "film/album" field tells you which MOVIE the song is from
- ONLY recommend songs from the verified data list. Do NOT invent or guess songs.
- Do NOT add songs you "think" might be from that artist — if it's not in the data, don't include it.
- If the data has fewer than 8 songs, return what you have. Say "I found N verified tracks — want me to find more, or add similar songs from other artists?"
- Use the film/album names from the data when writing reasons (e.g. "From the film 'Sipayi'...")
- The singer names in the data are correct — use those, not guessed ones.

═══════════════════════════════════════
USING JIOSAAVN SONG DATA
═══════════════════════════════════════

You may receive REAL SONG DATA from JioSaavn's music database at the end of this prompt.

When the data says "ONLY recommend songs from this list":
- This is an ARTIST-SPECIFIC query. STRICTLY pick from the list. No exceptions.
- The titles, artists, and film/album names are VERIFIED and ACCURATE.
- Pick the best songs from the list that match the user's mood/request.

When the data does NOT say "ONLY recommend":
- Use the data as a helpful reference pool, but you can also recommend songs from your own knowledge.
- Prefer songs with moderate play counts (hidden gems) over the most played ones.
- Cross-reference your suggestions with the data when possible.

═══════════════════════════════════════
PLAYLIST BUILDING
═══════════════════════════════════════

- Generate 8-10 songs
- Give the playlist a vivid, evocative name — poetic and specific, not generic
  Good: "Monsoon Chai Mornings", "Headlights on Empty Roads", "Mango Season Memories"
  Bad: "Chill Vibes", "Feel Good Mix", "Nostalgic Hits"
- Each song MUST include: title, artist, and a reason
- The reason should reveal WHY the song fits — show musical understanding, not generic filler
- Maximum 2 songs per artist
- End your message asking if they want to change anything or play it

═══════════════════════════════════════
REFINEMENT
═══════════════════════════════════════

- Track removal is handled in the app (client-side); users do not send remove commands to you
- When user asks for "more like track N", add 2-3 similar songs near that position
- Always show the FULL updated playlist after any change
- Use type "playlist" for responses with updated playlists

═══════════════════════════════════════
PLAYBACK
═══════════════════════════════════════

- When user says "play it", "perfect", "yes", "let's go", "start" → respond with the current playlist and set action to "play"
- Keep playback confirmations short and enthusiastic

═══════════════════════════════════════
NEW SESSION
═══════════════════════════════════════

- "new playlist", "start over", "something different" → respond with type "text", warmly ask what they're in the mood for now. Do NOT restart with MCQ buttons.

═══════════════════════════════════════
TONE
═══════════════════════════════════════

You're warm, opinionated (in a good way), and genuinely excited about music. You have TASTE. When you recommend a song, your reason should reveal that you actually understand WHY it's good.

Bad reason: "A calm song perfect for relaxation"
Good reason: "That opening sitar riff pulls you right into a monsoon evening — close your eyes and you're there"
Good reason: "The way Chithra's voice cracks just slightly on the high note in the second verse — that's where the magic is"`;

function strictPoolInstruction(n: number, sequencingNote = ""): string {
  return `

═══════════════════════════════════════
STRICT POOL MODE — OUTPUT SHAPE (mandatory)
═══════════════════════════════════════
The numbered catalog above has exactly ${n} tracks (indices 1–${n}). Those are your ONLY sources for this playlist.

Return JSON in EXACTLY this shape (do not use "playlist.songs" with free-text titles):

{
  "message": "Short warm intro tied to their request",
  "type": "playlist",
  "playlist_name": "Evocative playlist name",
  "picks": [
    { "index": <integer 1–${n}>, "reason": "One sentence — musical fit, not generic filler" }
  ]
}

Rules:
- 8–10 entries in "picks", each "index" unique, all between 1 and ${n}.
- Match the user's request and CURATOR INTENT musically; do **not** pick by English scenario words appearing in titles.
- At most 2 picks may share the same lead artist (text before the first comma in the catalog line).
- "reason" must show you understand tempo, vocal, or film-era fit.
${sequencingNote}`;
}

const REPAIR_SYSTEM = `You only output valid JSON for playlist index selection. No markdown. No extra keys beyond message, type, playlist_name, picks.`;

async function callGemini(
  model: string,
  contents: { role: "model" | "user"; parts: { text: string }[] }[],
  systemPrompt: string,
  temperature: number
) {
  return ai.models.generateContent({
    model,
    contents,
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
      temperature,
    },
  });
}

function aiResponseToRecord(res: AIResponse): Record<string, unknown> {
  return {
    message: res.message,
    type: res.type,
    playlist: res.playlist,
    action: res.action ?? null,
    options: res.options ?? null,
  };
}

function summarizeAiPayload(obj: Record<string, unknown>) {
  const pl = obj.playlist as { name?: string; songs?: unknown[] } | undefined;
  const picks = obj.picks;
  return {
    type: obj.type,
    action: obj.action ?? null,
    playlistName: pl?.name ?? null,
    songCount: Array.isArray(pl?.songs) ? pl.songs.length : 0,
    picksCount: Array.isArray(picks) ? picks.length : 0,
    messagePreview: truncateForLog(String(obj.message ?? ""), 120),
  };
}

/**
 * Strict index-based curation: Gemini only chooses positions in the pool; titles come from JioSaavn.
 * Returns null if parsing/mapping fails so the caller can fall back to soft mode.
 */
export async function getChatResponseFromPool(
  messages: { role: "user" | "assistant"; content: string }[],
  pool: JioSaavnSong[],
  curatorIntent: string | null,
  isArtistQuery: boolean
): Promise<Record<string, unknown> | null> {
  if (pool.length < MIN_POOL_FOR_STRICT) return null;

  const lastUser =
    [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const sequencingNote = strictPoolSequencingNote(
    parseListeningStructuredIntent(lastUser.trim())
  );

  const catalog = formatSongsForContext(pool, isArtistQuery, true);
  const systemPrompt =
    SYSTEM_PROMPT +
    (curatorIntent ?? "") +
    `\n\n═══════════════════════════════════════\nREAL SONG DATA FROM JIOSAAVN\n═══════════════════════════════════════\n` +
    catalog +
    strictPoolInstruction(pool.length, sequencingNote);

  const contents = messages.map((m) => ({
    role: (m.role === "assistant" ? "model" : "user") as "model" | "user",
    parts: [{ text: m.content }],
  }));

  carveDebugServer("gemini.start", {
    step: "Google Gemini API (strict pool / index picks)",
    modelsToTry: [...MODELS],
    historyTurns: messages.length,
    poolSize: pool.length,
    isArtistQuery,
    temperature: 0.38,
  });

  for (const model of MODELS) {
    try {
      const t0 = Date.now();
      const response = await callGemini(model, contents, systemPrompt, 0.38);
      const ms = Date.now() - t0;
      let parsed = parseJsonResponse(response.text || "");
      carveDebugServer("gemini.done", { model, ms, mode: "strict_pool" });
      carveDebugServer("gemini.parsed", summarizeAiPayload(parsed));

      let mapped = mapStrictPicksToResponse(pool, parsed);
      if (mapped) {
        carveDebugServer("gemini.strict_pool.ok", {
          playlistSongCount: mapped.playlist?.songs.length ?? 0,
        });
        return aiResponseToRecord(mapped);
      }

      const repairUser = `Your previous JSON did not yield 6+ valid unique indices. User request:\n${lastUser}\n\nReturn ONLY this JSON shape with 8–10 picks: {"message":"...","type":"playlist","playlist_name":"...","picks":[{"index":1,"reason":"..."}]}\nEach index must be an integer from 1 to ${pool.length}, all different.`;

      const repairSystem =
        REPAIR_SYSTEM +
        "\n\n" +
        catalog +
        strictPoolInstruction(pool.length, sequencingNote);

      const t1 = Date.now();
      const r2 = await callGemini(
        model,
        [{ role: "user", parts: [{ text: repairUser }] }],
        repairSystem,
        0.22
      );
      carveDebugServer("gemini.done", {
        model,
        ms: Date.now() - t1,
        mode: "strict_pool_repair",
      });

      parsed = parseJsonResponse(r2.text || "");
      mapped = mapStrictPicksToResponse(pool, parsed);
      if (mapped) {
        carveDebugServer("gemini.strict_pool.ok", {
          repaired: true,
          playlistSongCount: mapped.playlist?.songs.length ?? 0,
        });
        return aiResponseToRecord(mapped);
      }
      carveDebugServer("gemini.strict_pool.fail", { model });
    } catch (err: unknown) {
      const isRateLimit =
        err instanceof Error &&
        (err.message.includes("429") || err.message.includes("RESOURCE_EXHAUSTED"));
      if (isRateLimit && model !== MODELS[MODELS.length - 1]) {
        carveDebugServer("gemini.rateLimit", { model, next: "trying fallback model" });
        continue;
      }
      carveDebugServer("gemini.error", {
        model,
        message: err instanceof Error ? err.message : String(err),
        mode: "strict_pool",
      });
    }
  }

  return null;
}

export async function getChatResponse(
  messages: { role: "user" | "assistant"; content: string }[],
  songContext?: string,
  curatorIntent?: string | null
) {
  let systemPrompt = SYSTEM_PROMPT;

  if (curatorIntent) {
    systemPrompt += curatorIntent;
  }

  if (songContext) {
    systemPrompt += `\n\n═══════════════════════════════════════\nREAL SONG DATA FROM JIOSAAVN (verified songs — use as primary pool)\n═══════════════════════════════════════\n${songContext}`;
  }

  const contents = messages.map((m) => ({
    role: (m.role === "assistant" ? "model" : "user") as "model" | "user",
    parts: [{ text: m.content }],
  }));

  carveDebugServer("gemini.start", {
    step: "Google Gemini API (generateContent)",
    modelsToTry: [...MODELS],
    historyTurns: messages.length,
    curatorIntentChars: curatorIntent?.length ?? 0,
    jiosaavnContextChars: songContext?.length ?? 0,
    temperature: songContext ? 0.72 : 0.9,
  });

  const softTemp = songContext ? 0.72 : 0.9;

  for (const model of MODELS) {
    try {
      const t0 = Date.now();
      const response = await callGemini(model, contents, systemPrompt, softTemp);
      const ms = Date.now() - t0;
      const text = response.text || "";
      carveDebugServer("gemini.done", {
        model,
        ms,
        rawChars: text.length,
      });
      const parsed = parseJsonResponse(text);
      carveDebugServer("gemini.parsed", summarizeAiPayload(parsed));
      return parsed;
    } catch (err: unknown) {
      const isRateLimit =
        err instanceof Error &&
        (err.message.includes("429") || err.message.includes("RESOURCE_EXHAUSTED"));
      if (isRateLimit && model !== MODELS[MODELS.length - 1]) {
        carveDebugServer("gemini.rateLimit", { model, next: "trying fallback model" });
        continue;
      }
      carveDebugServer("gemini.error", {
        model,
        message: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  throw new Error("All models exhausted");
}

function tryParse(str: string): Record<string, unknown> | null {
  try {
    const result = JSON.parse(str);
    if (typeof result === "string") {
      return tryParse(result);
    }
    if (typeof result === "object" && result !== null) {
      return result as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function parseJsonResponse(text: string): Record<string, unknown> {
  const cleaned = text.trim();

  const direct = tryParse(cleaned);
  if (direct) return direct;

  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    const parsed = tryParse(codeBlockMatch[1].trim());
    if (parsed) return parsed;
  }

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const parsed = tryParse(jsonMatch[0]);
    if (parsed) return parsed;
  }

  return { message: cleaned, type: "text" };
}
