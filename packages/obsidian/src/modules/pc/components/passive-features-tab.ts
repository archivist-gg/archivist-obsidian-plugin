import type { SheetComponent, ComponentRenderContext } from "./component.types";
import { buildActionModel } from "./actions/action-model";
import { renderActionSections } from "./actions/section-renderer";

/**
 * Tab 2 — "Passive & Features". Renders only the `passive` economy section
 * ("Passive & Free Actions"): passive/free features, feats, race traits,
 * background, and free/passive boons. Shares the same section renderer as the
 * Actions tab; passive/free rows never dim, so no incapacitated banner here.
 */
export class PassiveFeaturesTab implements SheetComponent {
  readonly type = "passive-features-tab";

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    // Keep `pc-actions-tab` so the tab-scoped attack-tag color rules
    // (actions.css) still apply to any free/special weapon that lands here.
    const root = el.createDiv({ cls: "pc-tab-body pc-actions-body pc-actions-tab pc-passive-features-tab" });
    const passive = buildActionModel(ctx.resolved, ctx.derived, ctx.services.entities)
      .filter((s) => s.key === "passive");
    if (passive.length === 0) {
      root.createDiv({ cls: "pc-empty-line", text: "(No passive or free actions.)" });
      return;
    }
    renderActionSections(root, passive, ctx);
  }
}
