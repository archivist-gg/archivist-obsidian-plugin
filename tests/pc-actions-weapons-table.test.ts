/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { renderWeaponRow } from "../packages/obsidian/src/modules/pc/components/actions/weapons-table";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type { AttackRow } from "@archivist-gg/dnd5e/pc/pc.types";

beforeAll(() => installObsidianDomHelpers());

/**
 * Task 4: the weapon renderer is now ROW-ONLY. It renders directly into a
 * caller-provided `list`, one `.pc-action-row` (+ sibling hidden expand) per
 * attack — no section head, no self-redraw. This helper stands in for the tab
 * (Task 5) that will dispatch each attack to `renderWeaponRow`.
 */
function renderWeapons(root: HTMLElement, attacks: AttackRow[], ctx: ComponentRenderContext): HTMLElement {
  const list = root.createDiv({ cls: "pc-actions-table pc-weapons-table" });
  for (const a of attacks) renderWeaponRow(list, a, ctx);
  return list;
}

function ctxWithAttacks(attacks: AttackRow[]): ComponentRenderContext {
  return {
    resolved: { definition: { equipment: [] } } as never,
    derived: { attacks } as never,
    services: { entities: { getBySlug: () => null } } as never,
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
    services: { entities: { getBySlug: () => null } } as never,
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

describe("renderWeaponRow", () => {
  it("renders one row per attack with cost badge defaulting to Action", () => {
    const root = mountContainer();
    const attacks = [{
      id: "0:standard", name: "Longsword", range: "melee 5 ft.", toHit: 5,
      damageDice: "1d8 + 3", damageType: "slashing",
      properties: ["versatile"], proficient: true,
      breakdown: { toHit: [], damage: [] },
      informational: [], slotKey: "mainhand",
    }] as unknown as AttackRow[];
    renderWeapons(root, attacks, ctxWithAttacks(attacks));
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
    renderWeapons(root, attacks, ctxWithAttacks(attacks));
    const dmgCell = root.querySelector(".pc-weapon-damage")?.textContent ?? "";
    expect(dmgCell).toContain("1d8 + 3");
    expect(dmgCell).toContain("1d10 + 3");
  });

  it("renders the field label (to hit / dmg) on weapon situational rows", () => {
    const root = mountContainer();
    const attacks = [{
      id: "0:standard", name: "Frost Brand", range: "melee 5 ft.", toHit: 6,
      damageDice: "1d8 + 4", damageType: "slashing",
      properties: [], proficient: true,
      breakdown: { toHit: [], damage: [] },
      informational: [
        { source: "Frost Brand", value: 1, field: "weapon_attack", conditions: [{ kind: "vs_creature_type", value: "fire" }] },
        { source: "Frost Brand", value: 2, field: "weapon_damage", conditions: [{ kind: "vs_creature_type", value: "fire" }] },
      ],
      slotKey: "mainhand",
    }] as unknown as AttackRow[];
    renderWeapons(root, attacks, ctxWithAttacks(attacks));
    const sub = root.querySelector(".pc-attack-row-situational");
    expect(sub).not.toBeNull();
    const text = sub?.textContent ?? "";
    expect(text).toContain("to hit");
    expect(text).toContain("dmg");
    // The label is its own span between the amount and the condition.
    expect(sub?.querySelector(".pc-situational-field")).not.toBeNull();
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
    renderWeapons(root, attacks, ctxWithAttacks(attacks));
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
    renderWeapons(root, attacks, ctxWithAttacks(attacks));
    // The atk tag is rolled by the shared inline-tag renderer, which formats
    // the text as "+N to hit" and exposes the raw modifier via data-dice-notation.
    const hit = root.querySelector(".pc-weapon-hit .archivist-tag-atk");
    expect(hit?.getAttribute("data-dice-notation")).toBe("+0");
    expect(hit?.textContent).toContain("+0");
  });

  it("renders each damageRider as its own damage tag (source not inline)", () => {
    const root = mountContainer();
    const attacks = [{
      id: "gs", name: "Greatsword",
      range: "melee 5 ft.", toHit: 9, damageDice: "2d6+5", damageType: "slashing",
      damageRiders: [
        { amount: "2d6", damage_type: "necrotic", source: "Wounding" },
        { amount: "1d8", damage_type: "necrotic", source: "Terrorizing Force" },
      ],
      properties: [], proficient: true,
      breakdown: { toHit: [], damage: [] },
      informational: [], slotKey: "mainhand",
    }] as unknown as AttackRow[];
    renderWeapons(root, attacks, ctxWithAttacks(attacks));
    const dmg = root.querySelector(".pc-weapon-damage")!;
    // base + two rider chips = 3 rollable damage tags.
    expect(dmg.querySelectorAll(".archivist-tag-damage").length).toBeGreaterThanOrEqual(3);
    expect(dmg.textContent).toContain("2d6 necrotic");
    expect(dmg.textContent).toContain("1d8 necrotic");
    expect(dmg.textContent).not.toContain("Wounding"); // source is NOT inline
    // ...but the source IS surfaced on each rider chip's hover title.
    const chips = [...dmg.querySelectorAll(".archivist-tag-damage")] as HTMLElement[];
    const riderTitles = chips.map((c) => c.title).join(" | ");
    expect(riderTitles).toContain("Wounding");
    expect(riderTitles).toContain("Terrorizing Force");
  });

  it("clicking a weapon row toggles .pc-row-open IN PLACE (no container redraw)", () => {
    const root = mountContainer();
    const attacks = [{
      id: "0:standard", name: "Longsword", range: "melee 5 ft.", toHit: 5,
      damageDice: "1d8 + 3", damageType: "slashing",
      properties: [], proficient: true,
      breakdown: { toHit: [], damage: [] },
      informational: [], slotKey: "mainhand",
    }] as unknown as AttackRow[];
    renderWeapons(root, attacks, ctxWithAttacks(attacks));
    const row = root.querySelector(".pc-action-row") as HTMLElement;
    const expand = row.nextElementSibling as HTMLElement & { hidden: boolean };
    expect(expand.classList.contains("pc-action-expand")).toBe(true);
    expect(row.classList.contains("pc-row-open")).toBe(false);
    expect(expand.hidden).toBe(true);

    row.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    // Same node survived the click → no self-redraw of the container.
    expect(root.querySelector(".pc-action-row")).toBe(row);
    expect(row.classList.contains("pc-row-open")).toBe(true);
    expect(expand.hidden).toBe(false);

    row.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(root.querySelector(".pc-action-row")).toBe(row);
    expect(row.classList.contains("pc-row-open")).toBe(false);
    expect(expand.hidden).toBe(true);
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
    renderWeapons(root, attacks, ctxWithAttacks(attacks));
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
    renderWeapons(root, attacks, ctxWithAttacks(attacks));
    expect(root.querySelector("table")).toBeNull();
    expect(root.querySelector(".pc-action-row")?.tagName).toBe("DIV");
  });

  it("renders an ADV chip in the hit cell for an attack-scope advantage roll-modifier", () => {
    const root = mountContainer();
    const attacks = [sword()];
    renderWeapons(root, attacks, ctxWithRollModifiers(attacks, [
      { mode: "advantage", roll: "attack", condition: "in dim light or darkness", label: "Devil's Sight" },
    ]));
    const hitCell = root.querySelector(".pc-weapon-hit") as HTMLElement;
    const adv = hitCell.querySelector(".pc-cond-tag.pc-cond-tag-adv");
    expect(adv).not.toBeNull();
    expect(adv?.textContent).toBe("ADV");
  });

  it("renders a DIS chip for an attack-scope disadvantage roll-modifier", () => {
    const root = mountContainer();
    const attacks = [sword()];
    renderWeapons(root, attacks, ctxWithRollModifiers(attacks, [
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
    renderWeapons(root, attacks, ctxWithAttacks(attacks));
    const crit = root.querySelector(".pc-weapon-crit");
    expect(crit).not.toBeNull();
    expect(crit?.textContent).toBe("crit 19–20");
  });

  it("renders no crit caption when critRange is undefined", () => {
    const root = mountContainer();
    const attacks = [sword()];
    renderWeapons(root, attacks, ctxWithAttacks(attacks));
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
    renderWeapons(root, attacks, ctxWithAttacks(attacks));
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
    renderWeapons(root, attacks, ctxWithAttacks(attacks));
    const note = root.querySelector(".pc-weapon-name .pc-weapon-note");
    expect(note).not.toBeNull();
    expect(note?.textContent).toBe("Reroll 2s · No disadvantage firing in melee");
  });

  it("renders no attack-note caption when attackNotes is absent", () => {
    const root = mountContainer();
    const attacks = [sword()];
    renderWeapons(root, attacks, ctxWithAttacks(attacks));
    expect(root.querySelector(".pc-weapon-note")).toBeNull();
  });

  it("does NOT render a roll-modifier chip scoped to ability-check on the weapon row", () => {
    const root = mountContainer();
    const attacks = [sword()];
    renderWeapons(root, attacks, ctxWithRollModifiers(attacks, [
      { mode: "advantage", roll: "ability-check", scope: "deception", label: "Liar" },
    ]));
    const hitCell = root.querySelector(".pc-weapon-hit") as HTMLElement;
    expect(hitCell.querySelector(".pc-cond-tag")).toBeNull();
  });

  it("expands as a full-width sibling div carrying the open tint (hidden until clicked)", () => {
    const root = mountContainer();
    const attacks = [{
      id: "0:standard", name: "Longsword", range: "melee 5 ft.", toHit: 5,
      damageDice: "1d8 + 3", damageType: "slashing",
      properties: [], proficient: true, breakdown: { toHit: [], damage: [] },
      informational: [], slotKey: "mainhand",
    }] as unknown as AttackRow[];
    renderWeapons(root, attacks, ctxWithAttacks(attacks));
    const expand = root.querySelector(".pc-action-expand") as HTMLElement & { hidden: boolean };
    // The expand panel exists from the first render, hidden.
    expect(expand).not.toBeNull();
    expect(expand.tagName).toBe("DIV");
    expect(expand.classList.contains("pc-open-expand")).toBe(true);
    expect(expand.hidden).toBe(true);
    (root.querySelector(".pc-action-row") as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(expand.hidden).toBe(false);
    expect(root.querySelector("table")).toBeNull();
  });
});
