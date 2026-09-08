import type { SheetComponent, ComponentRenderContext } from "./component.types";
import type { ComponentRegistry } from "./component-registry";
import type { ResolvedCharacter } from "@archivist-gg/dnd5e/pc/pc.types";
import type { TabDecl } from "@archivist-gg/dnd5e/types/selection-pool";
import { PoolTab } from "./pool-tab";

// Built-in, always-on tabs. Notes removed in Phase 2.
// `short` is the label the strip renders when the content column is too narrow for the full one
// (R4 {G5, G6} live rider 2, V-1 at 252): it is DECLARED here, beside the label it shortens, so the
// renderer holds no rule about which words may be dropped. Only the one long built-in label has one;
// every other tab, including a data-declared pool tab, repeats its own label.
const BUILTIN: ReadonlyArray<{ type: string; panelId: string; label: string; short?: string }> = [
  { type: "actions-tab",           panelId: "panel-actions",   label: "Actions" },
  { type: "passive-features-tab",  panelId: "panel-passive",   label: "Passive & Features", short: "Passive" },
  { type: "spells-tab",            panelId: "panel-spells",    label: "Spells" },
  { type: "inventory-tab",         panelId: "panel-inventory", label: "Inventory" },
];

interface BuiltTab { panelId: string; label: string; short: string; component: SheetComponent | undefined; }

/** Data-declared tabs from the resolved class/subclass, de-duped by id. */
function collectTabDecls(resolved: ResolvedCharacter | undefined): TabDecl[] {
  const out: TabDecl[] = [];
  const seen = new Set<string>();
  for (const c of resolved?.classes ?? []) {
    const decls = [
      ...(c.entity?.tabs ?? []),
      ...(c.subclass?.tabs ?? []),
    ];
    for (const d of decls) {
      if (seen.has(d.id)) continue;
      seen.add(d.id);
      out.push(d);
    }
  }
  return out;
}

export class TabsContainer implements SheetComponent {
  readonly type = "tabs-container";

  constructor(private readonly registry: ComponentRegistry) {}

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const tabs: BuiltTab[] = BUILTIN.map((b) => ({
      panelId: b.panelId, label: b.label, short: b.short ?? b.label, component: this.registry.get(b.type),
    }));

    // Dynamic pool tabs: one PoolTab instance per declared tab whose pool resolved.
    for (const decl of collectTabDecls(ctx.resolved)) {
      const pool = ctx.resolved?.pools?.find((p) => p.id === decl.renders.pool);
      if (!pool) continue;
      // authored beats derived beats default (R4-G4 §4.2.5)
      const layout = decl.renders.layout ?? pool.layout ?? "spell-like";
      tabs.push({ panelId: `panel-pool-${decl.id}`, label: decl.label, short: decl.label, component: new PoolTab(decl.renders.pool, layout) });
    }

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
      ctx.activeTabId && tabs.some((t) => t.panelId === ctx.activeTabId)
        ? ctx.activeTabId
        : tabs[0].panelId;

    for (const { panelId, label, short, component } of tabs) {
      const btn = tabBar.createEl("button", { cls: "pc-tab-btn", text: label, attr: { "data-tab": panelId, "data-short": short } });
      const panel = panels.createDiv({ cls: "pc-tab-panel", attr: { id: panelId } });
      if (component) component.render(panel, ctx);
      else panel.createDiv({ cls: "pc-empty-line", text: `(No renderer for ${panelId})` });
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
