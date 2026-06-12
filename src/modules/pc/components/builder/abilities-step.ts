import type { ComponentRenderContext } from "../component.types";
import type { Ability } from "../../../../shared/types/choice";
import type { AbilityMethod } from "../../pc.types";
import { ABILITY_KEYS } from "../../../../shared/dnd/constants";
import {
  ABILITY_METHODS, POINT_BUY_RULES, STANDARD_ARRAY, allowedScores,
  pointBuySpent, pointBuyRemaining,
} from "./ability-methods";
import type { PointBuyRule } from "./ability-methods";
import { abilityBonusBreakdown } from "../../pc.recalc";

const ABILITY_LABELS: Record<Ability, string> = {
  str: "STR", dex: "DEX", con: "CON", int: "INT", wis: "WIS", cha: "CHA",
};

/** SP2 §7 Step 3 — Ability Scores: method pills, per-method context bar, six
 *  obelisk tiles (the sheet's exact classes) with a Base picker + crimson bonus
 *  caption each. Tiles show FINAL totals from derived; the Base control (picker
 *  design B-II — an anchored parchment popover, no native <select>) writes BASE
 *  scores via setAbilityBaseScore. */
export function renderAbilitiesStep(body: HTMLElement, ctx: ComponentRenderContext): void {
  const method = ctx.resolved.definition.ability_method;

  // Method pills.
  const tabs = body.createDiv({ cls: "pc-bmethods" });
  for (const m of ABILITY_METHODS) {
    const pill = tabs.createEl("button", { cls: `pc-bmtab${m.id === method ? " on" : ""}`, text: m.label });
    if (m.homebrew) pill.createSpan({ cls: "pc-bhb", text: "Homebrew" });
    pill.addEventListener("click", () => ctx.editState?.setAbilityMethod(m.id));
  }
  // ✦ Custom — Plan 6 hand-off; renders the prompt box only.
  const customOn = ctx.builderUiState?.get("builder.abilities.custom") === true;
  const custom = tabs.createEl("button", { cls: `pc-bmtab ai${customOn ? " on" : ""}` });
  custom.createSpan({ cls: "pc-bmtab-star", text: "✦ " });
  custom.createSpan({ text: "Custom" });
  custom.addEventListener("click", () => {
    ctx.builderUiState?.set("builder.abilities.custom", !customOn);
    redraw(body, ctx);
  });

  if (customOn) renderCustomBox(body);
  else renderMethodBar(body, ctx, method);

  renderTiles(body, ctx, method);
}

function redraw(body: HTMLElement, ctx: ComponentRenderContext): void {
  body.empty();
  renderAbilitiesStep(body, ctx);
}

function renderCustomBox(body: HTMLElement): void {
  const box = body.createDiv({ cls: "pc-baibox" });
  box.createDiv({ cls: "pc-baibox-t", text: "Custom scoring method" });
  box.createDiv({
    cls: "pc-baibox-b",
    text: "Describe a scoring method to Archivist Inquiry — it becomes a reusable tab here, exactly like Archivist Point Buy.",
  });
  const btn = box.createEl("button", { cls: "pc-baibtn", text: "✦ Ask Archivist Inquiry" });
  btn.disabled = true;
  btn.title = "Arrives with the Inquiry hand-off (Plan 6).";
}

function renderTiles(body: HTMLElement, ctx: ComponentRenderContext, method: AbilityMethod): void {
  const breakdown = abilityBonusBreakdown(ctx.resolved);
  // DerivedStats holds the final totals on `scores` + the modifiers on `mods`.
  const derivedScores = ctx.derived.scores;
  const derivedMods = ctx.derived.mods;
  const row = body.createDiv({ cls: "pc-babrow" });
  for (const ab of ABILITY_KEYS) {
    const col = row.createDiv({ cls: "pc-babcol" });
    const tile = col.createDiv({ cls: "pc-ab", attr: { "data-ability": ab } });
    tile.createDiv({ cls: "pc-ab-label", text: ABILITY_LABELS[ab] });
    const mod = derivedMods[ab] ?? 0;
    tile.createDiv({ cls: "pc-ab-mod", text: `${mod >= 0 ? "+" : ""}${mod}` });
    tile.createDiv({ cls: "pc-ab-score", text: String(derivedScores[ab] ?? ctx.resolved.definition.abilities[ab]) });

    const ctl = col.createDiv({ cls: "pc-babctl" });
    ctl.createSpan({ cls: "pc-babctl-l", text: "Base" });
    renderBaseControl(ctl, ctx, method, ab);

    const cap = col.createDiv({ cls: "pc-babcap" });
    const parts: string[] = [];
    if (breakdown[ab].species > 0) parts.push(`+${breakdown[ab].species} species`);
    if (breakdown[ab].background > 0) parts.push(`+${breakdown[ab].background} background`);
    if (breakdown[ab].class > 0) parts.push(`+${breakdown[ab].class} class`);
    if (breakdown[ab].feat > 0) parts.push(`+${breakdown[ab].feat} feat`);
    if (parts.length) cap.createSpan({ cls: "pc-bsp", text: parts.join(" · ") });
  }
}

