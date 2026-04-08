import { describe, it, expect } from "vitest";
import { buildJioSaavnQueriesFromIntent } from "@/lib/jiosaavnQueriesFromIntent";
import type { SearchIntent } from "@/lib/searchIntent";

describe("buildJioSaavnQueriesFromIntent", () => {
  it("avoids naive 'pop songs' keyword-only queries", () => {
    const intent: SearchIntent = {
      isArtistRequest: false,
      artistName: null,
      language: "english",
      decade: "2020s",
      genres: ["pop"],
      vibes: [],
    };

    const queries = buildJioSaavnQueriesFromIntent(intent, "english pop songs of 2020s");

    // Should include hits/top-style queries, not only "pop songs".
    expect(queries.some((q) => q.includes("hits"))).toBe(true);
    expect(queries.some((q) => q.includes("2020s"))).toBe(true);

    // "pop songs" as a literal phrase is a common failure mode.
    expect(queries.some((q) => q.includes("pop songs"))).toBe(false);
  });
});

