import type { SearchIntent, SearchLanguage } from "@/lib/searchIntent";
import {
  expandMoodImperativeVibes,
  parseDecadeHintsForSearch,
} from "@/lib/moodSearchQuery";

function normalizeDecade(d: string): string | null {
  const s = d.trim();
  if (!s) return null;
  if (/^(19|20)\d{2}s$/i.test(s)) return s;
  if (/^([6-9]0|00|10|20)s$/i.test(s)) return s;
  return null;
}

function withLang(lang: SearchLanguage | null, q: string): string {
  const s = q.trim();
  if (!s) return s;
  return lang ? `${lang} ${s}` : s;
}

/**
 * Deterministic query builder from structured intent.
 * This tries to reduce "keyword in title" bias by favoring "hits/top/chart"
 * language and by separating genre tokens from "songs" tokens.
 */
export function buildJioSaavnQueriesFromIntent(
  intent: SearchIntent,
  fallbackText: string
): string[] {
  const lang = intent.language;
  const imperative = expandMoodImperativeVibes(fallbackText);
  const decade =
    (intent.decade && normalizeDecade(intent.decade)) ||
    (parseDecadeHintsForSearch(fallbackText)[0] ?? null);

  const genres = intent.genres.map((g) => g.toLowerCase()).slice(0, 2);
  const vibes = [
    ...new Set([
      ...intent.vibes.map((v) => v.toLowerCase()),
      ...imperative.vibes.map((v) => v.toLowerCase()),
    ]),
  ].slice(0, 4);

  const q = new Set<string>();

  // Core "hits" style queries (works better than "pop songs" on many keyword engines).
  if (decade) {
    q.add(withLang(lang, `${decade} hits`));
    q.add(withLang(lang, `top songs ${decade}`));
    q.add(withLang(lang, `popular songs ${decade}`));
  }

  // Genre: keep "hits" around it to avoid pulling literal "Pop" titles.
  for (const g of genres) {
    if (decade) q.add(withLang(lang, `${g} hits ${decade}`));
    q.add(withLang(lang, `${g} hits`));
    q.add(withLang(lang, `${g} chart hits`));
  }

  // Vibes: only use as a modifier, not the entire query.
  for (const v of vibes) {
    if (decade) q.add(withLang(lang, `${v} hits ${decade}`));
    q.add(withLang(lang, `${v} songs`));
  }

  // Language-only fallbacks.
  if (lang) {
    q.add(`${lang} hits`);
    q.add(`${lang} popular songs`);
  }

  // Last resort: add the raw text with lang prefix, but keep it late.
  // Skip when the message is an emotional imperative (e.g. "make me happy") — that
  // becomes literal title search on catalogs, not mood retrieval.
  const cleanedFallback = fallbackText
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleanedFallback.length > 5 && imperative.vibes.length === 0) {
    q.add(withLang(lang, cleanedFallback));
  }

  return [...q].filter((s) => s.trim().length > 3).slice(0, 8);
}

