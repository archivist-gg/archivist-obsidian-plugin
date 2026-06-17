import type { SheetComponent, ComponentRenderContext } from "./component.types";
import type { ResolvedPool, ResolvedPoolEntry } from "../pc.types";
import type { OptionalFeatureEntity } from "../../optional-feature/optional-feature.types";
import type { PoolLayout } from "../../../shared/types/selection-pool";
import { renderActiveEffectsRail, type ActiveEffectItem } from "./active-effects-rail";

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
      const lvl = boonLevel(entry.entity);
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
      for (const entry of pool.grants) this.grantedRow(list, entry);
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
    const sub = metaSub(e);
    if (sub) nameWrap.createDiv({ cls: "pc-spell-sub", text: sub });
    nameWrap.addEventListener("click", () => toggleDesc(host, e));

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

  private grantedRow(parent: HTMLElement, entry: ResolvedPoolEntry): void {
    const e = entry.entity;
    const host = parent.createDiv({ cls: "pc-spell-prep-row-host" });
    const row = host.createDiv({ cls: "pc-spell-prep-row" });
    const nameWrap = row.createDiv({ cls: "pc-spell-namewrap" });
    nameWrap.createSpan({ cls: "pc-spell-name", text: e.name });
    nameWrap.createSpan({ cls: "pc-spell-always", text: "granted" });
    const sub = metaSub(e);
    if (sub) nameWrap.createDiv({ cls: "pc-spell-sub", text: sub });
    nameWrap.addEventListener("click", () => toggleDesc(host, e));
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

    const meta = section.createDiv({ cls: "pc-block-meta" });
    const lvl = boonLevel(e);
    metaItem(meta, "Level", lvl ? String(lvl) : "—");
    if (e.action_cost) metaItem(meta, "Cost", COST_LABELS[e.action_cost] ?? e.action_cost);
    if (e.consumes?.amount) {
      const word = e.consumes.resource ?? e.consumes.column ?? "resource";
      const display = e.consumes.amount === 1 ? word.replace(/s$/, "") : word;
      metaItem(meta, "Cost", `${e.consumes.amount} ${display.charAt(0).toUpperCase()}${display.slice(1)}`);
    }
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

/** Max level prereq (mirrors pc.pools.ts); 0 when there is no level prereq. */
function boonLevel(e: OptionalFeatureEntity): number {
  return (e.prerequisites ?? [])
    .filter((p): p is { kind: "level"; min: number } => p.kind === "level")
    .reduce((m, p) => Math.max(m, p.min), 0);
}

/** Italic meta sub-line: "Passive", action cost, and consume cost. */
function metaSub(e: OptionalFeatureEntity): string {
  const parts: string[] = [];
  if (e.passive) parts.push("Passive");
  if (e.action_cost) parts.push(COST_LABELS[e.action_cost] ?? e.action_cost);
  if (e.consumes?.amount) {
    const word = e.consumes.resource ?? e.consumes.column ?? "resource";
    const display = e.consumes.amount === 1 ? word.replace(/s$/, "") : word;
    const label = `${display.charAt(0).toUpperCase()}${display.slice(1)}`;
    parts.push(`${e.consumes.amount} ${label}`);
  }
  return parts.join(" · ");
}

/** One crimson-labelled meta item inside a pc-block-meta row. */
function metaItem(parent: HTMLElement, label: string, value: string): void {
  const line = parent.createDiv({ cls: "pc-meta-line" });
  line.createSpan({ cls: "pc-meta-label", text: `${label}: ` });
  line.createSpan({ cls: "pc-meta-val", text: value });
}

/** Toggle a plain-text description block below the row (host carries the tint). */
function toggleDesc(host: HTMLElement, e: OptionalFeatureEntity): void {
  const existing = host.querySelector(":scope > .pc-spell-expand");
  if (existing) {
    existing.remove();
    host.classList.remove("pc-open-expand");
  } else {
    host.createDiv({ cls: "pc-spell-expand" }).setText(e.description ?? "");
    host.classList.add("pc-open-expand");
  }
}
