/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
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
}

function renderCtx(pools: ResolvedPool[], opts: RenderOpts = {}): ComponentRenderContext {
  return {
    resolved: {
      definition: { equipment: [], edition: "2014" },
      race: null, classes: [], background: null, feats: [],
      totalLevel: 5, features: [], pools,
      state: { feature_uses: {}, active_buffs: opts.activeBuffs ?? [] },
    } as unknown as ResolvedCharacter,
    derived: { attacks: [], attacksPerAction: 1, conditionEffects: undefined } as never,
    services: { entities: buildMockRegistry([]) } as never,
    app: {} as never,
    editState: (opts.editState ?? null) as never,
  };
}

const headings = (root: HTMLElement): string[] =>
  [...root.querySelectorAll(".pc-tab-heading")].map((n) => n.textContent ?? "");
const subGroupTitles = (root: HTMLElement): string[] =>
  [...root.querySelectorAll(".pc-actions-section-head .pc-actions-section-title")].map((n) => n.textContent ?? "");
const boonRows = (root: HTMLElement): HTMLElement[] =>
  [...root.querySelectorAll<HTMLElement>(".pc-boon-row")];
const boonNames = (root: HTMLElement): string[] =>
  boonRows(root).map((r) => r.querySelector(".pc-action-row-name")?.textContent ?? "");
const boonRowByName = (root: HTMLElement, name: string): HTMLElement =>
  boonRows(root).find((r) => r.querySelector(".pc-action-row-name")?.textContent === name)!;
/** The economy `.pc-tab-heading` a given boon row files under. */
const economyForBoon = (root: HTMLElement, name: string): string => {
  const list = boonRowByName(root, name).closest(".pc-boons-list")!;
  let n: Element | null = list.previousElementSibling;
  while (n && !n.classList.contains("pc-tab-heading")) n = n.previousElementSibling;
  return n?.textContent ?? "";
};

describe("ActionsTab — boons in the economy×source model (§3.6)", () => {
  it("files a free boon under Actions → Boons (NOT under an 'Interdict Boons' head)", () => {
    const c = mountContainer();
    new ActionsTab().render(c, renderCtx([
      pool({ selected: [entry("wrath", { name: "Boon of Wrath", action_cost: "free", description: "Deal extra damage." })] }),
    ]));
    expect(boonNames(c)).toEqual(["Boon of Wrath"]);
    expect(economyForBoon(c, "Boon of Wrath")).toBe("Actions");
    expect(subGroupTitles(c)).toContain("Boons");
    expect(headings(c)).not.toContain("Interdict Boons");
  });

  it("files a passive boon under Passive & Always-Active → Boons", () => {
    const c = mountContainer();
    new ActionsTab().render(c, renderCtx([
      pool({ selected: [entry("stoic", { name: "Boon of Endurance", passive: true, description: "Always on." })] }),
    ]));
    expect(economyForBoon(c, "Boon of Endurance")).toBe("Passive & Always-Active");
    expect(headings(c)).not.toContain("Interdict Boons");
  });

  it("files a granted boon (no action_cost) under Passive → Boons", () => {
    const c = mountContainer();
    new ActionsTab().render(c, renderCtx([
      pool({ grants: [entry("sight", { name: "Boon of Sight", description: "See in the dark." })] }),
    ]));
    expect(boonNames(c)).toEqual(["Boon of Sight"]);
    expect(economyForBoon(c, "Boon of Sight")).toBe("Passive & Always-Active");
  });

  it("shows an Active toggle wired to editState for an activatable selected boon", () => {
    const c = mountContainer();
    const toggleActiveBuff = vi.fn();
    new ActionsTab().render(c, renderCtx([
      pool({ selected: [entry("wrath", { name: "Boon of Wrath", activatable: true })] }),
    ], { editState: { toggleActiveBuff } }));
    const row = boonRowByName(c, "Boon of Wrath");
    const btn = row.querySelector<HTMLButtonElement>(".pc-pool-active");
    expect(btn).not.toBeNull();
    expect(btn!.textContent).toBe("Activate");
    btn!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(toggleActiveBuff).toHaveBeenCalledWith("wrath");
  });

  it("reflects the on-state ('Active' + .on) when the boon's slug is an active buff", () => {
    const c = mountContainer();
    new ActionsTab().render(c, renderCtx([
      pool({ selected: [entry("wrath", { name: "Boon of Wrath", activatable: true })] }),
    ], { activeBuffs: ["wrath"] }));
    const btn = boonRowByName(c, "Boon of Wrath").querySelector<HTMLButtonElement>(".pc-pool-active")!;
    expect(btn.textContent).toBe("Active");
    expect(btn.classList.contains("on")).toBe(true);
  });

  it("shows a 'Boon' tag (no Active toggle) on a non-activatable selected boon", () => {
    const c = mountContainer();
    new ActionsTab().render(c, renderCtx([
      pool({ selected: [entry("wrath", { name: "Boon of Wrath" })] }),
    ]));
    const row = boonRowByName(c, "Boon of Wrath");
    expect(row.querySelector(".pc-passive-tag")?.textContent).toBe("Boon");
    expect(row.querySelector(".pc-pool-active")).toBeNull();
  });

  it("shows a read-only 'granted' tag (no Active toggle, no select box) on a granted boon", () => {
    const c = mountContainer();
    new ActionsTab().render(c, renderCtx([
      pool({ grants: [entry("sight", { name: "Boon of Sight", activatable: true })] }),
    ]));
    const row = boonRowByName(c, "Boon of Sight");
    expect(row.textContent).toContain("granted");
    expect(row.querySelector(".pc-pool-active")).toBeNull();
    // read-only: never the pool tab's pick/deselect toggle-box
    expect(row.querySelector(".archivist-toggle-box")).toBeNull();
  });

  it("clicking a boon row expands the shared .archivist-item-block card with its description", () => {
    const c = mountContainer();
    new ActionsTab().render(c, renderCtx([
      pool({ selected: [entry("wrath", { name: "Boon of Wrath", description: "Deal thunderous extra damage." })] }),
    ]));
    const row = boonRowByName(c, "Boon of Wrath");
    const card = row.nextElementSibling as HTMLElement & { hidden: boolean };
    expect(card.classList.contains("pc-action-expand")).toBe(true);
    expect(card.hidden).toBe(true);
    row.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(card.hidden).toBe(false);
    const block = card.querySelector(".archivist-item-block");
    expect(block).toBeTruthy();
    expect(block?.textContent).toContain("Boon of Wrath");
    expect(block?.querySelector(".archivist-item-description")?.textContent).toContain("thunderous extra damage");
  });

  it("clicking the Active toggle does NOT expand the row's card", () => {
    const c = mountContainer();
    const toggleActiveBuff = vi.fn();
    new ActionsTab().render(c, renderCtx([
      pool({ selected: [entry("wrath", { name: "Boon of Wrath", activatable: true, description: "x" })] }),
    ], { editState: { toggleActiveBuff } }));
    const row = boonRowByName(c, "Boon of Wrath");
    const card = row.nextElementSibling as HTMLElement & { hidden: boolean };
    const btn = row.querySelector<HTMLButtonElement>(".pc-pool-active")!;
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(card.hidden).toBe(true);
    expect(toggleActiveBuff).toHaveBeenCalledWith("wrath");
  });

  it("renders nothing when the character has no pools", () => {
    const c = mountContainer();
    new ActionsTab().render(c, renderCtx([]));
    expect(boonRows(c)).toEqual([]);
  });
});
