import { describe, it, expect } from "vitest";
import {
  compactCastingTime, formatRange, abbrAbility, hitDcDescriptor, effectDescriptor, editionTag,
} from "../src/modules/pc/components/spells/spell-display";
import type { ResolvedSpell } from "../src/modules/pc/pc.types";

function sp(extra: Partial<ResolvedSpell["entity"]>): ResolvedSpell {
  return { entity: { name: "X", level: 1, ...extra } as never, slug: "x",
    classSlug: "wizard", source: "class", prepared: true, alwaysPrepared: false };
}

describe("compactCastingTime", () => {
  it("maps the real casting_time tokens to compact labels", () => {
    expect(compactCastingTime("action")).toBe("1A");
    expect(compactCastingTime("bonus-action")).toBe("1BA");
    expect(compactCastingTime("reaction")).toBe("1R");
    expect(compactCastingTime("1minute")).toBe("1 min");
    expect(compactCastingTime("minute")).toBe("1 min");
    expect(compactCastingTime("10minutes")).toBe("10 min");
    expect(compactCastingTime("1hour")).toBe("1 hr");
    expect(compactCastingTime("hour")).toBe("1 hr");
    expect(compactCastingTime("8hours")).toBe("8 hr");
    expect(compactCastingTime(undefined)).toBe("—");
    expect(compactCastingTime("weird")).toBe("weird"); // unknown passes through
  });
});

describe("formatRange", () => {
  it("compacts feet and passes through keywords", () => {
    expect(formatRange("120 feet")).toBe("120 ft");
    expect(formatRange("5 feet")).toBe("5 ft");
    expect(formatRange("Self")).toBe("Self");
    expect(formatRange("Touch")).toBe("Touch");
    expect(formatRange("Special")).toBe("Special");
    expect(formatRange(undefined)).toBe("—");
  });
});

describe("abbrAbility", () => {
  it("abbreviates full ability words", () => {
    expect(abbrAbility("dexterity")).toBe("DEX");
    expect(abbrAbility("wisdom")).toBe("WIS");
    expect(abbrAbility("CHA")).toBe("CHA"); // already short
  });
});

describe("hitDcDescriptor", () => {
  it("returns save ability + DC when the spell has a saving throw", () => {
    expect(hitDcDescriptor(sp({ saving_throw: { ability: "wisdom" } as never }), 14))
      .toEqual({ ability: "WIS", dc: 14 });
  });
  it("returns null when there is no saving throw (no attack data exists in the model)", () => {
    expect(hitDcDescriptor(sp({}), 14)).toBeNull();
  });
});

describe("effectDescriptor", () => {
  it("returns the first damage type when present", () => {
    expect(effectDescriptor(sp({ damage: { types: ["fire"] } as never }))).toEqual({ damageType: "fire" });
  });
  it("returns an empty descriptor when no structured effect exists (no inference)", () => {
    expect(effectDescriptor(sp({}))).toEqual({ damageType: null });
  });
});

describe("editionTag", () => {
  it("derives the source label + css modifier from entity.edition", () => {
    expect(editionTag(sp({ edition: "2014" } as never))).toEqual({ label: "5e", mod: "e2014" });
    expect(editionTag(sp({ edition: "2024" } as never))).toEqual({ label: "2024", mod: "e2024" });
    expect(editionTag(sp({}))).toBeNull(); // no edition → no tag
  });
});
