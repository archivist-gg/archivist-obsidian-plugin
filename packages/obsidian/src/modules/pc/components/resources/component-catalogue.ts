import type { ComponentRenderContext } from "../component.types";
import type { ResourceRow } from "./resource-model";
import { AT_WILL_MAX } from "@archivist-gg/dnd5e/dnd/resource-formula";
import { resolveScalingDie } from "@archivist-gg/dnd5e/dnd/resource-die";
import { resourceLevelFor } from "@archivist-gg/dnd5e/pc/pc.resources";
import { renderChargeBoxes, CHARGE_BOX_LIMIT } from "../actions/charge-boxes";
import { renderPointPool } from "../actions/point-pool";
import { renderDieIcon } from "./die-icon";

/**
 * THE COMPONENT CATALOGUE — one table, `rendering_hint` → renderer.
 *
 * A note says which control draws its resource (`rendering_hint`) and where it
 * goes (`surface`); this table is the only place those strings mean anything.
 * Adding a control is one entry here. Adding a RESOURCE is no code at all —
 * which is the whole point, and why nothing below may ever branch on a
 * resource's name or id. The row's kind (feature / hit die / item) selects the
 * WRITE-BACK, never the drawing.
 *
 * The hint is looked up as an OWN property (the `RENDERING_HINT_LAYOUT` guard in
 * dnd5e's `pool-layout.ts`): `rendering_hint` is a free `z.string().optional()`
 * on converter data, so a note may carry any string at all, and a plain index
 * would answer `constructor` or `toString` with a function off the prototype.
 */

/** What a component needs beyond the row. */
export interface ResourceComponentOpts {
  /**
   * `.pc-hd-label` text. The two surfaces want different words and neither is
   * derivable here: the band names the resource (a cell has no other title), the
   * tab names only the die face (the row's `.pc-action-row-name` already carries
   * the name). Empty / absent → no label element at all, rather than an empty box
   * taking up the line.
   */
  label?: string;
  /**
   * Which surface is drawing. The counters carry their label on both, inside the
   * shipped widget's body; the controls that have no body of their own — pips, a
   * bar, the numeric pool — carry it in the BAND only, where a cell would
   * otherwise be an anonymous row of boxes in the header. On the tab the row
   * already has a name cell.
   */
  surface: "band" | "tab";
}

export type ResourceComponent = (
  host: HTMLElement,
  row: ResourceRow,
  ctx: ComponentRenderContext,
  opts: ResourceComponentOpts,
) => void;

/** Uses left, floored at 0 (a seed can exceed a shrunken max). */
const remainingOf = (row: ResourceRow): number => Math.max(0, row.max - row.used);

/**
 * The ONE write-back. Every control moves the same axis — how many are LEFT —
 * and the row's kind picks the primitive that records it. Nothing else in this
 * file knows a row has kinds.
 */
function writeRemaining(row: ResourceRow, ctx: ComponentRenderContext, next: number): void {
  const editState = ctx.editState;
  if (!editState) return;
  const clamped = Math.max(0, Math.min(row.max, next));
  if (row.kind === "hit-dice") {
    const now = remainingOf(row);
    if (clamped < now) editState.spendHitDie(row.face);
    else if (clamped > now) editState.restoreHitDie(row.face);
    return;
  }
  if (row.kind === "item") {
    editState.setItemCharges(row.index, row.max - clamped, row.max);
    return;
  }
  editState.setFeatureUse(row.res.id, row.max - clamped);
}

/** The `used` axis, for the controls that speak in uses rather than remaining. */
function writeUsed(row: ResourceRow, ctx: ComponentRenderContext, used: number): void {
  writeRemaining(row, ctx, row.max - used);
}

/** The face a row shows right now: the hit die's own, or the resource's die
 *  resolved at its OWNER's class level (R4-G4 §6.2.4). */
