import type { ComponentRenderContext } from "../component.types";
import { classSpellCandidates, type SpellCandidate } from "@archivist-gg/dnd5e/spell/spell.access";
import { renderSpellBlock } from "../../../spell/spell.renderer";
import { compactCastingTime, formatRange, componentLetters, abbrAbility } from "./spell-display";
import {
  type FilterState, defaultFilters, matchesFilters,
  activeFacetCount, resetFacets, type ChipItem,
  SOURCES, SCHOOLS, CAST_TIMES, RANGES, DAMAGE_TYPES, SAVES,
} from "./spell-filter";
import { compareCandidates } from "@archivist-gg/dnd5e/spell/spell.filter";
import type { SortKey } from "@archivist-gg/dnd5e/spell/spell.filter";
import { confirmResetFilters } from "./reset-filters-modal";

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}
const levelLabel = (l: number): string => (l === 0 ? "Cantrip" : ordinal(l));

interface Col { label: string; sort?: SortKey; cls: string; center?: boolean; }
const COLS: Col[] = [
  { label: "",              cls: "col-add" },
  { label: "Name",          sort: "name",   cls: "col-name" },
  { label: "Level",         sort: "level",  cls: "col-level" },
  { label: "Time",          sort: "time",   cls: "col-time" },
  { label: "School",        sort: "school", cls: "col-school" },
  { label: "Range",         sort: "range",  cls: "col-range" },
  { label: "Components",    cls: "col-comp" },
  { label: "Source",        sort: "source", cls: "col-source" },
  { label: "Damage",        sort: "damage", cls: "col-damage" },
  { label: "Save",          sort: "save",   cls: "col-save" },
  { label: "Duration",      cls: "col-dur" },
];

/** Multi-select chip group: an "All" chip (active when the set is empty) clears
 *  the set; each value chip toggles its membership. Re-rendered on every draw. */
function chipGroup<V>(
  parent: HTMLElement, label: string, items: ChipItem<V>[], set: Set<V>, draw: () => void,
): void {
  const grp = parent.createDiv({ cls: "pc-spell-fgroup" });
  grp.createSpan({ cls: "pc-spell-flabel", text: label });
  const chips = grp.createDiv({ cls: "pc-spell-fchips" });
  const all = chips.createSpan({ cls: `pc-spell-fchip${set.size === 0 ? " active" : ""}`, text: "All" });
  all.addEventListener("click", () => { set.clear(); draw(); });
  for (const it of items) {
    const chip = chips.createSpan({ cls: `pc-spell-fchip${set.has(it.value) ? " active" : ""}`, text: it.label });
    chip.addEventListener("click", () => {
      if (set.has(it.value)) set.delete(it.value); else set.add(it.value);
      draw();
    });
  }
}

/** Level chips: Cantrip, then 1..max (up to 9 when "all classes" is on). */
function levelItems(maxLevel: number, showAll: boolean): ChipItem<number>[] {
  const top = showAll ? 9 : maxLevel;
  const items: ChipItem<number>[] = [{ label: "Cantrip", value: 0 }];
  for (let l = 1; l <= top; l++) items.push({ label: ordinal(l), value: l });
  return items;
}

