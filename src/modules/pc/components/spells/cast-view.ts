import type { ComponentRenderContext } from "../component.types";
import type { ResolvedSpell } from "../../pc.types";
import { renderChargeBoxes } from "../actions/charge-boxes";
import { spellEffectAtSlot, upcastLevelsFor } from "./spell-scaling";
import { toggleSpellBlock } from "./spell-block-expand";
import { baseClassName } from "../../pc.spellcasting";
import { compactCastingTime, formatRange, hitDcDescriptor, effectDescriptor, componentLetters } from "./spell-display";
import { setDamageTypeIcon, hasDamageTypeIcon } from "../../assets/spell-icons";

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

const COLS = ["", "Name", "Time", "Range", "Hit / DC", "Effect", "Components"];

function tableFor(root: HTMLElement): HTMLElement {
  const table = root.createEl("table", { cls: "pc-spell-cast-table" });
  const thead = table.createEl("thead");
  const htr = thead.createEl("tr");
  for (const c of COLS) htr.createEl("th", { text: c });
  return table.createEl("tbody");
}

export function renderCastView(root: HTMLElement, ctx: ComponentRenderContext): void {
  // A spell is castable when its class explicitly prepares it (prepared===true,
  // which the resolver only ever sets for prepared casters, cantrips, and
  // always-prepared spells) OR it belongs to a known-caster class — every known
  // spell of a known caster (sorcerer / bard-2014 / warlock / ranger-2014) is
  // castable. Normalize class slugs on both sides so a bare `class: sorcerer`
  // matches a compendium-prefixed derived slug like `srd-2024_sorcerer`.
  const knownClassSlugs = new Set(
    ctx.derived.spellcastingClasses.filter((c) => c.preparation === "known").map((c) => baseClassName(c.classSlug)),
  );
  const isCastable = (s: ResolvedSpell): boolean =>
    s.prepared || knownClassSlugs.has(baseClassName(s.classSlug ?? ""));
  const castable = ctx.resolved.spells.filter(isCastable);

  const slotTotal = (lvl: number): number =>
    ctx.resolved.definition.overrides.spell_slots?.[lvl] ?? ctx.derived.derivedSpellSlots[lvl] ?? 0;
  const slotUsed = (lvl: number): number => ctx.resolved.state.spell_slots?.[lvl]?.used ?? 0;
  const ownedLevels = Object.keys(ctx.derived.derivedSpellSlots)
    .map(Number).filter((l) => slotTotal(l) > 0).sort((a, b) => a - b);
  // Pact-class slugs: their leveled spells live in the Pact Magic section only.
  const pactClassSlugs = ctx.derived.spellcastingClasses.filter((c) => c.casterType === "pact").map((c) => c.classSlug);

  const dcFor = (s: ResolvedSpell): number => {
    const cls = ctx.derived.spellcastingClasses.find((c) => baseClassName(c.classSlug) === baseClassName(s.classSlug ?? ""));
    return cls?.saveDC ?? ctx.derived.spellcastingClasses[0]?.saveDC ?? 0;
  };

  // ── Cantrips: At Will, no slots, no button ──
  const cantrips = castable.filter((s) => (s.entity.level ?? 0) === 0);
  if (cantrips.length) {
    const head = root.createDiv({ cls: "pc-spell-sec" });
    head.createSpan({ cls: "pc-spell-sec-label", text: "Cantrips" });
    const body = tableFor(root);
    for (const s of cantrips) renderRow(body, s, 0, ctx, dcFor, { cantrip: true });
  }

  // ── Leveled sections: slot boxes + CAST ──
  // Render every owned leveled section (a derived slot level with total > 0)
  // regardless of whether a spell is prepared there. The slot tracker lives only
  // in Cast view, so a prepared caster with no leveled spell prepared still needs
  // their owned slot boxes; an empty level renders a "No spells" row.
  for (const lvl of ownedLevels) {
    const head = root.createDiv({ cls: "pc-spell-sec" });
    head.createSpan({ cls: "pc-spell-sec-label", text: `${ordinal(lvl)} Level` });
    const slots = head.createDiv({ cls: "pc-spell-slots" });
    slots.createSpan({ cls: "pc-spell-slots-label", text: "Slots" });
    renderChargeBoxes(slots, {
      used: slotUsed(lvl), max: slotTotal(lvl),
      onExpend: () => ctx.editState?.expendSlot(lvl),
      onRestore: () => ctx.editState?.restoreSlot(lvl),
    });

    const body = tableFor(root);
    const base = castable.filter((s) => (s.entity.level ?? 0) === lvl && !pactClassSlugs.includes(s.classSlug ?? ""));
    const upcasts = castable.filter((s) => !pactClassSlugs.includes(s.classSlug ?? "") && upcastLevelsFor(s.entity, ownedLevels).includes(lvl));
    for (const s of base) renderRow(body, s, lvl, ctx, dcFor, {});
    for (const s of upcasts) renderRow(body, s, lvl, ctx, dcFor, { upcast: true });
    if (!base.length && !upcasts.length) {
      const tr = body.createEl("tr", { cls: "pc-spell-empty-row" });
      tr.createEl("td", { attr: { colspan: String(COLS.length) }, text: "No spells at this level." });
    }
  }

  // ── Pact Magic ──
  const pact = ctx.derived.pactMagic;
  if (pact) {
    const head = root.createDiv({ cls: "pc-spell-sec" });
    head.createSpan({ cls: "pc-spell-sec-label", text: `Pact Magic (L${pact.level})` });
    const slots = head.createDiv({ cls: "pc-spell-slots" });
    slots.createSpan({ cls: "pc-spell-slots-label", text: "Slots" });
    renderChargeBoxes(slots, {
      used: ctx.resolved.state.spell_slots_pact?.used ?? 0, max: pact.total,
      onExpend: () => ctx.editState?.expendPactSlot(),
      onRestore: () => ctx.editState?.restorePactSlot(),
    });
    const body = tableFor(root);
    const pactSpells = castable.filter((s) =>
      (s.entity.level ?? 0) > 0 && (pactClassSlugs.length === 0 || pactClassSlugs.includes(s.classSlug ?? "")));
    for (const s of pactSpells) renderRow(body, s, pact.level, ctx, dcFor, { pact: true });
    if (!pactSpells.length) {
      const tr = body.createEl("tr", { cls: "pc-spell-empty-row" });
      tr.createEl("td", { attr: { colspan: String(COLS.length) }, text: "No spells." });
    }
  }
}

