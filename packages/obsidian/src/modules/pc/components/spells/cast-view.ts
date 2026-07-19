import type { ComponentRenderContext } from "../component.types";
import type { ResolvedSpell } from "@archivist-gg/dnd5e/pc/pc.types";
import { renderChargeBoxes } from "../actions/charge-boxes";
import { spellEffectAtSlot, upcastLevelsFor } from "@archivist-gg/dnd5e/spell/spell.scaling";
import { toggleSpellBlock } from "./spell-block-expand";
import { baseClassName } from "@archivist-gg/dnd5e/class/class.slug";
import { compactCastingTime, formatRange, hitDcDescriptor, effectDescriptor, componentLetters } from "./spell-display";
import { setDamageTypeIcon, hasDamageTypeIcon } from "../../assets/spell-icons";
import { renderScrollAbilityControl } from "../inventory/scroll-spell-picker";

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

const COLS = ["", "Name", "Time", "Range", "Hit / DC", "Effect", "Components"];

function tableFor(root: HTMLElement): HTMLElement {
  const list = root.createDiv({ cls: "pc-spell-cast-table" });
  const head = list.createDiv({ cls: "pc-spell-cast-head" });
  for (const c of COLS) head.createDiv({ cls: "pc-spell-cast-hcell", text: c });
  return list; // rows append here
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
    // Feat-granted spells (classSlug null) carry their OWN spellcasting ability;
    // their DC lives in derived.abilitySpellcasting, not a class. On a non-caster
    // the class list is empty, so without this branch the DC would fall to 0.
    if ((s.source === "feat" || s.classSlug == null) && s.ability) {
      const own = ctx.derived.abilitySpellcasting?.[s.ability]?.saveDC;
      if (own != null) return own;
    }
    const cls = ctx.derived.spellcastingClasses.find((c) => baseClassName(c.classSlug) === baseClassName(s.classSlug ?? ""));
    return cls?.saveDC ?? ctx.derived.spellcastingClasses[0]?.saveDC ?? 0;
  };

  // ── Cantrips: At Will, no slots, no button ──
  // Item (scroll) spells never mix into the class/feat sections; they surface in
  // their own "Scrolls & Consumables" section below.
  const cantrips = castable.filter((s) => s.source !== "item" && (s.entity.level ?? 0) === 0);
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
    const base = castable.filter((s) => s.source !== "item" && (s.entity.level ?? 0) === lvl && !pactClassSlugs.includes(s.classSlug ?? ""));
    const upcasts = castable.filter((s) => s.source !== "item" && !pactClassSlugs.includes(s.classSlug ?? "") && upcastLevelsFor(s.entity, ownedLevels).includes(lvl));
    for (const s of base) renderRow(body, s, lvl, ctx, dcFor, {});
    for (const s of upcasts) renderRow(body, s, lvl, ctx, dcFor, { upcast: true });
    if (!base.length && !upcasts.length) {
      body.createDiv({ cls: "pc-spell-empty-row", text: "No spells at this level." });
    }
  }

  // ── Feat-granted leveled spells with no owned slot (non-caster free casts) ──
  // A feat like Magic Initiate grants a level-1 spell to a character who owns no
  // slot at that level (e.g. a Fighter). It has no slot to spend, so surface it
  // in its own level section as an always-prepared, free cast (no slot tracker;
  // the per-long-rest economy is out of scope here). Feat spells at a level the
  // character DOES own already render in the owned-slot section above.
  const freeFeat = castable.filter((s) =>
    s.source === "feat" && (s.entity.level ?? 0) > 0 && !ownedLevels.includes(s.entity.level ?? 0));
  const freeLevels = [...new Set(freeFeat.map((s) => s.entity.level ?? 0))].sort((a, b) => a - b);
  for (const lvl of freeLevels) {
    const head = root.createDiv({ cls: "pc-spell-sec" });
    head.createSpan({ cls: "pc-spell-sec-label", text: `${ordinal(lvl)} Level` });
    const body = tableFor(root);
    for (const s of freeFeat.filter((s) => (s.entity.level ?? 0) === lvl)) {
      renderRow(body, s, lvl, ctx, dcFor, { free: true });
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
      s.source !== "item" && (s.entity.level ?? 0) > 0 && (pactClassSlugs.length === 0 || pactClassSlugs.includes(s.classSlug ?? "")));
    for (const s of pactSpells) renderRow(body, s, pact.level, ctx, dcFor, { pact: true });
    if (!pactSpells.length) {
      body.createDiv({ cls: "pc-spell-empty-row", text: "No spells." });
    }
  }

  // ── Scrolls & Consumables ──
  // Item-granted spells (Spell Scrolls) are cast by CONSUMING the item, not by
  // spending a slot. The T3 segmented dedupe already yields one source:"item"
  // spell per equipment entry (keyed by entryIndex), so this renders one row per
  // scroll instance. Cast at the spell's own level (a scroll never upcasts here).
  const scrolls = castable.filter((s) => s.source === "item");
  if (scrolls.length) {
    const head = root.createDiv({ cls: "pc-spell-sec" });
    head.createSpan({ cls: "pc-spell-sec-label", text: "Scrolls & Consumables" });
    const body = tableFor(root);
    for (const s of scrolls) renderRow(body, s, s.entity.level ?? 0, ctx, dcFor, { scroll: true });
  }
}

