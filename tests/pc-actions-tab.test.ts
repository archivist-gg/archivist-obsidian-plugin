/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { ActionsTab } from "../packages/obsidian/src/modules/pc/components/actions-tab";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type { DerivedStats, ResolvedCharacter, AttackRow } from "@archivist-gg/dnd5e/pc/pc.types";

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
  services: { entities: { getBySlug: () => null } } as never,
  app: {} as never,
  editState: null,
});

const headings = (root: HTMLElement): string[] =>
  [...root.querySelectorAll(".pc-tab-heading")].map((n) => n.textContent ?? "");

describe("ActionsTab — Actions group (#7 attacks heading)", () => {
  it("renders the Attacks heading atop the Actions group", () => {
    const c = mountContainer();
    new ActionsTab().render(c, ctxFactory([sampleAttack()]));
    expect(headings(c)).toContain("Attacks");
  });

  it("uses derived.attacks names (no regex on equipment)", () => {
    const c = mountContainer();
    new ActionsTab().render(c, ctxFactory([sampleAttack({ name: "Flame Tongue Longsword" })]));
    expect([...c.querySelectorAll(".pc-action-row-name")].map((n) => n.textContent)).toContain("Flame Tongue Longsword");
  });

  it("renders no weapon rows when derived.attacks empty", () => {
    const c = mountContainer();
    new ActionsTab().render(c, ctxFactory([]));
    expect(c.querySelectorAll(".pc-weapons-table .pc-action-row").length).toBe(0);
  });

  it("shows the multiplier in the Attacks heading when attacksPerAction > 1 (#7)", () => {
    const c = mountContainer();
    const ctx = ctxFactory([sampleAttack()]);
    (ctx.derived as DerivedStats).attacksPerAction = 2;
    new ActionsTab().render(c, ctx);
    expect(headings(c)).toContain("Attacks (×2)");
  });

  it("keeps a plain Attacks heading when attacksPerAction is 1 (#7)", () => {
    const c = mountContainer();
    const ctx = ctxFactory([sampleAttack()]);
    (ctx.derived as DerivedStats).attacksPerAction = 1;
    new ActionsTab().render(c, ctx);
    const h = headings(c);
    expect(h).toContain("Attacks");
    expect(h).not.toContain("Attacks (×1)");
  });
});

describe("ActionsTab — grouped feature sections", () => {
  it("renders an action-bucket feature row under the Actions group", () => {
    const c = mountContainer();
    const features = [{
      feature: { name: "Eldritch Blast", action: "action", description: "A beam of crackling energy." } as never,
      source: { kind: "class", slug: "warlock", level: 1 } as never,
    }] as ResolvedCharacter["features"];
    new ActionsTab().render(c, ctxFactory([], features));
    expect([...c.querySelectorAll(".pc-feature-row .pc-action-row-name")].map((n) => n.textContent)).toContain("Eldritch Blast");
  });

  it("renders a Passive & Always-Active heading for an action-less feature", () => {
    const c = mountContainer();
    const features = [{
      feature: { name: "Darkvision", description: "You can see in the dark." } as never,
      source: { kind: "race", slug: "elf" } as never,
    }] as ResolvedCharacter["features"];
    new ActionsTab().render(c, ctxFactory([], features));
    expect(headings(c)).toContain("Passive & Always-Active");
    expect([...c.querySelectorAll(".pc-feature-row .pc-action-row-name")].map((n) => n.textContent)).toContain("Darkvision");
  });

  it("keeps the standard combat actions reference footer", () => {
    const c = mountContainer();
    new ActionsTab().render(c, ctxFactory([sampleAttack()]));
    expect(c.querySelector(".pc-standard-actions-title")?.textContent).toBe("Standard combat actions");
  });
});
