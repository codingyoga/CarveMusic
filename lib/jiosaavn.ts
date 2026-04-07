export interface JioSaavnSong {
  title: string;
  artist: string;
  album: string;
  year: string;
  language: string;
  playCount: number;
}

const JIOSAAVN_ENDPOINTS = [
  "https://jiosaavn-api-privatecvc2.vercel.app/search/songs",
  "https://saavn.dev/api/search/songs",
];

interface RawSong {
  name?: string;
  title?: string;
  primaryArtists?: string;
  artists?: { primary?: { name: string }[] };
  album?: { name?: string } | string;
  year?: string;
  language?: string;
  playCount?: number;
}

function parseSong(s: RawSong): JioSaavnSong {
  let artists = s.primaryArtists || "";
  if (!artists && s.artists?.primary) {
    artists = s.artists.primary.map((a) => a.name).join(", ");
  }
  let albumName = "";
  if (typeof s.album === "string") albumName = s.album;
  else if (s.album?.name) albumName = s.album.name;

  return {
    title: s.name || s.title || "",
    artist: artists,
    album: albumName,
    year: s.year || "",
    language: s.language || "",
    playCount: typeof s.playCount === "number" ? s.playCount : 0,
  };
}

export async function searchJioSaavn(
  query: string,
  limit = 30
): Promise<JioSaavnSong[]> {
  for (const endpoint of JIOSAAVN_ENDPOINTS) {
    try {
      const url = `${endpoint}?query=${encodeURIComponent(query)}&limit=${limit}`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) continue;

      const data = await res.json();
      let results = data?.data?.results;
      if (!results) {
        results = data?.data;
        if (typeof results === "object" && !Array.isArray(results)) {
          results = results?.results;
        }
      }
      if (!results) results = data?.results;
      if (!Array.isArray(results) || results.length === 0) continue;

      return results.map(parseSong);
    } catch {
      continue;
    }
  }

  return [];
}

export async function multiSearchJioSaavn(
  queries: string[]
): Promise<JioSaavnSong[]> {
  const allSongs: JioSaavnSong[] = [];
  const seen = new Set<string>();

  for (const query of queries) {
    const songs = await searchJioSaavn(query, 20);
    for (const song of songs) {
      const key = `${song.title.toLowerCase()}|${song.artist.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        allSongs.push(song);
      }
    }
  }

  return allSongs;
}

export function formatSongsForContext(
  songs: JioSaavnSong[],
  isArtistQuery = false,
  strictIndexMode = false
): string {
  if (songs.length === 0) return "";

  let header = "";
  if (isArtistQuery) {
    header =
      "VERIFIED SONGS FROM THIS ARTIST'S FILMS (album = movie name). ONLY recommend songs from this list:\n";
  }
  if (strictIndexMode) {
    header += `NUMBERED CATALOG (${songs.length} tracks): select ONLY by index 1–${songs.length} in JSON "picks" — do not invent titles.\n`;
  }

  const list = songs
    .map(
      (s, i) =>
        `${i + 1}. "${s.title}" by ${s.artist} — film/album: ${s.album}, year: ${s.year}, language: ${s.language}, plays: ${s.playCount.toLocaleString()}`
    )
    .join("\n");

  return header + list;
}
