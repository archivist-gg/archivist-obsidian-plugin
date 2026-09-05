// src/modules/pc/components/proficiency-edit-modal.ts
import { type App } from "obsidian";
import { PaneCenteredModal } from "../../../shared/modals/pane-centered-modal";
import type { ComponentRenderContext } from "./component.types";
import type { CharacterEditState } from "../pc.edit-state";
import type { ProficiencyTri } from "@archivist-gg/dnd5e/pc/pc.types";
import { aggregateProficiencies } from "@archivist-gg/dnd5e/pc/pc.proficiencies";
import type { ProficiencyEntry } from "@archivist-gg/dnd5e/pc/pc.proficiencies";
import { humanizeProficiency, toProfSlug } from "@archivist-gg/dnd5e/pc/pc.proficiency-normalize";
import {
  ALL_LANGUAGES, ARTISANS_TOOLS, MUSICAL_INSTRUMENTS, GAMING_SETS, OTHER_TOOLS,
} from "@archivist-gg/dnd5e/types/choice";

/** The two user-editable proficiency domains (spec R4-P3b §3). */
export type ProficiencyDomain = "languages" | "tools";

let current: ProficiencyEditModal | null = null;

/** Open the proficiency override modal for ONE domain (no-op without editState,
 *  matching the Max-HP / coin precedent).
 *
 *  The house reuse guard is `if (current) { current.updateContext(ctx); return; }`
 *  (coin-modal.ts:20) and it is DOMAIN-FREE. Copied verbatim here, clicking Tools
 *  while Languages is open would silently repaint the LANGUAGES modal and return.
 *  The singleton therefore carries its domain, and a request for the other domain
 *  closes and reopens (spec §10). */
export function openProficiencyModal(ctx: ComponentRenderContext, domain: ProficiencyDomain): void {
  if (!ctx.editState) return;
  // Close a stale modal bound to a DIFFERENT character (a split-view click on
  // sheet B must never repaint sheet A's open modal) or to the OTHER domain.
  if (current && (ctx.editState !== current.openedWith || domain !== current.domain)) current.close();
  if (current) { current.updateContext(ctx); return; }
  const modal = new ProficiencyEditModal(ctx.app, ctx, ctx.editState, domain);
  current = modal;
  modal.open();
}

/** Called from ProficienciesPanel.render on every sheet render. Repaints the open
 *  modal from fresh ctx; CLOSES it when the editState identity changed (file
 *  switch). It NEVER changes the open modal's domain. */
export function refreshProficiencyModal(ctx: ComponentRenderContext): void {
  if (!current) return;
  if (!ctx.editState || ctx.editState !== current.openedWith) { current.close(); return; }
  current.updateContext(ctx);
}

export function closeProficiencyModal(): void {
  current?.close();
}

interface DomainCopy {
  title: string;
  filterPlaceholder: string;
  customPlaceholder: string;
  /** Live count sentence, singular-aware, shown under the title. */
  count: (n: number) => string;
  /** Addable list is empty and no filter is typed: the vocabulary is exhausted. */
  exhausted: string;
}

const DOMAIN_COPY: Record<ProficiencyDomain, DomainCopy> = {
  languages: {
    title: "Languages",
    filterPlaceholder: "Filter languages…",
    customPlaceholder: "Language name",
    count: (n) => (n === 0 ? "You speak no languages."
      : n === 1 ? "You speak 1 language." : `You speak ${n} languages.`),
    exhausted: "Every standard language is already known.",
  },
  tools: {
    title: "Tools",
    filterPlaceholder: "Filter tools…",
    customPlaceholder: "Tool name",
    count: (n) => (n === 0 ? "You are proficient with no tools."
      : n === 1 ? "You are proficient with 1 tool." : `You are proficient with ${n} tools.`),
    exhausted: "Every standard tool is already known.",
  },
};

/** Tools render GROUPED, in the engine's own ALL_TOOLS composition order
 *  (types/choice.ts): artisan's tools, musical instruments, gaming sets, other.
 *  Languages render FLAT (the approved mockup draws no language headers). */
const TOOL_GROUPS: { label: string; slugs: string[] }[] = [
  { label: "Artisan's Tools", slugs: ARTISANS_TOOLS },
  { label: "Musical Instruments", slugs: MUSICAL_INSTRUMENTS },
  { label: "Gaming Sets", slugs: GAMING_SETS },
  { label: "Other Tools", slugs: OTHER_TOOLS },
];

/** Shown in place of the chips row when there is nothing to show. Deliberately
 *  domain-neutral and instructive: the subtitle immediately above already states
 *  the zero count, so this says what to DO rather than repeating it. */
