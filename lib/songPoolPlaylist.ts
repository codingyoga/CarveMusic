import type { JioSaavnSong } from "@/lib/jiosaavn";
import type { AIResponse, Song } from "@/lib/types";

export const MAX_POOL_SONGS = 48;
export const MIN_POOL_FOR_STRICT = 10;
export const MIN_PLAYLIST_SONGS = 6;
export const TARGET_PLAYLIST_SONGS = 10;

function dedupeKey(s: JioSaavnSong): string {
  return `${s.title}|${s.artist}`.toLowerCase();
}

/** Cap pool size; spread across play-count spectrum so the model sees both known and mid-tier tracks. */
export function capSongPool(songs: JioSaavnSong[]): JioSaavnSong[] {
  const seen = new Set<string>();
  const unique = songs.filter((s) => {
    const k = dedupeKey(s);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (unique.length <= MAX_POOL_SONGS) return unique;

  const sorted = [...unique].sort((a, b) => a.playCount - b.playCount);
  const out: JioSaavnSong[] = [];
  const picks = MAX_POOL_SONGS;
  for (let k = 0; k < picks; k++) {
    const idx = Math.round((k / Math.max(1, picks - 1)) * (sorted.length - 1));
    out.push(sorted[idx]);
  }
  const seen2 = new Set<string>();
  return out.filter((s) => {
    const k = dedupeKey(s);
    if (seen2.has(k)) return false;
    seen2.add(k);
    return true;
  });
}

function primaryArtistKey(artist: string): string {
  return artist.split(/[,&]/)[0]?.trim().toLowerCase() ?? "";
}

/**
 * Turn Gemini strict-pool JSON into a normal AIResponse.
 * Expects picks: [{ index: 1-based, reason }].
 */
export function mapStrictPicksToResponse(
  pool: JioSaavnSong[],
  parsed: Record<string, unknown>
): AIResponse | null {
  const picks = parsed.picks;
  if (!Array.isArray(picks) || picks.length === 0) return null;

  const usedIdx = new Set<number>();
  const artistCount = new Map<string, number>();
  const songsOut: Song[] = [];

  for (const row of picks) {
    if (typeof row !== "object" || row === null) continue;
    const r = row as Record<string, unknown>;
    const raw =
      typeof r.index === "number"
        ? r.index
        : typeof r.index === "string"
          ? parseInt(r.index, 10)
          : typeof r.i === "number"
            ? r.i
            : Number.NaN;
    if (!Number.isFinite(raw)) continue;
    const i = Math.floor(raw as number);
    if (i < 1 || i > pool.length || usedIdx.has(i)) continue;

    const s = pool[i - 1];
    const pk = primaryArtistKey(s.artist);
    const c = artistCount.get(pk) ?? 0;
    if (c >= 2) continue;

    artistCount.set(pk, c + 1);
    usedIdx.add(i);
    const reason =
      String(r.reason ?? "").trim() ||
      "Fits the mood and flow you asked for — solid pick from this catalog.";
    songsOut.push({
      title: s.title,
      artist: s.artist,
      year: s.year || "",
      reason,
    });
    if (songsOut.length >= TARGET_PLAYLIST_SONGS) break;
  }

  if (songsOut.length < MIN_PLAYLIST_SONGS) return null;

  const name =
    String(parsed.playlist_name ?? parsed.playlistName ?? "").trim() ||
    "Curated mix";
  const message =
    String(parsed.message ?? "").trim() ||
    "Here's a playlist built from verified tracks that match your request.";

  return {
    message,
    type: "playlist",
    playlist: { name, songs: songsOut },
    action: null,
  };
}
