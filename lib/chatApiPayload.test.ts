import { describe, expect, it } from "vitest";
import { buildApiMessages, HISTORY_WINDOW, summarizeForHistory } from "./chatApiPayload";
import type { ChatMessage, Playlist } from "./types";

const pl: Playlist = {
  name: "Test Mix",
  songs: [
    { title: "A", artist: "One", year: "2020", reason: "" },
    { title: "B", artist: "Two", year: "2021", reason: "" },
  ],
};

const assistantPlaylist = (id: string): ChatMessage => ({
  id,
  role: "assistant",
  content: "Here is your mix",
  parsed: {
    message: "Here is your mix",
    type: "playlist",
    playlist: pl,
  },
});

describe("buildApiMessages", () => {
  it("after a playlist, sends only the new user message (fresh context)", () => {
    const prior: ChatMessage[] = [
      { id: "1", role: "user", content: "evening songs" },
      assistantPlaylist("2"),
    ];
    const out = buildApiMessages(prior, "something else entirely", pl);
    expect(out).toEqual([{ role: "user", content: "something else entirely" }]);
  });

  it("after a playlist, play-confirm pairs summarized assistant + user when playlist ref exists", () => {
    const prior: ChatMessage[] = [
      { id: "1", role: "user", content: "evening songs" },
      assistantPlaylist("2"),
    ];
    const out = buildApiMessages(prior, "yes let's go", pl);
    expect(out).toHaveLength(2);
    expect(out[0].role).toBe("assistant");
    expect(out[1]).toEqual({ role: "user", content: "yes let's go" });
    const summary = JSON.parse(out[0].content);
    expect(summary.type).toBe("playlist");
    expect(summary.playlist.name).toBe("Test Mix");
  });

  it("play-confirm without playlist ref falls back to user-only payload", () => {
    const prior: ChatMessage[] = [
      { id: "1", role: "user", content: "evening songs" },
      assistantPlaylist("2"),
    ];
    const out = buildApiMessages(prior, "play", null);
    expect(out).toEqual([{ role: "user", content: "play" }]);
  });

  it("without a trailing playlist, includes last HISTORY_WINDOW summarized turns", () => {
    const prior: ChatMessage[] = Array.from({ length: HISTORY_WINDOW + 5 }, (_, i) => ({
      id: String(i),
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `msg ${i}`,
      parsed:
        i % 2 === 1
          ? { message: `msg ${i}`, type: "text" as const }
          : undefined,
    }));
    const out = buildApiMessages(prior, "next", null);
    expect(out.length).toBe(HISTORY_WINDOW + 1);
    expect(out[out.length - 1]).toEqual({ role: "user", content: "next" });
    expect(out[0].content).toContain("msg 5");
  });

  it("summarizeForHistory compresses playlist assistant rows", () => {
    const m = assistantPlaylist("x");
    const s = summarizeForHistory(m);
    const parsed = JSON.parse(s.content);
    expect(parsed.playlist.songs_summary).toContain('"A" by One');
  });
});
