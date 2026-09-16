/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { renderWeaponRow } from "../packages/obsidian/src/modules/pc/components/actions/weapons-table";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type { AttackRow, DamageRider } from "@archivist-gg/dnd5e/pc/pc.types";
import { CHOSEN_DAMAGE_TYPE_NOTE } from "@archivist-gg/dnd5e/dnd/math";

beforeAll(() => installObsidianDomHelpers());

/**
 * R4-G7 T6a E-4 (c) · what may go INSIDE the damage text.
 *
 * A damage chip is a ROLL: only a dice expression or a number, optionally with a canonical damage type,
 * can be one. A rider whose amount is prose ("your Wisdom modifier", "half your fighter level") is not a
 * roll, and printing it inside the dice text made the cell unreadable on 198 of the 3,977 weapon damage
 * cells the T6 offline pass measured. Those riders render as the row's CAPTION instead, the muted
 * `.pc-weapon-note` line under the weapon name that already carries the reroll-damage and attack-rule
 * captions. The engine resolves the amount and the damage type first (T6a's dnd5e commits), so what
 * reaches here is prose only where the DATA is prose.
 */

function renderRow(attacks: AttackRow[]): HTMLElement {
  const root = mountContainer();
  const list = root.createDiv({ cls: "pc-actions-table pc-weapons-table" });
  const ctx = {
    resolved: { definition: { equipment: [] } } as never,
    derived: { attacks } as never,
    services: { entities: { getBySlug: () => null } } as never,
    app: {} as never,
    editState: null,
  } as ComponentRenderContext;
  for (const a of attacks) renderWeaponRow(list, a, ctx);
  return list;
}

const swordWith = (riders: DamageRider[]): AttackRow[] => ([{
  id: "0:standard", name: "Longsword", range: "melee 5 ft.", toHit: 5,
  damageDice: "1d8 + 3", damageType: "slashing",
  damageRiders: riders,
  properties: [], proficient: true,
  breakdown: { toHit: [], damage: [] },
  informational: [], slotKey: "mainhand",
}] as unknown as AttackRow[]);

const damageText = (list: HTMLElement): string => list.querySelector(".pc-weapon-damage")!.textContent ?? "";
const captions = (list: HTMLElement): string =>
  Array.from(list.querySelectorAll(".pc-weapon-note")).map((n) => n.textContent ?? "").join(" | ");
const chips = (list: HTMLElement): number => list.querySelectorAll(".pc-weapon-damage .archivist-tag-damage").length;

describe("renderWeaponRow · damage riders that cannot be a dice chip", () => {
  it("a PROSE amount never reaches the damage text and renders as the row's caption", () => {
    const list = renderRow(swordWith([{ amount: "your Wisdom modifier", damage_type: "necrotic", source: "Divine Strike" }]));
    expect(damageText(list)).not.toContain("your Wisdom modifier");
    expect(damageText(list)).toContain("1d8 + 3");
    expect(captions(list)).toContain("your Wisdom modifier necrotic");
    expect(captions(list)).toContain("Divine Strike");
    expect(chips(list)).toBe(1); // the base damage only
  });

  it("a prose amount with no damage type is captioned too, and its source is optional", () => {
    const list = renderRow(swordWith([{ amount: "a number of d6s equal to your Rage Damage bonus" }]));
    expect(damageText(list)).not.toContain("Rage Damage");
    expect(captions(list)).toContain("a number of d6s equal to your Rage Damage bonus");
    expect(captions(list)).not.toContain("(");
  });

  it("CONTROL: a dice rider with a canonical type is still a chip inside the damage text", () => {
    const list = renderRow(swordWith([{ amount: "2d6", damage_type: "necrotic", source: "Wounding" }]));
    expect(damageText(list)).toContain("2d6 necrotic");
    expect(chips(list)).toBe(2); // base + rider
    expect(captions(list)).toBe("");
  });

  it("CONTROL: a rider carrying its type inside the amount is still a chip", () => {
    // `pc.equipment.ts`'s migrated manual override: `{amount: "1d6 fire"}` with no `damage_type`.
    const list = renderRow(swordWith([{ amount: "1d6 fire", source: "manual" }]));
    expect(damageText(list)).toContain("1d6 fire");
    expect(chips(list)).toBe(2);
    expect(captions(list)).toBe("");
  });

  it("CONTROL: a flat number rider is still a chip", () => {
    const list = renderRow(swordWith([{ amount: "2", damage_type: "Fire", source: "Rage" }]));
    expect(damageText(list)).toContain("2 Fire");
    expect(chips(list)).toBe(2);
    expect(captions(list)).toBe("");
  });

  it("a row mixing a chip rider and a prose rider keeps them apart", () => {
    const list = renderRow(swordWith([
      { amount: "1d8", damage_type: "radiant", source: "Divine Smite" },
      { amount: "your Charisma modifier", damage_type: "slashing", source: "Agonizing Blast" },
    ]));
    expect(damageText(list)).toContain("1d8 radiant");
    expect(damageText(list)).not.toContain("Charisma");
    expect(captions(list)).toContain("your Charisma modifier slashing");
    expect(chips(list)).toBe(2);
  });
});

