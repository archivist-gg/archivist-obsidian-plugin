import type { SheetComponent, ComponentRenderContext } from "./component.types";
import type { ResolvedPool, ResolvedPoolEntry } from "@archivist-gg/dnd5e/pc/pc.types";
import type { OptionalFeatureEntity } from "@archivist-gg/dnd5e/types/optional-feature.types";
import { levelPrereqMax, strandedPicks } from "@archivist-gg/dnd5e/pc/pc.pools";
import { hiddenCompendiumSet, entityCompendiumVisible } from "../../../shared/entities/compendium-visibility";
import type { PoolLayout } from "@archivist-gg/dnd5e/types/selection-pool";
import { renderActiveEffectsRail, type ActiveEffectItem } from "./active-effects-rail";
import { rowExpandKey, isRowExpanded, setRowExpanded } from "./row-expand-state";
import { renderSpendControl } from "./actions/spend-control";
import { CHARGE_BOX_LIMIT } from "./actions/charge-boxes";
import { renderPointPool } from "./actions/point-pool";
import { renderPickTracker } from "./actions/pick-tracker";
import { renderAffordanceCaption, renderControlGroup } from "./actions/entry-affordance";
import { renderResourceTracker } from "./actions/resource-tracker";
import { RESET_LABELS, CUSTOM_RESET_TIP } from "./actions/reset-labels";
import { AT_WILL_MAX } from "@archivist-gg/dnd5e/dnd/resource-formula";
import { resourceLevelFor, poolSaveDC } from "@archivist-gg/dnd5e/pc/pc.resources";

/* The ECONOMY label for a pool row's sub-line and a block card's Cost meta. R4 {G5, G6} live rider 2,
 * X-1-13: the label names the economy and carries no amount. `1 Action` / `1 Bonus Action` beside a
 * sibling row's bare `Reaction` read as a quantity of actions, and on a narrow column the pair
 * `Passive · 1 Bonus Action` broke across lines with the stray `1` ending one. The amount a reader
 * can act on is the COST, which `consumeCost` still prints with its number. */
const COST_LABELS: Record<string, string> = {
  action: "Action", "bonus-action": "Bonus Action", reaction: "Reaction", free: "Free", special: "Special",
};

/** Generic tab that renders one selection pool, reusing the Spells "Prepare"
 *  vocabulary: an active-effects rail, an "X / N" counter, level bands, and
 *  per-row toggle boxes that add/remove via the choices ledger. One instance
 *  per declared pool (type = `pool-tab:<id>`); constructed by TabsContainer.
 *  The engine is generic — every game-specific string comes from the data. */
