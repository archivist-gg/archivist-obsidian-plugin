/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { renderCastView } from "../packages/obsidian/src/modules/pc/components/spells/cast-view";
import { EMPTY_CELL } from "../packages/obsidian/src/modules/pc/components/spells/spell-display";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";

beforeAll(() => installObsidianDomHelpers());

// ─────────────────────────────────────────────────────────────────────────────
// Task 3e · feat-granted spells in the Cast view. A NON-caster (Fighter with a
// Magic-Initiate-shaped feat) has no class caster and no spell slots, yet its
// feat spells carry their OWN spellcasting ability. Their DC must come from
// derived.abilitySpellcasting (NOT the empty class list, which would show 0),
// and a leveled feat spell must still surface as an always-prepared, free cast.
// ─────────────────────────────────────────────────────────────────────────────

const featCantrip = {
  entity: { name: "Sacred Flame", level: 0, school: "evocation", saving_throw: { ability: "dexterity" } },
  slug: "sacred-flame", classSlug: null, source: "feat", prepared: true, alwaysPrepared: true, ability: "wis",
};
const featLevel1 = {
  entity: { name: "Command", level: 1, school: "enchantment", saving_throw: { ability: "wisdom" } },
  slug: "command", classSlug: null, source: "feat", prepared: true, alwaysPrepared: true, ability: "wis",
};

// abilitySpellcasting.wis for a Fighter 5 (prof 3) with WIS 16 (+3): DC 14, atk +6.
function nonCasterCtx(spells: unknown[]): ComponentRenderContext {
  return {
    resolved: {
      definition: { overrides: {} },
      state: { spell_slots: {} },
      spells,
    },
    derived: {
      spellcastingClasses: [],
      derivedSpellSlots: {},
      pactMagic: null,
      abilitySpellcasting: { wis: { saveDC: 14, attackBonus: 6 } },
    },
    editState: null,
  } as never;
}

// R4-G3b §6 · a RACE grant on the same non-caster. A second builder rather than a
// parameter on nonCasterCtx, so every pre-existing case above stays byte-unchanged.
// abilitySpellcasting.con for an Air Genasi Fighter 5 (prof 3) with CON 14 (+2): DC 13, atk +5.
const raceSpell = {
  entity: { name: "Levitate", level: 2, school: "transmutation", saving_throw: { ability: "constitution" } },
  slug: "eepc_spell_levitate", classSlug: null, source: "race", prepared: true, alwaysPrepared: true, ability: "con",
};
function nonCasterConCtx(spells: unknown[]): ComponentRenderContext {
  return {
    resolved: {
      definition: { overrides: {} },
      state: { spell_slots: {} },
      spells,
    },
    derived: {
      spellcastingClasses: [],
      derivedSpellSlots: {},
      pactMagic: null,
      abilitySpellcasting: { con: { saveDC: 13, attackBonus: 5 } },
    },
    editState: null,
  } as never;
}

const rowByName = (root: HTMLElement, name: string): HTMLElement | undefined =>
  [...root.querySelectorAll<HTMLElement>(".pc-spell-cast-row")].find(
    (r) => r.querySelector(".pc-spell-name")?.textContent === name,
  );
const dcOf = (row: HTMLElement): string | undefined => row.querySelector(".pc-spell-hitdc-v")?.textContent ?? undefined;
const secLabels = (root: HTMLElement): string[] =>
  [...root.querySelectorAll(".pc-spell-sec-label")].map((n) => n.textContent ?? "");

