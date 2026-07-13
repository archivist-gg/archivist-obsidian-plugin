/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { ActionsTab } from "../packages/obsidian/src/modules/pc/components/actions-tab";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type { ResolvedCharacter, ResolvedPool, ResolvedPoolEntry } from "@archivist-gg/dnd5e/pc/pc.types";
import type { OptionalFeatureEntity } from "@archivist-gg/dnd5e/types/optional-feature.types";

beforeAll(() => installObsidianDomHelpers());

// ─────────────────────────────────────────────────────────────
// Fixtures — a ResolvedCharacter carrying selection pools (§3.6)
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
    services: { entities: { getBySlug: () => null } } as never,
    app: {} as never,
    editState: (opts.editState ?? null) as never,
  };
}

const headings = (root: HTMLElement): string[] =>
  [...root.querySelectorAll(".pc-tab-heading")].map((n) => n.textContent ?? "");
const boonRows = (root: HTMLElement): HTMLElement[] =>
  [...root.querySelectorAll<HTMLElement>(".pc-boon-row")];
const boonNames = (root: HTMLElement): string[] =>
  boonRows(root).map((r) => r.querySelector(".pc-action-row-name")?.textContent ?? "");
const boonRowByName = (root: HTMLElement, name: string): HTMLElement =>
  boonRows(root).find((r) => r.querySelector(".pc-action-row-name")?.textContent === name)!;

describe("ActionsTab — Interdict Boons section (#1b, §3.6)", () => {
  it("renders selected + granted boons under the pool-label heading", () => {
    const c = mountContainer();
    new ActionsTab().render(c, renderCtx([
      pool({
        selected: [entry("wrath", { name: "Boon of Wrath", description: "Deal extra damage." })],
        grants: [entry("sight", { name: "Boon of Sight", description: "See in the dark." })],
      }),
    ]));
    expect(headings(c)).toContain("Interdict Boons");
    expect(boonNames(c)).toEqual(["Boon of Wrath", "Boon of Sight"]);
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

  it("renders a grants-only pool (no selections)", () => {
    const c = mountContainer();
    new ActionsTab().render(c, renderCtx([
      pool({ selected: [], grants: [entry("sight", { name: "Boon of Sight" })] }),
    ]));
    expect(headings(c)).toContain("Interdict Boons");
    expect(boonNames(c)).toEqual(["Boon of Sight"]);
  });

  it("omits a pool with neither selected nor granted members", () => {
    const c = mountContainer();
    new ActionsTab().render(c, renderCtx([
      pool({ label: "Empty Pool", selected: [], grants: [], available: [entry("x", { name: "Unpicked" })] }),
    ]));
    expect(headings(c)).not.toContain("Empty Pool");
    expect(boonNames(c)).toEqual([]);
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

  it("renders one section per pool with members, in pool order", () => {
    const c = mountContainer();
    new ActionsTab().render(c, renderCtx([
      pool({ id: "a", label: "Interdict Boons", selected: [entry("wrath", { name: "Boon of Wrath" })] }),
      pool({ id: "b", label: "Dark Gifts", grants: [entry("gift", { name: "Gift of Shadow" })] }),
    ]));
    const h = headings(c);
    expect(h).toContain("Interdict Boons");
    expect(h).toContain("Dark Gifts");
    expect(boonNames(c)).toEqual(["Boon of Wrath", "Gift of Shadow"]);
  });

  it("renders nothing when the character has no pools", () => {
    const c = mountContainer();
    new ActionsTab().render(c, renderCtx([]));
    expect(boonRows(c)).toEqual([]);
  });
});
