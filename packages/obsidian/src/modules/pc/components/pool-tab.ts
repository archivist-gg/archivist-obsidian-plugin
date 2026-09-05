import type { SheetComponent, ComponentRenderContext } from "./component.types";
import type { ResolvedPool, ResolvedPoolEntry } from "@archivist-gg/dnd5e/pc/pc.types";
import type { OptionalFeatureEntity } from "@archivist-gg/dnd5e/types/optional-feature.types";
import { levelPrereqMax } from "@archivist-gg/dnd5e/pc/pc.pools";
import type { PoolLayout } from "@archivist-gg/dnd5e/types/selection-pool";
import { renderActiveEffectsRail, type ActiveEffectItem } from "./active-effects-rail";
import { rowExpandKey, isRowExpanded, setRowExpanded } from "./row-expand-state";
import { renderSpendControl } from "./actions/spend-control";

const COST_LABELS: Record<string, string> = {
  action: "1 Action", "bonus-action": "1 Bonus Action", reaction: "Reaction", free: "Free", special: "Special",
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
    const pool = ctx.resolved?.pools?.find((p) => p.id === this.poolId);
    if (!pool) {
      root.createDiv({ cls: "pc-empty-line", text: "No data for this pool." });
      return;
    }
    if (this.layout === "blocks") this.renderBlocks(root, pool, ctx);
    else this.renderSpellLike(root, pool, ctx);
  }

  private renderSpellLike(root: HTMLElement, pool: ResolvedPool, ctx: ComponentRenderContext): void {
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
          active: activeBuffs.includes(entry.slug),
        }, pool, ctx);
      }
    }

    const stranded = strandedSelections(pool);
    if (stranded.length) {
      root.createDiv({ cls: "pc-actions-section-head" }).createSpan({ text: "Selected · prerequisite unmet" });
      const list = root.createDiv({ cls: "pc-spell-list" });
      for (const entry of stranded) {
        this.row(list, entry, {
          selected: true,
          atCap,
          active: activeBuffs.includes(entry.slug),
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
    opts: { selected: boolean; atCap: boolean; active: boolean },
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
    const sub = metaSub(e, ctx);
    if (sub) nameWrap.createDiv({ cls: "pc-spell-sub", text: sub });
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
    // cross-book row is unchanged.
    if (opts.selected && e.consumes?.resource) renderSpendControl(row, { consumes: e.consumes, ctx });

    if (opts.selected && e.activatable) {
      const actv = row.createEl("button", {
        cls: `pc-pool-active${opts.active ? " on" : ""}`,
        text: opts.active ? "Active" : "Activate",
      });
      actv.addEventListener("click", (ev) => {
        ev.stopPropagation();
        ctx.editState?.toggleActiveBuff(entry.slug);
      });
    }
  }

  private grantedRow(parent: HTMLElement, entry: ResolvedPoolEntry, pool: ResolvedPool, ctx: ComponentRenderContext): void {
    const e = entry.entity;
    const host = parent.createDiv({ cls: "pc-spell-prep-row-host" });
    const row = host.createDiv({ cls: "pc-spell-prep-row" });
    const nameWrap = row.createDiv({ cls: "pc-spell-namewrap" });
    nameWrap.createSpan({ cls: "pc-spell-name", text: e.name });
    nameWrap.createSpan({ cls: "pc-spell-always", text: "granted" });
    const sub = metaSub(e, ctx);
    if (sub) nameWrap.createDiv({ cls: "pc-spell-sub", text: sub });
    const descKey = rowExpandKey("pooldesc", pool.id, entry.slug);
    nameWrap.addEventListener("click", () => toggleDesc(host, e, ctx, descKey));
    if (isRowExpanded(ctx, descKey)) openDesc(host, e);
    // A granted entry is KNOWN, so it spends like a selected one (R4-G4 §3.2.4): the same control
    // the blocks layout's `blockCard` and the boon row already render for granted entries.
    if (e.consumes?.resource) renderSpendControl(row, { consumes: e.consumes, ctx });
  }

  private renderBlocks(root: HTMLElement, pool: ResolvedPool, ctx: ComponentRenderContext): void {
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
    for (const entry of strandedSelections(pool)) {
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

    if (e.description) section.createEl("p", { cls: "pc-block-description", text: e.description });
  }
}

/** Selected picks no longer present in `available` (their prereq is now unmet);
 *  the resolver keeps them in `selected`, so we surface them as removable rows. */
function strandedSelections(pool: ResolvedPool): ResolvedPoolEntry[] {
  const avail = new Set(pool.available.map((e) => e.slug));
  return pool.selected.filter((e) => !avail.has(e.slug));
}

/** Active-effects rail items: each selected, activatable, currently-on boon. */
function activeItems(pool: ResolvedPool, activeBuffs: string[], ctx: ComponentRenderContext): ActiveEffectItem[] {
  return pool.selected
    .filter((e) => e.entity.activatable && activeBuffs.includes(e.slug))
    .map((e) => ({
      label: "Active boon",
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

/** Italic meta sub-line: "Passive", action cost, and consume cost. */
function metaSub(e: OptionalFeatureEntity, ctx: ComponentRenderContext): string {
  const parts: string[] = [];
  if (e.passive) parts.push("Passive");
  if (e.action_cost) parts.push(COST_LABELS[e.action_cost] ?? e.action_cost);
  if (e.consumes?.amount) parts.push(consumeCost(e.consumes, ctx));
  return parts.join(" · ");
}

/** The "Cost" text for a `consumes` link, shared by the row sub-line and the block card's meta
 *  (R4-G4 §3.2.4). The resource's NAME from `resolved.resources` when the character owns it, else
 *  the raw id: never singularized and never capitalized, because the old
 *  `.replace(/s$/, "")` + capitalize pair was game-vocabulary logic living in a renderer
 *  (invariant 3), and it printed "1 Fighter-2024:superiority-dice" on a Parry row. A `column` or
 *  absent link keeps the literal it always had. */
function consumeCost(consumes: NonNullable<OptionalFeatureEntity["consumes"]>, ctx: ComponentRenderContext): string {
  const id = consumes.resource ?? consumes.column ?? "resource";
  const name = consumes.resource ? (ctx.resolved.resources?.get(consumes.resource)?.name ?? id) : id;
  return `${consumes.amount} ${name}`;
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
