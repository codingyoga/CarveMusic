/**
 * Rule-based parsing of nuanced listening intent: mood vs music contrast,
 * introspective themes, and simple emotional arcs (e.g. sad → energetic).
 */

export type EnergyLevel = "low" | "mid" | "high";

export interface ListeningStructuredIntent {
  /** How energized the user says they *feel* (surface mood). */
  moodSurfaceEnergy: EnergyLevel | null;
  /** Tempo/energy they want in the *music*. */
  musicTargetEnergy: EnergyLevel | null;
  /** e.g. "very happy but want slow songs" */
  contrastMoodVsMusic: boolean;
  /** inward, reflective listening */
  introspective: boolean;
  themes: string[];
  arcOpening: EnergyLevel | null;
  arcClosing: EnergyLevel | null;
  hasArc: boolean;
}

const HIGH_MOOD =
  /\b(very\s+)?(happy|excited|great|amazing|energetic|pumped|hyped|elated|joyful|ecstatic)\b/i;
const LOW_MOOD =
  /\b(sad|depressed|down|heartbroken|lonely|melanchol|grief|cry|hurt|empty)\b/i;

const LOW_MUSIC =
  /\b(slow|chill|calm|soft|melody|melodies|ballad|acoustic|low[\s-]?key|mellow|gentle|quiet|peaceful|soothing)\b/i;
const HIGH_MUSIC =
  /\b(fast|upbeat|energetic|dance|pump|hype|party|banger|powerful|intense)\b/i;

const CONTRAST_CONNECTOR = /\b(but|however|yet|though|although|while)\b/i;

const WANT_LISTEN =
  /\b(want|wanna|need|like|prefer|listen|play|something|give\s+me)\b/i;

const INTROSPECTIVE =
  /\b(on\s+myself|by\s+myself|introspective|reflective|in\s+my\s+head|thinking|alone\s+with|just\s+me|my\s+own)\b/i;

const THEME_BREAKUP =
  /\b(break\s*up|breakup|heartbreak|split\s+up|ex\b|divorce|moved\s+on)\b/i;
const THEME_ROMANTIC = /\b(romantic|love\s+songs?|in\s+love)\b/i;

/** Arc: sad / low opening → happier / high closing */
const ARC_LOW_TO_HIGH =
  /\b(start|begin|open|first).{0,80}?(sad|slow|melanchol|low|down|breakup).{0,120}?(end|finish|later|then|after).{0,80}?(happy|energetic|upbeat|better|uplift|move\s+on|hope)/i;
const ARC_LOW_TO_HIGH_B =
  /\b(sad|melanchol|slow|breakup).{0,100}?\b(then|and\s+then|moving\s+to|finish\s+with).{0,80}?(happy|energetic|upbeat|dance|hope)/i;

function detectMusicTargetEnergy(t: string): EnergyLevel | null {
  const wantListen = WANT_LISTEN.test(t);
  if (LOW_MUSIC.test(t) && (wantListen || CONTRAST_CONNECTOR.test(t)))
    return "low";
  if (HIGH_MUSIC.test(t)) return "high";
  if (LOW_MUSIC.test(t)) return "low";
  return null;
}

export function parseListeningStructuredIntent(text: string): ListeningStructuredIntent {
  const t = text.trim();
  const lower = t.toLowerCase();

  let moodSurfaceEnergy: EnergyLevel | null = null;
  if (HIGH_MOOD.test(t)) moodSurfaceEnergy = "high";
  else if (LOW_MOOD.test(t)) moodSurfaceEnergy = "low";

  let musicTargetEnergy = detectMusicTargetEnergy(t);

  const contrastMoodVsMusic =
    Boolean(moodSurfaceEnergy === "high" && musicTargetEnergy === "low") ||
    Boolean(
      moodSurfaceEnergy === "high" &&
        LOW_MUSIC.test(t) &&
        CONTRAST_CONNECTOR.test(t)
    );

  if (contrastMoodVsMusic && musicTargetEnergy === null) musicTargetEnergy = "low";

  const introspective = INTROSPECTIVE.test(t);

  const themes: string[] = [];
  if (THEME_BREAKUP.test(t)) themes.push("breakup / healing");
  if (THEME_ROMANTIC.test(t)) themes.push("romantic");

  let arcOpening: EnergyLevel | null = null;
  let arcClosing: EnergyLevel | null = null;
  let hasArc = false;

  if (ARC_LOW_TO_HIGH.test(t) || ARC_LOW_TO_HIGH_B.test(t)) {
    hasArc = true;
    arcOpening = "low";
    arcClosing = "high";
  } else if (
    /\b(sad|slow|melanchol).{0,60}?\b(then|→|->|to)\b.{0,40}?\b(happy|energetic|upbeat)\b/i.test(
      t
    )
  ) {
    hasArc = true;
    arcOpening = "low";
    arcClosing = "high";
  }

  return {
    moodSurfaceEnergy,
    musicTargetEnergy,
    contrastMoodVsMusic,
    introspective,
    themes,
    arcOpening,
    arcClosing,
    hasArc,
  };
}

