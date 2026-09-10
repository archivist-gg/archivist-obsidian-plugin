/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { renderWeaponRow } from "../packages/obsidian/src/modules/pc/components/actions/weapons-table";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type { AttackRow, DamageRider } from "@archivist-gg/dnd5e/pc/pc.types";

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

describe("renderWeaponRow — damage riders that cannot be a dice chip", () => {
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