/** The Roll-method pool of six totals. Source of truth is the draft field
 *  `builder_rolls` (persisted by setBuilderRolls — survives view close/restart);
 *  the in-memory `builder.abilities.roll` bag is only a transient fallback for a
 *  render that runs before the field is seeded. Returns [] when neither holds a
 *  pool (no roll yet). */
function rollPool(ctx: ComponentRenderContext): number[] {
  const persisted = ctx.resolved.definition.builder_rolls;
  if (Array.isArray(persisted) && persisted.length) return [...persisted];
  const state = ctx.builderUiState?.get("builder.abilities.roll") as { dice: number[][] } | undefined;
  return (state?.dice ?? []).map((r) => r[0] + r[1] + r[2]);
}

/** Allowed Base values per method: point-buy rules constrain by budget;
 *  standard-array offers unused array values (+ the current one); rolled offers
 *  the session pool (Task 11); manual offers 3-20. */
function baseChoicesFor(ctx: ComponentRenderContext, method: AbilityMethod, ab: Ability): number[] {
  const abilities = ctx.resolved.definition.abilities;
  const rule = POINT_BUY_RULES[method];
  if (rule) return allowedScores(rule, abilities, ab);
  if (method === "standard-array") {
    const used = ABILITY_KEYS.filter((k) => k !== ab).map((k) => abilities[k]);
    const pool = [...STANDARD_ARRAY];
    for (const u of used) {
      const i = pool.indexOf(u);
      if (i >= 0) pool.splice(i, 1);
    }
    if (!pool.includes(abilities[ab])) pool.push(abilities[ab]);
    return [...new Set(pool)].sort((a, b) => b - a);
  }
  if (method === "rolled") {
    const totals = rollPool(ctx);
    for (const k of ABILITY_KEYS) {
      if (k === ab) continue;
      const i = totals.indexOf(abilities[k]);
      if (i >= 0) totals.splice(i, 1);
    }
    return totals.length ? [...new Set(totals)].sort((a, b) => b - a) : [abilities[ab]];
  }
  const out: number[] = [];
  for (let v = 3; v <= 20; v++) out.push(v);
  return out;
}

/** A pool method (standard-array / rolled) draws its Base picker from a fixed
 *  multiset of values shared across the six tiles. This resolves the FULL pool
 *  and tags each instance by who owns it: `cur` = this tile's value (carries the
 *  ✓), `used` = claimed by another tile (ghosted/inert), `free` = assignable.
 *  Duplicates are honoured slot-by-slot so two 15s read independently. */
interface PoolSlot { value: number; state: "cur" | "used" | "free"; }

function isPoolMethod(method: AbilityMethod): boolean {
  return method === "standard-array" || method === "rolled";
}

/** The neutral "unassigned" base. `Character.abilities` is `Record<Ability,
 *  number>` — strictly numeric, with no null arm — so a draft seeds every score
 *  to 10 (buildDraftCharacter) and "unassigned" is the value 10, the same
 *  sentinel `builder-view`'s draft-touch test keys on. Unassigning a pool tile
 *  writes 10 back via `clearAbilityBaseScore`, which frees the value it held. */
const UNASSIGNED_BASE = 10;

/** A pool tile is "assigned" when it holds a non-neutral value — i.e. a real
 *  pick the user placed, distinct from the seeded 10. Only then do we offer the
 *  unassign affordances (re-click ✓ + the explicit row). */
function isAssigned(ctx: ComponentRenderContext, method: AbilityMethod, ab: Ability): boolean {
  return isPoolMethod(method) && ctx.resolved.definition.abilities[ab] !== UNASSIGNED_BASE;
}

