/**
 * Flow logging for local debugging. Prefix: [CarveMusic]
 *
 * Client-safe: no Node built-ins. Use `carveDebug` in hooks.
 * Server routes / lib/ai: use `carveDebugServer` from `@/lib/carveDebugLogFile` so logs
 * can also append to CARVEMUSIC_LOG_FILE.
 *
 * Console enabled when:
 * - Server: NODE_ENV=development, or CARVEMUSIC_DEBUG=1 / true
 * - Browser: NODE_ENV=development, or NEXT_PUBLIC_CARVEMUSIC_DEBUG=1
 *
 * File: set CARVEMUSIC_LOG_FILE (e.g. logs/flow.log) — writes every carveDebugServer
 * line regardless of NODE_ENV so you can trace Gemini/JioSaavn steps in production.
 */

export function carveDebugEnabled(): boolean {
  if (process.env.CARVEMUSIC_DEBUG === "1" || process.env.CARVEMUSIC_DEBUG === "true") {
    return true;
  }
  if (typeof window !== "undefined") {
    return (
      process.env.NODE_ENV === "development" ||
      process.env.NEXT_PUBLIC_CARVEMUSIC_DEBUG === "1"
    );
  }
  return process.env.NODE_ENV === "development";
}

/** Always formats a line (used for file append when CARVEMUSIC_LOG_FILE is set). */
export function formatCarveDebugLineAlways(
  tag: string,
  data?: Record<string, unknown>
): string {
  const ts = new Date().toISOString();
  const payload = data !== undefined ? ` ${JSON.stringify(data)}` : "";
  return `[CarveMusic ${ts}] ${tag}${payload}`;
}

export function formatCarveDebugLine(
  tag: string,
  data?: Record<string, unknown>
): string | null {
  if (!carveDebugEnabled()) return null;
  return formatCarveDebugLineAlways(tag, data);
}

export function carveDebug(tag: string, data?: Record<string, unknown>): void {
  const line = formatCarveDebugLine(tag, data);
  if (line) console.log(line);
}

export function truncateForLog(str: string, max = 160): string {
  const t = str.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

/** One row for CARVEMUSIC_LOG_FILE (pool catalog or final playlist). */
export type ChatLogTrackRow = {
  i: number;
  title: string;
  artist: string;
  year?: string;
  reason?: string;
};

export function poolSongsForDebugLog(
  songs: { title: string; artist: string; year?: string }[]
): { poolCount: number; poolTracks: ChatLogTrackRow[] } {
  return {
    poolCount: songs.length,
    poolTracks: songs.map((s, idx) => ({
      i: idx + 1,
      title: truncateForLog(s.title, 140),
      artist: truncateForLog(s.artist, 100),
      year: s.year ? truncateForLog(s.year, 16) : undefined,
    })),
  };
}

export function playlistSongsForDebugLog(
  songs: {
    title: string;
    artist: string;
    year?: string;
    reason?: string;
  }[]
): { selectedCount: number; selectedTracks: ChatLogTrackRow[] } {
  return {
    selectedCount: songs.length,
    selectedTracks: songs.map((s, idx) => ({
      i: idx + 1,
      title: truncateForLog(s.title, 140),
      artist: truncateForLog(s.artist, 100),
      year: s.year ? truncateForLog(s.year, 16) : undefined,
      reason: s.reason ? truncateForLog(s.reason, 160) : undefined,
    })),
  };
}