const CHIPS_EMPTY_HINT = "Add one from the list below, or create a custom one.";

/** Header for off-vocabulary rows, which can only be a suppressed HOMEBREW grant
 *  (a custom `add[]` value never reaches `remove[]`: `×` on a non-granted value
 *  just drops the add, so nothing is written to `remove[]`). */
const OFF_VOCABULARY_GROUP = "Other";

/** One offerable row: what `addProficiency` receives, what the user reads, and
 *  the group header it sits under (null for the flat language list). */
interface AddableRow { value: string; label: string; group: string | null }

export class ProficiencyEditModal extends PaneCenteredModal {
  private subEl!: HTMLElement;
  private chipsEl!: HTMLElement;
  private filterEl!: HTMLInputElement;
  private customFormEl!: HTMLElement;
  private customInputEl!: HTMLInputElement;
  private listEl!: HTMLElement;
  /** The current repaint's offerable rows, computed ONCE in `updateDynamic`.
   *  `renderList` filters this; it never rebuilds it. */
  private candidates: AddableRow[] = [];

  constructor(
    app: App,
    private ctx: ComponentRenderContext,
    readonly openedWith: CharacterEditState,
    readonly domain: ProficiencyDomain,
  ) { super(app); }

  onOpen(): void {
    this.contentEl.addClass("archivist-modal", "pc-prof-modal");
    // Two-stage Escape (the Max-HP / coin shape): Escape #1 discards an open
    // custom-entry form, Escape #2 (or Escape with no form open) closes.
    this.takeOverEscape(() => {
      if (this.isCustomFormOpen()) { this.closeCustomForm(); return; }
      this.close();
    });
    this.buildSkeleton();
    this.updateDynamic();
  }

  onClose(): void {
    this.contentEl.empty();
    if (current === this) current = null;
  }

  updateContext(ctx: ComponentRenderContext): void {
    this.ctx = ctx;
    this.updateDynamic();
  }

  // ─── data reads (always through the CURRENT ctx, never a snapshot) ───

  /** The effective set for this domain. Read through `aggregateProficiencies`,
   *  the SAME composer the sheet panel calls, so the modal and the sheet can
   *  never disagree about what the character knows (spec §9). */
  private entries(): ProficiencyEntry[] {
    return aggregateProficiencies(this.ctx.resolved)[this.domain];
  }

  /** Currently-suppressed raw values. `CharacterEditState.character` is private,
   *  so the store is read through the resolved character, whose `definition` IS
   *  the object the edit state mutates (spec §10).
   *
   *  A `none` tri suppresses a tool exactly as `remove` does (R4-G4 §9.3), so its
   *  keys join the union · that is what returns an OFF-VOCABULARY suppressed grant
   *  to the candidate rows, the one case no TOOL_GROUPS section can produce.
   *  Domain-narrowed because the `languages | tools` union has no `proficiency`,
   *  and annotated because a bare `{}` is not indexable under `noImplicitAny`. */
  private suppressed(): string[] {
    const ov = this.ctx.resolved.definition.overrides;
    const removed = ov?.[this.domain]?.remove ?? [];
    const tri: Record<string, ProficiencyTri> = this.domain === "tools" ? (ov?.tools?.proficiency ?? {}) : {};
    return [...removed, ...Object.keys(tri).filter((k) => tri[k] === "none")];
  }

  private copy(): DomainCopy {
    return DOMAIN_COPY[this.domain];
  }

  // ─── skeleton ───

