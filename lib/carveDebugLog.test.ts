import { describe, expect, it } from "vitest";
import {
  playlistSongsForDebugLog,
  poolSongsForDebugLog,
} from "./carveDebugLog";

describe("poolSongsForDebugLog", () => {
  it("indexes tracks 1..n with truncated fields", () => {
    const { poolCount, poolTracks } = poolSongsForDebugLog([
      { title: "A", artist: "B", year: "2020" },
      { title: "C", artist: "D", year: "" },
    ]);
    expect(poolCount).toBe(2);
    expect(poolTracks[0]).toMatchObject({ i: 1, title: "A", artist: "B", year: "2020" });
    expect(poolTracks[1]).toMatchObject({ i: 2, title: "C", artist: "D" });
    expect(poolTracks[1].year).toBeUndefined();
  });
});

describe("playlistSongsForDebugLog", () => {
  it("includes reason for selected rows", () => {
    const { selectedCount, selectedTracks } = playlistSongsForDebugLog([
      { title: "X", artist: "Y", year: "1999", reason: "Because" },
    ]);
    expect(selectedCount).toBe(1);
    expect(selectedTracks[0]).toMatchObject({
      i: 1,
      title: "X",
      reason: "Because",
    });
  });
});