function faceOf(row: ResourceRow, ctx: ComponentRenderContext): string | undefined {
  if (row.kind === "hit-dice") return row.face;
  if (row.kind !== "resource" || !row.res.die) return undefined;
  return resolveScalingDie(row.res.die, resourceLevelFor(row.res.owner.source, ctx.resolved));
}

/** U+2212 MINUS SIGN — the glyph the shipped widgets use; not a hyphen. */
const MINUS = "−";

/**
 * The COUNTER: the shipped hit-dice shape. Stacked `+` / `−` on the left, a big
 * `current / total` beside it, a small-caps label under it.
 *
 * `total` is printed only when the resource HAS one (`max > 0`). A resource
 * whose max is not a positive count — the shape a tally handed out at the table
 * has — renders the bare number, because `12 / 0` is a lie and `12 / ` is a
 * dangling mark.
 */
function renderCounterShape(
  host: HTMLElement,
  row: ResourceRow,
  ctx: ComponentRenderContext,
  opts: ResourceComponentOpts & { die?: boolean },
): void {
  const wrap = host.createDiv({ cls: "pc-hd-widget" });
  const remaining = remainingOf(row);

  const actions = wrap.createDiv({ cls: "pc-hd-actions" });
  const plus = actions.createEl("button", { cls: "pc-hd-plus", text: "+", attr: { title: `Restore 1 ${row.name}` } });
  const minus = actions.createEl("button", { cls: "pc-hd-minus", text: MINUS, attr: { title: `Spend 1 ${row.name}` } });

  const body = wrap.createDiv({ cls: "pc-hd-body" });
  const nums = body.createDiv({ cls: opts.die ? "pc-hd-nums pc-hd-nums-die" : "pc-hd-nums" });

  if (opts.die) mountDieFace(nums, row, ctx);
  nums.createSpan({ cls: "pc-hd-rem", text: String(remaining) });
  if (row.max > 0) {
    nums.createSpan({ cls: "pc-hd-sep", text: " / " });
    nums.createSpan({ cls: "pc-hd-tot", text: String(row.max) });
  }
  if (opts.label) body.createDiv({ cls: "pc-hd-label", text: opts.label });

  // NO `stopPropagation`, matching the shipped `HitDiceWidget` this shape is:
  // the sheet's popovers close on an outside click read off `document`
  // (`components/defense-type-popover.ts`), so a control that swallowed its own
  // click would leave an open picker up. No host here binds a row click.
  plus.addEventListener("click", () => writeRemaining(row, ctx, remaining + 1));
  minus.addEventListener("click", () => writeRemaining(row, ctx, remaining - 1));
}

/**
 * The trimmings a control with no body of its own needs: the die face before it
 * (a face is the first thing a player reads off a die resource, and a pip track
 * has nowhere to put it), and the label after it, in the band only.
 */
function renderFace(host: HTMLElement, row: ResourceRow, ctx: ComponentRenderContext): void {
  const face = faceOf(row, ctx);
  if (face) renderDieIcon(host, face).addClass("pc-resource-face");
}

function renderBandLabel(host: HTMLElement, opts: ResourceComponentOpts): void {
  if (opts.surface === "band" && opts.label) host.createDiv({ cls: "pc-hd-label", text: opts.label });
}

/**
 * The die face beside the number — a READOUT, not a control.
 *
 * It used to be clickable, stepping along the ladder the resource declares. That
 * was a false affordance: `faceOf` resolves the face from the owner's class level
 * through `resolveScalingDie`, and the engine carries no field for a chosen rung,
 * so a step lived in the DOM until the next re-render (any `editState` write) and
 * then silently snapped back to the level's face. A control that forgets is worse
 * than a label, because it looks like it worked. The face a character's level
 * gives them is not theirs to pick, so there is nothing to persist and nothing to
 * click.
 */