/**
 * R4-G7 T8 RIDER-12 (F-RIDER (a)) · a rider that carries a `condition` is not damage on every hit.
 *
 * The engine now carries the source effect's `condition` on the rider (dnd5e `computeFeatureEffects`). A conditional
 * rider leaves the damage cell and prints in the row's caption with its condition, in the T6a E-4 (c) caption idiom:
 * `+ 2d8 radiant (Divine Smite: for a 1st-level spell slot)`. The damage cell keeps the unconditional riders only, so
 * a 5e Paladin reads `1d8 radiant` there instead of `2d8 radiant + 1d8 radiant + 1d8 radiant`. The policy is by FIELD,
 * never by prose: an always-on scope authored as a condition (PHB 2024 Radiant Strikes) moves too (the ruling).
 */
describe("renderWeaponRow · RIDER-12: a rider with a condition prints in the caption, never in the damage cell", () => {
  it("the Divine Smite shape: the conditional 2d8 leaves the damage cell, the unconditional 1d8 stays a chip", () => {
    const list = renderRow(swordWith([
      { amount: "2d8", damage_type: "radiant", source: "Divine Smite", condition: "for a 1st-level spell slot" },
      { amount: "1d8", damage_type: "radiant", source: "Improved Divine Smite" },
    ]));
    expect(damageText(list)).not.toContain("2d8");
    expect(damageText(list)).toContain("1d8 radiant");
    expect(chips(list)).toBe(2); // the base damage + the unconditional rider
    expect(captions(list)).toBe("+ 2d8 radiant (Divine Smite: for a 1st-level spell slot)");
  });

  it("a conditional rider with no source captions its condition alone", () => {
    const list = renderRow(swordWith([{ amount: "1d6", damage_type: "fire", condition: "while raging" }]));
    expect(damageText(list)).not.toContain("1d6 fire");
    expect(captions(list)).toBe("+ 1d6 fire (while raging)");
  });

  it("a conditional PROSE amount and an unconditional prose amount share the one caption line", () => {
    const list = renderRow(swordWith([
      { amount: "your Charisma modifier", damage_type: "force", source: "Agonizing Blast", condition: "When you cast eldritch blast" },
      { amount: "half your fighter level", damage_type: "slashing", source: "Brute" },
    ]));
    expect(captions(list)).toBe("+ your Charisma modifier force (Agonizing Blast: When you cast eldritch blast) · + half your fighter level slashing (Brute)");
    expect(chips(list)).toBe(1);
  });
});

/**
 * R4-G7 T8 RIDER-13 (F-RIDER (b)) · a `chosen` damage type is the player's pick, never the row's type and never a word.
 *
 * The engine keeps the schema's sentinel `chosen` on the rider (dnd5e `resolveDamageRider`). The row prints the amount
 * with NO type, in the caption, with the words from dnd5e's `CHOSEN_DAMAGE_TYPE_NOTE` after the source (and before a
 * condition, which follows a semicolon). T6a's renderer captioned it as `+ 1d8 chosen (Divine Strike)`.
 */
describe("renderWeaponRow · RIDER-13: a `chosen` rider prints type-less, captioned with the player's choice", () => {
  it("the Nature Domain Divine Strike shape: `+ 1d8 (Divine Strike: <the note>)`, no chip, no word `chosen`", () => {
    const list = renderRow(swordWith([{ amount: "1d8", damage_type: "chosen", source: "Divine Strike" }]));
    expect(captions(list)).toBe(`+ 1d8 (Divine Strike: ${CHOSEN_DAMAGE_TYPE_NOTE})`);
    expect(captions(list)).not.toContain("chosen");
    expect(chips(list)).toBe(1); // the base damage only
    expect(damageText(list)).toBe("1d8 + 3 slashing");
  });

  it("a `chosen` rider with a condition: the note first, the condition after a semicolon", () => {
    const list = renderRow(swordWith([{ amount: "your Charisma modifier", damage_type: "Chosen", source: "Agonizing Blast", condition: "When you cast eldritch blast" }]));
    expect(captions(list)).toBe(`+ your Charisma modifier (Agonizing Blast: ${CHOSEN_DAMAGE_TYPE_NOTE}; When you cast eldritch blast)`);
  });

  it("a `chosen` rider with no source captions the note alone", () => {
    const list = renderRow(swordWith([{ amount: "1d6", damage_type: "chosen" }]));
    expect(captions(list)).toBe(`+ 1d6 (${CHOSEN_DAMAGE_TYPE_NOTE})`);
  });
});
