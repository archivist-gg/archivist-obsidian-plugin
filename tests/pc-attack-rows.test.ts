/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { AttackRows } from "../src/modules/pc/components/attack-rows";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";
import type { DerivedStats, AttackRow, ResolvedCharacter } from "../src/modules/pc/pc.types";

beforeAll(() => installObsidianDomHelpers());

const sampleAttack = (overrides: Partial<AttackRow> = {}): AttackRow => ({
  id: "0:standard", name: "Longsword", range: "melee", toHit: 5,
  damageDice: "1d8+3", damageType: "slashing",
  properties: ["versatile"], proficient: true,
  breakdown: { toHit: [{ source: "STR modifier", amount: 3, kind: "ability" }, { source: "Proficiency bonus", amount: 2, kind: "ability" }], damage: [] },
  ...overrides,
});

const ctx = (attacks: AttackRow[]): ComponentRenderContext => ({
  resolved: { definition: { equipment: [] } } as unknown as ResolvedCharacter,
  derived: { attacks } as unknown as DerivedStats,
  core: {} as never,
  editState: null,
});

describe("AttackRows", () => {
  it("renders one row per attack", () => {
    const c = mountContainer();
    new AttackRows().render(c, ctx([sampleAttack(), sampleAttack({ id: "0:versatile", name: "Longsword (versatile, 2h)", damageDice: "1d10+3" })]));
    expect(c.querySelectorAll(".pc-attack-row")).toHaveLength(2);
  });

  it("renders empty-state when no attacks", () => {
    const c = mountContainer();
    new AttackRows().render(c, ctx([]));
    expect(c.querySelector(".pc-empty-line")?.textContent).toMatch(/no attacks/i);
  });

  it("formats toHit with sign", () => {
    const c = mountContainer();
    new AttackRows().render(c, ctx([sampleAttack({ toHit: 0 })]));
    const tohit = c.querySelector(".pc-attack-tohit");
    expect(tohit?.textContent).toBe("+0");
  });

  it("includes extraDamage in damage cell when present", () => {
    const c = mountContainer();
    new AttackRows().render(c, ctx([sampleAttack({ extraDamage: "1d6 fire" })]));
    expect(c.querySelector(".pc-attack-damage")?.textContent).toMatch(/1d6 fire/);
  });
});
