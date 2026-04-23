/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
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

const ctx: ComponentRenderContext = { resolved: {} as ResolvedCharacter, derived: {} as DerivedStats, core: {} as never };

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
  it("activates the first tab by default", () => {
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
});
