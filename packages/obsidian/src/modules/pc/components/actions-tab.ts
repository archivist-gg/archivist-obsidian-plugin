import type { SheetComponent, ComponentRenderContext } from "./component.types";
import { renderWeaponRow } from "./actions/weapons-table";
import { renderItemRow } from "./actions/items-table";
import { renderBoonRow } from "./actions/boon-rows";
import { renderFeatureRow } from "./actions/feature-rows";
import { buildActionModel, type SourceKey } from "./actions/action-model";
import { renderStandardActionsList } from "./actions/standard-actions-list";
import { CONDITION_DISPLAY_NAMES, type ConditionSlug } from "@archivist-gg/dnd5e/pc/conditions.constants";

const ACTION_DISABLING_CONDITIONS: ReadonlySet<ConditionSlug> = new Set([
  "incapacitated", "paralyzed", "petrified", "stunned", "unconscious",
]);

export class ActionsTab implements SheetComponent {
  readonly type = "actions-tab";

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const root = el.createDiv({ cls: "pc-tab-body pc-actions-body pc-actions-tab" });

    const ce = ctx.derived.conditionEffects;
    if (ce && ce.actions_disabled) {
      const banner = root.createDiv({ cls: "pc-incapacitated-banner" });
      const names = ce.sources
        .filter((s): s is { condition: ConditionSlug; level?: number; effects: string[] } =>
          s.condition !== "exhaustion" && ACTION_DISABLING_CONDITIONS.has(s.condition))
        .map((s) => CONDITION_DISPLAY_NAMES[s.condition]);
      const status = names.length > 0 ? names.join(" · ") : "Incapacitated";
      banner.createDiv({ cls: "pc-incapacitated-banner-status", text: status });
      banner.createDiv({ cls: "pc-incapacitated-banner-effect", text: "actions & reactions disabled" });
    }

    // ── Two-level economy × source model (spec §3) ───────────────────
    // The pure `buildActionModel` categorizer files every playable entry —
    // weapons, magic items, class/race/background features, feats and boons —
    // into economy sections (Actions / Bonus / Reactions / Passive), each split
    // into fixed-order source sub-groups. The tab is now pure layout: emit the
    // economy heading + each sub-group's head, then dispatch every entry to its
    // row renderer by `entry.kind` (no re-derivation happens here).
    //
    // Per-source grid class — weapons keep the 5-col grid, items the 4-col grid,
    // everything else the feature grid. A fixed `pc-feature-list` for the
    // weapon/item sub-groups would collapse their multi-column grids
    // (actions.css: `.pc-weapons-table`/`.pc-items-table` own the grid), so the
    // list carries the per-source class.
    const LIST_CLASS: Record<SourceKey, string> = {
      weapons: "pc-weapons-table", items: "pc-items-table",
      "class-features": "pc-feature-list", feats: "pc-feature-list",
      race: "pc-feature-list", background: "pc-feature-list", boons: "pc-feature-list pc-boons-list",
    };
    const model = buildActionModel(ctx.resolved, ctx.derived, ctx.services.entities);
    for (const section of model) {
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
          else renderFeatureRow(list, e.rf, ctx);
        }
      }
    }

    renderStandardActionsList(root, ctx);
  }
}