export class PoolTab implements SheetComponent {
  readonly type: string;
  constructor(private readonly poolId: string, private readonly layout: PoolLayout = "spell-like") {
    this.type = `pool-tab:${poolId}`;
  }

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const root = el.createDiv({ cls: "pc-tab-body" });
    const found = ctx.resolved?.pools?.find((p) => p.id === this.poolId);
    if (!found) {
      root.createDiv({ cls: "pc-empty-line", text: "No data for this pool." });
      return;
    }
    // R4-G5 §3.2.2: the sheet's half of the ONE visibility predicate, applied ONCE here and BEFORE the
    // `LAYOUTS` dispatch, on a SHALLOW COPY whose `available` is filtered over the `compendium` string
    // `resolvePool` stamps at resolve time (§9.2.1). All four layout entries inherit it from one place.
    // `selected` and `grants` are untouched, and therefore so is `strandedPicks`: the only entries this
    // removes are UNSELECTED candidates, because the predicate exempts the current selection exactly as
    // the builder's does. The executed order is collapse (in `resolvePool`, which has no visibility
    // input) THEN filter (here). The optional chain is load-bearing: the sheet's fixtures cast an empty
    // `services`, and `hiddenCompendiumSet` fails open on a nullish argument.
    const hidden = hiddenCompendiumSet(ctx.services.plugin?.settings);
    const picked = new Set(found.selected.map((e) => e.slug));
    const pool: ResolvedPool = {
      ...found,
      available: found.available.filter((e) => entityCompendiumVisible(e, hidden) || picked.has(e.slug)),
    };
    const renderer = LAYOUTS.get(this.layout) ?? LAYOUTS.get("spell-like")!;
    renderer.call(this, root, pool, ctx);
  }

  /** @internal Reached through the `LAYOUTS` registry below, after `renderPoolHead`, from every entry
   *  that names it (R4-G5 §5.2 gave the head to all four), never from outside this module. */
  renderSpellLike(root: HTMLElement, pool: ResolvedPool, ctx: ComponentRenderContext): void {
    const activeBuffs = ctx.resolved?.state?.active_buffs ?? [];
    renderActiveEffectsRail(root, activeItems(pool, activeBuffs, ctx));
    renderCounter(root, pool);

    const selectedSlugs = new Set(pool.selected.map((e) => e.slug));
    const atCap = pool.selected.length >= pool.count;

    const byLevel = new Map<number, ResolvedPoolEntry[]>();
    for (const entry of pool.available) {
      const lvl = levelPrereqMax(entry.entity);
      (byLevel.get(lvl) ?? byLevel.set(lvl, []).get(lvl)!).push(entry);
    }
    const levels = [...byLevel.keys()].sort((a, b) => a - b);
    const ungrouped = levels.length === 1 && levels[0] === 0;

    for (const lvl of levels) {
      const entries = byLevel.get(lvl)!;
      if (!ungrouped) {
        const head = root.createDiv({ cls: "pc-actions-section-head" });
        head.createSpan({ text: lvl === 0 ? "Any Level" : `Level ${lvl}` });
        head.createSpan({ cls: "pc-actions-section-count", text: `${entries.length} ${entries.length === 1 ? "option" : "options"}` });
      }
      const list = root.createDiv({ cls: "pc-spell-list" });
      for (const entry of entries) {
        this.row(list, entry, {
          selected: selectedSlugs.has(entry.slug),
          atCap,
        }, pool, ctx);
      }
    }

    const stranded = strandedPicks(pool);
    if (stranded.length) {
      root.createDiv({ cls: "pc-actions-section-head" }).createSpan({ text: "Selected · prerequisite unmet" });
      const list = root.createDiv({ cls: "pc-spell-list" });
      for (const entry of stranded) {
        this.row(list, entry, {
          selected: true,
          atCap,
        }, pool, ctx);
      }
    }

    if (pool.grants.length) {
      root.createDiv({ cls: "pc-actions-section-head" }).createSpan({ text: "Granted" });
      const list = root.createDiv({ cls: "pc-spell-list" });
      for (const entry of pool.grants) this.grantedRow(list, entry, pool, ctx);
    }
  }

  private row(
    parent: HTMLElement,
    entry: ResolvedPoolEntry,
    opts: { selected: boolean; atCap: boolean },
    pool: ResolvedPool,
    ctx: ComponentRenderContext,
  ): void {
    const e = entry.entity;
    const host = parent.createDiv({ cls: "pc-spell-prep-row-host" });
    const row = host.createDiv({ cls: "pc-spell-prep-row" });

    const locked = !opts.selected && opts.atCap;
    const box = row.createDiv({
      cls: `archivist-toggle-box${opts.selected ? " archivist-toggle-box-checked" : ""}${locked ? " pc-box-locked" : ""}`,
    });
    if (!locked) {
      box.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const cur = pool.selected.map((x) => x.slug);
        const next = opts.selected ? cur.filter((s) => s !== entry.slug) : [...cur, entry.slug];
        ctx.editState?.setChoice(pool.classIndex, pool.anchorLevel, pool.id, next);
      });
    }

    const nameWrap = row.createDiv({ cls: "pc-spell-namewrap" });
    nameWrap.createSpan({ cls: "pc-spell-name", text: e.name });
    renderMetaSub(nameWrap, metaSub(e, ctx));
    renderAffordanceCaption(nameWrap, entry, ctx);
    const descKey = rowExpandKey("pooldesc", pool.id, entry.slug);
    nameWrap.addEventListener("click", () => toggleDesc(host, e, ctx, descKey));
    if (isRowExpanded(ctx, descKey)) openDesc(host, e);

    // The shared spend control (R4-G4 §3.2.4). Measured 2026-09-05 with
    // `grep -rn "renderSpendControl(" packages/obsidian/src`: six call EXPRESSIONS across three
    // calling FILES, three of them on this tab. All three render on the KNOWN entries only: this
    // row when its entry is SELECTED, `grantedRow` unconditionally because it is reached only over
    // `pool.grants`, and `blockCard` when its entry is granted OR selected, because `renderBlocks`
    // sends that method every available candidate as well. A bare candidate the character has not
    // picked is not spendable, so it carries the Cost meta and no button. `renderBoonRow` is
    // reached only with a `kind` of "selected" or "granted", so the Actions / Passive boon surface
    // already had this property. An unowned id renders nothing and warns once (§13), so a
    // cross-book row is unchanged. R4-G5 §4.2.2 (b) gave it ONE new sibling here and on the boon
    // row: the `.pc-buff-group` created immediately before it, never a parent of it.

    // R4-G5 §4.2.2 (b): the pick's own tracker (which MOVES out of `.pc-spell-namewrap`) and its Active
    // toggle (which MOVES from the row's end) in ONE group, created BEFORE the spend control so the
    // group is the sibling that precedes it. Tracker-then-toggle: this row's shipped relative order.
    renderControlGroup(row, entry, ctx, { selected: opts.selected, order: "tracker-first" });
    if (opts.selected && e.consumes?.resource) renderSpendControl(row, { consumes: e.consumes, ctx });
  }

  private grantedRow(parent: HTMLElement, entry: ResolvedPoolEntry, pool: ResolvedPool, ctx: ComponentRenderContext): void {
    const e = entry.entity;
    const host = parent.createDiv({ cls: "pc-spell-prep-row-host" });
    const row = host.createDiv({ cls: "pc-spell-prep-row" });
    const nameWrap = row.createDiv({ cls: "pc-spell-namewrap" });
    nameWrap.createSpan({ cls: "pc-spell-name", text: e.name });
    nameWrap.createSpan({ cls: "pc-spell-always", text: "granted" });
    // A granted pick tracks its own `uses` exactly like a selected one (R4-G4 §12).
    renderPickTracker(nameWrap, entry, ctx);
    renderMetaSub(nameWrap, metaSub(e, ctx));
    renderAffordanceCaption(nameWrap, entry, ctx);
    const descKey = rowExpandKey("pooldesc", pool.id, entry.slug);
    nameWrap.addEventListener("click", () => toggleDesc(host, e, ctx, descKey));
    if (isRowExpanded(ctx, descKey)) openDesc(host, e);
    // A granted entry is KNOWN, so it spends like a selected one (R4-G4 §3.2.4): the same control
    // the blocks layout's `blockCard` and the boon row already render for granted entries.
    if (e.consumes?.resource) renderSpendControl(row, { consumes: e.consumes, ctx });
  }

  /** @internal Reached through the `LAYOUTS` registry below, never from outside this module. */
  renderBlocks(root: HTMLElement, pool: ResolvedPool, ctx: ComponentRenderContext): void {
    const activeBuffs = ctx.resolved?.state?.active_buffs ?? [];
    renderActiveEffectsRail(root, activeItems(pool, activeBuffs, ctx));
    renderCounter(root, pool);

    const selectedSlugs = new Set(pool.selected.map((e) => e.slug));
    const atCap = pool.selected.length >= pool.count;
    for (const entry of pool.available) {
      this.blockCard(root, entry, {
        granted: false, selected: selectedSlugs.has(entry.slug), atCap, active: activeBuffs.includes(entry.slug),
      }, pool, ctx);
    }
    for (const entry of strandedPicks(pool)) {
      this.blockCard(root, entry, {
        granted: false, selected: true, atCap, active: activeBuffs.includes(entry.slug),
      }, pool, ctx);
    }
    for (const entry of pool.grants) {
      this.blockCard(root, entry, { granted: true, selected: false, atCap, active: false }, pool, ctx);
    }
  }

  private blockCard(
    parent: HTMLElement,
    entry: ResolvedPoolEntry,
    opts: { granted: boolean; selected: boolean; atCap: boolean; active: boolean },
    pool: ResolvedPool,
    ctx: ComponentRenderContext,
  ): void {
    const e = entry.entity;
    const section = parent.createDiv({ cls: "pc-block pc-boon-block" });
    const head = section.createDiv({ cls: "pc-block-head" });

    if (!opts.granted) {
      const locked = !opts.selected && opts.atCap;
      const box = head.createDiv({
        cls: `archivist-toggle-box${opts.selected ? " archivist-toggle-box-checked" : ""}${locked ? " pc-box-locked" : ""}`,
      });
      if (!locked) {
        box.addEventListener("click", () => {
          const cur = pool.selected.map((x) => x.slug);
          const next = opts.selected ? cur.filter((s) => s !== entry.slug) : [...cur, entry.slug];
          ctx.editState?.setChoice(pool.classIndex, pool.anchorLevel, pool.id, next);
        });
      }
    }

    head.createEl("h3", { cls: "pc-block-title", text: e.name });
    const controls = head.createDiv({ cls: "pc-block-controls" });
    if (opts.granted) controls.createSpan({ cls: "pc-spell-always", text: "granted" });
    if (!opts.granted && opts.selected && e.activatable) {
      const actv = controls.createEl("button", {
        cls: `pc-pool-active${opts.active ? " on" : ""}`,
        text: opts.active ? "Active" : "Activate",
      });
      actv.addEventListener("click", () => ctx.editState?.toggleActiveBuff(entry.slug));
    }
    // The same control on the blocks layout, hosted by the card's control strip instead of the
    // row, under the same KNOWN-entries gate: `renderBlocks` calls this method for every
    // `pool.available` candidate as well as for the stranded picks and the grants, so a card
    // needs its own `granted || selected` test exactly as `row()` needs `selected`.
    if ((opts.granted || opts.selected) && e.consumes?.resource) renderSpendControl(controls, { consumes: e.consumes, ctx });

    const meta = section.createDiv({ cls: "pc-block-meta" });
    const lvl = levelPrereqMax(e);
    metaItem(meta, "Level", lvl ? String(lvl) : "—");
    if (e.action_cost) metaItem(meta, "Cost", COST_LABELS[e.action_cost] ?? e.action_cost);
    if (e.consumes?.amount) metaItem(meta, "Cost", consumeCost(e.consumes, ctx));
    if (e.passive) metaItem(meta, "Type", "Passive");

    // R4-G5 §4.2.2 (a): the caption is a line of its own under the card's meta row, not a meta item:
    // `.pc-block-meta` holds `.pc-meta-line` pairs and this is a sentence, not a label / value pair.
    renderAffordanceCaption(section, entry, ctx);

    if (e.description) section.createEl("p", { cls: "pc-block-description", text: e.description });
  }
}