describe("renderCastView · feat-granted spells (non-caster)", () => {
  it("renders a feat cantrip At Will with its OWN save DC (not 0) and an always marker", () => {
    const root = mountContainer();
    renderCastView(root, nonCasterCtx([featCantrip]));
    const row = rowByName(root, "Sacred Flame");
    expect(row).toBeDefined();
    expect(row!.querySelector(".pc-spell-atwill")?.textContent).toBe("At Will");
    expect(dcOf(row!)).toBe("14"); // from abilitySpellcasting.wis, NOT spellcastingClasses[0] ?? 0
    expect(row!.querySelector(".pc-spell-always")).not.toBeNull();
  });

  it("surfaces a leveled feat spell in its level section as an always-prepared free cast, own DC, no slot/CAST", () => {
    const root = mountContainer();
    renderCastView(root, nonCasterCtx([featLevel1]));
    expect(secLabels(root)).toContain("1st Level"); // section exists despite zero owned slots
    const row = rowByName(root, "Command");
    expect(row).toBeDefined();
    expect(dcOf(row!)).toBe("14");
    expect(row!.querySelector(".pc-spell-always")).not.toBeNull();
    // Free cast, not a slot-consuming CAST button, and no slot tracker invented.
    expect(row!.querySelector(".pc-spell-free")).not.toBeNull();
    expect(row!.querySelector(".pc-spell-castbtn")).toBeNull();
    expect(root.querySelector(".pc-spell-slots")).toBeNull();
  });

  it("renders both a feat cantrip and a leveled feat spell together", () => {
    const root = mountContainer();
    renderCastView(root, nonCasterCtx([featCantrip, featLevel1]));
    expect(secLabels(root)).toEqual(expect.arrayContaining(["Cantrips", "1st Level"]));
    expect(dcOf(rowByName(root, "Sacred Flame")!)).toBe("14");
    expect(dcOf(rowByName(root, "Command")!)).toBe("14");
  });
});

// R4 {G5, G6} live rider N-1-19: on the Paladin's Spells tab `Protection from Evil and Good` carries no
// `components` value, so its Components cell was EMPTY while every neighbour read `V` or `V S M`, and
// the row sat a line short. The cell takes the same placeholder the Range cell already prints for an
// absent value; the glyph itself is untouched (P8 owns the null-glyph ruling).
describe("renderCastView · an absent cell value keeps the row's rhythm", () => {
  const noComponents = {
    entity: { name: "Protection from Evil and Good", level: 1, school: "abjuration" },
    slug: "protection-from-evil-and-good", classSlug: null, source: "feat",
    prepared: true, alwaysPrepared: true, ability: "wis",
  };

  it("prints the placeholder in the Components cell when the spell carries none", () => {
    const root = mountContainer();
    renderCastView(root, nonCasterCtx([noComponents]));
    const row = rowByName(root, "Protection from Evil and Good")!;
    expect(row).toBeDefined();
    expect(row.querySelector(".pc-spell-comp")?.textContent).toBe(EMPTY_CELL);
    // The same placeholder the Range cell prints for an absent range, and one glyph for both.
    expect(row.querySelector(".pc-spell-range")?.textContent).toBe(EMPTY_CELL);
  });

  it("prints the letters, not the placeholder, when the spell carries components", () => {
    const root = mountContainer();
    renderCastView(root, nonCasterCtx([{ ...noComponents, entity: { ...noComponents.entity, components: "V, S" } }]));
    const row = rowByName(root, "Protection from Evil and Good")!;
    expect(row.querySelector(".pc-spell-comp")?.textContent).toBe("V S");
  });
});

describe("renderCastView · race-granted spells (non-caster) · R4-G3b §6", () => {
  it("surfaces a leveled race grant in its own free-cast level section, with its OWN (CON) DC", () => {
    // RED FIRST before Task 7 (plugin 7bb5d39b): the free-cast block read
    // `s.source === "feat"`, so a race row produced no "2nd Level" section at all.
    const root = mountContainer();
    renderCastView(root, nonCasterConCtx([raceSpell]));
    expect(secLabels(root)).toContain("2nd Level"); // section exists despite zero owned slots
    const row = rowByName(root, "Levitate");
    expect(row).toBeDefined();
    expect(dcOf(row!)).toBe("13"); // from abilitySpellcasting.con, NOT spellcastingClasses[0] ?? 0
    expect(row!.querySelector(".pc-spell-free")).not.toBeNull();
    expect(row!.querySelector(".pc-spell-castbtn")).toBeNull();
    expect(row!.querySelector(".pc-spell-always")).not.toBeNull();
  });
});