  /** Built ONCE. The search row and the custom form are never rebuilt afterwards
   *  · that is what preserves typed filter text, focus and the custom form's
   *  in-progress value across background repaints (coin-modal.ts:107-109 records
   *  the same reason verbatim). The subtitle ELEMENT is skeleton; only its text
   *  is refreshed, exactly like the coin modal's total. */
  private buildSkeleton(): void {
    const copy = this.copy();
    this.contentEl.createDiv({ cls: "pc-prof-modal-title", text: copy.title });
    this.subEl = this.contentEl.createDiv({ cls: "pc-prof-modal-sub" });
    this.chipsEl = this.contentEl.createDiv({ cls: "pc-prof-modal-chips" });

    const searchRow = this.contentEl.createDiv({ cls: "pc-prof-modal-searchrow" });
    this.filterEl = searchRow.createEl("input", {
      cls: "pc-prof-modal-filter",
      attr: { type: "text", placeholder: copy.filterPlaceholder },
    });
    this.guardKeys(this.filterEl, () => this.addSoleMatch());
    // No debounce, and `updateDynamic`'s hoisted snapshot is what earns that:
    // a keystroke runs `renderList` ONLY, which filters an already-built array of
    // at most 35 rows and writes fewer than 40 DIRECT CHILDREN of the list · an
    // unfiltered tools list is 35 rows plus 4 group headers = 39. Counted as
    // ELEMENTS it is 109, because each row nests a name span and a pip button;
    // the "fewer than 40" figure is the direct-child count. No engine call is on
    // this path · see `updateDynamic`, which is the only thing that walks it.
    // The portrait picker debounces (portrait-picker-modal.ts:18) because its
    // search rescans the whole vault on every keystroke; that is the shape a
    // debounce is for, and it is precisely what the snapshot removes here.
    this.filterEl.addEventListener("input", () => this.renderList());

    // eslint-disable-next-line obsidianmd/ui/sentence-case -- button label; leading glyph misleads the rule into lowercasing the first word
    const customBtn = searchRow.createEl("button", { cls: "pc-prof-modal-custombtn", text: "+ Custom" });
    customBtn.addEventListener("click", () => this.openCustomForm());

    this.customFormEl = this.contentEl.createDiv({ cls: "pc-prof-modal-customform" });
    this.customInputEl = this.customFormEl.createEl("input", {
      cls: "pc-prof-modal-custominput",
      attr: { type: "text", placeholder: copy.customPlaceholder },
    });
    this.guardKeys(this.customInputEl, () => this.commitCustom());
    // Typing clears the rejection dress. Without this the box stays red while the
    // user fixes the very thing that reddened it.
    this.customInputEl.addEventListener("input", () => {
      this.customInputEl.classList.remove("is-error");
    });
    const ok = this.customFormEl.createEl("button", { cls: "pc-prof-modal-ok", text: "Add" });
    ok.addEventListener("click", () => this.commitCustom());
    const cancel = this.customFormEl.createEl("button", { cls: "pc-prof-modal-cancel", text: "Cancel" });
    cancel.addEventListener("click", () => this.closeCustomForm());
    // Blur deliberately commits NOTHING. makeInlineInput's commit-when-dirty rule
    // is number-only (edit-primitives.ts:55) and cannot be reused for free text:
    // Add commits, Cancel discards, Enter commits (spec §10.5).

    this.listEl = this.contentEl.createDiv({ cls: "pc-prof-modal-list" });
  }

  /** stopPropagation keeps Obsidian's hotkey manager from swallowing keystrokes
   *  (the hp-widget model). It does NOT stop Obsidian's Escape-to-close: `Keymap`
   *  binds `window` at the CAPTURE phase, so the built-in has already run by the
   *  time this bubble-phase listener sees the event · Escape is owned by onOpen's
   *  scope handler. The local Escape below is still load-bearing in POP-OUT
   *  windows, where `Keymap` (bound to the main window) never fires at all. Do
   *  not delete it as dead code. */
  private guardKeys(input: HTMLInputElement, onEnter: () => void): void {
    const stopProp = (e: Event) => e.stopPropagation();
    input.addEventListener("keydown", (e) => {
      stopProp(e);
      if (e.key === "Enter") { e.preventDefault(); onEnter(); return; }
      if (e.key === "Escape") {
        e.preventDefault();
        if (this.isCustomFormOpen()) { this.closeCustomForm(); return; }
        this.close();
      }
    });
    input.addEventListener("keyup", stopProp);
    input.addEventListener("keypress", stopProp);
  }

  // ─── dynamic ───

  /** Rebuilt on every repaint: the subtitle text, the chips row and the addable
   *  list. Nothing else is touched.
   *
   *  This is the ONLY place that enters the engine, and it enters it ONCE: the
   *  effective set is computed here and handed to both consumers. Letting
   *  `renderChips` and the candidate build each call `entries()` would run
   *  `aggregateProficiencies` (two full walks: `collectProficiencySources` plus
   *  `computeEffectiveProficiencies`, each traversing race/classes/background/
   *  feats and the decision engine) twice per repaint, plus once more per
   *  KEYSTROKE, since the filter input rebuilds the list. It is memoized nowhere. */
  private updateDynamic(): void {
    const entries = this.entries();
    this.subEl.setText(this.copy().count(entries.length));
    this.renderChips(entries);
    this.candidates = this.buildCandidates(entries);
    this.renderList();
  }

