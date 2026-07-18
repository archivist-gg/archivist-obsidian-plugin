import type { ComponentRenderContext } from "../component.types";
import type { Section, SourceKey } from "./action-model";
import { renderWeaponRow } from "./weapons-table";
import { renderItemRow } from "./items-table";
import { renderBoonRow } from "./boon-rows";
import { renderFeatureRow } from "./feature-rows";

// Per-source grid class — weapons keep the 5-col grid, items the 4-col grid,
// everything else the feature grid (moved verbatim from ActionsTab.render).
const LIST_CLASS: Record<SourceKey, string> = {
  weapons: "pc-weapons-table", items: "pc-items-table",
  "class-features": "pc-feature-list", feats: "pc-feature-list",
  race: "pc-feature-list", background: "pc-feature-list", boons: "pc-feature-list pc-boons-list",
};

/** Render a (possibly filtered) list of economy sections into `root`: the economy
 *  heading, each sub-group's head (+ optional count), and every entry dispatched
 *  to its row renderer by `entry.kind`. No re-derivation happens here. */
export function renderActionSections(
  root: HTMLElement,
  sections: Section[],
  ctx: ComponentRenderContext,
): void {
  for (const section of sections) {
    root.createEl("h4", { cls: "pc-tab-heading", text: section.label });
    for (const sg of section.subGroups) {
      const head = root.createDiv({ cls: "pc-actions-section-head" });
      head.createSpan({ cls: "pc-actions-section-title", text: sg.label });
      if (sg.count) head.createSpan({ cls: "pc-actions-section-count", text: sg.count });
      const list = root.createDiv({ cls: `pc-actions-table ${LIST_CLASS[sg.key]}` });
      for (const e of sg.entries) {
        if (e.kind === "weapon") renderWeaponRow(list, e.attack, ctx);
        else if (e.kind === "item") renderItemRow(list, e.item, ctx);
        else if (e.kind === "boon") renderBoonRow(list, e.entry, e.status, e.poolLabel, ctx);
        else renderFeatureRow(list, e.rf, ctx, e.merged);
      }
    }
  }
}
