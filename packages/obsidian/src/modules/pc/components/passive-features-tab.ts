import type { SheetComponent, ComponentRenderContext } from "./component.types";
import { buildActionModel } from "./actions/action-model";
import { renderActionSections } from "./actions/section-renderer";
import { renderRaceBlock } from "./passive/race-block";
import { renderBackgroundBlock } from "./passive/background-block";

/**
 * Tab 2 — "Passive & Features". Renders, top to bottom (spec §1.1):
 *   1. the bespoke **Race block** (`renderRaceBlock`, reads `resolved.race`) —
 *      consolidating the scattered per-trait race rows the model used to emit;
 *   2. the bespoke **Background block** (`renderBackgroundBlock`, reads
 *      `resolved.background`) — replacing the 2024 "(No description provided.)"
 *      placeholder with a real-content reference block;
 *   3. the `passive` economy grouped sections ("Passive & Free Actions": passive/
 *      free features, feats, and free/passive boons).
 *
 * The `race` AND `background` sub-groups are PRE-SPLIT out of the passive model
 * before rendering the sections (F8): the bespoke blocks own that content now
 * (removing `background` also suppresses the generator placeholder row). Any
 * Section left with zero sub-groups after the split is dropped (R1-#6) so a bare
 * "Passive & Free Actions" `<h4>` never renders. Shares the same section renderer
 * as the Actions tab; passive/free rows never dim, so no incapacitated banner
 * here.
 */
export class PassiveFeaturesTab implements SheetComponent {
  readonly type = "passive-features-tab";

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    // Keep `pc-actions-tab` so the tab-scoped attack-tag color rules
    // (actions.css) still apply to any free/special weapon that lands here.
    const root = el.createDiv({ cls: "pc-tab-body pc-actions-body pc-actions-tab pc-passive-features-tab" });

    // Pre-split (§3.2/§4.1, F8): drop the `race` AND `background` sub-groups from
    // every passive Section — their content is owned by the bespoke blocks (the
    // `background` split also suppresses the generator "(No description
    // provided.)" placeholder row) — then drop any Section left with zero
    // sub-groups so a now-empty section never renders a bare heading.
    const sections = buildActionModel(ctx.resolved, ctx.derived, ctx.services.entities)
      .filter((s) => s.key === "passive")
      .map((s) => ({
        ...s,
        subGroups: s.subGroups.filter((sg) => sg.key !== "race" && sg.key !== "background"),
      }))
      .filter((s) => s.subGroups.length > 0);

    const hasBlock = ctx.resolved.race != null || ctx.resolved.background != null;
    if (!hasBlock && sections.length === 0) {
      root.createDiv({ cls: "pc-empty-line", text: "(No passive or free actions.)" });
      return;
    }

    // Blocks first (Race, then Background — spec §1.1), then the grouped passive
    // sections.
    renderRaceBlock(root, ctx);
    renderBackgroundBlock(root, ctx);
    renderActionSections(root, sections, ctx);
  }
}
