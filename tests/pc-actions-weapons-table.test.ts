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
});
