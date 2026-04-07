import { describe, expect, it } from "vitest";
import {
  formatStructuredListeningForCurator,
  parseListeningStructuredIntent,
  strictPoolSequencingNote,
  structuredIntentSearchBoosts,
} from "./listeningStructuredIntent";

describe("parseListeningStructuredIntent", () => {
  it("detects high mood + low music contrast", () => {
    const i = parseListeningStructuredIntent(
      "I'm very happy but I want slow Kannada melody songs, acoustic feel"
    );
    expect(i.moodSurfaceEnergy).toBe("high");
    expect(i.musicTargetEnergy).toBe("low");
    expect(i.contrastMoodVsMusic).toBe(true);
  });

  it("detects introspective + soft target", () => {
    const i = parseListeningStructuredIntent(
      "Feeling great, want something introspective on myself, soft hindi songs"
    );
    expect(i.introspective).toBe(true);
    expect(i.musicTargetEnergy).toBe("low");
  });

  it("detects breakup theme and sad-to-happy arc", () => {
    const i = parseListeningStructuredIntent(
      "Just had a breakup, start sad and slow then end with happy energetic kannada"
    );
    expect(i.themes.some((t) => t.includes("breakup"))).toBe(true);
    expect(i.hasArc).toBe(true);
    expect(i.arcOpening).toBe("low");
    expect(i.arcClosing).toBe("high");
  });
});

describe("formatStructuredListeningForCurator", () => {
  it("returns empty when nothing structured matches", () => {
    expect(
      formatStructuredListeningForCurator(
        parseListeningStructuredIntent("play music")
      )
    ).toBe("");
  });

  it("includes contrast line when contrast detected", () => {
    const s = formatStructuredListeningForCurator(
      parseListeningStructuredIntent("happy but slow tamil melodies")
    );
    expect(s.toLowerCase()).toContain("contrast");
    expect(s.toLowerCase()).toContain("slow melody");
  });
});

describe("structuredIntentSearchBoosts", () => {
  it("adds slow acoustic lines for contrast + low music in user language", () => {
    const boosts = structuredIntentSearchBoosts(
      "Kannada",
      parseListeningStructuredIntent("so happy but want slow melody kannada")
    );
    expect(boosts.some((b) => b.includes("kannada slow melody acoustic"))).toBe(
      true
    );
  });
});

describe("strictPoolSequencingNote", () => {
  it("returns note when arc present", () => {
    const note = strictPoolSequencingNote(
      parseListeningStructuredIntent(
        "sad songs first then happy energetic ending hindi"
      )
    );
    expect(note).toContain("Order matters");
    expect(note).toContain("opening");
  });
});