function poolSlotsFor(ctx: ComponentRenderContext, method: AbilityMethod, ab: Ability): PoolSlot[] {
  const abilities = ctx.resolved.definition.abilities;
  let pool: number[];
  if (method === "standard-array") {
    pool = [...STANDARD_ARRAY];
  } else {
    pool = rollPool(ctx);
  }
  // Claim one slot per ability that holds a matching value (first-fit), so
  // duplicates are owned independently. Then label each slot relative to `ab`.
  const owner: (Ability | null)[] = pool.map(() => null);
  for (const k of ABILITY_KEYS) {
    const want = abilities[k];
    const i = pool.findIndex((v, idx) => v === want && owner[idx] === null);
    if (i >= 0) owner[i] = k;
  }
  const slots: PoolSlot[] = pool
    .map((value, idx): PoolSlot => ({
      value,
      state: owner[idx] === ab ? "cur" : owner[idx] !== null ? "used" : "free",
    }))
    .sort((a, b) => b.value - a.value);
  // Guard: the current value must always be representable (e.g. a manual edit
  // left a score outside the pool). If no slot owns this tile, stamp the
  // highest free slot — or, failing that, prepend the current value as `cur`.
  if (!slots.some((s) => s.state === "cur")) {
    slots.unshift({ value: abilities[ab], state: "cur" });
  }
  return slots;
}

/** The Base picker (picker design B-II): a button-dressed control that opens an
 *  anchored in-DOM parchment popover below it — no native <select>, so the OS
 *  menu never draws. Pool methods list the pool (✓ on current, other-tile values
 *  ghosted); manual/point-buy show a numeral grid over the real range. The panel
 *  is created INSIDE a relative anchor wrapper, so the builder's per-write
 *  re-render unmounts it naturally; outside-click + Escape close it with no
 *  write. */
function renderBaseControl(ctl: HTMLElement, ctx: ComponentRenderContext, method: AbilityMethod, ab: Ability): void {
  const cur = ctx.resolved.definition.abilities[ab];
  const anchor = ctl.createDiv({ cls: "pc-base-pop-anchor" });
  const btn = anchor.createEl("button", { cls: "pc-base-pop-btn", attr: { "data-ability": ab } });
  btn.createSpan({ cls: "pc-base-pop-v", text: String(cur) });
  btn.createSpan({ cls: "pc-base-pop-cv", text: "▾" });
  btn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    if (closeBasePopoverFor(anchor)) return; // clicking the open tile's button closes it
    openBasePopover(anchor, btn, ctx, method, ab);
  });
}

/** Module-level singleton so only one Base popover is ever open: opening another
 *  tile's closes the first. The cleanup tears down the document-level listeners. */
let currentBasePopover: { anchor: HTMLElement; panel: HTMLElement; cleanup: () => void } | null = null;

function closeBasePopover(): void {
  if (!currentBasePopover) return;
  currentBasePopover.cleanup();
  currentBasePopover.panel.remove();
  currentBasePopover = null;
}

/** Closes the popover if it belongs to `anchor`, returning whether it did — so a
 *  click on the same trigger toggles closed instead of reopening. */
function closeBasePopoverFor(anchor: HTMLElement): boolean {
  if (currentBasePopover?.anchor === anchor) {
    closeBasePopover();
    return true;
  }
  closeBasePopover(); // a different tile's popover, if any, also closes
  return false;
}

