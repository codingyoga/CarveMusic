import { describe, expect, it } from "vitest";
import { buildCuratorIntentSection } from "./curatorIntent";

describe("buildCuratorIntentSection", () => {
  it("returns null for very short generic user text", () => {
    expect(
      buildCuratorIntentSection([{ role: "user", content: "hi" }])
    ).toBeNull();
  });

  it("includes language and vibe for longdrive kannada", () => {
    const s = buildCuratorIntentSection([
      { role: "user", content: "longdrive kannada songs for evening road trip" },
    ]);
    expect(s).toBeTruthy();
    expect(s!.toLowerCase()).toContain("kannada");
    expect(s!.toLowerCase()).toContain("upbeat");
    expect(s!.toLowerCase()).toContain("curator intent");
    expect(s!.toLowerCase()).not.toContain("longdrive");
  });

  it("includes vibe for workout without language", () => {
    const s = buildCuratorIntentSection([
      { role: "user", content: "high energy songs for my gym workout today" },
    ]);
    expect(s).toBeTruthy();
    expect(s!.toLowerCase()).toMatch(/high energy|dance|beats/);
  });

  it("includes era / decade when user names 90s or 2000s", () => {
    const s = buildCuratorIntentSection([
      { role: "user", content: "90s and 2000s kannada film hits for nostalgia" },
    ]);
    expect(s).toBeTruthy();
    expect(s!.toLowerCase()).toContain("era");
    expect(s).toMatch(/1990s|90s/);
    expect(s).toMatch(/2000s/);
  });
});
