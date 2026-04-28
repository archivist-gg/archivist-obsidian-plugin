import type { SheetComponent, ComponentRenderContext } from "../component.types";
import type { Feature } from "../../../../shared/types/feature";
import type { FeatureSource } from "../../pc.types";
import { renderCostBadge, type ActionCost } from "./cost-badge";
import { renderChargeBoxes } from "./charge-boxes";
import { attachExpandToggle, createExpandState } from "./row-expand";
import { renderFeatureExpand } from "./feature-expand";

interface FeatureWithSource { feature: Feature; sourceLabel: string; }

const RESET_TO_RECOVERY: Record<string, "dawn" | "short" | "long" | "special"> = {
  "short-rest": "short", "long-rest": "long", "dawn": "dawn", "dusk": "long",
  "turn": "special", "round": "special", "custom": "special",
};

export class FeaturesTable implements SheetComponent {
  readonly type = "features-table";
  private expand = createExpandState();

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const rows = collectFeatures(ctx);
    if (rows.length === 0) return;

    const visible = rows.filter(({ feature }) => feature.action && feature.action !== "special");
    if (visible.length === 0) return;

    const section = el.createDiv({ cls: "pc-actions-section" });
    const head = section.createDiv({ cls: "pc-actions-section-head" });
    head.createSpan({ cls: "pc-actions-section-title", text: "Features" });
    head.createSpan({ cls: "pc-actions-section-count", text: `${visible.length} features` });

    const table = section.createEl("table", { cls: "pc-actions-table pc-features-table" });
    const tbody = table.createEl("tbody");

    for (const { feature, sourceLabel } of visible) {
      const key = `feature:${feature.id ?? feature.name}`;
      const tr = tbody.createEl("tr", { cls: "pc-action-row" });
      if (this.expand.is(key)) tr.classList.add("open");

      renderCostBadge(tr.createEl("td"), feature.action as ActionCost);

      const nameCell = tr.createEl("td");
      nameCell.createDiv({ cls: "pc-action-row-name", text: feature.name });
      if (sourceLabel) nameCell.createDiv({ cls: "pc-action-row-sub", text: sourceLabel });

      tr.createEl("td", { text: "self" });

      const chgCell = tr.createEl("td");
      const featureKey = feature.resources?.[0]?.id ?? feature.id;
      const fu = featureKey ? ctx.resolved.state.feature_uses?.[featureKey] : undefined;
      if (fu && featureKey) {
        const reset = feature.resources?.[0]?.reset ?? "long-rest";
        renderChargeBoxes(chgCell, {
          used: fu.used,
          max: fu.max,
          recovery: { amount: String(fu.max), reset: RESET_TO_RECOVERY[reset] ?? "special" },
          onExpend: () => ctx.editState?.expendFeatureUse(featureKey),
          onRestore: () => ctx.editState?.restoreFeatureUse(featureKey),
        });
      } else {
        chgCell.createSpan({ text: "—" });
      }

      attachExpandToggle(tr.createEl("td"), key, (k) => {
        this.expand.toggle(k);
        el.empty();
        this.render(el, ctx);
      });

      if (this.expand.is(key)) {
        const exp = tbody.createEl("tr", { cls: "pc-action-expand-row" });
        const td = exp.createEl("td");
        td.setAttribute("colspan", "5");
        const inner = td.createDiv({ cls: "pc-action-expand-inner" });
        renderFeatureExpand(inner, feature, sourceLabel);
      }
    }
  }
}

/**
 * Normalizes `ctx.resolved.features` into `{ feature, sourceLabel }[]`.
 *
 * Production shape is `ResolvedCharacter.features: ResolvedFeature[]`
 * (each `{ feature: Feature; source: FeatureSource }`). Tests sometimes
 * pass raw `Feature[]` (no wrapper). We accept both:
 *   - If an entry has a `feature` property, treat it as ResolvedFeature
 *     and derive `sourceLabel` from its `source` (FeatureSource).
 *   - Otherwise, treat the entry itself as a `Feature` and emit
 *     an empty source label.
 */
function collectFeatures(ctx: ComponentRenderContext): FeatureWithSource[] {
  const features = (ctx.resolved as unknown as {
    features?: Array<{ feature: Feature; source?: FeatureSource } | Feature>;
  }).features ?? [];
  return features.map((entry) => {
    if (entry && typeof entry === "object" && "feature" in entry) {
      const wrapped = entry as { feature: Feature; source?: FeatureSource };
      return { feature: wrapped.feature, sourceLabel: formatSourceLabel(wrapped.source) };
    }
    return { feature: entry as Feature, sourceLabel: "" };
  });
}

function formatSourceLabel(source: FeatureSource | undefined): string {
  if (!source) return "";
  switch (source.kind) {
    case "class":
      return `${capitalizeSlug(source.slug)} ${source.level}`;
    case "subclass":
      return `${capitalizeSlug(source.slug)} ${source.level}`;
    case "race":
      return capitalizeSlug(source.slug);
    case "background":
      return `Background: ${capitalizeSlug(source.slug)}`;
    case "feat":
      return `Feat: ${capitalizeSlug(source.slug)}`;
    default:
      return "";
  }
}

function capitalizeSlug(slug: string): string {
  return slug.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}