function openBasePopover(
  anchor: HTMLElement, trigger: HTMLElement,
  ctx: ComponentRenderContext, method: AbilityMethod, ab: Ability,
): void {
  const cur = ctx.resolved.definition.abilities[ab];
  // The panel + caret + header + numeral grid share the generic `.pc-pop` /
  // `.pc-numgrid` families with the class-card level picker (picker A-II); the
  // `.pc-base-*` co-classes carry only the Base-specific dress (tile-centred
  // anchor, narrower width) and the pool-list, which the level picker has no
  // analogue for.
  const panel = anchor.createDiv({ cls: "pc-pop pc-base-pop" });
  panel.createDiv({ cls: "pc-pop-arrow pc-base-pop-arrow" });
  panel.addEventListener("click", (ev) => ev.stopPropagation());

  const commit = (value: number): void => {
    closeBasePopover();
    ctx.editState?.setAbilityBaseScore(ab, value);
  };
  const clear = (): void => {
    closeBasePopover();
    ctx.editState?.clearAbilityBaseScore(ab);
  };

  if (isPoolMethod(method)) {
    panel.createDiv({ cls: "pc-pop-h pc-base-pop-h", text: "Assign value" });
    const list = panel.createDiv({ cls: "pc-base-pool-list" });
    for (const slot of poolSlotsFor(ctx, method, ab)) {
      const opt = list.createDiv({
        cls: `pc-base-pool-opt${slot.state === "cur" ? " cur" : ""}${slot.state === "used" ? " used" : ""}`,
      });
      opt.createSpan({ cls: "pc-base-pool-ck", text: slot.state === "cur" ? "✓" : "" });
      opt.createSpan({ text: String(slot.value) });
      // Re-clicking the ✓ current value unassigns it (toggle semantics, like the
      // chips idiom everywhere else); free values assign; used values are inert.
      if (slot.state === "cur") opt.addEventListener("click", () => clear());
      else if (slot.state === "free") opt.addEventListener("click", () => commit(slot.value));
    }
    // An explicit quiet "Unassign" row (discoverability), shown only when this
    // tile actually holds an assigned pool value (a `cur` slot exists). Freed
    // values rejoin the pool for other tiles on the per-write re-render.
    if (isAssigned(ctx, method, ab)) {
      const un = panel.createDiv({ cls: "pc-base-unassign", text: "– Unassign" });
      un.addEventListener("click", () => clear());
    }
  } else {
    panel.createDiv({ cls: "pc-pop-h pc-base-pop-h", text: "Set value" });
    const grid = panel.createDiv({ cls: "pc-numgrid pc-base-numgrid" });
    for (const v of baseChoicesFor(ctx, method, ab)) {
      const cell = grid.createDiv({ cls: `pc-numgrid-c pc-base-numgrid-c${v === cur ? " cur" : ""}`, text: String(v) });
      cell.addEventListener("click", () => commit(v));
    }
  }

  // Dismissal — the conditions-popover idiom: register document-level
  // outside-click + Escape on open, tear down on close. The opening click is
  // still bubbling when this runs, but it targets the trigger (inside `anchor`),
  // so `anchor.contains` ignores it and the listener survives the open. A
  // builder re-render unmounts the panel without calling close, so each handler
  // also bails (and tears down) the moment the panel leaves the DOM.
  const onClick = (e: MouseEvent): void => {
    if (!panel.isConnected) { closeBasePopover(); return; }
    if (!(e.target instanceof Node)) return;
    if (panel.contains(e.target) || trigger.contains(e.target)) return;
    closeBasePopover();
  };
  const onKey = (e: KeyboardEvent): void => {
    if (!panel.isConnected) { closeBasePopover(); return; }
    if (e.key === "Escape") closeBasePopover();
  };
  activeDocument.addEventListener("click", onClick);
  activeDocument.addEventListener("keydown", onKey);

  currentBasePopover = {
    anchor, panel,
    cleanup: () => {
      activeDocument.removeEventListener("click", onClick);
      activeDocument.removeEventListener("keydown", onKey);
    },
  };
}

function renderMethodBar(body: HTMLElement, ctx: ComponentRenderContext, method: AbilityMethod): void {
  // Tasks 10-11 fill the per-method bars; manual needs none.
  const rule = POINT_BUY_RULES[method];
  if (rule) renderPointBuyBar(body, ctx, method, rule);
  else if (method === "standard-array") renderArrayBar(body, ctx);
  else if (method === "rolled") renderRollBar(body, ctx);
}

// ── Per-method context bars ───────────────────────────────────────────
// Tasks 10-11 replace these bodies; the signatures here are FIXED. Each is the
// minimal honest context line for now (no placeholder copy).
function renderPointBuyBar(body: HTMLElement, ctx: ComponentRenderContext, method: AbilityMethod, rule: PointBuyRule): void {
  const abilities = ctx.resolved.definition.abilities;
  const spent = pointBuySpent(rule, abilities);
  const left = pointBuyRemaining(rule, abilities);
  const over = left < 0;
  // Design D: one calm line — label · spent · meter · hero remaining. The cost
  // legend lives in the Base picker now. Over budget wears the N1 idiom: tint +
  // "!" disc + crimson copy + a darker overflow cap on the meter. No accent bars.
  const bar = body.createDiv({ cls: `pc-bctx${over ? " pc-bctx-over" : ""}` });
  if (over) bar.createSpan({ cls: "pc-bover-bang", text: "!" });
  bar.createSpan({ cls: "pc-bctx-l", text: ABILITY_METHODS.find((m) => m.id === method)?.label ?? "" });

  const meter = bar.createDiv({ cls: "pc-bmeter" });
  meter.createSpan({ cls: `pc-bmeter-t${over ? " over" : ""}`, text: `${spent} of ${rule.budget} spent` });
  const track = meter.createDiv({ cls: "pc-bmeter-bar" });
  const fill = track.createDiv({ cls: "pc-bmeter-fill" });
  if (over) {
    fill.style.width = `${(rule.budget / spent) * 100}%`;
    const overSeg = track.createDiv({ cls: "pc-bmeter-over" });
    overSeg.style.width = `${((spent - rule.budget) / spent) * 100}%`;
  } else {
    fill.style.width = `${Math.max(0, Math.min(100, (spent / rule.budget) * 100))}%`;
  }

  bar.createSpan({ cls: "pc-bleft-n", text: String(Math.abs(left)) });
  bar.createSpan({ cls: `pc-bleft-l${over ? " over" : ""}`, text: over ? "over" : "left" });
  if (over) {
    const n = Math.abs(left);
    bar.createSpan({ cls: "pc-bover-t", text: `— lower scores worth ${n} point${n === 1 ? "" : "s"} to continue` });
  }
}

