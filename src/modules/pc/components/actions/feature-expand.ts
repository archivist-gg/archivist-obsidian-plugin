import type { Feature } from "../../../../shared/types/feature";
import type { Attack, AttackRange } from "../../../../shared/types/attack";

/**
 * Renders the inner content of a FeaturesTable expand row: feature title,
 * source label (e.g. "Fighter 2"), description (or fallback `entries`
 * paragraphs), and any structured attacks attached to the feature.
 *
 * Used by FeaturesTable (Task 22) inside its expanded row panel.
 */
export function renderFeatureExpand(
  parent: HTMLElement,
  feature: Feature,
  sourceLabel: string,
): HTMLElement {
  const wrap = parent.createDiv({ cls: "pc-feature-expand" });
  wrap.createDiv({ cls: "pc-feature-expand-title", text: feature.name });
  if (sourceLabel) wrap.createDiv({ cls: "pc-feature-expand-meta", text: sourceLabel });

  const body = wrap.createDiv({ cls: "pc-feature-expand-body" });
  if (feature.description) {
    body.createEl("p", { text: feature.description });
  } else if (feature.entries && feature.entries.length > 0) {
    for (const entry of feature.entries) {
      body.createEl("p", { text: entry });
    }
  }

  if (feature.attacks && feature.attacks.length > 0) {
    const atk = wrap.createDiv({ cls: "pc-feature-expand-attacks" });
    for (const a of feature.attacks) {
      const line = atk.createDiv({ cls: "pc-feature-expand-attack-line" });
      line.createSpan({ text: formatAttackLine(a) });
    }
  }
  return wrap;
}

function formatAttackLine(a: Attack): string {
  const parts: string[] = [];
  parts.push(a.name || "Attack");
  const dmg = [a.damage, a.damage_type].filter(Boolean).join(" ");
  if (dmg) parts.push(dmg);
  const range = formatRange(a.range);
  if (range) parts.push(range);
  return parts.join(" · ");
}

function formatRange(range: AttackRange | undefined): string {
  if (!range) return "";
  if (range.reach != null) return `reach ${range.reach} ft.`;
  if (range.normal != null && range.long != null) return `${range.normal}/${range.long} ft.`;
  if (range.normal != null) return `${range.normal} ft.`;
  return "";
}