function mountDieFace(nums: HTMLElement, row: ResourceRow, ctx: ComponentRenderContext): void {
  const face = faceOf(row, ctx);
  if (!face) return;
  renderDieIcon(nums, face, { size: "lg" });
}

const counterComponent: ResourceComponent = (host, row, ctx, opts) =>
  renderCounterShape(host, row, ctx, opts);

/**
 * The TALLY: the counter's shape over a count with no ceiling — hero points,
 * and any table currency handed out and spent with no maximum. The approved
 * design is the inspiration control: a bare number that goes up and down, and
 * no `/ total`, because there is no total to print.
 *
 * It reads the `used` axis DIRECTLY as the count held, where every other
 * control reads `max - used` as the count left. That inversion is what "no
 * ceiling" means here: a remaining-axis control cannot express it, since
 * `remaining` is defined against a max.
 *
 * The note declares `uses.max: 999` — `AT_WILL_MAX`, the project's existing
 * word for "no ceiling", already understood by the pip track and the pool head.
 * That is load-bearing and not a placeholder: `seedFeatureUses` clamps a stored
 * `used` to the resource's max on every recalc, so a max of 0 would reset the
 * tally to 0 on the next render, and `writeUsed` routes through
 * `writeRemaining`, whose clamp to `[0, max]` would refuse every increment. At
 * 999 both are no-ops for any count a table produces, and no engine field, no
 * schema change and no new write path are needed — which is why this is one
 * catalogue entry rather than a change to the engine.
 */
const tallyComponent: ResourceComponent = (host, row, ctx, opts) => {
  const wrap = host.createDiv({ cls: "pc-hd-widget" });

  const actions = wrap.createDiv({ cls: "pc-hd-actions" });
  const plus = actions.createEl("button", { cls: "pc-hd-plus", text: "+", attr: { title: `Gain 1 ${row.name}` } });
  const minus = actions.createEl("button", { cls: "pc-hd-minus", text: MINUS, attr: { title: `Spend 1 ${row.name}` } });

  const body = wrap.createDiv({ cls: "pc-hd-body" });
  const nums = body.createDiv({ cls: "pc-hd-nums" });
  nums.createSpan({ cls: "pc-hd-rem", text: String(Math.max(0, row.used)) });
  if (opts.label) body.createDiv({ cls: "pc-hd-label", text: opts.label });

  plus.addEventListener("click", () => writeUsed(row, ctx, row.used + 1));
  minus.addEventListener("click", () => writeUsed(row, ctx, row.used - 1));
};

/** The counter, with the die face inline beside the number. */
const dieComponent: ResourceComponent = (host, row, ctx, opts) =>
  renderCounterShape(host, row, ctx, { ...opts, die: true });

/**
 * PIPS — the shipped toggle track.
 *
 * It prints no `/ <reset>` caption on either surface: the band shows current and
 * total and nothing else, and on the tab the GROUP HEADING already says what a
 * rest returns. A resource's partial `recovery`, which the heading cannot say,
 * is the tab's own caption and is written by the tab beside this control.
 */
const pipsComponent: ResourceComponent = (host, row, ctx, opts) => {
  renderFace(host, row, ctx);
  const track = host.createSpan({ cls: "pc-feature-track" });
  renderChargeBoxes(track, {
    used: row.used,
    max: row.max,
    atWill: row.max === AT_WILL_MAX,
    onSet: (newUsed) => writeUsed(row, ctx, newUsed),
  });
  renderBandLabel(host, opts);
};

/**
 * THE CHARGE BAR — a track for a pool too large to count at a glance, with its
 * remaining count beside it (`87 of 100`).
 *
 * The hatched zone is what has been SPENT. It carries no number of its own:
 * depletion is what the hatching is for, and a second figure beside the first
 * only makes the reader do the subtraction the bar already drew.
 */
