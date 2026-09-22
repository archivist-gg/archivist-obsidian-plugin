import { describe, it, expect } from "vitest";
import {
  compactCastingTime, formatRange, abbrAbility, hitDcDescriptor, effectDescriptor, editionTag,
} from "../packages/obsidian/src/modules/pc/components/spells/spell-display";
import type { ResolvedSpell } from "@archivist-gg/dnd5e/pc/pc.types";

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
    expect(compactCastingTime(undefined)).toBe("\u2014");
    expect(compactCastingTime("weird")).toBe("weird"); // unknown passes through
  });

  // R4 {G5, G6} live rider N-1-17: on the 13-book install the Paladin's Spells tab mixed `1A` with
  // `bonus action` and `1 minute` in ONE column. The bundle spells all carry the tokens above, so the
  // odd spellings are a converted book's: the same token written with a space or a capital, which fell
  // through the switch to the raw string. The token is normalised before it is matched, so one
  // vocabulary reaches the column whatever the document spells.
  it("matches a token whatever its spacing, hyphenation or case", () => {
    expect(compactCastingTime("bonus action")).toBe("1BA");
    expect(compactCastingTime("Bonus Action")).toBe("1BA");
    expect(compactCastingTime("1 bonus action")).toBe("1BA");
    expect(compactCastingTime("1 minute")).toBe("1 min");
    expect(compactCastingTime("10 minutes")).toBe("10 min");
    expect(compactCastingTime("Action")).toBe("1A");
    expect(compactCastingTime(" reaction ")).toBe("1R");
    // Still verbatim when nothing matches, and the placeholder is unchanged.
    expect(compactCastingTime("1 week")).toBe("1 week");
    expect(compactCastingTime(undefined)).toBe("\u2014");
  });
});

describe("formatRange", () => {
  it("compacts feet and passes through keywords", () => {
    expect(formatRange("120 feet")).toBe("120 ft");
    expect(formatRange("5 feet")).toBe("5 ft");
    expect(formatRange("Self")).toBe("Self");
    expect(formatRange("Touch")).toBe("Touch");
    expect(formatRange("Special")).toBe("Special");
    expect(formatRange(undefined)).toBe("\u2014");
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
  it("returns the save descriptor (ability + DC) when the spell has a saving throw", () => {
    expect(hitDcDescriptor(sp({ saving_throw: { ability: "wisdom" } as never }), 14))
      .toEqual({ kind: "save", ability: "WIS", dc: 14 });
  });
  it("returns null when the spell has neither a saving throw nor a curated attack roll", () => {
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

describe("R4-G7 T7 live rider RIDER-4 · a PROSE reaction casting time", () => {
  // WITNESSED LIVE at S00 on `conv-diviner2024-20`'s Spells tab: Feather Fall's time cell read
  // `reaction (which you take when you or a creature you can see within 60 feet of you falls)` and
  // wrapped onto SEVEN lines in a column sized for `1A`, making that one row about five times the
  // height of its neighbours. MEASURED in the converter corpus: `casting_time` has 24 distinct values,
  // of which THIRTEEN are this `reaction (...)` prose shape (Feather Fall, Absorb Elements, Shield,
  // Counterspell, Silvery Barbs and their edition twins); the bare `reaction` token already compacts,
  // so only the ones carrying their trigger fell through verbatim.
  it("compacts a reaction that carries its trigger, and keeps every other token exactly as it was", () => {
    expect(compactCastingTime("reaction (which you take when you or a creature you can see within 60 feet of you falls)")).toBe("1R");
    expect(compactCastingTime("Reaction (which you take when you are hit by an attack)")).toBe("1R");
    expect(compactCastingTime("1 reaction, which you take when you are hit by an attack you can see or targeted by magic missile")).toBe("1R");
    // the controls: nothing else moves
    expect(compactCastingTime("reaction")).toBe("1R");
    expect(compactCastingTime("action")).toBe("1A");
    expect(compactCastingTime("bonus action")).toBe("1BA");
    expect(compactCastingTime("1 minute")).toBe("1 min");
    expect(compactCastingTime("1 week")).toBe("1 week");
    expect(compactCastingTime("weird")).toBe("weird");
    expect(compactCastingTime(undefined)).toBe("\u2014");
  });

  it("does not swallow a token that merely CONTAINS the word reaction", () => {
    // The LEADING token decides, so a minute cast with prose after it compacts to its minutes; the word
    // `reaction` later in the string never makes it a reaction.
    expect(compactCastingTime("1 minute (reaction optional)")).toBe("1 min");
    expect(compactCastingTime("reactionary")).toBe("reactionary");
  });
});

describe("compactCastingTime · a bonus action written without the word `action`", () => {
  // User request 2026-09-22: a hand-authored spell may write its casting time as `1 bonus` or plain
  // `bonus`. The matcher required the word `action`, so those fell through to the raw string in a
  // column sized for the compact label. The label also reads `1BA` now, in line with `1A` / `1R`.
  it("compacts `bonus` and `1 bonus` to 1BA, with or without trailing prose", () => {
    expect(compactCastingTime("bonus")).toBe("1BA");
    expect(compactCastingTime("1 bonus")).toBe("1BA");
    expect(compactCastingTime("1bonus")).toBe("1BA");
    expect(compactCastingTime("Bonus")).toBe("1BA");
    expect(compactCastingTime("1 Bonus, which you take immediately after hitting a creature")).toBe("1BA");
    expect(compactCastingTime("bonus-action")).toBe("1BA");
    expect(compactCastingTime("1 bonus action")).toBe("1BA");
  });

  it("does not swallow a token that merely CONTAINS the word bonus", () => {
    expect(compactCastingTime("bonuses")).toBe("bonuses");
    expect(compactCastingTime("1 minute (bonus action to end)")).toBe("1 min");
    expect(compactCastingTime("action")).toBe("1A");
  });
});

describe("compactCastingTime · action, minutes and hours in any spelling (shared parseCastingTime)", () => {
  // User report 2026-09-22 (screenshot): the Cast table printed `1 action` and `10 minute` raw beside `1A`
  // and `1BA`. The matcher only knew the bundle's exact tokens; it now reads through dnd5e's
  // `parseCastingTime`, the same reader the add-drawer filter uses.
  it("compacts the screenshot's rows", () => {
    expect(compactCastingTime("1 action")).toBe("1A");
    expect(compactCastingTime("10 minute")).toBe("10 min");
  });

  it("compacts every count / plural / spacing variant of action, minute and hour", () => {
    expect(compactCastingTime("1action")).toBe("1A");
    expect(compactCastingTime("1 Action")).toBe("1A");
    expect(compactCastingTime("1 action or 8 hours")).toBe("1A");
    expect(compactCastingTime("10 Minutes")).toBe("10 min");
    expect(compactCastingTime("1 min")).toBe("1 min");
    expect(compactCastingTime("1 hour")).toBe("1 hr");
    expect(compactCastingTime("8 hours")).toBe("8 hr");
    expect(compactCastingTime("24 hours")).toBe("24 hr");
    expect(compactCastingTime("12 hr")).toBe("12 hr");
  });

  it("still passes an unreadable token through verbatim", () => {
    expect(compactCastingTime("1 week")).toBe("1 week");
    expect(compactCastingTime("actions")).toBe("actions");
    expect(compactCastingTime("hourly")).toBe("hourly");
    expect(compactCastingTime(undefined)).toBe("\u2014");
  });
});
