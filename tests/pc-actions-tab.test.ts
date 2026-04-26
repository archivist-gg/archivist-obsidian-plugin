/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { ActionsTab } from "../src/modules/pc/components/actions-tab";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";
import type { DerivedStats, ResolvedCharacter, AttackRow } from "../src/modules/pc/pc.types";

beforeAll(() => installObsidianDomHelpers());

const sampleAttack = (overrides: Partial<AttackRow> = {}): AttackRow => ({
  id: "0:standard", name: "Longsword", range: "melee", toHit: 5,
  damageDice: "1d8+3", damageType: "slashing", properties: [], proficient: true,
  breakdown: { toHit: [], damage: [] }, ...overrides,
});

const ctxFactory = (attacks: AttackRow[], features: ResolvedCharacter["features"] = []): ComponentRenderContext => ({
  resolved: {
    definition: { equipment: [] }, race: null, classes: [], background: null,
    feats: [], totalLevel: 1, features, state: {} as never,
  } as unknown as ResolvedCharacter,
  derived: { attacks } as DerivedStats,
  core: {} as never,
  editState: null,
});

describe("ActionsTab", () => {
  it("renders the Attacks heading", () => {
    const c = mountContainer();
    new ActionsTab().render(c, ctxFactory([sampleAttack()]));
    expect([...c.querySelectorAll(".pc-tab-heading")].map((n) => n.textContent)).toContain("Attacks");
  });

  it("uses derived.attacks names (no regex on equipment)", () => {
    const c = mountContainer();
    new ActionsTab().render(c, ctxFactory([sampleAttack({ name: "Flame Tongue Longsword" })]));
    expect([...c.querySelectorAll(".pc-attack-name")].map((n) => n.textContent)).toContain("Flame Tongue Longsword");
  });

  it("falls back to empty-state when derived.attacks empty", () => {
    const c = mountContainer();
    new ActionsTab().render(c, ctxFactory([]));
    expect(c.textContent).toMatch(/no attacks/i);
  });

  it("renders feature attacks below weapon attacks", () => {
    const c = mountContainer();
    const features = [{
      feature: { name: "Eldritch Blast", attacks: [{ name: "Eldritch Blast", to_hit: "+5", damage: "1d10 force" }] } as never,
      source: { kind: "class", slug: "warlock", level: 1 } as never,
    }];
    new ActionsTab().render(c, ctxFactory([], features));
    expect(c.textContent).toMatch(/Eldritch Blast/);
  });
});
