import { describe, expect, it } from "vitest";
import type { Playlist, Song } from "@/lib/types";
import {
  playerQueueMatchesPlaylist,
  playlistTrackFingerprint,
} from "./playlistIdentity";

describe("playlistTrackFingerprint", () => {
  it("is case and trim insensitive", () => {
    expect(
      playlistTrackFingerprint([{ title: "  Hello  ", artist: "World" }])
    ).toBe(playlistTrackFingerprint([{ title: "hello", artist: " world " }]));
  });
});

describe("playerQueueMatchesPlaylist", () => {
  const pl: Playlist = {
    name: "Test",
    songs: [
      { title: "A", artist: "One", year: "", reason: "" },
      { title: "B", artist: "Two", year: "", reason: "" },
    ],
  };

  it("returns true when resolved queue matches playlist rows", () => {
    const resolved: Song[] = [
      { title: "A", artist: "One", year: "2020", reason: "r", videoId: "x" },
      { title: "B", artist: "Two", year: "", reason: "", videoId: "y" },
    ];
    expect(playerQueueMatchesPlaylist(resolved, pl)).toBe(true);
  });

  it("returns false when lengths differ", () => {
    const resolved: Song[] = [
      { title: "A", artist: "One", year: "", reason: "", videoId: "x" },
    ];
    expect(playerQueueMatchesPlaylist(resolved, pl)).toBe(false);
  });

  it("returns false when titles differ (different playlist)", () => {
    const resolved: Song[] = [
      { title: "Old", artist: "Song", year: "", reason: "", videoId: "x" },
      { title: "Other", artist: "Hit", year: "", reason: "", videoId: "y" },
    ];
    expect(playerQueueMatchesPlaylist(resolved, pl)).toBe(false);
  });
});