function renderRow(
  body: HTMLElement, c: SpellCandidate, ctx: ComponentRenderContext,
  known: Set<string>, expanded: Set<string>,
): void {
  const e = c.entity;
  const isKnown = known.has(c.slug);
  const firstClass = ctx.derived.spellcastingClasses[0]?.classSlug;
  const tr = body.createDiv({ cls: "pc-spell-add-row" });

  const addTd = tr.createDiv({ cls: "col-add" });
  const toggle = addTd.createEl("button", { cls: `pc-add-toggle${isKnown ? " on" : ""}`, text: isKnown ? "✓" : "＋" });
  toggle.addEventListener("click", (ev) => {
    ev.stopPropagation();
    if (known.has(c.slug)) ctx.editState?.removeKnownSpell(c.slug);
    else ctx.editState?.addKnownSpell(c.slug, { class: firstClass });
  });

  const nameTd = tr.createDiv({ cls: "col-name" });
  nameTd.createSpan({ cls: `pc-add-name${isKnown ? " on" : ""}`, text: c.name });
  if (e.concentration) nameTd.createSpan({ cls: "pc-spell-cr c", text: "C", attr: { title: "Concentration" } });
  if (e.ritual) nameTd.createSpan({ cls: "pc-spell-cr", text: "R", attr: { title: "Ritual" } });

  tr.createDiv({ cls: "col-level", text: levelLabel(c.level) });
  tr.createDiv({ cls: "col-time", text: compactCastingTime(e.casting_time) });
  tr.createDiv({ cls: "col-school", text: e.school ?? "" });
  tr.createDiv({ cls: "col-range", text: formatRange(e.range) });
  tr.createDiv({ cls: "col-comp", text: componentLetters(e.components).letters.join(" ") });
  const srcTd = tr.createDiv({ cls: "col-source" });
  const ed = e.edition === "2014" ? "2014" : e.edition === "2024" ? "2024" : null;
  if (ed) srcTd.createSpan({ cls: `pc-spell-srctag e${ed}`, text: ed === "2014" ? "5e" : ed });
  tr.createDiv({ cls: "col-damage", text: e.damage?.types?.[0] ?? "—" });
  tr.createDiv({ cls: "col-save", text: e.saving_throw?.ability ? abbrAbility(e.saving_throw.ability) : "—" });
  tr.createDiv({ cls: "col-dur", text: e.duration ?? "" });

  const toggleExpand = (): void => {
    const next = tr.nextElementSibling;
    if (next?.classList.contains("pc-spell-expand-row")) { next.remove(); expanded.delete(c.slug); tr.classList.remove("pc-row-open"); return; }
    expanded.add(c.slug);
    tr.classList.add("pc-row-open");
    const exprow = body.createDiv({ cls: "pc-spell-expand-row pc-open-expand" });
    tr.after(exprow);
    const wrap = exprow.createDiv({ cls: "pc-spell-expand" });
    // The table may be wider than the drawer (it scrolls). Pin the expanded
    // block to the visible width so its prose wraps instead of running off-screen.
    const host = tr.closest(".pc-add-tablehost");
    if (host) wrap.style.maxWidth = `${(host as HTMLElement).clientWidth - 28}px`;
    void renderSpellBlock(e, ctx.app).then((block) => wrap.appendChild(block));
  };
  tr.addEventListener("click", toggleExpand);
  if (expanded.has(c.slug)) toggleExpand(); // restore open state across redraws
}

function renderTable(
  host: HTMLElement, cands: SpellCandidate[], state: FilterState,
  ctx: ComponentRenderContext, known: Set<string>, expanded: Set<string>, draw: () => void,
): void {
  if (!cands.length) { host.createDiv({ cls: "pc-spell-pick-meta", text: "No matching spells." }); return; }
  const list = host.createDiv({ cls: "pc-spell-add-table" });
  const headRow = list.createDiv({ cls: "pc-spell-add-head" });
  for (const col of COLS) {
    const th = headRow.createDiv({ cls: `pc-add-th ${col.cls}${col.center ? " ctr" : ""}`, text: col.label });
    if (col.sort) {
      th.classList.add("sortable");
      if (state.sortKey === col.sort) th.createSpan({ cls: "pc-add-sortarr", text: state.sortDir === "asc" ? " ▲" : " ▼" });
      th.addEventListener("click", () => {
        if (state.sortKey === col.sort) state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
        else { state.sortKey = col.sort!; state.sortDir = "asc"; }
        draw();
      });
    }
  }
  for (const c of cands) renderRow(list, c, ctx, known, expanded);
}

/** The collapsible "More filters" panel: School / Cast Time / Range / Damage /
 *  Save chip groups + the Concentration/Ritual flag toggles. */
