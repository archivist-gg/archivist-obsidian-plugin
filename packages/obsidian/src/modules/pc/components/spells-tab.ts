import type { SheetComponent, ComponentRenderContext } from "./component.types";
import { spellSource } from "@archivist-gg/dnd5e/pc/spell-source";
import { renderCastView } from "./spells/cast-view";
import { renderPrepareView } from "./spells/prepare-view";
import { renderActiveEffectsRail } from "./active-effects-rail";
import { attachStatTooltip } from "./stat-tooltip";
import { renderSituationalRows } from "./situational-rows";
import { characterHasOwnSpellcastingAbility } from "./inventory/scroll-spell-picker";
import { openSpellAbilityModal, refreshSpellAbilityModal } from "./spell-ability-modal";
import { renderSeparated } from "./separated-caption";

type SpellsMode = "cast" | "prepare";

export class SpellsTab implements SheetComponent {
  readonly type = "spells-tab";
  private mode: SpellsMode = "cast";
  private modeForCharacter: string | null = null;

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    // Repaint/tear down an open spell-ability modal on every sheet pass. Safe
    // here because every tab panel re-renders each pass (TabsContainer renders
    // all panels; setActive only toggles a CSS class), same as hp-widget.ts:24
    // and currency-strip.ts:29; the one fragility is a future lazy-tab-render.
    refreshSpellAbilityModal(ctx);
    el.empty();
    const root = el.createDiv({ cls: "pc-tab-body pc-spells-body" });
    const casters = ctx.derived.spellcastingClasses;
    // A granted spell (a feat pick such as Magic Initiate, a race trait, a Spell
    // Scroll) surfaces even on a class with no spellcasting feature, so the Cast view
    // must render for it too. Which sources count is the descriptor's countsAsGranted;
    // only a character with neither a spellcasting class NOR a granted spell gets the
    // "No Spellcasting" empty state.
    const hasGrantedSpells = ctx.resolved.spells.some((s) => spellSource(s).countsAsGranted);

    if (casters.length === 0 && !hasGrantedSpells) {
      const empty = root.createDiv({ cls: "pc-spells-empty" });
      empty.createDiv({ cls: "pc-spells-empty-icon", text: "☆" });
      empty.createDiv({ cls: "pc-spells-empty-title", text: "No Spellcasting" });
      const name = ctx.resolved.definition.name;
      // R4-G7 T8 RIDER-28 (F-ARTICLE): no indefinite article before a data name ("is a Illrigger" read wrong, and an a / an vowel
      // rule is an English heuristic that fails on names). Fix round 1 (review Minor 5): no class named either; the first class
      // alone ("from the Fighter class") on a multiclass read as if another class might grant spellcasting.
      empty.createDiv({ cls: "pc-spells-empty-subtitle", text: `${name} has no spellcasting feature.` });
      return;
    }

    // Ephemeral mode: reset to Cast when a different character is shown.
    const charId = ctx.resolved.definition.name;
    if (this.modeForCharacter !== charId) { this.mode = "cast"; this.modeForCharacter = charId; }

