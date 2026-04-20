import {
  detectLanguage,
  expandMoodImperativeVibes,
  expandScenarioVibes,
  formatDecadeHintsForCurator,
} from "@/lib/moodSearchQuery";
import {
  formatStructuredListeningForCurator,
  parseListeningStructuredIntent,
} from "@/lib/listeningStructuredIntent";

function assistantAlreadyAskedLanguageRecently(
  messages: { role: string; content: string }[]
): boolean {
  const recentAssistant = [...messages]
    .filter((m) => m.role === "assistant")
    .slice(-3);
  return recentAssistant.some((m) =>
    /\b(which\s+language|what\s+language|kannada[^\n]{0,40}hindi|pick\s+(?:a\s+)?language)\b/i.test(
      m.content
    )
  );
}

/**
 * Shown to Gemini after JioSaavn so the assistant can briefly acknowledge the lookup.
 */
export function formatCatalogSearchPreamble(opts: {
  isArtistPath: boolean;
  artistName: string | null;
  queries: string[];
}): string | null {
  if (!opts.queries.length) return null;

  if (opts.isArtistPath) {
    const who = opts.artistName?.trim() || "the artist they named";
    return `\n\n═══════════════════════════════════════
CATALOG SEARCH (already completed)
═══════════════════════════════════════
The server already ran a music-catalog lookup focused on: ${who}.
In your JSON "message" opening, include one short natural phrase that you searched the catalog for them (paraphrase; never read out raw API query strings).`;
  }

  return `\n\n═══════════════════════════════════════
CATALOG SEARCH (already completed)
═══════════════════════════════════════
The server already ran a music-catalog lookup using mood/style queries derived from their message (their words are not treated as an exact song title).
In your JSON "message" opening, include one short natural phrase that you searched for tracks that fit the vibe they described (paraphrase; never read out raw API query strings).`;
}

/**
 * Structured intent injected into the system prompt so the model curates by
 * situation + language + musical vibe instead of treating user text as title keywords.
 */
export function buildCuratorIntentSection(
  messages: { role: string; content: string }[]
): string | null {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const text = lastUser?.content?.trim();
  if (!text) return null;

  const lang = detectLanguage(messages);
  const lower = text.toLowerCase();
  const { vibes: scenarioVibes, stripped: scenarioStripped } =
    expandScenarioVibes(lower);
  const { vibes: imperativeVibes, stripped: strippedAfterImperative } =
    expandMoodImperativeVibes(scenarioStripped);
  const allVibes = [...new Set([...scenarioVibes, ...imperativeVibes])];
  const compact = strippedAfterImperative.replace(/\s+/g, " ").trim();

  if (!lang && allVibes.length === 0 && text.length < 20) return null;

  const lines: string[] = [
    "",
    "═══════════════════════════════════════",
    "CURATOR INTENT (derived from the latest user message)",
    "═══════════════════════════════════════",
    "Curate using this block. The user's words describe situation, mood, and language — not a list of words to match in song titles.",
    "- Prefer culturally authentic tracks from the right industry over clever English title overlap with their message.",
  ];

  if (lang) {
    lines.push(
      `- **Primary language / industry:** ${lang}. Each playlist track should genuinely fit this tradition unless they explicitly asked to mix languages.`
    );
  } else {
    lines.push(
      `- **Language:** not clearly pinned in this thread yet. Prefer curating from the catalog results without a scripted interrogation. If you truly need a language/industry choice, ask ONE short conversational question and vary your wording from earlier turns — or offer a tasteful mix without asking.`
    );
    if (assistantAlreadyAskedLanguageRecently(messages)) {
      lines.push(
        `- **Do not repeat** another language-preference question unless they just answered it; infer from context or lean on the catalog pool you were given.`
      );
    }
  }

  const decadeLine = formatDecadeHintsForCurator(text);
  if (decadeLine) {
    lines.push(decadeLine);
  }

  if (imperativeVibes.length > 0) {
    lines.push(
      `- **Imperative / emotional phrasing** (e.g. wanting to feel happier) is a **mood goal** — do NOT bias toward tracks whose titles literally echo that English sentence.`
    );
  }

  if (allVibes.length) {
    lines.push(
      `- **Musical direction (from their situation, not literal title search):** ${allVibes.join(", ")} — translate into tempo, energy, orchestration, and singalong feel using real songs from the target catalog.`
    );
    lines.push(
      `- Scenario English (drive, road, rain, gym, party, etc.) defines **vibe only**; do not overweight tracks just because those syllables appear in a title.`
    );
  }

  if (compact.length > 2 && compact.length <= 220) {
    lines.push(`- **Remaining topical hints** (after stripping generic scenario phrasing): "${compact}"`);
  }

  const structured = formatStructuredListeningForCurator(
    parseListeningStructuredIntent(text)
  );
  if (structured) {
    lines.push(structured);
  }

  return lines.join("\n");
}