  private renderChips(entries: ProficiencyEntry[]): void {
    this.chipsEl.empty();
    if (entries.length === 0) {
      // NOT the zero-count sentence: the subtitle directly above already says it,
      // and printing it twice, stacked, reads as a rendering bug.
      this.chipsEl.createDiv({ cls: "pc-prof-modal-chips-empty", text: CHIPS_EMPTY_HINT });
      return;
    }
    for (const entry of entries) {
      const chip = this.chipsEl.createSpan({
        cls: `pc-prof-modal-chip${entry.origin === "grant" ? " granted" : ""}`,
        attr: { "data-prof": entry.value },
      });
      chip.appendText(entry.label);
      if (this.domain === "tools") {
        // R4-G4 §9.3 (UR1). The chip's tri has only TWO rendered states, because these
        // chips ARE the effective set: a `none` tool is not in it, so it has no chip and
        // comes back through the candidate rows instead. The full cycle and the two
        // shapes it takes are stated once, on `CharacterEditState.setToolProficiency`.
        const tri: ProficiencyTri = entry.expertise ? "expertise" : "proficient";
        const btn = chip.createEl("button", {
          cls: `pc-prof-modal-tri ${tri}`,
          // U+00D7 MULTIPLICATION SIGN, like the chip's own dismiss glyph.
          text: tri === "expertise" ? "×2" : "×1",
          attr: { "data-tri": tri, "aria-label": `${entry.label}: ${tri}` },
        });
        if (entry.expertise) chip.addClass("expertise");
        btn.addEventListener("click", () => {
          // TWO arms, not three: `tri` is assigned `entry.expertise ? "expertise" : "proficient"`
          // above, so a `tri === "expertise" ? "none" : "proficient"` tail could never take its
          // second branch (review M-7). A `none` tool has no chip here at all.
          const next: ProficiencyTri = tri === "proficient" ? "expertise" : "none";
          this.openedWith.setToolProficiency(entry.value, next);
          this.refocusFilter();
        });
      }
      chip.createSpan({ cls: "pc-prof-modal-chip-src", text: sourceText(entry) });
      // U+00D7 MULTIPLICATION SIGN, matching every existing chip · not U+2715,
      // and emphatically not an em dash. EVERY chip carries it, granted included:
      // suppressing a rules-granted entry is the headline feature (spec §10.2).
      const x = chip.createSpan({ cls: "pc-prof-modal-chip-x", text: "×" });
      x.addEventListener("click", () => {
        this.openedWith.removeProficiency(this.domain, entry.value);
        this.refocusFilter();
      });
    }
  }

  /** Filters the CURRENT repaint's candidate snapshot. Cheap by construction: no
   *  engine call, no allocation beyond the surviving rows.
   *
   *  The needle is re-read from the live filter input on EVERY call, and that is
   *  deliberate and NOT part of the snapshot. The input's text survives a repaint
   *  because it is skeleton; the list does not, so a rebuild that ignored the
   *  filter would leave a filter box showing text over an unfiltered list
   *  (spec §10.1). Reading the live input rather than a cached field is what
   *  makes that impossible to get wrong. */
  private renderList(): void {
    this.listEl.empty();
    const needle = this.filterEl.value.trim().toLowerCase();
    const rows = this.candidates.filter((r) => matchesFilter(r, needle));
    if (rows.length === 0) {
      this.listEl.createDiv({
        cls: "pc-prof-modal-list-empty",
        text: needle ? `No match for "${this.filterEl.value.trim()}".` : this.copy().exhausted,
      });
      return;
    }
    let lastGroup: string | null = null;
    for (const row of rows) {
      if (row.group && row.group !== lastGroup) {
        this.listEl.createDiv({ cls: "pc-prof-modal-group", text: row.group });
      }
      lastGroup = row.group;
      const el = this.listEl.createDiv({
        cls: "pc-prof-modal-row",
        attr: { "data-prof": row.value },
      });
      el.createSpan({ cls: "pc-prof-modal-name", text: row.label });
      const pip = el.createEl("button", { cls: "pc-prof-modal-pip", text: "+" });
      pip.addEventListener("click", () => {
        this.openedWith.addProficiency(this.domain, row.value);
        this.refocusFilter();
      });
    }
  }

