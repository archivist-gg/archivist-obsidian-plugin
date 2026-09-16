/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { ActionsTab } from "../packages/obsidian/src/modules/pc/components/actions-tab";
import { renderAffordanceCaption } from "../packages/obsidian/src/modules/pc/components/actions/entry-affordance";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { buildMockRegistry } from "./fixtures/pc/mock-entity-registry";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type { ResolvedCharacter, ResolvedPool, ResolvedPoolEntry } from "@archivist-gg/dnd5e/pc/pc.types";
import type { OptionalFeatureEntity } from "@archivist-gg/dnd5e/types/optional-feature.types";

beforeAll(() => installObsidianDomHelpers());

// R4-G5 §4.2.2 (a). The DOMAIN is four converted documents (Commander's Strike x2, Rally x2), which are
// field-identical to the other 39 maneuvers EXCEPT `rendering_hint: "granted-die-to-ally"`; Parry is one
// of the 39 and is the negative control in every case below. MEASURED (research B §4): neither edition's
// superiority-dice resource declares `die.scaling`, so the SCALING fixture is a construction and is
// named as one.
const entry = (slug: string, entity: Partial<OptionalFeatureEntity> = {}): ResolvedPoolEntry =>
  ({ slug, entity: { slug, name: slug, description: "", edition: "2014", source: "", feature_type: "maneuver",
     prerequisites: [], available_to: [], effects: [], ...entity } }) as unknown as ResolvedPoolEntry;

const maneuver = (slug: string, name: string, hint?: string): ResolvedPoolEntry =>
  entry(slug, { name, action_cost: "bonus-action", rendering_hint: hint,
                consumes: { resource: "fighter:superiority-dice", amount: 1 } } as never);

const pool = (over: Partial<ResolvedPool> = {}): ResolvedPool =>
  ({ id: "battle-master-maneuvers", label: "Maneuvers", classIndex: 0, count: 3, anchorLevel: 3,
     selected: [], available: [], grants: [], ...over }) as ResolvedPool;

const ctxWith = (pools: ResolvedPool[], die?: { base: string; scaling?: Record<string, string> }): ComponentRenderContext => {
  const ctx = {
    resolved: {
      definition: { equipment: [], edition: "2014" },
      race: null, classes: [{ entity: { slug: "fighter" }, level: 10, subclass: { slug: "bm" } }],
      background: null, feats: [], totalLevel: 10, features: [], pools,
      state: { feature_uses: { "fighter:superiority-dice": { used: 0, max: 4 } }, active_buffs: [] },
    } as unknown as ResolvedCharacter,
    derived: { attacks: [], attacksPerAction: 1 } as never,
    services: { entities: buildMockRegistry([]) } as never,
    app: {} as never,
    editState: { spendFeatureUse: () => {}, setFeatureUse: () => {} } as never,
  };
  (ctx.resolved as { resources?: unknown }).resources = new Map([
    ["fighter:superiority-dice", { id: "fighter:superiority-dice", name: "Superiority Dice",
      reset: "short-rest", maxFormula: "4", die,
      owner: { kind: "feature", featureId: "cs", featureName: "Combat Superiority",
               source: { kind: "subclass", slug: "bm", level: 3 } }}],
  ]);
  return ctx as ComponentRenderContext;
};

const boonRowByName = (root: HTMLElement, name: string): HTMLElement =>
  Array.from(root.querySelectorAll<HTMLElement>(".pc-boon-row"))
    .find((r) => r.querySelector(".pc-action-row-name")?.textContent === name)!;

describe("renderAffordanceCaption (R4-G5 §4.2.2 a)", () => {
  it("RED FIRST (row 18): Commander's Strike's boon row carries the ally caption and Parry's does not", () => {
    const c = mountContainer();
    const p = pool({ selected: [
      maneuver("cs", "Commander's Strike", "granted-die-to-ally"),
      maneuver("parry", "Parry"),
    ] });
    new ActionsTab().render(c, ctxWith([p], { base: "d8" }));
    expect(boonRowByName(c, "Commander's Strike").querySelector(".pc-affordance-caption")!.textContent)
      .toBe("1d8 to an ally");
    expect(boonRowByName(c, "Parry").querySelector(".pc-affordance-caption")).toBeNull();
  });

  it("RED FIRST (row 14, FIXTURE-ONLY: no shipped granted-die owner scales its die): the caption reads the SCALED die at the owner's level", () => {
    const host = mountContainer();
    const cs = maneuver("cs", "Commander's Strike", "granted-die-to-ally");
    // The owner is the subclass at level 3 and the character's Fighter level is 10, so the 10-step face
    // is the right answer and the base d8 is the mutant's.
    renderAffordanceCaption(host, cs, ctxWith([pool({ selected: [cs] })], { base: "d8", scaling: { "10": "d12" } }));
    expect(host.querySelector(".pc-affordance-caption")!.textContent).toBe("1d12 to an ally");
  });

  it("an owner resource with NO die renders NO caption, rather than an empty face", () => {
    const host = mountContainer();
    const cs = maneuver("cs", "Commander's Strike", "granted-die-to-ally");
    renderAffordanceCaption(host, cs, ctxWith([pool({ selected: [cs] })], undefined));
    expect(host.querySelector(".pc-affordance-caption")).toBeNull();
  });

  it("a cast ResolvedCharacter with NO `resources` index renders nothing rather than throwing", () => {
    const host = mountContainer();
    const cs = maneuver("cs", "Commander's Strike", "granted-die-to-ally");
    const ctx = ctxWith([pool({ selected: [cs] })], { base: "d8" });
    delete (ctx.resolved as { resources?: unknown }).resources;
    expect(() => renderAffordanceCaption(host, cs, ctx)).not.toThrow();
    expect(host.querySelector(".pc-affordance-caption")).toBeNull();
  });
});
