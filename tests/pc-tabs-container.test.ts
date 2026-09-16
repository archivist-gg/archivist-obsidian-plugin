/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { TabsContainer } from "../packages/obsidian/src/modules/pc/components/tabs-container";
import { ComponentRegistry } from "../packages/obsidian/src/modules/pc/components/component-registry";
import { PoolTab } from "../packages/obsidian/src/modules/pc/components/pool-tab";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { SheetComponent, ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type { DerivedStats, ResolvedCharacter } from "@archivist-gg/dnd5e/pc/pc.types";

beforeAll(() => installObsidianDomHelpers());

class Probe implements SheetComponent {
  constructor(readonly type: string) {}
  render(el: HTMLElement, _ctx?: ComponentRenderContext) { el.createDiv({ cls: `probe-${this.type}`, text: this.type }); }
}

const ctx: ComponentRenderContext = { resolved: {} as ResolvedCharacter, derived: {} as DerivedStats, services: {} as never, editState: null };

function mkRegistry(): ComponentRegistry {
  const r = new ComponentRegistry();
  for (const t of ["actions-tab", "passive-features-tab", "resources-tab", "spells-tab", "inventory-tab"]) r.register(new Probe(t));
  return r;
}

describe("TabsContainer", () => {
  it("renders five built-in tabs and no Notes/Features/Background tab", () => {
    const container = mountContainer();
    new TabsContainer(mkRegistry()).render(container, ctx);
    expect(container.querySelectorAll(".pc-tab-btn").length).toBe(5);
    expect(container.querySelectorAll(".pc-tab-panel").length).toBe(5);
    expect(container.querySelector('.pc-tab-btn[data-tab="panel-notes"]')).toBeNull();
    expect(container.querySelector('.pc-tab-btn[data-tab="panel-features"]')).toBeNull();
    expect(container.querySelector('.pc-tab-btn[data-tab="panel-background"]')).toBeNull();
    // AC1: the builtin tabs, in order, with the renamed "Actions" label. "Resources"
    // sits after "Passive & Features": the two feature-shaped tabs stay adjacent, and the
    // new one lands before the two inventories of things rather than after them.
    const labels = [...container.querySelectorAll(".pc-tab-btn")].slice(0, 5).map((b) => b.textContent);
    expect(labels).toEqual(["Actions", "Passive & Features", "Resources", "Spells", "Inventory"]);
    // The new panel renders a real component (not the "(No renderer…)" fallback).
    const passivePanel = container.querySelector<HTMLElement>("#panel-passive")!;
    expect(passivePanel.querySelector(".probe-passive-features-tab")).not.toBeNull();
    expect(passivePanel.textContent).not.toMatch(/No renderer/);
  });
  it("appends a dynamic pool tab when a class declares one and the pool resolved", () => {
    const dyn: ComponentRenderContext = {
      ...ctx,
      resolved: {
        classes: [{ entity: { tabs: [{ id: "boons", label: "Interdict Boons", renders: { pool: "interdict-boons" } }] }, subclass: null }],
        pools: [{ id: "interdict-boons", label: "Interdict Boons", classIndex: 0, count: 1, anchorLevel: 2, selected: [], available: [], grants: [] }],
      } as never,
    };
    const container = mountContainer();
    new TabsContainer(mkRegistry()).render(container, dyn);
    expect(container.querySelectorAll(".pc-tab-btn").length).toBe(6); // 5 built-ins + 1 pool tab
    const btn = container.querySelector<HTMLElement>('.pc-tab-btn[data-tab="panel-pool-boons"]');
    expect(btn?.textContent).toBe("Interdict Boons");
  });
  it("carries a short label on every tab: the built-in long one abbreviates, every other repeats its own label", () => {
    // R4 {G5, G6} live rider 2, V-1 at 252: below a 300 px content column the strip renders
    // `data-short` instead of the button's own text, so the four built-in tabs fit one row. The
    // attribute is the renderer's whole part in that: the abbreviation is declared beside the label
    // it shortens, and a data-declared pool tab repeats its own label rather than being shortened
    // by any rule in the renderer.
    const dyn: ComponentRenderContext = {
      ...ctx,
      resolved: {
        classes: [{ entity: { tabs: [{ id: "boons", label: "Interdict Boons", renders: { pool: "interdict-boons" } }] }, subclass: null }],
        pools: [{ id: "interdict-boons", label: "Interdict Boons", classIndex: 0, count: 1, anchorLevel: 2, selected: [], available: [], grants: [] }],
      } as never,
    };
    const container = mountContainer();
    new TabsContainer(mkRegistry()).render(container, dyn);
    const shorts = [...container.querySelectorAll<HTMLElement>(".pc-tab-btn")].map((b) => b.dataset.short);
    expect(shorts).toEqual(["Actions", "Passive", "Resources", "Spells", "Inventory", "Interdict Boons"]);
    // The button's own text is untouched: the short form is an attribute the narrow tier reads.
    const labels = [...container.querySelectorAll(".pc-tab-btn")].map((b) => b.textContent);
    expect(labels).toEqual(["Actions", "Passive & Features", "Resources", "Spells", "Inventory", "Interdict Boons"]);
  });
  it("two pool tabs with the same label are told apart by the entity that declared the later one (R4-G7 RIDER-8, B012-D11)", () => {
    // MEASURED in the converter output: the 2014 Fighter declares `fighting-style` "Fighting Style" and its Champion (5e)
    // subclass (`short_name: Champion`) declares `champion-fighting-style` "Fighting Style" for the level-10 Additional
    // Fighting Style. The ids differ, the labels do not, so the live sheet showed two identical FIGHTING STYLE tabs. The
    // qualifier is the declaring entity's own short name (the converter's count column already reads
    // "Champion (5e) Fighting Style"): a label the strip already carries is prefixed, nothing else changes.
    const dyn: ComponentRenderContext = {
      ...ctx,
      resolved: {
        classes: [{
          entity: { name: "Fighter", tabs: [{ id: "fighting-style", label: "Fighting Style", renders: { pool: "fighting-style" } }] },
          subclass: { name: "Champion (5e)", short_name: "Champion", tabs: [{ id: "champion-fighting-style", label: "Fighting Style", renders: { pool: "champion-fighting-style" } }] },
        }],
        pools: [
          { id: "fighting-style", label: "Fighting Style", classIndex: 0, count: 1, anchorLevel: 1, selected: [], available: [], grants: [] },
          { id: "champion-fighting-style", label: "Fighting Style", classIndex: 0, count: 1, anchorLevel: 10, selected: [], available: [], grants: [] },
        ],
      } as never,
    };
    const container = mountContainer();
    new TabsContainer(mkRegistry()).render(container, dyn);
    const pool = Array.from(container.querySelectorAll<HTMLElement>(".pc-tab-btn")).slice(5).map((b) => [b.dataset.tab, b.textContent, b.dataset.short]);
    expect(pool).toEqual([
      ["panel-pool-fighting-style", "Fighting Style", "Fighting Style"],
      ["panel-pool-champion-fighting-style", "Champion Fighting Style", "Champion Fighting Style"],
    ]);
  });
  it("a subclass without a short name qualifies by its full name, and a label nobody else carries is never qualified", () => {
    const dyn: ComponentRenderContext = {
      ...ctx,
      resolved: {
        classes: [{
          entity: { name: "Fighter", tabs: [{ id: "fighting-style", label: "Fighting Style", renders: { pool: "a" } }] },
          subclass: { name: "College of Swords (5e)", tabs: [
            { id: "swords-style", label: "Fighting Style", renders: { pool: "b" } },
            { id: "maneuvers", label: "Maneuvers", renders: { pool: "c" } },
          ] },
        }],
        pools: ["a", "b", "c"].map((id) => ({ id, label: "x", classIndex: 0, count: 1, anchorLevel: 1, selected: [], available: [], grants: [] })),
      } as never,
    };
    const container = mountContainer();
    new TabsContainer(mkRegistry()).render(container, dyn);
    const labels = Array.from(container.querySelectorAll(".pc-tab-btn")).map((b) => b.textContent);
    expect(labels.slice(5)).toEqual(["Fighting Style", "College of Swords (5e) Fighting Style", "Maneuvers"]);
  });
  it("does NOT append a declared tab whose pool did not resolve", () => {
    const dyn: ComponentRenderContext = {
      ...ctx,
      resolved: {
        classes: [{ entity: { tabs: [{ id: "boons", label: "Boons", renders: { pool: "interdict-boons" } }] }, subclass: null }],
        pools: [],
      } as never,
    };
    const container = mountContainer();
    new TabsContainer(mkRegistry()).render(container, dyn);
    expect(container.querySelectorAll(".pc-tab-btn").length).toBe(5);
  });
  it("activates the first tab by default when no activeTabId is provided", () => {
    const container = mountContainer();
    new TabsContainer(mkRegistry()).render(container, ctx);
    const activePanels = container.querySelectorAll(".pc-tab-panel.active");
    expect(activePanels.length).toBe(1);
    expect((activePanels[0] as HTMLElement).id).toBe("panel-actions");
  });
  it("clicking another tab toggles .active", () => {
    const container = mountContainer();
    new TabsContainer(mkRegistry()).render(container, ctx);
    const spellsBtn = container.querySelector<HTMLButtonElement>('.pc-tab-btn[data-tab="panel-spells"]')!;
    spellsBtn.click();
    expect(spellsBtn.classList.contains("active")).toBe(true);
    const active = container.querySelectorAll<HTMLElement>(".pc-tab-panel.active");
    expect(active.length).toBe(1);
    expect(active[0].id).toBe("panel-spells");
  });
  it("renders a fallback inside panels whose component isn't registered", () => {
    const partial = new ComponentRegistry();
    partial.register(new Probe("actions-tab"));
    const container = mountContainer();
    new TabsContainer(partial).render(container, ctx);
    const spellsPanel = container.querySelector<HTMLElement>("#panel-spells")!;
    expect(spellsPanel.querySelector(".pc-empty-line")?.textContent).toMatch(/No renderer/);
  });
  it("preserves activeTabId across re-renders when explicitly provided", () => {
    // The bug: edit-state mutators trigger renderSheet → renders TabsContainer
    // again. If TabsContainer hardcodes "first tab is active", every re-render
    // kicks the user back to Actions even if they were on Inventory.
    // Fix: when ctx.activeTabId is provided, honor it on initial activation.
    const ctxWithTab: ComponentRenderContext = {
      ...ctx,
      activeTabId: "panel-inventory",
    };

    const container = mountContainer();
    const tabs = new TabsContainer(mkRegistry());
    tabs.render(container, ctxWithTab);

    let activePanels = container.querySelectorAll<HTMLElement>(".pc-tab-panel.active");
    expect(activePanels.length).toBe(1);
    expect(activePanels[0].id).toBe("panel-inventory");

    // Simulate the renderSheet re-render path: empty the host, render again
    // with the same context. Active tab must still be inventory.
    container.empty();
    tabs.render(container, ctxWithTab);

    activePanels = container.querySelectorAll<HTMLElement>(".pc-tab-panel.active");
    expect(activePanels.length).toBe(1);
    expect(activePanels[0].id).toBe("panel-inventory");
  });
  it("calls onActiveTabChange when user clicks a different tab", () => {
    const onActiveTabChange = vi.fn();
    const ctxWithCb: ComponentRenderContext = {
      ...ctx,
      activeTabId: "panel-actions",
      onActiveTabChange,
    };

    const container = mountContainer();
    new TabsContainer(mkRegistry()).render(container, ctxWithCb);

    const inventoryBtn = container.querySelector<HTMLButtonElement>('.pc-tab-btn[data-tab="panel-inventory"]')!;
    inventoryBtn.click();

    expect(onActiveTabChange).toHaveBeenCalledTimes(1);
    expect(onActiveTabChange).toHaveBeenCalledWith("panel-inventory");
  });
  it("passes the declared layout to the pool tab (blocks renders pc-block)", () => {
    const dyn: ComponentRenderContext = {
      ...ctx,
      resolved: {
        classes: [{ entity: { tabs: [{ id: "boons", label: "Boons", renders: { pool: "p", layout: "blocks" } }] }, subclass: null }],
        pools: [{
          id: "p", label: "Boons", classIndex: 0, count: 1, anchorLevel: 2,
          selected: [], grants: [],
          available: [{ slug: "x", entity: { slug: "x", name: "X", description: "dx", prerequisites: [], effects: [], available_to: [] } }],
        }],
        state: { active_buffs: [] },
      } as never,
    };
    const container = mountContainer();
    new TabsContainer(mkRegistry()).render(container, dyn);
    expect(container.querySelector("#panel-pool-boons .pc-block.pc-boon-block")).not.toBeNull();
  });
  it("R4-G4 \u00a74.2.5: an authored layout beats the derived one, the derived one beats the default", () => {
    const mk = (declared: string | undefined, derived: string | undefined) => ({
      ...ctx, resolved: {
        classes: [{ entity: { tabs: [{ id: "t", label: "T", renders: { pool: "p", ...(declared ? { layout: declared } : {}) } }] }, subclass: null }],
        pools: [{ id: "p", label: "P", classIndex: 0, count: 1, anchorLevel: 2, selected: [], grants: [], available: [], ...(derived ? { layout: derived } : {}) }],
        state: {},
      } as never,
    });
    const spy = vi.spyOn(PoolTab.prototype, "render");
    const authored = mountContainer(); new TabsContainer(mkRegistry()).render(authored, mk("blocks", "dice-pool"));
    const derivedOnly = mountContainer(); new TabsContainer(mkRegistry()).render(derivedOnly, mk(undefined, "dice-pool"));
    const neither = mountContainer(); new TabsContainer(mkRegistry()).render(neither, mk(undefined, undefined));
    const layouts = spy.mock.instances.map((i) => (i as unknown as { layout: string }).layout);
    expect(layouts).toEqual(["blocks", "dice-pool", "spell-like"]);
    expect([authored, derivedOnly, neither].every((c) => c.querySelector("#panel-pool-t") !== null)).toBe(true);
    spy.mockRestore();
  });
});