  /** `(domain vocabulary ∪ currently-suppressed values) − effective` (spec §8).
   *
   *  The union is what lets a suppressed entry come back AT ALL: suppressing
   *  Dwarvish drops it from the effective set, and without the union it would
   *  also be missing from "vocabulary minus effective" for every value the
   *  vocabulary does not carry · a homebrew grant would be unrestorable.
   *
   *  Takes the repaint's already-computed effective set rather than calling
   *  `entries()` again: this runs once per repaint, never per keystroke. */
  private buildCandidates(entries: ProficiencyEntry[]): AddableRow[] {
    const effective = new Set(entries.map((e) => toProfSlug(e.value)));
    const suppressed = this.suppressed();
    const seen = new Set<string>();
    /** Collect one section, skipping anything effective or already claimed by an
     *  earlier section. The label matches what the engine composes for a GRANT of
     *  the same value (pc.decision-engine.ts' proficiencyEntryFor), so a row and
     *  the chip it turns into read identically. */
    const section = (raws: string[], group: string | null): AddableRow[] => {
      const rows: AddableRow[] = [];
      for (const raw of raws) {
        const slug = toProfSlug(raw);
        if (effective.has(slug) || seen.has(slug)) continue;
        seen.add(slug);
        rows.push({ value: raw, label: humanizeProficiency(slug), group });
      }
      return sortByLabel(rows);
    };

    if (this.domain === "languages") {
      // Flat: one section spanning the vocabulary AND anything suppressed that
      // the vocabulary does not carry.
      return section([...ALL_LANGUAGES, ...suppressed], null);
    }
    const grouped: AddableRow[] = [];
    for (const group of TOOL_GROUPS) grouped.push(...section(group.slugs, group.label));
    // Whatever the vocabulary sections did not claim is off-vocabulary.
    grouped.push(...section(suppressed, OFF_VOCABULARY_GROUP));
    return grouped;
  }

  // ─── custom entry ───

  private isCustomFormOpen(): boolean {
    return this.customFormEl.classList.contains("is-open");
  }

  private openCustomForm(): void {
    // The search row stays visible while the form is open, so "+ Custom" is still
    // clickable · clearing unconditionally would wipe an in-progress value on a
    // stray second click. Re-opening an open form is just a refocus.
    if (!this.isCustomFormOpen()) {
      this.customInputEl.value = "";
      this.customInputEl.classList.remove("is-error");
      this.customFormEl.classList.add("is-open");
    }
    this.customInputEl.focus();
  }

  private closeCustomForm(): void {
    this.customFormEl.classList.remove("is-open");
    this.customInputEl.value = "";
    this.customInputEl.classList.remove("is-error");
    this.refocusFilter();
  }

  private commitCustom(): void {
    const value = this.customInputEl.value.trim();
    if (!value) {
      // Nothing to add: flag the box and keep the form open rather than silently
      // discarding a deliberate action.
      this.customInputEl.classList.add("is-error");
      this.customInputEl.focus();
      return;
    }
    this.openedWith.addProficiency(this.domain, value);
    this.closeCustomForm();
  }

  /** Enter in the filter box adds the SOLE remaining match · the one keyboard
   *  shortcut the flow actually wants ("type elv, press Enter"). With 0 or 2+
   *  matches it is deliberately inert: guessing which of several rows the user
   *  meant is worse than doing nothing. */
  private addSoleMatch(): void {
    const rows = this.listEl.querySelectorAll(".pc-prof-modal-row");
    if (rows.length !== 1) return;
    const value = rows[0].getAttribute("data-prof");
    if (!value) return;
    this.openedWith.addProficiency(this.domain, value);
    // Clearing the filter is a SKELETON mutation, so it has to be paired with an
    // explicit list rebuild. The repaint the mutation triggers ran with the old
    // filter text still in the box; without the rebuild below the box reads empty
    // over a list still narrowed to the term just consumed · the mirror image of
    // the stale-list bug spec §10.1 exists to prevent.
    this.filterEl.value = "";
    this.renderList();
    this.refocusFilter();
  }

  /** Every control that mutates destroys itself in the ensuing repaint, so focus
   *  would fall to `<body>` and the next keystroke would go nowhere. Park it on
   *  the filter box, which is skeleton and therefore always alive. */
  private refocusFilter(): void {
    this.filterEl.focus();
  }
}

/** Spec §7.3's table. `grant` joins EVERY granting entity: a 2014 Rogue and a
 *  2024 Criminal both grant thieves' tools under one slug, and that collision is
 *  already shipped data. */
function sourceText(entry: ProficiencyEntry): string {
  switch (entry.origin) {
    case "grant": return entry.sources.join(" · ");
    case "pick": return "chosen";
    case "manual": return "added";
    case "custom": return "custom";
  }
}

/** Matches the label AND the stored value, so "deep s" and "deep-s" both find
 *  Deep Speech. An empty needle matches everything. */
function matchesFilter(row: AddableRow, needle: string): boolean {
  if (!needle) return true;
  return `${row.label} ${row.value}`.toLowerCase().includes(needle);
}

/** Same UTF-16 code-unit comparison the effective set sorts by, so the addable
 *  list and the chip row order values identically. */
function sortByLabel(rows: AddableRow[]): AddableRow[] {
  return rows.sort((a, b) => (a.label < b.label ? -1 : a.label > b.label ? 1 : 0));
}
