import type { SheetComponent, ComponentRenderContext } from "./component.types";
import type { ResolvedCharacter } from "../pc.types";
import { WeaponsTable } from "./actions/weapons-table";
import { ItemsTable } from "./actions/items-table";

export class ActionsTab implements SheetComponent {
  readonly type = "actions-tab";

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const root = el.createDiv({ cls: "pc-tab-body pc-actions-body pc-actions-tab" });
    root.createEl("h4", { cls: "pc-tab-heading", text: "Attacks" });

    new WeaponsTable().render(root, ctx);
    new ItemsTable().render(root, ctx);

    const featureAttacks = collectFeatureAttacks(ctx.resolved);
    if (featureAttacks.length > 0) {
      const t = root.createEl("table", { cls: "pc-attack-table pc-feature-attacks" });
      const thead = t.createEl("thead").createEl("tr");
      for (const col of ["Name", "Range", "Hit", "Damage", "Source"]) thead.createEl("th", { text: col });
      const tbody = t.createEl("tbody");
      for (const a of featureAttacks) {
        const tr = tbody.createEl("tr", { cls: "pc-attack-row" });
        tr.createEl("td", { cls: "pc-attack-name", text: a.name });
        tr.createEl("td", { text: a.range ?? "—" });
        tr.createEl("td", { text: a.toHit ?? "—" });
        tr.createEl("td", { text: a.damage ?? "—" });
        tr.createEl("td", { text: a.source });
      }
    }

    const resourceFeatures = ctx.resolved.features.filter((rf) => rf.feature.grants_resource || rf.feature.resources);
    if (resourceFeatures.length > 0) {
      root.createEl("h4", { cls: "pc-tab-heading", text: "Resources" });
      const strip = root.createDiv({ cls: "pc-resource-strip" });
      for (const rf of resourceFeatures) {
        strip.createDiv({ cls: "pc-resource-badge" }).createSpan({ cls: "pc-resource-name", text: rf.feature.name });
      }
    }
  }
}

interface DisplayAttack { name: string; range?: string; toHit?: string; damage?: string; source: string }

function collectFeatureAttacks(resolved: ResolvedCharacter): DisplayAttack[] {
  const out: DisplayAttack[] = [];
  for (const rf of resolved.features) {
    const attacks = (rf.feature as unknown as { attacks?: Array<{ name?: string; range?: string; to_hit?: string; damage?: string }> }).attacks;
    if (!attacks) continue;
    for (const a of attacks) {
      out.push({
        name: a.name ?? rf.feature.name,
        range: a.range,
        toHit: a.to_hit,
        damage: a.damage,
        source: rf.source.kind === "class" || rf.source.kind === "subclass" ? rf.source.slug : rf.source.kind,
      });
    }
  }
  return out;
}
