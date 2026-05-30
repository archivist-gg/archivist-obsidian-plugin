import type { ComponentRenderContext } from "../component.types";
import { groupByLevel, slotCells } from "./spell-display";
import { renderSpellRow } from "./spell-row";

export function renderByLevelView(root: HTMLElement, ctx: ComponentRenderContext): void {
  const spells = ctx.resolved.spells;
  const grouped = groupByLevel(spells);

  const hasPrepared = ctx.derived.spellcastingClasses.some((c) => c.preparation === "prepared");

  const slotTotal = (lvl: number): number =>
    ctx.resolved.definition.overrides.spell_slots?.[lvl] ?? ctx.derived.derivedSpellSlots[lvl] ?? 0;
  const slotUsed = (lvl: number): number => ctx.resolved.state.spell_slots?.[lvl]?.used ?? 0;

  const levels = new Set<number>([...grouped.keys()]);
  for (const k of Object.keys(ctx.derived.derivedSpellSlots)) levels.add(Number(k));
  const sorted = [...levels].sort((a, b) => a - b);

  for (const lvl of sorted) {
    const head = root.createDiv({ cls: "pc-actions-section-head" });
    head.createSpan({ text: lvl === 0 ? "Cantrips" : `${ordinal(lvl)} Level` });

    if (lvl > 0) {
      const total = slotTotal(lvl);
      if (total > 0) {
        const used = slotUsed(lvl);
        const pips = head.createSpan({ cls: "pc-slot-pips" });
        slotCells(total, used).forEach((isUsed, i) => {
          const pip = pips.createSpan({ cls: `pc-slot-pip${isUsed ? " used" : ""}`, text: isUsed ? "✕" : "" });
          pip.addEventListener("click", () => isUsed ? ctx.editState?.restoreSlot(lvl) : ctx.editState?.expendSlot(lvl));
        });
        pips.createSpan({ cls: "pc-slot-count", text: `${total - used} / ${total}` });
      }
    }

    const table = root.createEl("table", { cls: "pc-actions-table" });
    const tbody = table.createEl("tbody");
    const rowSpells = grouped.get(lvl) ?? [];
    const castLevels = lvl === 0 ? [] : availableCastLevels(lvl, slotTotal, slotUsed);
    for (const sp of rowSpells) {
      renderSpellRow(tbody, sp, ctx, { showPrepare: hasPrepared, castLevels, isCantrip: lvl === 0 });
    }
    if (rowSpells.length === 0 && lvl > 0) {
      tbody.createEl("tr").createEl("td", { cls: "pc-action-row-sub", attr: { colspan: "7" }, text: "No spells at this level." });
    }
  }

  const pact = ctx.derived.pactMagic;
  if (pact) {
    const head = root.createDiv({ cls: "pc-actions-section-head" });
    head.createSpan({ text: `Pact Magic (L${pact.level})` });
    const used = ctx.resolved.state.spell_slots_pact?.used ?? 0;
    const pips = head.createSpan({ cls: "pc-slot-pips" });
    slotCells(pact.total, used).forEach((isUsed) => {
      const pip = pips.createSpan({ cls: `pc-slot-pip${isUsed ? " used" : ""}`, text: isUsed ? "✕" : "" });
      pip.addEventListener("click", () => isUsed ? ctx.editState?.restorePactSlot() : ctx.editState?.expendPactSlot());
    });
    pips.createSpan({ cls: "pc-slot-count", text: `${pact.total - used} / ${pact.total}` });
  }
}

function availableCastLevels(spellLevel: number, total: (l: number) => number, used: (l: number) => number): number[] {
  const out: number[] = [];
  for (let l = spellLevel; l <= 9; l++) if (total(l) - used(l) > 0) out.push(l);
  return out;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}