function renderRow(
  body: HTMLElement, spell: ResolvedSpell, level: number, ctx: ComponentRenderContext,
  dcFor: (s: ResolvedSpell) => number, opts: { cantrip?: boolean; upcast?: boolean; pact?: boolean; free?: boolean; scroll?: boolean },
): void {
  const tr = body.createDiv({ cls: "pc-spell-cast-row" });

  // ACTION cell
  const actTd = tr.createDiv({ cls: "pc-spell-act" });
  if (opts.cantrip) {
    actTd.createSpan({ cls: "pc-spell-atwill", text: "At Will" });
  } else if (opts.free) {
    // Feat-granted, always-prepared leveled spell with no class slot: a free
    // cast, surfaced as an affordance rather than a slot-consuming CAST button.
    actTd.createSpan({ cls: "pc-spell-atwill pc-spell-free", text: "Free" });
  } else if (opts.scroll) {
    // A scroll is cast by CONSUMING the item (one unit / the whole stack's last
    // unit), never by spending a spell slot. The crimson pill marks the
    // consumable cost; the click decrements qty / removes the spent scroll.
    const btn = actTd.createEl("button", { cls: "pc-spell-scroll", text: "Cast (consume)" });
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (spell.entryIndex != null) ctx.editState?.consumeScroll(spell.entryIndex);
    });
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
  const nameTd = tr.createDiv({ cls: "pc-spell-namecell" });
  const nl = nameTd.createDiv({ cls: "pc-spell-nl" });
  nl.createSpan({ cls: "pc-spell-name", text: spell.entity.name });
  // Always-prepared spells (feat grants, domain spells) carry the shared "always"
  // marker used in the prepare view, so a free feat cast reads as always-ready.
  if (spell.alwaysPrepared) nl.createSpan({ cls: "pc-spell-always", text: "always" });
  if (spell.entity.concentration) nl.createSpan({ cls: "pc-spell-cr c", text: "C", attr: { title: "Concentration" } });
  if (spell.entity.ritual) nl.createSpan({ cls: "pc-spell-cr", text: "R", attr: { title: "Ritual" } });
  if (opts.upcast) nl.createSpan({ cls: "pc-spell-up", text: `↑ ${ordinal(level)}` });
  if (spell.entity.school) nameTd.createDiv({ cls: "pc-spell-school", text: spell.entity.school });
  // Expand the reference block as a full-width sibling div BELOW this row.
  nameTd.addEventListener("click", () => {
    const next = tr.nextElementSibling;
    if (next?.classList.contains("pc-spell-expand-row")) { next.remove(); tr.classList.remove("pc-row-open"); return; }
    tr.classList.add("pc-row-open");
    const expand = body.createDiv({ cls: "pc-spell-expand-row pc-open-expand" });
    tr.after(expand);
    toggleSpellBlock(expand, spell, ctx);
  });

  // TIME / RANGE
  tr.createDiv({ cls: "pc-spell-time", text: compactCastingTime(spell.entity.casting_time) });
  tr.createDiv({ cls: "pc-spell-range", text: formatRange(spell.entity.range) });

  // HIT / DC. A no-ability scroll (no own casting ability + no per-instance
  // spell_ability) has no DC to show, so it swaps the Hit/DC cell for the shared
  // INT/WIS/CHA capture control (the same one the inventory row uses). Every
  // other row keeps the existing descriptor cell (T8 extends this for
  // attack-roll spells).
  if (opts.scroll && !spell.ability && spell.entryIndex != null) {
    renderScrollAbilityControl(tr, ctx, spell.entryIndex);
  } else {
    const hd = tr.createDiv({ cls: "pc-spell-hitdc" });
    const desc = hitDcDescriptor(spell, dcFor(spell));
    if (desc) {
      hd.createSpan({ cls: "pc-spell-hitdc-ab", text: desc.ability });
      hd.createSpan({ cls: "pc-spell-hitdc-v", text: `${desc.dc}` });
    } else {
      // U+2014 dash placeholder (escaped so the source carries no literal em dash).
      hd.setText("\u2014");
    }
  }

  // EFFECT
  const effTd = tr.createDiv({ cls: "pc-spell-effcell" });
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
  const comp = tr.createDiv({ cls: "pc-spell-comp" });
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
