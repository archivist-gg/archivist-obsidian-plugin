/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { renderCastView } from "../packages/obsidian/src/modules/pc/components/spells/cast-view";
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
