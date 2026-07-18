import type { SheetComponent, ComponentRenderContext } from "./component.types";
import { buildActionModel } from "./actions/action-model";
import { renderActionSections } from "./actions/section-renderer";
import { renderRaceBlock } from "./passive/race-block";

/**
 * Tab 2 — "Passive & Features". Renders, top to bottom (spec §1.1):
 *   1. the bespoke **Race block** (`renderRaceBlock`, reads `resolved.race`) —
 *      consolidating the scattered per-trait race rows the model used to emit;
 *      (Task 3a slots a Background block in between here and the sections),
 *   2. the `passive` economy grouped sections ("Passive & Free Actions": passive/
 *      free features, feats, and free/passive boons).
 *
 * The `race` sub-group is PRE-SPLIT out of the passive model before rendering the
 * sections (F8): the block owns those traits now. Any Section left with zero
 * sub-groups after the split is dropped (R1-#6) so a bare "Passive & Free Actions"
 * `<h4>` never renders. Shares the same section renderer as the Actions tab;
 * passive/free rows never dim, so no incapacitated banner here.
 */
export class PassiveFeaturesTab implements SheetComponent {
  readonly type = "passive-features-tab";

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    // Keep `pc-actions-tab` so the tab-scoped attack-tag color rules
    // (actions.css) still apply to any free/special weapon that lands here.
    const root = el.createDiv({ cls: "pc-tab-body pc-actions-body pc-actions-tab pc-passive-features-tab" });

    // Pre-split (§3.2, F8): drop the `race` sub-group from every passive Section —
    // its traits are owned by the bespoke Race block — then drop any Section left
    // with zero sub-groups so a now-empty section never renders a bare heading.
    const sections = buildActionModel(ctx.resolved, ctx.derived, ctx.services.entities)
      .filter((s) => s.key === "passive")
      .map((s) => ({ ...s, subGroups: s.subGroups.filter((sg) => sg.key !== "race") }))
      .filter((s) => s.subGroups.length > 0);

    const hasRaceBlock = ctx.resolved.race != null;
    if (!hasRaceBlock && sections.length === 0) {
      root.createDiv({ cls: "pc-empty-line", text: "(No passive or free actions.)" });
      return;
    }

    // Blocks first (Task 3a inserts a Background block after the Race block),
    // then the grouped passive sections.
    renderRaceBlock(root, ctx);
    renderActionSections(root, sections, ctx);
  }
}
