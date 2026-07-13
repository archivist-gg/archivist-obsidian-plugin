/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { TabsContainer } from "../packages/obsidian/src/modules/pc/components/tabs-container";
import { ComponentRegistry } from "../packages/obsidian/src/modules/pc/components/component-registry";
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
  for (const t of ["actions-tab", "spells-tab", "inventory-tab", "background-tab"]) r.register(new Probe(t));
  return r;
}

describe("TabsContainer", () => {
  it("renders four built-in tabs and no Notes/Features tab", () => {
    const container = mountContainer();
    new TabsContainer(mkRegistry()).render(container, ctx);
    expect(container.querySelectorAll(".pc-tab-btn").length).toBe(4);
    expect(container.querySelectorAll(".pc-tab-panel").length).toBe(4);
    expect(container.querySelector('.pc-tab-btn[data-tab="panel-notes"]')).toBeNull();
    expect(container.querySelector('.pc-tab-btn[data-tab="panel-features"]')).toBeNull();
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
    expect(container.querySelectorAll(".pc-tab-btn").length).toBe(5); // 4 built-ins + 1 pool tab
    const btn = container.querySelector<HTMLElement>('.pc-tab-btn[data-tab="panel-pool-boons"]');
    expect(btn?.textContent).toBe("Interdict Boons");
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
    expect(container.querySelectorAll(".pc-tab-btn").length).toBe(4);
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
});