function renderMorePanel(host: HTMLElement, state: FilterState, draw: () => void): void {
  const panel = host.createDiv({ cls: "pc-spell-morepanel" });
  chipGroup(panel, "School", SCHOOLS, state.schools, draw);
  chipGroup(panel, "Cast Time", CAST_TIMES, state.castTimes, draw);
  chipGroup(panel, "Range", RANGES, state.ranges, draw);
  chipGroup(panel, "Damage", DAMAGE_TYPES, state.damages, draw);
  chipGroup(panel, "Save", SAVES, state.saves, draw);

  const flags = panel.createDiv({ cls: "pc-spell-fgroup" });
  flags.createSpan({ cls: "pc-spell-flabel", text: "Flags" });
  const fchips = flags.createDiv({ cls: "pc-spell-fchips" });
  const conc = fchips.createSpan({ cls: `pc-spell-fchip tog${state.concentration ? " active" : ""}`, text: "Concentration" });
  conc.addEventListener("click", () => { state.concentration = !state.concentration; draw(); });
  const rit = fchips.createSpan({ cls: `pc-spell-fchip tog${state.ritual ? " active" : ""}`, text: "Ritual" });
  rit.addEventListener("click", () => { state.ritual = !state.ritual; draw(); });
}

/** Inline add-spell drawer: a flat, sortable, multi-column table with a
 *  multi-select filter toolbar. Built once; draw() rebuilds chips + table. */
export function renderAddDrawer(parent: HTMLElement, ctx: ComponentRenderContext): void {
  const drawer = parent.createDiv({ cls: "pc-spell-adddrawer" });
  const state = defaultFilters();
  const expanded = new Set<string>();

  const classSlugs = ctx.derived.spellcastingClasses.map((c) => c.classSlug);
  const maxLevel = Math.max(
    0,
    ...Object.keys(ctx.derived.derivedSpellSlots).map(Number),
    ctx.derived.pactMagic?.level ?? 0,
  );
  // Scroll-granted spells (source:"item") are NOT part of the known/prepared
  // list, so excluding them keeps a caster's own class spell that they happen
  // to carry a scroll of ADDABLE here (mirrors prepare-view / cast-view). AC-S4.
  const knownSet = () => new Set(
    ctx.resolved.spells.filter((s) => s.source !== "item").map((s) => s.slug),
  );

  // Persistent toolbar shell (search must survive redraws or it loses focus).
  const bar = drawer.createDiv({ cls: "pc-spell-addbar" });
  const top = bar.createDiv({ cls: "pc-spell-addbar-top" });
  const search = top.createEl("input", { cls: "pc-spell-search", attr: { type: "text", placeholder: "Search spells…" } });
  const allBtn = top.createEl("button", { cls: "pc-spell-filter", text: "All classes" });
  const moreBtn = top.createEl("button", { cls: "pc-spell-morebtn" });
  const resetBtn = top.createEl("button", { cls: "pc-spell-resetbtn", text: "Reset filters" });
  resetBtn.prepend("↺ ");
  const chipsHost = bar.createDiv({ cls: "pc-spell-addbar-primary" });
  const panelHost = bar.createDiv({ cls: "pc-spell-morepanel-host" });
  const tableHost = drawer.createDiv({ cls: "pc-add-tablehost" });

  const draw = (): void => {
    chipsHost.empty();
    tableHost.empty();
    allBtn.classList.toggle("active", state.showAll);
    chipGroup(chipsHost, "Source", SOURCES, state.sources, draw);
    chipGroup(chipsHost, "Level", levelItems(maxLevel, state.showAll), state.levels, draw);

    panelHost.empty();
    moreBtn.empty();
    moreBtn.appendText(`More filters ${state.moreOpen ? "▴" : "▾"}`);
    const n = activeFacetCount(state);
    if (n) moreBtn.createSpan({ cls: "pc-spell-morebadge", text: String(n) });
    if (state.moreOpen) renderMorePanel(panelHost, state, draw);

    const known = knownSet();
    const cands = classSpellCandidates(ctx.services.entities, classSlugs, maxLevel, new Set(), state.showAll, state.query)
      .filter((c) => matchesFilters(c, state))
      .sort((a, b) => compareCandidates(a, b, state.sortKey, state.sortDir))
      .slice(0, 300);
    renderTable(tableHost, cands, state, ctx, known, expanded, draw);
  };

  search.addEventListener("input", () => { state.query = search.value; draw(); });
  allBtn.addEventListener("click", () => { state.showAll = !state.showAll; draw(); });
  moreBtn.addEventListener("click", () => { state.moreOpen = !state.moreOpen; draw(); });
  resetBtn.addEventListener("click", () => {
    confirmResetFilters(ctx.app, () => { resetFacets(state); search.value = ""; draw(); });
  });
  draw();
}
