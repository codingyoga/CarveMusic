import { describe, expect, it } from "vitest";
import {
  buildMoodSearchQueries,
  buildMoodSearchQuery,
  detectLanguage,
  expandScenarioVibes,
  formatDecadeHintsForCurator,
  isLikelyEraOrDecadeNotArtist,
  isLikelyMoodDescriptorNotArtist,
  isScenarioOnlyArtistFalsePositive,
  parseDecadeHintsForSearch,
} from "./moodSearchQuery";

const neverMcq = () => false;

describe("expandScenarioVibes", () => {
  it("maps long drive to vibe tokens and strips scenario words", () => {
    const { vibes, stripped } = expandScenarioVibes("longdrive kannada songs");
    expect(vibes).toContain("upbeat");
    expect(vibes).toContain("filmy");
    expect(stripped.toLowerCase()).not.toContain("longdrive");
    expect(stripped.toLowerCase()).not.toContain("long drive");
  });

  it("handles spaced long drive", () => {
    const { vibes } = expandScenarioVibes("long drive kannada");
    expect(vibes.length).toBeGreaterThan(0);
  });
});

describe("isLikelyEraOrDecadeNotArtist", () => {
  it("treats decade-only and decade+language as not an artist name", () => {
    expect(isLikelyEraOrDecadeNotArtist("90s")).toBe(true);
    expect(isLikelyEraOrDecadeNotArtist("90s kannada")).toBe(true);
    expect(isLikelyEraOrDecadeNotArtist("mid 90s")).toBe(true);
    expect(isLikelyEraOrDecadeNotArtist("2000s hindi")).toBe(true);
    expect(isLikelyEraOrDecadeNotArtist("1990s tamil")).toBe(true);
  });

  it("keeps artist + era as a plausible artist query", () => {
    expect(isLikelyEraOrDecadeNotArtist("madonna 90s")).toBe(false);
    expect(isLikelyEraOrDecadeNotArtist("sp balasubrahmanyam 90s")).toBe(false);
  });
});

describe("parseDecadeHintsForSearch", () => {
  it("expands short and long decade mentions", () => {
    const h = parseDecadeHintsForSearch("90s and 2000s kannada");
    expect(h).toContain("90s");
    expect(h).toContain("1990s");
    expect(h).toContain("2000s");
  });

  it("handles 00s and 2010s style", () => {
    expect(parseDecadeHintsForSearch("00s hits")).toContain("2000s");
    expect(parseDecadeHintsForSearch("10s tamil")).toContain("2010s");
  });
});

describe("formatDecadeHintsForCurator", () => {
  it("returns null when no decade", () => {
    expect(formatDecadeHintsForCurator("slow kannada")).toBeNull();
  });

  it("returns era bullet when decades present", () => {
    const s = formatDecadeHintsForCurator("80s hindi romantic");
    expect(s).toContain("Era");
    expect(s).toContain("1980s");
  });
});

describe("isLikelyMoodDescriptorNotArtist", () => {
  it("flags vibe + language clusters mistaken for artists", () => {
    expect(isLikelyMoodDescriptorNotArtist("slow acoustic")).toBe(true);
    expect(isLikelyMoodDescriptorNotArtist("slow kannada acoustic")).toBe(true);
    expect(isLikelyMoodDescriptorNotArtist("kannada acoustic")).toBe(true);
    expect(isLikelyMoodDescriptorNotArtist("slow")).toBe(true);
  });

  it("does not flag real artist names", () => {
    expect(isLikelyMoodDescriptorNotArtist("arijit singh")).toBe(false);
    expect(isLikelyMoodDescriptorNotArtist("rajkumar")).toBe(false);
    expect(isLikelyMoodDescriptorNotArtist("drake")).toBe(false);
  });
});

describe("isScenarioOnlyArtistFalsePositive", () => {
  it("flags longdrive as scenario, not an artist", () => {
    expect(isScenarioOnlyArtistFalsePositive("longdrive")).toBe(true);
    expect(isScenarioOnlyArtistFalsePositive("long drive")).toBe(true);
  });

  it("does not flag real artist-like names", () => {
    expect(isScenarioOnlyArtistFalsePositive("ravichandran")).toBe(false);
    expect(isScenarioOnlyArtistFalsePositive("arijit singh")).toBe(false);
  });
});

describe("buildMoodSearchQueries", () => {
  it("returns multiple queries for kannada mood", () => {
    const qs = buildMoodSearchQueries(
      [{ role: "user", content: "upbeat kannada songs for evening" }],
      neverMcq
    );
    expect(qs.length).toBeGreaterThanOrEqual(2);
    expect(qs.some((q) => q.toLowerCase().includes("kannada"))).toBe(true);
  });

  it("adds language + decade JioSaavn queries when user names eras", () => {
    const qs = buildMoodSearchQueries(
      [{ role: "user", content: "90s and 2000s kannada romantic melodies" }],
      neverMcq
    );
    expect(qs.some((q) => q.includes("kannada 1990s songs"))).toBe(true);
    expect(qs.some((q) => q.includes("kannada 2000s songs"))).toBe(true);
  });

  it("skips filmy hits and prepends soft boosts for happy-but-slow contrast", () => {
    const qs = buildMoodSearchQueries(
      [
        {
          role: "user",
          content:
            "I'm very happy but want slow acoustic kannada feel-good melodies",
        },
      ],
      neverMcq
    );
    expect(qs.some((q) => q.includes("filmy hits"))).toBe(false);
    expect(qs.some((q) => q.includes("kannada slow melody acoustic"))).toBe(
      true
    );
  });
});

describe("buildMoodSearchQuery", () => {
  it("does not pass literal longdrive into keyword string for Kannada road-trip ask", () => {
    const messages = [
      { role: "user" as const, content: "longdrive kannada songs for evening" },
    ];
    const q = buildMoodSearchQuery(messages, neverMcq);
    expect(q.toLowerCase()).not.toContain("longdrive");
    expect(q.toLowerCase()).not.toMatch(/long\s*drive/);
    expect(q.toLowerCase()).toContain("kannada");
    expect(q.toLowerCase()).toContain("upbeat");
  });

  it("includes detected language", () => {
    const messages = [{ role: "user" as const, content: "some chill tamil melodies" }];
    const q = buildMoodSearchQuery(messages, neverMcq);
    expect(q).toContain("tamil");
  });
});

describe("detectLanguage", () => {
  it("reads last-mentioned language from thread", () => {
    const messages = [
      { role: "user", content: "hi" },
      { role: "assistant", content: "hey" },
      { role: "user", content: "kannada romantic" },
    ];
    expect(detectLanguage(messages)).toBe("kannada");
  });
});
