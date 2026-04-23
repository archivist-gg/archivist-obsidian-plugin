import type { SheetComponent, ComponentRenderContext } from "./component.types";
import { formatModifier } from "../../../shared/dnd/math";

export class CombatStatsRow implements SheetComponent {
  readonly type = "combat-stats-row";

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const row = el.createDiv({ cls: "pc-combat-row" });

    this.statCard(row, "Prof", formatModifier(ctx.derived.proficiencyBonus), "Proficiency Bonus");
    this.statCard(row, "Speed", `${ctx.derived.speed}`, "Walking Speed", "ft.");
    this.statCard(row, "Init", formatModifier(ctx.derived.initiative), "Initiative");
    this.statCard(row, "AC", `${ctx.derived.ac}`, "Armor Class");

    const inspCard = row.createDiv({ cls: "pc-combat-card pc-combat-inspiration" });
    inspCard.createDiv({ cls: "pc-combat-label", text: "Heroic Inspiration" });
    const inspired = !!ctx.resolved.state?.inspiration;
    inspCard.createDiv({ cls: `pc-combat-inspiration-icon${inspired ? " filled" : ""}`, text: inspired ? "★" : "☆" });

    const hpCard = row.createDiv({ cls: "pc-combat-card pc-combat-hp" });
    hpCard.createDiv({ cls: "pc-combat-label", text: "Hit Points" });
    const hpRow = hpCard.createDiv({ cls: "pc-hp-row" });
    hpRow.createSpan({ cls: "pc-hp-current", text: `${ctx.derived.hp.current}` });
    hpRow.createSpan({ cls: "pc-hp-sep", text: " / " });
    hpRow.createSpan({ cls: "pc-hp-max", text: `${ctx.derived.hp.max}` });
    if (ctx.derived.hp.temp > 0) {
      hpRow.createSpan({ cls: "pc-hp-temp", text: ` +${ctx.derived.hp.temp} temp` });
    }
    const hdLabel = Object.entries(ctx.resolved.state.hit_dice ?? {})
      .map(([die, { used, total }]) => `${total - used}/${total}${die}`)
      .join(", ");
    if (hdLabel) hpCard.createDiv({ cls: "pc-hp-hitdice", text: `Hit Dice: ${hdLabel}` });
  }

  private statCard(row: HTMLElement, label: string, big: string, title: string, unit?: string) {
    const card = row.createDiv({ cls: "pc-combat-card", attr: { title } });
    card.createDiv({ cls: "pc-combat-big", text: big });
    card.createDiv({ cls: "pc-combat-label", text: unit ? `${label} (${unit})` : label });
  }
}
