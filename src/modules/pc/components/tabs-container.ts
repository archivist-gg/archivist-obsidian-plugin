import type { SheetComponent, ComponentRenderContext } from "./component.types";
import type { ComponentRegistry } from "./component-registry";

const TAB_DEF: ReadonlyArray<[type: string, panelId: string, label: string]> = [
  ["actions-tab",    "panel-actions",    "Actions"],
  ["spells-tab",     "panel-spells",     "Spells"],
  ["inventory-tab",  "panel-inventory",  "Inventory"],
  ["features-tab",   "panel-features",   "Features & Traits"],
  ["background-tab", "panel-background", "Background"],
  ["notes-tab",      "panel-notes",      "Notes"],
];

export class TabsContainer implements SheetComponent {
  readonly type = "tabs-container";

  constructor(private readonly registry: ComponentRegistry) {}

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const tabBar = el.createDiv({ cls: "pc-tabs-bar" });
    const panels = el.createDiv({ cls: "pc-tab-panels" });
    const buttons: HTMLButtonElement[] = [];
    const panelEls: HTMLDivElement[] = [];

    // Resolve which tab should be active on initial render. If the parent
    // view tracks tab state and passes it through ctx (the production path),
    // honor it so re-renders triggered by editState mutations don't kick the
    // user back to Actions. If unset (test fixtures that pre-date this
    // contract, or any direct caller that doesn't care), fall back to the
    // first declared tab.
    const initialActive =
      ctx.activeTabId && TAB_DEF.some(([, id]) => id === ctx.activeTabId)
        ? ctx.activeTabId
        : TAB_DEF[0][1];

    for (const [type, panelId, label] of TAB_DEF) {
      const btn = tabBar.createEl("button", { cls: "pc-tab-btn", text: label, attr: { "data-tab": panelId } });
      const panel = panels.createDiv({ cls: "pc-tab-panel", attr: { id: panelId } });
      const component = this.registry.get(type);
      if (component) component.render(panel, ctx);
      else panel.createDiv({ cls: "pc-empty-line", text: `(No renderer for ${type})` });
      buttons.push(btn);
      panelEls.push(panel);
      btn.addEventListener("click", () => {
        setActive(buttons, panelEls, panelId);
        ctx.onActiveTabChange?.(panelId);
      });
    }
    setActive(buttons, panelEls, initialActive);
  }
}

function setActive(buttons: HTMLButtonElement[], panels: HTMLDivElement[], activeId: string) {
  for (const b of buttons) b.classList.toggle("active", b.dataset.tab === activeId);
  for (const p of panels) p.classList.toggle("active", p.id === activeId);
}
