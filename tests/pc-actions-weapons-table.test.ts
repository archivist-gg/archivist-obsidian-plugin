/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { WeaponsTable } from "../src/modules/pc/components/actions/weapons-table";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";
import type { AttackRow } from "../src/modules/pc/pc.types";

beforeAll(() => installObsidianDomHelpers());

function ctxWithAttacks(attacks: AttackRow[]): ComponentRenderContext {
  return {
    resolved: { definition: { equipment: [] } } as never,
    derived: { attacks } as never,
    core: { entities: { getBySlug: () => null } } as never,
    app: {} as never,
    editState: null,
  };
}

function ctxWithRollModifiers(
  attacks: AttackRow[],
  rollModifiers: unknown[],
): ComponentRenderContext {
  return {
    resolved: { definition: { equipment: [] } } as never,
    derived: { attacks, rollModifiers } as never,
    core: { entities: { getBySlug: () => null } } as never,
    app: {} as never,
    editState: null,
  };
}

const sword = (): AttackRow => ([{
  id: "0:standard", name: "Longsword", range: "melee 5 ft.", toHit: 5,
  damageDice: "1d8 + 3", damageType: "slashing",
  properties: [], proficient: true,
  breakdown: { toHit: [], damage: [] },
  informational: [], slotKey: "mainhand",
}] as unknown as AttackRow[])[0];

