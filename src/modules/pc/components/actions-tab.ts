import type { SheetComponent, ComponentRenderContext } from "./component.types";
import type { ResolvedCharacter } from "../pc.types";

export class ActionsTab implements SheetComponent {
  readonly type = "actions-tab";

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const root = el.createDiv({ cls: "pc-tab-body pc-actions-body" });

    // Attacks
    root.createEl("h4", { cls: "pc-tab-heading", text: "Attacks" });
    const weapons = (ctx.resolved.definition.equipment ?? []).filter((e) => /weapon|sword|bow|axe|hammer|dagger|mace|spear|club|flail|rapier|staff|crossbow/i.test(e.item));
    const featureAttacks = collectFeatureAttacks(ctx.resolved);
    if (weapons.length === 0 && featureAttacks.length === 0) {
      root.createDiv({ cls: "pc-empty-line", text: "No attacks." });
    } else {
      const table = root.createEl("table", { cls: "pc-attack-table" });
      const thead = table.createEl("thead").createEl("tr");
      for (const col of ["Attack", "Range", "Hit", "Damage", "Notes"]) thead.createEl("th", { text: col });
      const tbody = table.createEl("tbody");
      for (const w of weapons) {
        const tr = tbody.createEl("tr");
        tr.createEl("td", { cls: "pc-attack-name", text: stripSlug(w.item) });
        tr.createEl("td", { text: "—" });
        tr.createEl("td", { text: "—" });
        tr.createEl("td", { text: "—" });
        tr.createEl("td", { text: w.notes ?? (w.equipped ? "equipped" : "") });
      }
      for (const a of featureAttacks) {
        const tr = tbody.createEl("tr");
        tr.createEl("td", { cls: "pc-attack-name", text: a.name });
        tr.createEl("td", { text: a.range ?? "—" });
        tr.createEl("td", { text: a.toHit ?? "—" });
        tr.createEl("td", { text: a.damage ?? "—" });
        tr.createEl("td", { text: a.source });
      }
    }

    // Resource badges (read-only)
    const resourceFeatures = ctx.resolved.features.filter((rf) => rf.feature.grants_resource || rf.feature.resources);
    if (resourceFeatures.length > 0) {
      root.createEl("h4", { cls: "pc-tab-heading", text: "Resources" });
      const strip = root.createDiv({ cls: "pc-resource-strip" });
      for (const rf of resourceFeatures) {
        const badge = strip.createDiv({ cls: "pc-resource-badge" });
        badge.createSpan({ cls: "pc-resource-name", text: rf.feature.name });
      }
    }

    // Hit dice
    const hdEntries = Object.entries(ctx.resolved.state.hit_dice ?? {});
    if (hdEntries.length > 0) {
      root.createEl("h4", { cls: "pc-tab-heading", text: "Hit dice" });
      const hdRow = root.createDiv({ cls: "pc-hd-row" });
      for (const [die, { used, total }] of hdEntries) {
        hdRow.createSpan({ cls: "pc-hd-entry", text: `${total - used}/${total} ${die}` });
      }
    }

    // Death saves
    const ds = ctx.resolved.state.death_saves;
    if (ds) {
      root.createEl("h4", { cls: "pc-tab-heading", text: "Death saves" });
      const block = root.createDiv({ cls: "pc-death-saves" });
      const succ = block.createDiv({ cls: "pc-ds-row" });
      succ.createSpan({ cls: "pc-ds-label", text: "Successes" });
      for (let i = 0; i < 3; i++) succ.createSpan({ cls: `pc-ds-dot${i < ds.successes ? " filled" : ""}` });
      const fail = block.createDiv({ cls: "pc-ds-row" });
      fail.createSpan({ cls: "pc-ds-label", text: "Failures" });
      for (let i = 0; i < 3; i++) fail.createSpan({ cls: `pc-ds-dot${i < ds.failures ? " filled failure" : ""}` });
    }
  }
}

interface DisplayAttack {
  name: string;
  range?: string;
  toHit?: string;
  damage?: string;
  source: string;
}

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

function stripSlug(ref: string): string {
  return ref.replace(/^\[\[(.+)\]\]$/, "$1").replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
