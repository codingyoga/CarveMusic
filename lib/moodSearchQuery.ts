/**
 * Builds JioSaavn search queries from chat history. Scenario phrases (long drive, etc.)
 * map to vibe keywords — not passed through as literal title search terms.
 */

import {
  parseListeningStructuredIntent,
  structuredIntentSearchBoosts,
} from "@/lib/listeningStructuredIntent";

export function detectLanguage(
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

/**
 * English imperatives / emotional asks ("make me happy") describe desired *music mood*,
 * not a literal track title to keyword-search.
 */
const MOOD_IMPERATIVE_PATTERNS: { pattern: RegExp; vibes: string[] }[] = [
  {
    pattern:
      /\b(?:please\s+|just\s+)?make\s+me\s+happy(?:\s+songs?|\s+music|\s+tracks?)?\b/gi,
    vibes: ["upbeat", "cheerful", "feel good"],
  },
  {
    pattern:
      /\b(?:please\s+)?cheer\s+me\s+up(?:\s+with\s+music|\s+with\s+songs?)?\b/gi,
    vibes: ["upbeat", "uplifting", "feel good"],
  },
  {
    pattern:
      /\b(?:put|get)\s+me\s+in\s+a\s+(?:good|better|great)\s+mood\b/gi,
    vibes: ["upbeat", "happy", "hits"],
  },
  {
    pattern:
      /\b(?:i\s+)?(?:want|need)\s+(?:some\s+)?happy\s+(?:songs?|music|tracks?|vibes?)\b/gi,
    vibes: ["upbeat", "cheerful", "hits"],
  },
  {
    pattern:
      /\bsomething\s+happy\b|\bhappy\s+(?:songs?|music|vibes?|hits)\b|\bfeel\s+good\s+(?:songs?|music)\b/gi,
    vibes: ["upbeat", "cheerful"],
  },
  {
    pattern:
      /\bmake\s+me\s+feel\s+better\b|\bfeel\s+better\s+with\s+(?:music|songs?)\b/gi,
    vibes: ["uplifting", "comfort", "feel good"],
  },
  {
    pattern:
      /\bbrighten\s+my\s+day\b|\blift\s+my\s+(?:mood|spirits)\b/gi,
    vibes: ["upbeat", "uplifting", "feel good"],
  },
];

const SCENARIO_VIBE_PATTERNS: { pattern: RegExp; vibes: string[] }[] = [
  {
    pattern: /long\s*drive|longdrive|road\s*trip|open\s*road|highway|cruise\b/gi,
    vibes: ["upbeat", "filmy", "dance", "energetic"],
  },
  {
    pattern: /rainy|monsoon|drizzle|chai\s+on|balcony/gi,
    vibes: ["melody", "romantic", "soft", "acoustic"],
  },
  {
    pattern: /late\s*night|3\s*am|insomnia|sleepless/gi,
    vibes: ["slow", "melancholy", "soulful"],
  },
  {
    pattern: /workout|gym|run\b|running/gi,
    vibes: ["high energy", "dance", "beats"],
  },
  {
    pattern: /party|celebrat|wedding\s*dance|sangeet/gi,
    vibes: ["dance", "party", "hits"],
  },
];

/**
 * True when a string looks like a scenario fragment (e.g. "longdrive") mistaken for an artist name.
 * Used so "longdrive kannada songs" does not trigger JioSaavn artist search for "longdrive".
 */
export function isScenarioOnlyArtistFalsePositive(candidate: string): boolean {
  const cleaned = candidate.replace(/\s+/g, " ").trim().toLowerCase();
  if (cleaned.length < 2) return false;
  const { vibes, stripped } = expandScenarioVibes(cleaned);
  if (vibes.length === 0) return false;
  const residual = stripped
    .replace(
      /\b(kannada|hindi|tamil|telugu|english|songs?|hits?|tracks?|playlist|music|some|for|the|a|an|my|me|and|or)\b/gi,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
  return residual.length <= 2;
}

/** Words that describe tempo/mood/sound — not artist names when combined with each other or a language. */
const MOOD_DESCRIPTOR_TOKENS = new Set([
  "slow",
  "fast",
  "chill",
  "chilling",
  "calm",
  "calming",
  "nostalgic",
  "nostalgia",
  "retro",
  "throwback",
  "pop",
  "love",
  "romance",
  "soft",
  "acoustic",
  "mellow",
  "gentle",
  "quiet",
  "loud",
  "upbeat",
  "energetic",
  "sad",
  "happy",
  "melancholy",
  "melancholic",
  "soulful",
  "peaceful",
  "soothing",
  "romantic",
  "emotional",
  "uplifting",
  "dark",
  "light",
  "instrumental",
  "powerful",
  "intense",
  "relaxing",
  "vibe",
  "evening",
  "morning",
  "afternoon",
  "night",
  "late",
  "feel",
  "good",
  "slice",
  "life",
]);

const LANGUAGE_TOKENS = new Set([
  "kannada",
  "hindi",
  "tamil",
  "telugu",
  "english",
]);

const ERA_FILLER_TOKENS = new Set([
  "some",
  "any",
  "the",
  "a",
  "an",
  "few",
  "little",
  "more",
  "best",
  "top",
  "old",
  "classic",
  "golden",
  "vintage",
  "from",
  "like",
  "similar",
  "mid",
  "early",
  "late",
  "around",
  "circa",
  "during",
  "through",
  "thru",
]);

function isDecadeToken(t: string): boolean {
  return (
    /^(19|20)\d{2}s?$/i.test(t) ||
    /^([6-9]0|00|10|20)s$/i.test(t)
  );
}

/**
 * True when the capture is era-focused (e.g. "90s", "90s kannada", "mid 90s hits")
 * and must not be sent as an artist name to JioSaavn.
 * False for "madonna 90s" (artist + era).
 */
export function isLikelyEraOrDecadeNotArtist(candidate: string): boolean {
  const c = candidate.replace(/'/g, "").replace(/\s+/g, " ").trim().toLowerCase();
  if (
    !/\b((?:19|20)\d{2}s?|(?:[6-9]0|00|10|20)s)\b/i.test(c)
  ) {
    return false;
  }
  const tokens = c.split(/\s+/).filter(Boolean);
  const nonDecade = tokens.filter((t) => !isDecadeToken(t));
  if (nonDecade.length === 0) return true;
  return nonDecade.every(
    (t) =>
      LANGUAGE_TOKENS.has(t) ||
      ERA_FILLER_TOKENS.has(t) ||
      MOOD_DESCRIPTOR_TOKENS.has(t) ||
      t.length <= 2
  );
}

/**
 * Decade tokens for JioSaavn queries (short + long forms when useful).
 * e.g. "90s kannada" → ["90s", "1990s"]
 */
export function parseDecadeHintsForSearch(text: string): string[] {
  const raw = text.replace(/'/g, "").toLowerCase();
  const out = new Set<string>();
  for (const m of raw.matchAll(/\b(19|20)(\d{2})s\b/g)) {
    out.add(`${m[1]}${m[2]}s`);
  }
  for (const m of raw.matchAll(/\b([6-9]0)s\b/g)) {
    out.add(m[0]);
    out.add(`19${m[1]}s`);
  }
  if (/\b00s\b/.test(raw)) {
    out.add("00s");
    out.add("2000s");
  }
  for (const m of raw.matchAll(/\b(10|20)s\b/g)) {
    out.add(m[0]);
    out.add(`20${m[1]}s`);
  }
  return [...out];
}

/**
 * One curator bullet when decades appear in the user message.
 */
export function formatDecadeHintsForCurator(text: string): string | null {
  const hints = parseDecadeHintsForSearch(text);
  if (hints.length === 0) return null;
  const readable = [...new Set(hints)].join(", ");
  return `- **Era / decade:** User asked for ${readable}. Prefer tracks whose release year or film era matches when the catalog shows it; decades are approximate.`;
}

/**
 * True when the extracted "artist" string is really a mood/vibe phrase
 * (e.g. "slow kannada acoustic" → after stripping → "slow acoustic").
 */
export function isLikelyMoodDescriptorNotArtist(candidate: string): boolean {
  const cleaned = candidate.replace(/\s+/g, " ").trim().toLowerCase();
  if (cleaned.length < 2) return false;
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  const descCount = tokens.filter((t) => MOOD_DESCRIPTOR_TOKENS.has(t)).length;
  const langCount = tokens.filter((t) => LANGUAGE_TOKENS.has(t)).length;
  if (tokens.length === 1 && MOOD_DESCRIPTOR_TOKENS.has(tokens[0]!)) return true;
  if (descCount >= 2) return true;
  if (langCount >= 1 && descCount >= 1) return true;
  return false;
}

export function expandScenarioVibes(text: string): { vibes: string[]; stripped: string } {
  let s = text;
  const vibes: string[] = [];
  for (const { pattern, vibes: v } of SCENARIO_VIBE_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(s)) {
      pattern.lastIndex = 0;
      vibes.push(...v);
      s = s.replace(pattern, " ");
    }
  }
  return {
    vibes: [...new Set(vibes)],
    stripped: s.replace(/\s+/g, " ").trim(),
  };
}

export function expandMoodImperativeVibes(text: string): {
  vibes: string[];
  stripped: string;
} {
  let s = text;
  const vibes: string[] = [];
  for (const { pattern, vibes: v } of MOOD_IMPERATIVE_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(s)) {
      pattern.lastIndex = 0;
      vibes.push(...v);
      s = s.replace(pattern, " ");
    }
  }
  return {
    vibes: [...new Set(vibes)],
    stripped: s.replace(/\s+/g, " ").trim(),
  };
}

export function buildMoodSearchQuery(
  messages: { role: string; content: string }[],
  isMcqOption: (s: string) => boolean
): string {
  const userMessages = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content.toLowerCase());

  const keywords: string[] = [];
  const lang = detectLanguage(messages);
  if (lang) keywords.push(lang);

  const lastUser = userMessages[userMessages.length - 1] || "";
  let cleanedLast = lastUser
    .replace(/\[remove\]/i, "")
    .replace(/^(give me|play|i want|suggest|find)\s+/i, "")
    .trim();

  const { vibes: scenarioVibes, stripped: scenarioStripped } =
    expandScenarioVibes(cleanedLast);
  const { vibes: imperativeVibes, stripped: imperativeStripped } =
    expandMoodImperativeVibes(scenarioStripped);
  keywords.push(...scenarioVibes, ...imperativeVibes);

  cleanedLast = imperativeStripped
    .replace(/\b(songs?|tracks?|playlist|music|some|give|need|want)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (cleanedLast.length > 2 && !isMcqOption(cleanedLast)) {
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

  return [...new Set(keywords.map((k) => k.trim()).filter(Boolean))].join(" ").trim();
}

/**
 * Several JioSaavn queries merged + deduped for broader, higher-quality pools.
 */
export function buildMoodSearchQueries(
  messages: { role: string; content: string }[],
  isMcqOption: (s: string) => boolean
): string[] {
  const primary = buildMoodSearchQuery(messages, isMcqOption);
  const lang = detectLanguage(messages);
  const lastUserRaw =
    [...messages].reverse().find((m) => m.role === "user")?.content?.trim() ??
    "";
  const lastUser = lastUserRaw.toLowerCase();
  const scen = expandScenarioVibes(lastUser);
  const imp = expandMoodImperativeVibes(scen.stripped);
  const vibes = [...new Set([...scen.vibes, ...imp.vibes])];
  const structured = parseListeningStructuredIntent(lastUserRaw);
  const boosts = structuredIntentSearchBoosts(lang, structured);
  const skipFilmyHits =
    (structured.contrastMoodVsMusic &&
      structured.musicTargetEnergy === "low") ||
    (structured.introspective && structured.musicTargetEnergy !== "high");
  const decades = parseDecadeHintsForSearch(lastUserRaw);

  const q = new Set<string>();
  for (const b of boosts) q.add(b);
  if (lang && decades.length > 0) {
    const uniqueDecades = [...new Set(decades)];
    for (const d of uniqueDecades.slice(0, 4)) {
      q.add(`${lang} ${d} songs`);
    }
  }
  if (primary.length > 3) q.add(primary);
  if (lang) {
    if (!skipFilmyHits) {
      q.add(`${lang} film songs filmy hits`);
    }
    q.add(`${lang} popular melody songs`);
    if (vibes.length > 0) {
      q.add([lang, ...vibes.slice(0, 3)].join(" "));
    }
    if (primary.length > 3) {
      q.add(`${lang} romantic songs`);
    }
  }
  if (q.size === 0 && primary.length > 3) q.add(primary);
  return [...q].filter((s) => s.trim().length > 3).slice(0, 8);
}
