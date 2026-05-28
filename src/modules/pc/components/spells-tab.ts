import type { SheetComponent, ComponentRenderContext } from "./component.types";
import type { ResolvedCharacter } from "../pc.types";

export class SpellsTab implements SheetComponent {
  readonly type = "spells-tab";

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const root = el.createDiv({ cls: "pc-tab-body pc-spells-body" });
    const casting = firstCastingClass(ctx.resolved);
    if (!casting) {
      const empty = root.createDiv({ cls: "pc-spells-empty" });
      empty.createDiv({ cls: "pc-spells-empty-icon", text: "☆" });
      empty.createDiv({ cls: "pc-spells-empty-title", text: "No Spellcasting" });
      const name = ctx.resolved.definition.name;
      const className = ctx.resolved.classes[0]?.entity?.name ?? "this class";
      empty.createDiv({ cls: "pc-spells-empty-subtitle", text: `${name} is a ${className} with no spellcasting feature.` });
      return;
    }

    // DC / attack summary
    const summary = root.createDiv({ cls: "pc-spell-summary" });
    if (ctx.derived.spellcasting) {
      summary.createSpan({ cls: "pc-spell-key", text: "DC " });
      summary.createSpan({ cls: "pc-spell-val", text: `${ctx.derived.spellcasting.saveDC}` });
      summary.createSpan({ cls: "pc-spell-sep", text: " • " });
      summary.createSpan({ cls: "pc-spell-key", text: "Atk " });
      summary.createSpan({ cls: "pc-spell-val", text: `+${ctx.derived.spellcasting.attackBonus}` });
    }

    // Slot grid
    const slots = ctx.resolved.state.spell_slots ?? {};
    const slotKeys = Object.keys(slots).map(Number).filter((n) => !Number.isNaN(n)).sort((a, b) => a - b);
    if (slotKeys.length > 0) {
      const grid = root.createDiv({ cls: "pc-slot-grid" });
      for (const lvl of slotKeys) {
        const cell = grid.createDiv({ cls: "pc-slot-cell" });
        cell.createDiv({ cls: "pc-slot-label", text: `L${lvl}` });
        const s = slots[lvl];
        cell.createDiv({ cls: "pc-slot-val", text: `${s.total - s.used}/${s.total}` });
      }
    }

    // Spells known, grouped by approximate level (best-effort: all under "Known" in SP3 since spell entities aren't resolved).
    const known = ctx.resolved.definition.spells?.known ?? [];
    if (known.length > 0) {
      root.createEl("h4", { cls: "pc-tab-heading", text: "Spells known" });
      const list = root.createEl("ul", { cls: "pc-spell-list" });
      for (const raw of known) {
        const li = list.createEl("li");
        li.createSpan({ cls: "pc-spell-name", text: prettifySlug(raw) });
        li.createSpan({ cls: "pc-spell-slug", text: ` [[${stripBrackets(raw)}]]` });
      }
    } else {
      root.createDiv({ cls: "pc-empty-line", text: "No spells recorded on this character yet." });
    }
  }
}

function firstCastingClass(r: ResolvedCharacter): boolean {
  for (const c of r.classes) {
    const sc = (c.entity as unknown as { spellcasting?: unknown })?.spellcasting;
    if (sc) return true;
  }
  return false;
}

function stripBrackets(s: string) {
  return s.replace(/^\[\[/, "").replace(/\]\]$/, "");
}

function prettifySlug(s: string) {
  return stripBrackets(s).replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