    const header = root.createDiv({ cls: "pc-spell-header" });
    const dcRow = header.createDiv({ cls: "pc-spell-dc-row" });
    // R4-G7 T8 RIDER-18 (F-CASTSUM): each class's summary is ONE unit of the separated caption, so a multiclass
    // caster's summaries read "... (Paladin) / ... (Warlock)" and a summary never breaks away from its class name
    // (the name is glued to the attack value by a no-break space). `/` separates the units because a unit already
    // carries a `·` between its DC and its attack. The clipping caption host is a CHILD div, never the row itself:
    // the row is the anchor the situational tooltip mounts INSIDE, and a `pc-cap-host` clips horizontally.
    const multiclass = casters.length > 1;
    const atk = (c: (typeof casters)[number]): string => `${c.attackBonus >= 0 ? "+" : ""}${c.attackBonus}`;
    const classTail = (c: (typeof casters)[number]): string => (multiclass ? `\u00a0(${c.className})` : "");
    const units = renderSeparated(
      dcRow.createDiv({ cls: "pc-spell-dc-list" }),
      casters.map((c) => `${c.ability.toUpperCase()} Save DC ${c.saveDC} · Atk ${atk(c)}${classTail(c)}`),
      { sep: "/", segCls: "pc-spell-dc-entry pc-edit-click" },
    );
    units.forEach((unit, i) => {
      const c = casters[i];
      // The segment is re-filled with the bold values; its text is byte-identical to the part string above.
      const entry = unit.querySelector<HTMLElement>(".pc-spell-dc-entry")!;
      entry.empty();
      entry.createSpan({ text: `${c.ability.toUpperCase()} ` });
      entry.createSpan({ text: "Save DC " });
      entry.createEl("b", { text: `${c.saveDC}` });
      entry.createSpan({ text: " · Atk " });
      entry.createEl("b", { text: atk(c) });
      if (multiclass) entry.createSpan({ cls: "pc-spell-dc-class", text: classTail(c) });
      entry.addEventListener("click", () => openSpellAbilityModal(ctx));
    });

    // Situational spell-attack / save-DC bonuses surface in a hover popover on
    // the DC row, attached only when the slice is non-empty.
    const spellInfo = ctx.derived.spellcastingInformational ?? [];
    if (spellInfo.length > 0) {
      attachStatTooltip(dcRow, (host) => {
        host.createDiv({ cls: "pc-stat-tooltip-title", text: "Spell — situational" });
        renderSituationalRows(host, spellInfo);
      });
    }

    // Cast / Prepare(Manage) segmented toggle.
    const secondLabel = casters.some((c) => c.preparation === "prepared") ? "Prepare" : "Manage";
    const seg = header.createDiv({ cls: "pc-spell-modetoggle" });
    const castSeg = seg.createEl("button", { cls: `pc-mode-seg${this.mode === "cast" ? " active" : ""}`, text: "Cast" });
    const prepSeg = seg.createEl("button", { cls: `pc-mode-seg${this.mode === "prepare" ? " active" : ""}`, text: secondLabel });
    castSeg.addEventListener("click", () => { this.mode = "cast"; this.render(el, ctx); });
    prepSeg.addEventListener("click", () => { this.mode = "prepare"; this.render(el, ctx); });

    const conc = ctx.resolved.state.concentration;
    if (conc) {
      const concSlug = conc.replace(/^\[\[|\]\]$/g, "");
      const concSpell = ctx.resolved.spells.find((s) => s.slug === concSlug);
      renderActiveEffectsRail(root, [{
        label: "Concentration",
        name: concSpell?.entity.name ?? conc,
        icon: "brain",
        onEnd: () => ctx.editState?.breakConcentration(),
      }]);
    }

    if (this.mode === "cast") {
      this.renderSpellAbilityLauncher(root, ctx);
      renderCastView(root, ctx);
    } else {
      renderPrepareView(root, ctx);
    }
  }

  /**
   * Small "Cast scrolls using" launcher at the top of the Cast region. Shown
   * ONLY for a character who casts item (scroll) spells but has NO own class
   * spellcasting ability, whose scrolls would otherwise be DC-less. Clicking it
   * opens the spell-ability modal, which writes the character-level
   * `overrides.spellcasting_ability` (the resolver's scroll DC-ability fallback).
   */
  private renderSpellAbilityLauncher(root: HTMLElement, ctx: ComponentRenderContext): void {
    const hasScrollSpells = ctx.resolved.spells.some((s) => spellSource(s).section === "consumable");
    if (!hasScrollSpells || characterHasOwnSpellcastingAbility(ctx.derived)) return;

    const launcher = root.createDiv({ cls: "pc-spellability-launcher pc-edit-click" });
    launcher.createSpan({ cls: "pc-spellability-launcher-label", text: "Cast scrolls using" });
    const current = ctx.resolved.definition.overrides.spellcasting_ability;
    launcher.createSpan({ cls: "pc-spellability-launcher-value", text: current ? current.toUpperCase() : "set ability" });
    launcher.addEventListener("click", () => openSpellAbilityModal(ctx));
  }
}