export function renderChargeBar(
  host: HTMLElement,
  opts: { remaining: number; max: number; pending?: number; inline?: boolean },
): { fill: HTMLElement; pending: HTMLElement; spent: HTMLElement; count: HTMLElement } {
  const max = Math.max(1, opts.max);
  const bar = host.createSpan({ cls: opts.inline ? "pc-charge-bar pc-charge-bar-inline" : "pc-charge-bar" });
  const track = bar.createSpan({ cls: "pc-charge-bar-track" });
  const fill = track.createSpan({ cls: "pc-charge-bar-fill" });
  const pending = track.createSpan({ cls: "pc-charge-bar-pending" });
  const spent = track.createSpan({ cls: "pc-charge-bar-burnt" });
  const cap = bar.createSpan({ cls: "pc-charge-bar-cap" });
  const line = cap.createSpan();
  const count = line.createEl("b");
  setChargeBar({ fill, pending, spent, count }, opts.remaining, max, opts.pending ?? 0);
  line.appendText(` of ${opts.max}`);
  return { fill, pending, spent, count };
}

/** Repaint a bar's three zones and its count. Widths are shares of `max`. */
export function setChargeBar(
  parts: { fill: HTMLElement; pending: HTMLElement; spent: HTMLElement; count: HTMLElement },
  remaining: number,
  max: number,
  pending = 0,
): void {
  const total = Math.max(1, max);
  const left = Math.max(0, Math.min(total, remaining));
  const held = Math.max(0, Math.min(left, pending));
  parts.fill.style.width = `${((left - held) / total) * 100}%`;
  parts.pending.style.width = `${(held / total) * 100}%`;
  parts.spent.style.width = `${((total - left) / total) * 100}%`;
  parts.count.textContent = String(left);
}

const chargeBarComponent: ResourceComponent = (host, row, ctx, opts) => {
  renderFace(host, row, ctx);
  renderChargeBar(host, { remaining: remainingOf(row), max: row.max });
  renderBandLabel(host, opts);
};

/** The shipped numeric pool widget, kept for the `point-pool` carriers. */
const pointPoolComponent: ResourceComponent = (host, row, ctx, opts) => {
  renderFace(host, row, ctx);
  renderPointPool(host, {
    id: row.key,
    name: row.name,
    used: row.used,
    max: row.max,
    onSet: (newUsed) => writeUsed(row, ctx, newUsed),
  });
  renderBandLabel(host, opts);
};

/** THE TABLE. One entry per control; the key is the note's `rendering_hint`. */
const COMPONENTS: Readonly<Record<string, ResourceComponent>> = {
  counter: counterComponent,
  tally: tallyComponent,
  die: dieComponent,
  pips: pipsComponent,
  "charge-bar": chargeBarComponent,
  "point-pool": pointPoolComponent,
};

/** The hint a row declares, if any. Only an indexed resource carries one. */
export function hintOf(row: ResourceRow): string | undefined {
  return row.kind === "resource" ? row.res.renderingHint : undefined;
}

/**
 * Hint → component. `defaultHint` is what the SURFACE would pick for a row that
 * declares none (hit dice ask for `die`, because a hit die is a face before it
 * is a number); a hint on the note always wins it.
 *
 * An unknown hint and no default pick by MAGNITUDE, the rule the sheet already
 * had: the at-will sentinel and anything a pip track can hold draw pips, a
 * larger pool draws the counter. The sentinel is tested FIRST because 999 also
 * clears `CHARGE_BOX_LIMIT`, and a counter over a number that means "unlimited"
 * would read `999 / 999`.
 */
export function pickResourceComponent(row: ResourceRow, defaultHint?: string): ResourceComponent {
  const hint = hintOf(row) ?? defaultHint;
  if (hint !== undefined && Object.prototype.hasOwnProperty.call(COMPONENTS, hint)) return COMPONENTS[hint];
  if (row.max === AT_WILL_MAX || row.max <= CHARGE_BOX_LIMIT) return pipsComponent;
  return counterComponent;
}
