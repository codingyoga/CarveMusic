import {
  detectLanguage,
  expandScenarioVibes,
  formatDecadeHintsForCurator,
} from "@/lib/moodSearchQuery";
import {
  formatStructuredListeningForCurator,
  parseListeningStructuredIntent,
} from "@/lib/listeningStructuredIntent";

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
  const { vibes, stripped } = expandScenarioVibes(text.toLowerCase());
  const compact = stripped.replace(/\s+/g, " ").trim();

  if (!lang && vibes.length === 0 && text.length < 20) return null;

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
  }

  const decadeLine = formatDecadeHintsForCurator(text);
  if (decadeLine) {
    lines.push(decadeLine);
  }

  if (vibes.length) {
    lines.push(
      `- **Musical direction (from their situation, not literal title search):** ${vibes.join(", ")} — translate into tempo, energy, orchestration, and singalong feel using real songs from the target catalog.`
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
