import type { SheetComponent, ComponentRenderContext } from "./component.types";
import { buildActionModel } from "./actions/action-model";
import { renderActionSections } from "./actions/section-renderer";
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
    // into fixed-order source sub-groups. `renderActionSections` is pure layout.
    const model = buildActionModel(ctx.resolved, ctx.derived, ctx.services.entities);
    renderActionSections(root, model.filter((s) => s.key !== "passive"), ctx);

    renderStandardActionsList(root, ctx);
  }
}