function renderArrayBar(body: HTMLElement, ctx: ComponentRenderContext): void {
  const abilities = ctx.resolved.definition.abilities;
  const bar = body.createDiv({ cls: "pc-bctx" });
  bar.createSpan({ cls: "pc-bctx-l", text: "Standard Array" });
  // Pool = array values minus those already assigned (each value consumed once).
  const pool = [...STANDARD_ARRAY];
  for (const ab of ABILITY_KEYS) {
    const i = pool.indexOf(abilities[ab]);
    if (i >= 0) pool.splice(i, 1);
  }
  const wrap = bar.createDiv({ cls: "pc-bpool" });
  wrap.createSpan({ cls: "pc-bmeter-t", text: pool.length ? "Unassigned:" : "All values assigned." });
  for (const v of pool) wrap.createSpan({ cls: "pc-bpool-chip", text: String(v) });
}

interface RollState { dice: number[][]; }

function renderRollBar(body: HTMLElement, ctx: ComponentRenderContext): void {
  const bag = ctx.builderUiState;
  // The POOL's source of truth is the persisted draft field (survives view
  // close/restart); the bag holds only the transient per-die breakdown for the
  // dice-chip dress, which is lost on reopen and falls back to bare totals.
  const persisted = ctx.resolved.definition.builder_rolls;
  const state = bag?.get("builder.abilities.roll") as RollState | undefined;
  const totals = rollPool(ctx);
  const hasPool = totals.length > 0;
  const bar = body.createDiv({ cls: "pc-bctx" });
  bar.createSpan({ cls: "pc-bctx-l", text: "Roll" });
  const btn = bar.createEl("button", { cls: "pc-broll-btn", text: hasPool ? "Re-roll" : "Roll 4d6 × 6" });
  btn.addEventListener("click", () => {
    const dice: number[][] = [];
    for (let i = 0; i < 6; i++) {
      const set = [0, 0, 0, 0].map(() => 1 + Math.floor(Math.random() * 6));
      set.sort((a, b) => b - a);
      dice.push(set);
    }
    // Persist the pool (totals) on the draft — the authority the Base popover
    // reads — then cache the per-die breakdown in the bag for the chip dress.
    // Re-roll overwrites both. The mutator's onChange re-renders the step.
    bag?.set("builder.abilities.roll", { dice } satisfies RollState);
    if (ctx.editState) {
      // The mutator's onChange drives the builder re-render.
      ctx.editState.setBuilderRolls(dice.map((r) => r[0] + r[1] + r[2]));
    } else {
      // No edit-state host (standalone render) — repaint directly.
      redraw(body, ctx);
    }
  });
  if (!hasPool) {
    bar.createSpan({ cls: "pc-bmeter-t", text: "Roll a pool of six, then assign via the Base dropdowns." });
    return;
  }
  const sets = bar.createDiv({ cls: "pc-broll-sets" });
  // Prefer the full per-die breakdown (struck lowest) when the bag still holds
  // it; after a reopen only the persisted totals remain, so render those bare.
  if (state) {
    for (const roll of state.dice) {
      const set = sets.createDiv({ cls: "pc-broll-set" });
      roll.forEach((d, i) => set.createSpan({ cls: `pc-broll-die${i === roll.length - 1 ? " strike" : ""}`, text: String(d) }));
      const total = roll[0] + roll[1] + roll[2]; // sorted desc — drop the lowest
      set.createSpan({ cls: "pc-broll-total", text: String(total) });
    }
  } else {
    for (const total of persisted ?? totals) {
      const set = sets.createDiv({ cls: "pc-broll-set" });
      set.createSpan({ cls: "pc-broll-total", text: String(total) });
    }
  }
}
