import { describe, expect, it } from "vitest";
import {
  capSongPool,
  mapStrictPicksToResponse,
  MAX_POOL_SONGS,
} from "./songPoolPlaylist";
import type { JioSaavnSong } from "./jiosaavn";

function song(
  title: string,
  artist: string,
  plays = 1000
): JioSaavnSong {
  return {
    title,
    artist,
    album: "X",
    year: "2020",
    language: "Kannada",
    playCount: plays,
  };
}

describe("capSongPool", () => {
  it("returns all when under max", () => {
    const a = [song("A", "a1"), song("B", "b1")];
    expect(capSongPool(a)).toHaveLength(2);
  });

  it("caps and dedupes", () => {
    const many: JioSaavnSong[] = [];
    for (let i = 0; i < 80; i++) {
      many.push(song(`T${i}`, `A${i}`, i * 1000));
    }
    const out = capSongPool(many);
    expect(out.length).toBeLessThanOrEqual(MAX_POOL_SONGS);
    const keys = new Set(out.map((s) => `${s.title}|${s.artist}`.toLowerCase()));
    expect(keys.size).toBe(out.length);
  });
});

describe("mapStrictPicksToResponse", () => {
  const pool = [
    song("Alpha", "Artist One, X"),
    song("Beta", "Artist Two"),
    song("Gamma", "Artist One, Y"),
    song("Delta", "Artist Three"),
    song("Eps", "Artist Four"),
    song("Zeta", "Artist Five"),
    song("Eta", "Artist Six"),
    song("Theta", "Artist Seven"),
    song("Iota", "Artist Eight"),
    song("Kappa", "Artist Nine"),
  ];

  it("maps valid picks to playlist", () => {
    const res = mapStrictPicksToResponse(pool, {
      message: "Hi",
      type: "playlist",
      playlist_name: "Test Mix",
      picks: [
        { index: 1, reason: "r1" },
        { index: 2, reason: "r2" },
        { index: 4, reason: "r3" },
        { index: 5, reason: "r4" },
        { index: 6, reason: "r5" },
        { index: 7, reason: "r6" },
        { index: 8, reason: "r7" },
        { index: 9, reason: "r8" },
      ],
    });
    expect(res).not.toBeNull();
    expect(res!.playlist!.songs).toHaveLength(8);
    expect(res!.playlist!.songs[0].title).toBe("Alpha");
  });

  it("rejects out-of-range and duplicate indices", () => {
    const res = mapStrictPicksToResponse(pool, {
      message: "Hi",
      type: "playlist",
      playlist_name: "X",
      picks: [
        { index: 0, reason: "bad" },
        { index: 99, reason: "bad" },
        { index: 1, reason: "a" },
        { index: 1, reason: "dup" },
        { index: 2, reason: "b" },
        { index: 3, reason: "c" },
        { index: 4, reason: "d" },
        { index: 5, reason: "e" },
        { index: 6, reason: "f" },
        { index: 7, reason: "g" },
        { index: 8, reason: "h" },
        { index: 9, reason: "i" },
        { index: 10, reason: "j" },
      ],
    });
    expect(res).not.toBeNull();
    expect(res!.playlist!.songs.length).toBeGreaterThanOrEqual(6);
  });

  it("returns null for empty picks", () => {
    expect(mapStrictPicksToResponse(pool, { picks: [] })).toBeNull();
  });
});
