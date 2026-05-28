/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { TabsContainer } from "../src/modules/pc/components/tabs-container";
import { ComponentRegistry } from "../src/modules/pc/components/component-registry";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { SheetComponent, ComponentRenderContext } from "../src/modules/pc/components/component.types";
import type { DerivedStats, ResolvedCharacter } from "../src/modules/pc/pc.types";

beforeAll(() => installObsidianDomHelpers());

class Probe implements SheetComponent {
  constructor(readonly type: string) {}
  render(el: HTMLElement, _ctx?: ComponentRenderContext) { el.createDiv({ cls: `probe-${this.type}`, text: this.type }); }
}

const ctx: ComponentRenderContext = { resolved: {} as ResolvedCharacter, derived: {} as DerivedStats, core: {} as never, editState: null };

function mkRegistry(): ComponentRegistry {
  const r = new ComponentRegistry();
  for (const t of ["actions-tab", "spells-tab", "inventory-tab", "features-tab", "background-tab", "notes-tab"]) r.register(new Probe(t));
  return r;
}

describe("TabsContainer", () => {
  it("renders six tab buttons and six panels", () => {
    const container = mountContainer();
    new TabsContainer(mkRegistry()).render(container, ctx);
    expect(container.querySelectorAll(".pc-tab-btn").length).toBe(6);
    expect(container.querySelectorAll(".pc-tab-panel").length).toBe(6);
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
});
