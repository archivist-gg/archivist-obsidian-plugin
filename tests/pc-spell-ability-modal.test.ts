/** @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import { renderSpellAbilityBody } from "../packages/obsidian/src/modules/pc/components/spell-ability-modal";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type { Ability } from "@archivist-gg/dnd5e";
import type { SpellcastingClassInfo } from "@archivist-gg/dnd5e/pc/pc.types";

interface CtxOver {
  spellcastingClasses?: SpellcastingClassInfo[];
  spells?: { source: string }[];
  overrides?: {
    spellcasting_ability?: Ability;
    spellcasting_ability_by_class?: Record<string, Ability>;
  };
  abilitySpellcasting?: Partial<Record<Ability, { saveDC: number; attackBonus: number }>>;
}

// Minimal ComponentRenderContext for the pure body renderer: only the fields
// renderSpellAbilityBody reads (derived.spellcastingClasses, resolved.spells,
// resolved.definition.overrides, derived.abilitySpellcasting, editState).
// Boundary cast: the fixture is a structural stand-in, not a full resolve.
function ctx(over: CtxOver = {}): ComponentRenderContext {
  const shape = {
    resolved: {
      spells: over.spells ?? [],
      definition: { overrides: over.overrides ?? {} },
    },
    derived: {
      spellcastingClasses: over.spellcastingClasses ?? [],
      abilitySpellcasting: over.abilitySpellcasting ?? {},
    },
    editState: null,
  };
  return shape as unknown as ComponentRenderContext;
}

function bard(over: Partial<SpellcastingClassInfo> = {}): SpellcastingClassInfo {
  return {
    classSlug: "bard", className: "Bard", ability: "cha", defaultAbility: "cha",
    saveDC: 15, attackBonus: 7, casterType: "full", preparation: "known", ...over,
  };
}

describe("renderSpellAbilityBody", () => {
  it("renders one row per casting class with a six-ability toggle", () => {
    const host = document.createElement("div");
    renderSpellAbilityBody(host, ctx({ spellcastingClasses: [bard()] }));
    expect(host.querySelectorAll(".pc-spellability-row").length).toBe(1);
    expect(host.querySelectorAll(".pc-ability-seg").length).toBe(6);
    expect(host.querySelector(".pc-ability-seg.active")?.textContent).toBe("CHA");
  });
  it("renders the revert control only when overridden", () => {
    const host = document.createElement("div");
    renderSpellAbilityBody(host, ctx({
      spellcastingClasses: [bard({ ability: "wis", defaultAbility: "cha", saveDC: 13, attackBonus: 5 })],
      overrides: { spellcasting_ability_by_class: { bard: "wis" } },
    }));
    expect(host.querySelector(".pc-spellability-revert")?.textContent).toContain("CHA");
  });
  it("does not render a revert control when not overridden", () => {
    const host = document.createElement("div");
    renderSpellAbilityBody(host, ctx({ spellcastingClasses: [bard()] }));
    expect(host.querySelector(".pc-spellability-revert")).toBeNull();
  });
  it("renders the scroll row for a non-caster with scrolls", () => {
    const host = document.createElement("div");
    renderSpellAbilityBody(host, ctx({ spellcastingClasses: [], spells: [{ source: "item" }], abilitySpellcasting: {} }));
    expect(host.querySelectorAll(".pc-spellability-row").length).toBe(1);
    expect(host.querySelector(".pc-spellability-class")?.textContent).toBe("Spell Scrolls");
  });
});
