/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { ActionsTab } from "../packages/obsidian/src/modules/pc/components/actions-tab";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { buildMockRegistry } from "./fixtures/pc/mock-entity-registry";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type { ResolvedCharacter, ResolvedPool, ResolvedPoolEntry } from "@archivist-gg/dnd5e/pc/pc.types";
import type { OptionalFeatureEntity } from "@archivist-gg/dnd5e/types/optional-feature.types";

beforeAll(() => installObsidianDomHelpers());

// ─────────────────────────────────────────────────────────────
// Fixtures — a ResolvedCharacter carrying selection pools (§3.6). Boons no
// longer render under a pool-label heading; they file into the economy×source
// grid model as "boons" sub-groups (Passive/Actions/… ← entity.action_cost).
// ─────────────────────────────────────────────────────────────
const entry = (slug: string, entity: Partial<OptionalFeatureEntity> = {}): ResolvedPoolEntry =>
  ({ slug, entity: { slug, name: slug, description: "", edition: "2014", source: "", feature_type: "boon", prerequisites: [], available_to: [], effects: [], ...entity } }) as unknown as ResolvedPoolEntry;

const pool = (over: Partial<ResolvedPool> = {}): ResolvedPool =>
  ({ id: "interdict-boons", label: "Interdict Boons", classIndex: 0, count: 2, anchorLevel: 3, selected: [], available: [], grants: [], ...over }) as ResolvedPool;

interface RenderOpts {
  activeBuffs?: string[];
  editState?: object | null;
  actionsDisabled?: boolean;
}

function renderCtx(pools: ResolvedPool[], opts: RenderOpts = {}): ComponentRenderContext {
  return {
    resolved: {
      definition: { equipment: [], edition: "2014" },
      race: null, classes: [], background: null, feats: [],
      totalLevel: 5, features: [], pools,
      state: { feature_uses: {}, active_buffs: opts.activeBuffs ?? [] },
    } as unknown as ResolvedCharacter,
    derived: {
      attacks: [], attacksPerAction: 1,
      conditionEffects: opts.actionsDisabled ? { actions_disabled: true, sources: [] } : undefined,
    } as never,
    services: { entities: buildMockRegistry([]) } as never,
    app: {} as never,
    editState: (opts.editState ?? null) as never,
  };
}

const boonRows = (root: HTMLElement): HTMLElement[] =>
  [...root.querySelectorAll<HTMLElement>(".pc-boon-row")];
const boonRowByName = (root: HTMLElement, name: string): HTMLElement =>
  boonRows(root).find((r) => r.querySelector(".pc-action-row-name")?.textContent === name)!;

describe("ActionsTab — boons in the economy×source model (§3.6)", () => {
  // The passive/free/special/no-cost boon cases (files-under-Passive, Active
  // toggle, on-state, Passive tag, granted FREE-pill/marker, read-only granted
  // tag, expand card, toggle-doesn't-expand) all file under the passive bucket
  // → they moved to pc-passive-features-tab.test.ts. Only the two clean
  // action-economy cases (an action boon dims; a bonus boon dims) stay here.

  it("gives a selected activatable boon its economy pill + Active toggle (no status marker)", () => {
    const c = mountContainer();
    new ActionsTab().render(c, renderCtx([pool({ selected: [entry("wrath", { name: "Wrath", action_cost: "action", activatable: true })] })]));
    const row = boonRowByName(c, "Wrath");
    expect(row.querySelector(".pc-cost-badge.cost-action")).toBeTruthy();
    expect(row.querySelector(".pc-pool-active")).toBeTruthy();
    expect(row.querySelector(".pc-boon-status")).toBeNull();
  });

  // "shows the 'Passive' tag for a special boon" (special → passive) moved to
  // pc-passive-features-tab.test.ts.

  it("dims a bonus-action boon when actions are disabled (free-boon split off)", () => {
    // SPLIT from the old single-tab test: the free-boon half (Free Boon NOT dimmed)
    // now lives in pc-passive-features-tab.test.ts. A free boon files under the
    // passive bucket, so only the bonus-action dimming assertion stays here.
    const c1 = mountContainer();
    new ActionsTab().render(c1, renderCtx([pool({ selected: [entry("b", { name: "BA Boon", action_cost: "bonus-action" })] })], { actionsDisabled: true }));
    expect(boonRowByName(c1, "BA Boon").classList.contains("pc-row-disabled")).toBe(true);
  });

  // The read-only 'granted' tag, the boon-row expand card, and the
  // "Active toggle doesn't expand" cases (all no-cost → passive) moved to
  // pc-passive-features-tab.test.ts.

  it("renders nothing when the character has no pools", () => {
    const c = mountContainer();
    new ActionsTab().render(c, renderCtx([]));
    expect(boonRows(c)).toEqual([]);
  });
});
