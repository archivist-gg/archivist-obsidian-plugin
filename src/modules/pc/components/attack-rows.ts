import type { SheetComponent, ComponentRenderContext } from "./component.types";
import type { AttackRow } from "../pc.types";
import { conditionsToText } from "../../item/item.conditions";

export class AttackRows implements SheetComponent {
  readonly type = "attack-rows";

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const root = el.createDiv({ cls: "pc-attack-rows" });
    const attacks = ctx.derived.attacks ?? [];

    if (attacks.length === 0) {
      root.createDiv({ cls: "pc-empty-line", text: "No attacks." });
      return;
    }

    const table = root.createEl("table", { cls: "pc-attack-table" });
    const thead = table.createEl("thead").createEl("tr");
    for (const col of ["Name", "Range", "Hit", "Damage", "Notes"]) thead.createEl("th", { text: col });
    const tbody = table.createEl("tbody");

    for (const a of attacks) {
      const tr = tbody.createEl("tr", { cls: "pc-attack-row" });
      tr.createEl("td", { cls: "pc-attack-name", text: a.name });
      tr.createEl("td", { cls: "pc-attack-range", text: a.range ?? "—" });
      tr.createEl("td", { cls: "pc-attack-tohit", text: formatSigned(a.toHit) });
      tr.createEl("td", { cls: "pc-attack-damage", text: damageCellText(a) });
      const notes = tr.createEl("td", { cls: "pc-attack-notes" });
      const info = notes.createSpan({ cls: "pc-attack-info", text: "ⓘ" });
      info.title = breakdownTitle(a);
      if (!a.proficient) notes.createSpan({ cls: "pc-attack-non-prof", text: "(non-prof)" });

      // Situational subline for conditional bonuses.
      if (a.informational && a.informational.length > 0) {
        const sub = tbody.createEl("tr", { cls: "pc-attack-row-situational" });
        const td = sub.createEl("td");
        td.setAttribute("colspan", "5");
        for (const i of a.informational) {
          const line = td.createDiv({ cls: "pc-attack-row-situational-line" });
          line.createSpan({ text: `${i.source}: ${formatSigned(i.value)} ${fieldLabel(i.field)} ${conditionsToText(i.conditions)}` });
        }
      }
    }
  }
}

function fieldLabel(field: string): string {
  if (field === "weapon_attack") return "to hit";
  if (field === "weapon_damage") return "dmg";
  return field;
}

function formatSigned(n: number): string {
  return (n >= 0 ? "+" : "") + n;
}

function damageCellText(a: AttackRow): string {
  const dmg = `${a.damageDice} ${a.damageType}`;
  return a.extraDamage ? `${dmg} + ${a.extraDamage}` : dmg;
}

function breakdownTitle(a: AttackRow): string {
  const lines: string[] = [`To hit: ${formatSigned(a.toHit)}`];
  for (const t of a.breakdown.toHit) lines.push(`  ${t.source}: ${formatSigned(t.amount)}`);
  lines.push("", `Damage: ${a.damageDice} ${a.damageType}`);
  for (const t of a.breakdown.damage) lines.push(`  ${t.source}: ${formatSigned(t.amount)}`);
  if (a.extraDamage) lines.push(`  Extra: ${a.extraDamage}`);
  return lines.join("\n");
}
