import { GoogleGenAI } from "@google/genai";
import { truncateForLog } from "@/lib/carveDebugLog";
import { carveDebugServer } from "@/lib/carveDebugLogFile";

export type SearchLanguage = "kannada" | "hindi" | "tamil" | "telugu" | "english";

export type SearchIntent = {
  /** Whether the user is asking for a specific artist/person's songs. */
  isArtistRequest: boolean;
  /** If isArtistRequest, extracted name (no language/mood words). */
  artistName: string | null;
  /** Preferred language if specified. */
  language: SearchLanguage | null;
  /** Decade hint if present (e.g. 2020s, 2000s, 90s). */
  decade: string | null;
  /** Genres/regions/tags user asked for (e.g. pop, indie, rock). */
  genres: string[];
  /** Vibe/mood tags user asked for (e.g. nostalgic, chill). */
  vibes: string[];
};

// Use a model that is available broadly in Gemini API.
const MODEL = "gemini-2.5-flash";

function safeJsonParse(s: string): unknown | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function normalizeIntent(raw: unknown): SearchIntent | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const isArtistRequest = Boolean(o.isArtistRequest);
  const artistName =
    typeof o.artistName === "string" && o.artistName.trim()
      ? o.artistName.trim()
      : null;
  const language =
    typeof o.language === "string"
      ? (o.language.trim().toLowerCase() as SearchLanguage)
      : null;
  const decade =
    typeof o.decade === "string" && o.decade.trim() ? o.decade.trim() : null;

  const genres = Array.isArray(o.genres)
    ? o.genres
        .filter((x) => typeof x === "string")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 4)
    : [];
  const vibes = Array.isArray(o.vibes)
    ? o.vibes
        .filter((x) => typeof x === "string")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 6)
    : [];

  const langOk =
    !language ||
    language === "kannada" ||
    language === "hindi" ||
    language === "tamil" ||
    language === "telugu" ||
    language === "english";

  return {
    isArtistRequest,
    artistName: isArtistRequest ? artistName : null,
    language: langOk ? language : null,
    decade,
    genres,
    vibes,
  };
}

/**
 * Uses Gemini to parse the user's *search intent* before we query JioSaavn.
 * Goal: avoid naive keyword search bias (e.g. "pop" matching titles), and avoid
 * misclassifying mood words as artists.
 *
 * Hard-fails to null so callers can fall back to heuristic query builders.
 */
export async function inferSearchIntent(opts: {
  lastUserText: string;
  languageHint: SearchLanguage | null;
}): Promise<SearchIntent | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey?.trim()) return null;

  const ai = new GoogleGenAI({ apiKey });
  const systemInstruction = `You extract structured music search intent from a single user message.

Return ONLY valid JSON.

Schema:
{
  "isArtistRequest": boolean,
  "artistName": string | null,
  "language": "kannada"|"hindi"|"tamil"|"telugu"|"english"|null,
  "decade": string | null,            // examples: "2020s", "2000s", "90s"
  "genres": string[],                 // examples: ["pop"], ["indie pop"], ["rock"]
  "vibes": string[]                   // examples: ["nostalgic"], ["chill"]
}

Rules:
- If the user asks for an artist/person's songs (\"X songs\", \"songs by X\"), set isArtistRequest=true and artistName="X".
- Do NOT treat mood/genre words (nostalgic, love, pop, romantic, hits) as an artist name.
- Emotional imperatives are MOOD requests, not song titles: e.g. \"make me happy\", \"cheer me up\", \"something happy\", \"put me in a good mood\" → isArtistRequest=false and put vibes like [\"happy\",\"upbeat\",\"uplifting\",\"feel good\"] (pick a few). Do NOT leave vibes empty for these.
- If the user specifies a decade/era, populate decade.
- Use the languageHint if the user didn't specify language explicitly.`;

  const userText = `languageHint: ${opts.languageHint ?? "null"}
message: ${opts.lastUserText}`;

  try {
    const res = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts: [{ text: userText }] }],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        temperature: 0,
      },
    });

    const raw = safeJsonParse(res.text || "");
    const normalized = normalizeIntent(raw);
    carveDebugServer("api.chat.intent", {
      step: "Infer search intent (Gemini)",
      ok: Boolean(normalized),
      lastUserPreview: truncateForLog(opts.lastUserText, 120),
      intent: normalized,
    });
    return normalized;
  } catch (err) {
    carveDebugServer("api.chat.intent", {
      step: "Infer search intent (Gemini) failed",
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

