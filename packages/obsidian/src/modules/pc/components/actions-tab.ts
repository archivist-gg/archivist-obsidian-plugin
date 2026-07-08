import type { SheetComponent, ComponentRenderContext } from "./component.types";
import type { ResolvedCharacter } from "@archivist/dnd5e/pc/pc.types";
import { WeaponsTable } from "./actions/weapons-table";
import { ItemsTable } from "./actions/items-table";
import { FeaturesTable } from "./actions/features-table";
import { renderStandardActionsList } from "./actions/standard-actions-list";
import { renderResourceList } from "./actions/resource-badge";
import { resolveScalingDie } from "@archivist/dnd5e/dnd/resource-die";
import { CONDITION_DISPLAY_NAMES, type ConditionSlug } from "@archivist/dnd5e/pc/conditions.constants";

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

    const attacksPerAction = ctx.derived.attacksPerAction;
    const attacksHeading = attacksPerAction > 1 ? `Attacks (×${attacksPerAction})` : "Attacks";
    root.createEl("h4", { cls: "pc-tab-heading", text: attacksHeading });

    new WeaponsTable().render(root.createDiv(), ctx);
    new ItemsTable().render(root.createDiv(), ctx);
    new FeaturesTable().render(root.createDiv(), ctx);

    const featureAttacks = collectFeatureAttacks(ctx.resolved);
    if (featureAttacks.length > 0) {
      const t = root.createEl("table", { cls: "pc-attack-table pc-feature-attacks" });
      const thead = t.createEl("thead").createEl("tr");
      for (const col of ["Name", "Range", "Hit", "Damage", "Source"]) thead.createEl("th", { text: col });
      const tbody = t.createEl("tbody");
      for (const a of featureAttacks) {
        const tr = tbody.createEl("tr", { cls: "pc-attack-row" });
        if (ce && ce.actions_disabled) tr.addClass("pc-row-disabled");
        tr.createEl("td", { cls: "pc-attack-name", text: a.name });
        tr.createEl("td", { text: a.range ?? "—" });
        tr.createEl("td", { text: a.toHit ?? "—" });
        tr.createEl("td", { text: a.damage ?? "—" });
        tr.createEl("td", { text: a.source });
      }
    }

    renderResourceList(root, ctx);

    renderStandardActionsList(root, ctx);
  }
}

export interface DisplayAttack { name: string; range?: string; toHit?: string; damage?: string; source: string }

export function collectFeatureAttacks(resolved: ResolvedCharacter): DisplayAttack[] {
  const out: DisplayAttack[] = [];
  for (const rf of resolved.features) {
    const attacks = (rf.feature as unknown as { attacks?: Array<{ name?: string; range?: string; to_hit?: string; damage?: string }> }).attacks;
    if (!attacks) continue;
    // A feature that owns a scaling-die resource surfaces that die as the damage
    // for any attack that omits its own static `damage` (e.g. Reaver Seal
    // Damage). Static damage always wins. See Phase 3b §6.2. The die is resolved
    // at totalLevel to match the resource badge (so the two surfaces never desync).
    const dieRes = (rf.feature.resources ?? []).find((r) => r.die);
    const scalingDie = dieRes?.die ? resolveScalingDie(dieRes.die, resolved.totalLevel) : undefined;
    for (const a of attacks) {
      out.push({
        name: a.name ?? rf.feature.name,
        range: a.range,
        toHit: a.to_hit,
        damage: a.damage ?? scalingDie,
        source: rf.source.kind === "class" || rf.source.kind === "subclass" ? rf.source.slug : rf.source.kind,
      });
    }
  }
  return out;
}