type LayoutRenderer = (this: PoolTab, root: HTMLElement, pool: ResolvedPool, ctx: ComponentRenderContext) => void;

/** The ONE layout → renderer registry (R4-G4 §4.2.6, invariant 3; the entity-presenter-dispatch
 *  pattern): an unknown key degrades to spell-like and never throws, which is what the fallback to
 *  this map's own `spell-like` entry buys `render`. EVERY entry calls `renderPoolHead` (R4-G5 §5.2),
 *  whose own three-way guard (`pool.resource`, its seeded `feature_uses` entry, its `resolved.resources`
 *  index entry) decides whether the WIDGET is drawn: an unhinted pool that OWNS a resource gets the
 *  widget, and one that owns none draws no widget. Only `point-pool` passes the `points`
 *  shape, because the head's own `numeric` computation already routes a large `dice` head to the numeric
 *  widget without being told. CONSEQUENCE, stated: the §11 pool save-DC line, which the head prints
 *  BEFORE the resource gate, now reaches the spell-like and blocks layouts too whenever a DC resolves.
 *  MEASURED 2026-09-07 on the 13-book install, three read-only scripts over the converted corpus: ZERO
 *  shipped pools gain a DC line, because the only DC-shaped pool owner, Way of the Four Elements,
 *  already derives `point-pool`; and the whole shipped widget delta is ONE head, the XGE Arcane Archer
 *  (5e)'s Arcane Shot Uses (2 boxes, "/ Short Rest", no die), the only unhinted pool whose members
 *  consume a resource the owner declares.
 *  A pool whose members carry an UNMAPPED hint never reaches the hinted entries BY DERIVATION: dnd5e's
 *  `RENDERING_HINT_LAYOUT` maps two hints, so `derivePoolLayout` returns undefined for the three G5
 *  families (pool-selection, granted-die-to-ally, stance) and `TabsContainer` falls through to
 *  spell-like absent an authored layout. An AUTHORED `TabDecl.renders.layout` still can reach them: it
 *  is the same four-member union and it OUTRANKS the derived value (§4.2.5). No shipped document
 *  authors one (measured 2026-09-05, read-only: zero `.md` files under the pristine bundle and the
 *  converter corpus name a tab `layout`, and the bundle index carries no `"layout"` key; spec §4.1
 *  measures the same as undefined on all 23 `TabDecl`s), so on both corpora a PHB 2024 Arcane Archer,
 *  whose members carry the `pool-selection` hint, renders spell-like. */