describe("WeaponsTable", () => {
  it("renders one row per attack with cost badge defaulting to Action", () => {
    const root = mountContainer();
    const attacks = [{
      id: "0:standard", name: "Longsword", range: "melee 5 ft.", toHit: 5,
      damageDice: "1d8 + 3", damageType: "slashing",
      properties: ["versatile"], proficient: true,
      breakdown: { toHit: [], damage: [] },
      informational: [], slotKey: "mainhand",
    }] as unknown as AttackRow[];
    new WeaponsTable().render(root, ctxWithAttacks(attacks));
    const rows = root.querySelectorAll(".pc-action-row");
    expect(rows.length).toBe(1);
    expect(rows[0].querySelector(".pc-cost-badge.cost-action")).toBeTruthy();
    expect(rows[0].textContent).toContain("Longsword");
    expect(rows[0].textContent).toContain("+5");
    expect(rows[0].textContent).toContain("1d8 + 3");
  });

  it("renders versatile 1H + 2H damage stacked in damage cell", () => {
    const root = mountContainer();
    const attacks = [{
      id: "0:standard", name: "Longsword", range: "melee 5 ft.", toHit: 5,
      damageDice: "1d8 + 3", damageType: "slashing",
      versatile: { damageDice: "1d10 + 3" },
      properties: ["versatile"], proficient: true,
      breakdown: { toHit: [], damage: [] },
      informational: [], slotKey: "mainhand",
    }] as unknown as AttackRow[];
    new WeaponsTable().render(root, ctxWithAttacks(attacks));
    const dmgCell = root.querySelector(".pc-weapon-damage")?.textContent ?? "";
    expect(dmgCell).toContain("1d8 + 3");
    expect(dmgCell).toContain("1d10 + 3");
  });

  it("preserves situational sub-line when informational present", () => {
    const root = mountContainer();
    const attacks = [{
      id: "0:standard", name: "+1 Longsword", range: "melee 5 ft.", toHit: 6,
      damageDice: "1d8 + 4", damageType: "slashing",
      properties: ["versatile"], proficient: true,
      breakdown: { toHit: [], damage: [] },
      informational: [{
        source: "Frost Brand", value: 1, field: "weapon_attack",
        conditions: [{ kind: "vs_creature_type", value: "fire" }],
      }],
      slotKey: "mainhand",
    }] as unknown as AttackRow[];
    new WeaponsTable().render(root, ctxWithAttacks(attacks));
    expect(root.querySelector(".pc-attack-row-situational")).toBeTruthy();
  });

  it("formats toHit of 0 with explicit + sign", () => {
    const root = mountContainer();
    const attacks = [{
      id: "0:standard", name: "Club", range: "melee 5 ft.", toHit: 0,
      damageDice: "1d4", damageType: "bludgeoning",
      properties: [], proficient: true,
      breakdown: { toHit: [], damage: [] },
      informational: [], slotKey: "mainhand",
    }] as unknown as AttackRow[];
    new WeaponsTable().render(root, ctxWithAttacks(attacks));
    // The atk tag is rolled by the shared inline-tag renderer, which formats
    // the text as "+N to hit" and exposes the raw modifier via data-dice-notation.
    const hit = root.querySelector(".pc-weapon-hit .archivist-tag-atk");
    expect(hit?.getAttribute("data-dice-notation")).toBe("+0");
    expect(hit?.textContent).toContain("+0");
  });

  it("appends extraDamage to the damage cell when present", () => {
    const root = mountContainer();
    const attacks = [{
      id: "mainhand", name: "Flame Tongue Longsword",
      range: "melee 5 ft.", toHit: 6, damageDice: "1d8 + 4", damageType: "slashing",
      extraDamage: "2d6 fire",
      properties: [], proficient: true,
      breakdown: { toHit: [], damage: [] },
      informational: [], slotKey: "mainhand",
    }] as unknown as AttackRow[];
    new WeaponsTable().render(root, ctxWithAttacks(attacks));
    const dmgCell = root.querySelector(".pc-weapon-damage")?.textContent ?? "";
    expect(dmgCell).toContain("1d8 + 4");
    expect(dmgCell).toContain("slashing");
    expect(dmgCell).toContain("2d6 fire");
    // The extraDamage gets its own click-to-roll tag so it's rollable.
    const tags = root.querySelectorAll(".pc-weapon-damage .archivist-tag-damage");
    expect(tags.length).toBe(2);
    expect(tags[1]?.textContent).toBe("2d6 fire");
  });

  it("clicking a weapon row marks it .pc-row-open (and unmarks on re-click)", () => {
    const root = mountContainer();
    const attacks = [{
      id: "0:standard", name: "Longsword", range: "melee 5 ft.", toHit: 5,
      damageDice: "1d8 + 3", damageType: "slashing",
      properties: [], proficient: true,
      breakdown: { toHit: [], damage: [] },
      informational: [], slotKey: "mainhand",
    }] as unknown as AttackRow[];
    new WeaponsTable().render(root, ctxWithAttacks(attacks));
    const row = () => root.querySelector(".pc-action-row") as HTMLElement;
    expect(row().classList.contains("pc-row-open")).toBe(false);
    row().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(row().classList.contains("pc-row-open")).toBe(true);
    row().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(row().classList.contains("pc-row-open")).toBe(false);
  });

  it("renders no situational sub-line when informational is undefined", () => {
    const root = mountContainer();
    const attacks = [{
      id: "0:standard", name: "Longsword", range: "melee 5 ft.", toHit: 5,
      damageDice: "1d8 + 3", damageType: "slashing",
      properties: ["versatile"], proficient: true,
      breakdown: { toHit: [], damage: [] },
      informational: undefined, slotKey: "mainhand",
    }] as unknown as AttackRow[];
    new WeaponsTable().render(root, ctxWithAttacks(attacks));
    expect(root.querySelector(".pc-attack-row-situational")).toBeNull();
  });

  it("renders rows as divs, not a <table>", () => {
    const root = mountContainer();
    const attacks = [{
      id: "0:standard", name: "Longsword", range: "melee 5 ft.", toHit: 5,
      damageDice: "1d8 + 3", damageType: "slashing",
      properties: [], proficient: true, breakdown: { toHit: [], damage: [] },
      informational: [], slotKey: "mainhand",
    }] as unknown as AttackRow[];
    new WeaponsTable().render(root, ctxWithAttacks(attacks));
    expect(root.querySelector("table")).toBeNull();
    expect(root.querySelector(".pc-action-row")?.tagName).toBe("DIV");
  });

  it("renders an ADV chip in the hit cell for an attack-scope advantage roll-modifier", () => {
    const root = mountContainer();
    new WeaponsTable().render(root, ctxWithRollModifiers([sword()], [
      { mode: "advantage", roll: "attack", condition: "in dim light or darkness", label: "Devil's Sight" },
    ]));
    const hitCell = root.querySelector(".pc-weapon-hit") as HTMLElement;
    const adv = hitCell.querySelector(".pc-cond-tag.pc-cond-tag-adv");
    expect(adv).not.toBeNull();
    expect(adv?.textContent).toBe("ADV");
  });

  it("renders a DIS chip for an attack-scope disadvantage roll-modifier", () => {
    const root = mountContainer();
    new WeaponsTable().render(root, ctxWithRollModifiers([sword()], [
      { mode: "disadvantage", roll: "attack", label: "Some Curse" },
    ]));
    const hitCell = root.querySelector(".pc-weapon-hit") as HTMLElement;
    expect(hitCell.querySelector(".pc-cond-tag.pc-cond-tag-dis")?.textContent).toBe("DIS");
  });

  it("renders a crit caption in the damage cell when critRange < 20", () => {
    const root = mountContainer();
    const attacks = [{
      id: "0:standard", name: "Greatsword", range: "melee 5 ft.", toHit: 6,
      damageDice: "2d6 + 4", damageType: "slashing",
      properties: [], proficient: true,
      breakdown: { toHit: [], damage: [] },
      informational: [], slotKey: "mainhand", critRange: 19,
    }] as unknown as AttackRow[];
    new WeaponsTable().render(root, ctxWithAttacks(attacks));
    const crit = root.querySelector(".pc-weapon-crit");
    expect(crit).not.toBeNull();
    expect(crit?.textContent).toBe("crit 19–20");
  });

  it("renders no crit caption when critRange is undefined", () => {
    const root = mountContainer();
    new WeaponsTable().render(root, ctxWithAttacks([sword()]));
    expect(root.querySelector(".pc-weapon-crit")).toBeNull();
  });

  it("renders no crit caption when critRange is exactly 20", () => {
    const root = mountContainer();
    const attacks = [{
      id: "0:standard", name: "Longsword", range: "melee 5 ft.", toHit: 5,
      damageDice: "1d8 + 3", damageType: "slashing",
      properties: [], proficient: true,
      breakdown: { toHit: [], damage: [] },
      informational: [], slotKey: "mainhand", critRange: 20,
    }] as unknown as AttackRow[];
    new WeaponsTable().render(root, ctxWithAttacks(attacks));
    expect(root.querySelector(".pc-weapon-crit")).toBeNull();
  });

  it("renders attackNotes joined with separator as a muted caption under the name", () => {
    const root = mountContainer();
    const attacks = [{
      id: "0:standard", name: "Greatsword", range: "melee 5 ft.", toHit: 6,
      damageDice: "2d6 + 4", damageType: "slashing",
      properties: [], proficient: true,
      breakdown: { toHit: [], damage: [] },
      informational: [], slotKey: "mainhand",
      attackNotes: ["Reroll 2s", "No disadvantage firing in melee"],
    }] as unknown as AttackRow[];
    new WeaponsTable().render(root, ctxWithAttacks(attacks));
    const note = root.querySelector(".pc-weapon-name .pc-weapon-note");
    expect(note).not.toBeNull();
    expect(note?.textContent).toBe("Reroll 2s · No disadvantage firing in melee");
  });

  it("renders no attack-note caption when attackNotes is absent", () => {
    const root = mountContainer();
    new WeaponsTable().render(root, ctxWithAttacks([sword()]));
    expect(root.querySelector(".pc-weapon-note")).toBeNull();
  });

  it("does NOT render a roll-modifier chip scoped to ability-check on the weapon row", () => {
    const root = mountContainer();
    new WeaponsTable().render(root, ctxWithRollModifiers([sword()], [
      { mode: "advantage", roll: "ability-check", scope: "deception", label: "Liar" },
    ]));
    const hitCell = root.querySelector(".pc-weapon-hit") as HTMLElement;
    expect(hitCell.querySelector(".pc-cond-tag")).toBeNull();
  });

  it("expands as a full-width sibling div carrying the open tint", () => {
    const root = mountContainer();
    const attacks = [{
      id: "0:standard", name: "Longsword", range: "melee 5 ft.", toHit: 5,
      damageDice: "1d8 + 3", damageType: "slashing",
      properties: [], proficient: true, breakdown: { toHit: [], damage: [] },
      informational: [], slotKey: "mainhand",
    }] as unknown as AttackRow[];
    new WeaponsTable().render(root, ctxWithAttacks(attacks));
    (root.querySelector(".pc-action-row") as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const expand = root.querySelector(".pc-action-expand") as HTMLElement;
    expect(expand).not.toBeNull();
    expect(expand.tagName).toBe("DIV");
    expect(expand.classList.contains("pc-open-expand")).toBe(true);
    expect(root.querySelector("table")).toBeNull();
  });
});
