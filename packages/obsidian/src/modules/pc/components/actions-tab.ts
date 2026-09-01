import type { SheetComponent, ComponentRenderContext } from "./component.types";
import { buildActionModel } from "./actions/action-model";
import { renderActionSections } from "./actions/section-renderer";
import { renderStandardActionsList } from "./actions/standard-actions-list";
import type { ConditionSlug } from "@archivist-gg/dnd5e/pc/conditions.constants";
import type { PCServices } from "../pc.services";
import { buildConditionLabelMap, conditionDisplayName } from "../condition-labels";
import { hiddenCompendiumSet } from "../../../shared/entities/compendium-visibility";

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
      // Built inside the branch: no banner, no registry scan. The cast is not
      // cosmetic: several sheet render paths hand components a ctx whose
      // `services` is absent or partial, and `buildConditionLabelMap` is
      // fail-open on exactly that (see condition-labels.ts) — an empty map
      // reproduces the retired `CONDITION_DISPLAY_NAMES` spellings byte for byte.
      const services = ctx.services as Partial<PCServices> | undefined;
      const conditionLabels = buildConditionLabelMap(
        services?.entities,
        hiddenCompendiumSet(services?.plugin?.settings),
      );
      const names = ce.sources
        .filter((s): s is { condition: ConditionSlug; level?: number; effects: string[] } =>
          s.condition !== "exhaustion" && ACTION_DISABLING_CONDITIONS.has(s.condition))
        .map((s) => conditionDisplayName(s.condition, conditionLabels));
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