const LAYOUTS: ReadonlyMap<PoolLayout, LayoutRenderer> = new Map<PoolLayout, LayoutRenderer>([
  ["spell-like", function (root, pool, ctx) { renderPoolHead(root, pool, ctx, "dice"); this.renderSpellLike(root, pool, ctx); }],
  ["blocks", function (root, pool, ctx) { renderPoolHead(root, pool, ctx, "dice"); this.renderBlocks(root, pool, ctx); }],
  ["dice-pool", function (root, pool, ctx) { renderPoolHead(root, pool, ctx, "dice"); this.renderSpellLike(root, pool, ctx); }],
  ["point-pool", function (root, pool, ctx) { renderPoolHead(root, pool, ctx, "points"); this.renderSpellLike(root, pool, ctx); }],
]);

/** The tab-head owner widget plus the §11 pool save-DC line.
 *
 *  The DC line first, whenever `poolSaveDC` is non-null (a Four Elements Monk's tab prints it with no
 *  widget beside it). Then the widget, but ONLY when all three of `pool.resource`, its seeded
 *  `feature_uses` entry and its `resolved.resources` index entry exist: a pool whose members consume
 *  nothing the character owns renders NO widget (Four Elements is the live witness: its tab prints the
 *  DC line and then the list), and a fixture that casts a `ResolvedCharacter` with no index reads
 *  `undefined` through the optional chain instead of throwing (§4.2.6, confirmation r6 M-1; `state` and
 *  `classes` are required and are read unguarded here, as they are in `renderSpendControl` and
 *  `renderCardResource`).
 *  The head div itself is created on FIRST use, so a pool with neither a DC nor an owned resource
 *  emits no empty spacer.
 *
 *  `dice` hands off to `renderResourceTracker` (`./actions/resource-tracker`, R4-G5 §4.3.2), which
 *  since the extraction owns the die span, the at-will sentinel, the `CHARGE_BOX_LIMIT` ceiling and
 *  the recovery caption for all four tracker sites. The head still computes the LEVEL that die is
 *  resolved at, the OWNER's class level (`resourceLevelFor`, the same expression `renderSpendControl`
 *  carries; `renderCardResource` reaches the same derivation through `feature-rows.ts`'s
 *  module-private `resourceLevel` helper). `points` goes straight to the numeric widget, which is
 *  exactly what the hint is load-bearing for (a point-pool below the box limit, §4.1).
 *
 *  THE NAME IS PRINTED ONCE. `renderPointPool` writes its own `.pc-point-pool-name`, so the head
 *  writes `.pc-pool-head-name` only on the paths where that widget does NOT run: the points shape
 *  always runs it, and the dice shape's helper hands off to it through `renderLarge` whenever
 *  `max > CHARGE_BOX_LIMIT`, EXCEPT at will, where `renderChargeBoxes` returns before it consults
 *  `renderLarge` (`AT_WILL_MAX` is itself above the limit, so a guard on the max alone would leave an
 *  at-will head nameless). */