/** Extra curator lines (injected after base CURATOR INTENT). */
export function formatStructuredListeningForCurator(
  intent: ListeningStructuredIntent
): string {
  const parts: string[] = [
    "",
    "───────────────────────────────────────",
    "STRUCTURED LISTENING INTENT (parsed)",
    "───────────────────────────────────────",
  ];

  if (intent.moodSurfaceEnergy) {
    parts.push(
      `- **User surface mood (how they feel):** ${intent.moodSurfaceEnergy} energy — do not force playlist to mirror this if they asked for different music energy below.`
    );
  }
  if (intent.musicTargetEnergy) {
    parts.push(
      `- **Target music energy:** ${intent.musicTargetEnergy} — this is what tracks should sound like (tempo, density, vocal intensity).`
    );
  }
  if (intent.contrastMoodVsMusic) {
    parts.push(
      "- **Contrast (mood vs music):** They feel one way but want to *hear* another — honor the **music** side. Prefer slow melody, acoustic-leaning, soft feel-good, romantic or slice-of-life; **avoid** generic loud “happy hits” or pure dance unless they asked."
    );
  }
  if (intent.introspective) {
    parts.push(
      "- **Introspective / inward:** Warm, quiet-positive, contemplative lyrics and delivery — songs that sit *with* them, not a stadium anthem."
    );
  }
  if (intent.themes.length) {
    parts.push(`- **Themes:** ${intent.themes.join(", ")}.`);
  }
  if (intent.hasArc && intent.arcOpening && intent.arcClosing) {
    parts.push(
      `- **Playlist arc (ordering picks[]):** Early positions ≈ tracks 1–4: **${intent.arcOpening}** energy / mood; middle 5–7: **turn**; late 8–10: **${intent.arcClosing}** energy. When choosing indices, order picks so the **sequence** of songs tells this story (use reasons to signal tempo shift).`
    );
  }

  if (parts.length <= 4) return "";

  return parts.join("\n");
}

/** Extra JioSaavn query strings — language-prefixed. */
export function structuredIntentSearchBoosts(
  lang: string | null,
  intent: ListeningStructuredIntent
): string[] {
  if (!lang) return [];
  const L = lang.toLowerCase();
  const out: string[] = [];

  if (intent.contrastMoodVsMusic && intent.musicTargetEnergy === "low") {
    out.push(`${L} slow melody acoustic feel good`);
    out.push(`${L} soft romantic melody mellow`);
    out.push(`${L} slice of life gentle songs`);
  }

  if (intent.introspective && (intent.musicTargetEnergy === "low" || intent.musicTargetEnergy === null)) {
    out.push(`${L} introspective soft melody songs`);
  }

  if (intent.hasArc && intent.arcOpening === "low" && intent.arcClosing === "high") {
    out.push(`${L} sad emotional melody songs`);
    out.push(`${L} energetic uplifting dance hits`);
  }

  return [...new Set(out)];
}

/** Short note appended to strict-pool rules so pick **order** respects arc. */
export function strictPoolSequencingNote(
  intent: ListeningStructuredIntent
): string {
  if (!intent.hasArc || !intent.arcOpening || !intent.arcClosing) return "";
  return `\n- **Order matters:** List picks[] in playlist order: opening (${intent.arcOpening}) → closing (${intent.arcClosing}). Earlier entries = start of journey, later = finish.\n`;
}
