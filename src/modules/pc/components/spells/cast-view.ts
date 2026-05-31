import type { ComponentRenderContext } from "../component.types";
import type { ResolvedSpell } from "../../pc.types";
import { renderChargeBoxes } from "../actions/charge-boxes";
import { spellEffectAtSlot, upcastLevelsFor } from "./spell-scaling";
import { toggleSpellBlock } from "./spell-block-expand";

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

export function renderCastView(root: HTMLElement, ctx: ComponentRenderContext): void {
  const castable = ctx.resolved.spells.filter((s) => s.prepared);
  const slotTotal = (lvl: number): number =>
    ctx.resolved.definition.overrides.spell_slots?.[lvl] ?? ctx.derived.derivedSpellSlots[lvl] ?? 0;
  const slotUsed = (lvl: number): number => ctx.resolved.state.spell_slots?.[lvl]?.used ?? 0;

  const ownedLevels = Object.keys(ctx.derived.derivedSpellSlots)
    .map(Number).filter((l) => slotTotal(l) > 0).sort((a, b) => a - b);

  // Cantrips
  const cantrips = castable.filter((s) => (s.entity.level ?? 0) === 0);
  if (cantrips.length) {
    const head = root.createDiv({ cls: "pc-actions-section-head" });
    head.createSpan({ text: "Cantrips" });
    const tbl = root.createDiv({ cls: "pc-spell-list" });
    for (const s of cantrips) renderCastRow(tbl, s, 0, ctx, { cantrip: true });
  }

  // Leveled sections
  for (const lvl of ownedLevels) {
    const head = root.createDiv({ cls: "pc-actions-section-head" });
    head.createSpan({ text: `${ordinal(lvl)} Level` });
    renderChargeBoxes(head, {
      used: slotUsed(lvl), max: slotTotal(lvl),
      onExpend: () => ctx.editState?.expendSlot(lvl),
      onRestore: () => ctx.editState?.restoreSlot(lvl),
    });

    const list = root.createDiv({ cls: "pc-spell-list" });
    const base = castable.filter((s) => (s.entity.level ?? 0) === lvl);
    const upcasts = castable.filter((s) => upcastLevelsFor(s.entity, ownedLevels).includes(lvl));
    for (const s of base) renderCastRow(list, s, lvl, ctx, {});
    for (const s of upcasts) renderCastRow(list, s, lvl, ctx, { upcast: true });
    if (!base.length && !upcasts.length) list.createDiv({ cls: "pc-spell-empty-row", text: "No spells at this level." });
  }

  // Pact Magic
  const pact = ctx.derived.pactMagic;
  if (pact) {
    const head = root.createDiv({ cls: "pc-actions-section-head" });
    head.createSpan({ text: `Pact Magic (L${pact.level})` });
    renderChargeBoxes(head, {
      used: ctx.resolved.state.spell_slots_pact?.used ?? 0, max: pact.total,
      onExpend: () => ctx.editState?.expendPactSlot(),
      onRestore: () => ctx.editState?.restorePactSlot(),
    });
  }
}

function renderCastRow(
  parent: HTMLElement, spell: ResolvedSpell, level: number,
  ctx: ComponentRenderContext, opts: { cantrip?: boolean; upcast?: boolean },
): void {
  const row = parent.createDiv({ cls: `pc-spell-cast-row${opts.upcast ? " upcast" : ""}` });

  // Left: cast pill
  const slotTotal = ctx.resolved.definition.overrides.spell_slots?.[level] ?? ctx.derived.derivedSpellSlots[level] ?? 0;
  const slotUsed = ctx.resolved.state.spell_slots?.[level]?.used ?? 0;
  const noSlot = !opts.cantrip && slotUsed >= slotTotal;
  const pill = row.createEl("button", { cls: `pc-spell-castpill${opts.cantrip ? " ghost" : ""}${noSlot ? " disabled" : ""}`, text: "Cast" });
  if (!noSlot) {
    pill.addEventListener("click", (e) => {
      e.stopPropagation();
      if (opts.cantrip) ctx.editState?.castCantrip(spell.slug);
      else ctx.editState?.castSpell(spell.slug, level);
    });
  }

  // Name (+ school sub, markers) — opens block
  const nameWrap = row.createDiv({ cls: "pc-spell-namewrap" });
  const name = nameWrap.createSpan({ cls: "pc-spell-name", text: spell.entity.name });
  if (spell.entity.concentration) name.createSpan({ cls: "pc-spell-mk", text: "C" });
  if (spell.entity.ritual) name.createSpan({ cls: "pc-spell-mk", text: "R" });
  if (opts.upcast) name.createSpan({ cls: "pc-spell-up", text: `↑ ${level}${level === 1 ? "st" : level === 2 ? "nd" : level === 3 ? "rd" : "th"}` });
  if (spell.entity.school) nameWrap.createDiv({ cls: "pc-spell-sub", text: spell.entity.school });
  nameWrap.addEventListener("click", () => toggleSpellBlock(row, spell, ctx));

  // Right: scaled-effect chip (upcast rows, when structured data is trustworthy)
  if (opts.upcast) {
    const eff = spellEffectAtSlot(spell.entity, level);
    if (eff) row.createSpan({ cls: "pc-spell-eff", text: eff });
  }
}