function renderPoolHead(root: HTMLElement, pool: ResolvedPool, ctx: ComponentRenderContext, shape: "dice" | "points"): void {
  let head: HTMLElement | undefined;
  const headEl = (): HTMLElement => (head ??= root.createDiv({ cls: "pc-pool-head" }));
  const dc = poolSaveDC(ctx.resolved, ctx.derived, pool);
  if (dc !== null) headEl().createDiv({ cls: "pc-pool-dc", text: `${pool.label} save DC ${dc}` });
  const id = pool.resource;
  const fu = id ? ctx.resolved.state.feature_uses?.[id] : undefined;
  const res = id ? ctx.resolved.resources?.get(id) : undefined;
  if (!id || !fu || !res) return;
  const resetLabel = RESET_LABELS[res.reset];
  const resetTitle = res.reset === "custom" ? CUSTOM_RESET_TIP : undefined;
  const isAtWill = fu.max === AT_WILL_MAX;
  const numeric = shape === "points" || (!isAtWill && fu.max > CHARGE_BOX_LIMIT);
  const pointOpts = { id, name: res.name, used: fu.used, max: fu.max, resetLabel, resetTitle, onSet: (n: number) => ctx.editState?.setFeatureUse(id, n) };
  const line = headEl().createDiv({ cls: "pc-pool-head-resource" });
  if (!numeric) line.createSpan({ cls: "pc-pool-head-name", text: res.name });
  if (shape === "dice") {
    renderResourceTracker(line, ctx, {
      id, name: res.name, reset: res.reset,
      die: res.die, level: res.die ? resourceLevelFor(res.owner.source, ctx.resolved) : undefined,
      onSet: (n) => ctx.editState?.setFeatureUse(id, n),
    });
  } else {
    renderPointPool(line, pointOpts);
  }
}

