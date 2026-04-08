import type { Playlist, Song } from "@/lib/types";

/** Stable identity for comparing chat playlist rows to the resolved player queue. */
export function playlistTrackFingerprint(
  songs: { title: string; artist: string }[]
): string {
  return songs
    .map((s) => `${s.title.trim().toLowerCase()}|${s.artist.trim().toLowerCase()}`)
    .join("\n");
}

/** True when the player queue matches this playlist (same length and same title/artist rows). */
export function playerQueueMatchesPlaylist(
  playerSongs: Song[],
  playlist: Playlist
): boolean {
  if (playerSongs.length === 0 || playerSongs.length !== playlist.songs.length) {
    return false;
  }
  return (
    playlistTrackFingerprint(playerSongs) ===
    playlistTrackFingerprint(playlist.songs)
  );
}
