/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { ActionsTab } from "../packages/obsidian/src/modules/pc/components/actions-tab";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { buildMockRegistry } from "./fixtures/pc/mock-entity-registry";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type {
  DerivedStats,
  ResolvedCharacter,
  AttackRow,
  EquipmentEntry,
} from "@archivist-gg/dnd5e/pc/pc.types";
import type { EntityRegistry } from "@archivist-gg/core";

beforeAll(() => installObsidianDomHelpers());

const sampleAttack = (overrides: Partial<AttackRow> = {}): AttackRow => ({
  id: "0:standard", name: "Longsword", range: "melee", toHit: 5,
  damageDice: "1d8+3", damageType: "slashing", properties: [], proficient: true,
  breakdown: { toHit: [], damage: [] }, ...overrides,
});

interface CtxOpts {
  attacks?: AttackRow[];
  features?: ResolvedCharacter["features"];
  equipment?: EquipmentEntry[];
  registry?: EntityRegistry;
  attacksPerAction?: number;
}

const ctxFactory = (opts: CtxOpts = {}): ComponentRenderContext => ({
  resolved: {
    definition: { equipment: opts.equipment ?? [] }, race: null, classes: [], background: null,
    feats: [], totalLevel: 1, features: opts.features ?? [], pools: [], state: {} as never,
  } as unknown as ResolvedCharacter,
  derived: { attacks: opts.attacks ?? [], attacksPerAction: opts.attacksPerAction } as DerivedStats,
  services: { entities: opts.registry ?? buildMockRegistry([]) } as never,
  app: {} as never,
  editState: null,
});

const headings = (root: HTMLElement): string[] =>
  [...root.querySelectorAll(".pc-tab-heading")].map((n) => n.textContent ?? "");
const subGroupTitles = (root: HTMLElement): string[] =>
  [...root.querySelectorAll(".pc-actions-section-head .pc-actions-section-title")].map((n) => n.textContent ?? "");
/** The economy `.pc-tab-heading` that precedes a given list element (the two
 *  siblings between them being the sub-group head and any earlier lists). */
const sectionHeadingFor = (list: Element): string => {
  let n: Element | null = list.previousElementSibling;
  while (n && !n.classList.contains("pc-tab-heading")) n = n.previousElementSibling;
  return n?.textContent ?? "";
};

describe("ActionsTab — economy sections (Level-1 heads)", () => {
  it("renders an Actions economy heading (not the old 'Attacks' heading) for an action weapon", () => {
    const c = mountContainer();
    new ActionsTab().render(c, ctxFactory({ attacks: [sampleAttack()] }));
    expect(headings(c)).toContain("Actions");
    expect(headings(c)).not.toContain("Attacks");
    expect(headings(c)).not.toContain("Attacks (×1)");
  });

  it("renders a Passive & Always-Active heading for an action-less feature", () => {
    const c = mountContainer();
    const features = [{
      feature: { name: "Darkvision", description: "You can see in the dark." } as never,
      source: { kind: "race", slug: "elf" } as never,
    }] as ResolvedCharacter["features"];
    new ActionsTab().render(c, ctxFactory({ features }));
    expect(headings(c)).toContain("Passive & Always-Active");
    expect([...c.querySelectorAll(".pc-feature-row .pc-action-row-name")].map((n) => n.textContent)).toContain("Darkvision");
  });
});

describe("ActionsTab — source sub-groups (Level-2 heads)", () => {
  it("files an action weapon under Actions → Weapons with the equipped count", () => {
    const c = mountContainer();
    new ActionsTab().render(c, ctxFactory({ attacks: [sampleAttack()], attacksPerAction: 2 }));
    // Level-2 sub-group head with a title + count.
    expect(subGroupTitles(c)).toContain("Weapons");
    const list = c.querySelector(".pc-weapons-table")!;
    expect(list).not.toBeNull();
    expect(sectionHeadingFor(list)).toBe("Actions");
    const count = c.querySelector(".pc-actions-section-count")?.textContent ?? "";
    expect(count).toContain("×2 attacks");
    expect(count).toContain("1 equipped");
  });

  it("carries the plain 'N equipped' count (no ×N clause) when attacksPerAction is 1", () => {
    const c = mountContainer();
    new ActionsTab().render(c, ctxFactory({ attacks: [sampleAttack()], attacksPerAction: 1 }));
    const count = c.querySelector(".pc-actions-section-count")?.textContent ?? "";
    expect(count).toBe("1 equipped");
  });

  it("uses derived.attacks names (no regex on equipment)", () => {
    const c = mountContainer();
    new ActionsTab().render(c, ctxFactory({ attacks: [sampleAttack({ name: "Flame Tongue Longsword" })] }));
    expect([...c.querySelectorAll(".pc-action-row-name")].map((n) => n.textContent)).toContain("Flame Tongue Longsword");
  });

  it("gives the weapons list the pc-weapons-table grid class (not the feature grid)", () => {
    const c = mountContainer();
    new ActionsTab().render(c, ctxFactory({ attacks: [sampleAttack()] }));
    const list = c.querySelector(".pc-actions-table.pc-weapons-table");
    expect(list).not.toBeNull();
  });

  it("renders no weapon rows when derived.attacks is empty", () => {
    const c = mountContainer();
    new ActionsTab().render(c, ctxFactory({ attacks: [] }));
    expect(c.querySelectorAll(".pc-weapons-table .pc-action-row").length).toBe(0);
  });

  it("files a reaction item under Reactions → Items (not Actions)", () => {
    const registry = buildMockRegistry([
      { slug: "srd-5e_ring-of-evasion", entityType: "item", data: { name: "Ring of Evasion", rarity: "rare" } },
    ]);
    const c = mountContainer();
    new ActionsTab().render(c, ctxFactory({
      equipment: [{ item: "[[srd-5e_ring-of-evasion]]", equipped: true }] as EquipmentEntry[],
      registry,
    }));
    // Ring of Evasion is a reaction item — it must land under Reactions, not Actions.
    const itemsList = c.querySelector(".pc-items-table")!;
    expect(itemsList).not.toBeNull();
    expect(sectionHeadingFor(itemsList)).toBe("Reactions");
    expect(itemsList.textContent).toContain("Ring of Evasion");
    // The sub-group head reads "Items".
    expect(subGroupTitles(c)).toContain("Items");
    expect(headings(c)).not.toContain("Actions");
  });
});

describe("ActionsTab — footer + banner", () => {
  it("keeps the standard combat actions reference footer", () => {
    const c = mountContainer();
    new ActionsTab().render(c, ctxFactory({ attacks: [sampleAttack()] }));
    expect(c.querySelector(".pc-standard-actions-title")?.textContent).toBe("Standard combat actions");
  });
});