/** Active-effects rail items: each selected, activatable, currently-on boon. */
function activeItems(pool: ResolvedPool, activeBuffs: string[], ctx: ComponentRenderContext): ActiveEffectItem[] {
  return pool.selected
    .filter((e) => e.entity.activatable && activeBuffs.includes(e.slug))
    .map((e) => ({
      // R4 {G5, G6} live rider 2, X-8-3: the tile's caption is the POOL's own label, from the data.
      // The literal it replaces, "Active boon", was a game noun this renderer invented, and on a
      // Warlock it sat beside a real Pact Boon tab. A pool with no label falls back to the neutral
      // word the class-feature tiles already use.
      label: pool.label || "Active",
      name: e.entity.name,
      onEnd: () => ctx.editState?.toggleActiveBuff(e.slug),
    }));
}

/** "Known X / N" counter; crimson .over when selections exceed the cap. */
function renderCounter(parent: HTMLElement, pool: ResolvedPool): void {
  const counts = parent.createDiv({ cls: "pc-spell-counts" });
  counts.appendText("Known ");
  const b = counts.createEl("b", { text: `${pool.selected.length} / ${pool.count}` });
  if (pool.selected.length > pool.count) b.classList.add("over");
}

/** Italic meta sub-line: "Passive", action cost, and consume cost.
 *
 *  R4 {G5, G6} live rider N-1-7: an entry that declares NEITHER `passive` NOR an `action_cost` reads
 *  "Passive" too. It is not a guess about the game: `featureEconomy` (the sheet's own filing rule,
 *  `actions/action-model.ts`) maps `free`, `special` and an ABSENT cost alike to the Passive & Free
 *  Actions bucket, so such an entry already lives under that heading everywhere else on the sheet and
 *  the row now says so instead of printing an empty sub-line. Measured live: in the fighting-style
 *  pool `Great Weapon Fighting` was the one row with no sub-line at all while its siblings read
 *  `Passive`, `Reaction` and `Passive · Special`. */
function metaSub(e: OptionalFeatureEntity, ctx: ComponentRenderContext): string[] {
  const parts: string[] = [];
  if (e.passive || !e.action_cost) parts.push("Passive");
  if (e.action_cost) parts.push(COST_LABELS[e.action_cost] ?? e.action_cost);
  if (e.consumes?.amount) parts.push(consumeCost(e.consumes, ctx));
  return parts;
}

/** The row sub-line, one SEGMENT element per part (R4 {G5, G6} live rider 2, X-8-7). The parts are
 *  joined by the same ` · ` text this line has always carried, so the composed `textContent` is
 *  unchanged; the segments exist so the CSS can forbid a break inside one, which is what split
 *  `Passive · 2` from `Sorcery Point` at the 356 px column. No part renders no line at all, as
 *  before. */
function renderMetaSub(nameWrap: HTMLElement, parts: string[]): void {
  if (!parts.length) return;
  const sub = nameWrap.createDiv({ cls: "pc-spell-sub" });
  parts.forEach((part, i) => {
    if (i) sub.appendText(" · ");
    sub.createSpan({ cls: "pc-spell-sub-seg", text: part });
  });
}

/** The "Cost" text for a `consumes` link, shared by the row sub-line and the block card's meta
 *  (R4-G4 §3.2.4). THREE sources for the name, in order: the resource's NAME from
 *  `resolved.resources` when the character OWNS it; else the name a registry entity DECLARES for that
 *  id (R4 {G5, G6} live rider V-5); else the raw id. Never singularized and never capitalized, because
 *  the old `.replace(/s$/, "")` + capitalize pair was game-vocabulary logic living in a renderer
 *  (invariant 3), and it printed "1 Fighter-2024:superiority-dice" on a Parry row. The declared lookup
 *  is not that logic returning: it reads a `name` a document authored beside the `id`, and it invents
 *  nothing when no document declares one. A `column` or absent link keeps the literal it always had. */