function renderRow(
  body: HTMLElement, spell: ResolvedSpell, level: number, ctx: ComponentRenderContext,
  dcFor: (s: ResolvedSpell) => number, opts: { cantrip?: boolean; upcast?: boolean; pact?: boolean },
): void {
  const tr = body.createEl("tr", { cls: "pc-spell-cast-row" });

  // ACTION cell
  const actTd = tr.createEl("td", { cls: "pc-spell-act" });
  if (opts.cantrip) {
    actTd.createSpan({ cls: "pc-spell-atwill", text: "At Will" });
  } else {
    let noSlot: boolean;
    if (opts.pact) {
      noSlot = (ctx.resolved.state.spell_slots_pact?.used ?? 0) >= (ctx.derived.pactMagic?.total ?? 0);
    } else {
      const total = ctx.resolved.definition.overrides.spell_slots?.[level] ?? ctx.derived.derivedSpellSlots[level] ?? 0;
      noSlot = (ctx.resolved.state.spell_slots?.[level]?.used ?? 0) >= total;
    }
    const btn = actTd.createEl("button", { cls: `pc-spell-castbtn${noSlot ? " disabled" : ""}`, text: "CAST" });
    if (!noSlot) {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (opts.pact) ctx.editState?.castPactSpell(spell.slug);
        else ctx.editState?.castSpell(spell.slug, level);
      });
    }
  }

  // NAME cell
  const nameTd = tr.createEl("td", { cls: "pc-spell-namecell" });
  const nl = nameTd.createDiv({ cls: "pc-spell-nl" });
  nl.createSpan({ cls: "pc-spell-name", text: spell.entity.name });
  if (spell.entity.concentration) nl.createSpan({ cls: "pc-spell-cr c", text: "C", attr: { title: "Concentration" } });
  if (spell.entity.ritual) nl.createSpan({ cls: "pc-spell-cr", text: "R", attr: { title: "Ritual" } });
  if (opts.upcast) nl.createSpan({ cls: "pc-spell-up", text: `↑ ${ordinal(level)}` });
  if (spell.entity.school) nameTd.createDiv({ cls: "pc-spell-school", text: spell.entity.school });
  // Expand the reference block as a full-width row BELOW this one. A bare div
  // inside a <tr> is invalid (the browser ejects it), so the block must live in
  // its own <tr><td colspan>; toggleSpellBlock then mounts into that cell.
  nameTd.addEventListener("click", () => {
    const next = tr.nextElementSibling;
    if (next?.classList.contains("pc-spell-expand-row")) { next.remove(); tr.classList.remove("pc-row-open"); return; }
    const exprow = body.createEl("tr", { cls: "pc-spell-expand-row" });
    tr.after(exprow);
    tr.classList.add("pc-row-open");
    const cell = exprow.createEl("td", { attr: { colspan: String(COLS.length) } });
    toggleSpellBlock(cell, spell, ctx);
  });

  // TIME / RANGE
  tr.createEl("td", { cls: "pc-spell-time", text: compactCastingTime(spell.entity.casting_time) });
  tr.createEl("td", { cls: "pc-spell-range", text: formatRange(spell.entity.range) });

  // HIT / DC
  const hd = tr.createEl("td", { cls: "pc-spell-hitdc" });
  const desc = hitDcDescriptor(spell, dcFor(spell));
  if (desc) {
    hd.createSpan({ cls: "pc-spell-hitdc-ab", text: desc.ability });
    hd.createSpan({ cls: "pc-spell-hitdc-v", text: `${desc.dc}` });
  } else {
    hd.setText("—");
  }

  // EFFECT
  const effTd = tr.createEl("td", { cls: "pc-spell-effcell" });
  const eff = effectDescriptor(spell);
  const scaled = (opts.upcast || opts.pact) ? spellEffectAtSlot(spell.entity, level) : null;
  if (scaled) {
    const chip = effTd.createSpan({ cls: "pc-spell-eff" });
    if (eff.damageType && hasDamageTypeIcon(eff.damageType)) {
      setDamageTypeIcon(chip.createSpan({ cls: "pc-spell-dtype-icon dmg" }), eff.damageType);
    }
    chip.createSpan({ text: scaled });
  }
  if (eff.damageType) {
    const dt = effTd.createSpan({ cls: "pc-spell-dtype" });
    if (!scaled && hasDamageTypeIcon(eff.damageType)) {
      setDamageTypeIcon(dt.createSpan({ cls: "pc-spell-dtype-icon dmg" }), eff.damageType);
    }
    dt.appendText(eff.damageType);
  }

  // COMPONENTS / duration
  const comp = tr.createEl("td", { cls: "pc-spell-comp" });
  if (spell.entity.components) {
    const { letters } = componentLetters(spell.entity.components);
    if (letters.length) {
      // Compact "V S M"; full material prose available on hover, not dumped into the cell.
      comp.createDiv({ text: letters.join(" "), attr: { title: spell.entity.components } });
    }
  }
  if (spell.entity.duration) {
    const d = spell.entity.concentration ? `Conc · ${spell.entity.duration}` : spell.entity.duration;
    comp.createDiv({ cls: "pc-spell-dur", text: d });
  }
}