function consumeCost(consumes: NonNullable<OptionalFeatureEntity["consumes"]>, ctx: ComponentRenderContext): string {
  const id = consumes.resource ?? consumes.column ?? "resource";
  const owned = consumes.resource ? ctx.resolved.resources?.get(consumes.resource)?.name : undefined;
  const name = consumes.resource ? (owned ?? declaredResourceNames(ctx).get(consumes.resource) ?? id) : id;
  return `${consumes.amount} ${name}`;
}

/** id → declared display name, for every resource ANY registered entity declares.
 *
 *  Why it exists: a cross-edition pick consumes a resource its owner does not own (a 2014 Battle
 *  Master's PHB 2024 maneuvers consume `fighter-2024:superiority-dice`), so `resolved.resources`, which
 *  indexes the CHARACTER's own features, misses and the id used to reach the sheet raw. The name is in
 *  the vault regardless: the PHB 2024 Fighter declares that id with `name: Superiority Dice`.
 *
 *  The walk is over SHAPE, not entity type: any registered document that carries a `resources[]`, at
 *  the top level or on a feature in `features_by_level`, contributes its `id` → `name` pairs. Nothing
 *  here names a class, a subclass or any other game word, so a homebrew document that declares
 *  resources is read exactly like a book one. The first declaration of an id wins, matching
 *  `resolveFeatureResources` in dnd5e, whose walk this mirrors · including its floor: like that walk,
 *  this one does NOT descend into `sub_features`, because a resource declared there is not in the
 *  character's index either, so descending would make the two disagree.
 *
 *  Built ONCE per sheet render and cached against the render CONTEXT, which `renderPCSheet` builds
 *  fresh on every pass: the cache therefore cannot outlive a compendium change, and a pool tab drawing
 *  a dozen rows walks the registry once rather than a dozen times. A context with no registry (every
 *  cast test fixture) memoises an empty map and every id stays raw. */
const DECLARED_RESOURCE_NAMES = new WeakMap<ComponentRenderContext, Map<string, string>>();

function declaredResourceNames(ctx: ComponentRenderContext): Map<string, string> {
  const cached = DECLARED_RESOURCE_NAMES.get(ctx);
  if (cached) return cached;
  const out = new Map<string, string>();
  const registry = ctx.services?.entities;
  const collect = (value: unknown): void => {
    if (!Array.isArray(value)) return;
    for (const r of value) {
      const res = r as { id?: unknown; name?: unknown };
      if (typeof res?.id !== "string" || typeof res.name !== "string") continue;
      if (!out.has(res.id)) out.set(res.id, res.name);
    }
  };
  if (registry) {
    for (const slug of registry.getAllSlugs()) {
      const data = registry.getBySlug(slug)?.data;
      if (!data) continue;
      collect(data.resources);
      const byLevel = data.features_by_level;
      if (!byLevel || typeof byLevel !== "object") continue;
      for (const features of Object.values(byLevel)) {
        if (!Array.isArray(features)) continue;
        for (const f of features) collect((f as { resources?: unknown })?.resources);
      }
    }
  }
  DECLARED_RESOURCE_NAMES.set(ctx, out);
  return out;
}

/** One crimson-labelled meta item inside a pc-block-meta row. */
function metaItem(parent: HTMLElement, label: string, value: string): void {
  const line = parent.createDiv({ cls: "pc-meta-line" });
  line.createSpan({ cls: "pc-meta-label", text: `${label}: ` });
  line.createSpan({ cls: "pc-meta-val", text: value });
}

/** Create the plain-text description block below the row (host carries the tint). */
function openDesc(host: HTMLElement, e: OptionalFeatureEntity): void {
  host.createDiv({ cls: "pc-spell-expand" }).setText(e.description ?? "");
  host.classList.add("pc-open-expand");
}

/** Toggle the description block, persisting the open state (D1). */
function toggleDesc(host: HTMLElement, e: OptionalFeatureEntity, ctx: ComponentRenderContext, key: string): void {
  const existing = host.querySelector(":scope > .pc-spell-expand");
  if (existing) {
    existing.remove();
    host.classList.remove("pc-open-expand");
    setRowExpanded(ctx, key, false);
  } else {
    openDesc(host, e);
    setRowExpanded(ctx, key, true);
  }
}
