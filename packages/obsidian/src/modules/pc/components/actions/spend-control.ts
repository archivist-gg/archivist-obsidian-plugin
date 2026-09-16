import type { ResourceConsumption } from "@archivist-gg/dnd5e/types/resource";
import { resolveScalingDie } from "@archivist-gg/dnd5e/dnd/resource-die";
import { resourceLevelFor } from "@archivist-gg/dnd5e/pc/pc.resources";
import { warnOnce } from "@archivist-gg/dnd5e/dnd/warn-once";
import type { ComponentRenderContext } from "../component.types";
import { RESET_LABELS } from "./reset-labels";
import { EXPEND_CONDITION_LABELS } from "./expend-condition-labels";
import { renderChargeBar, setChargeBar } from "../resources/component-catalogue";

/** U+2212 MINUS SIGN — the glyph every stepper on the sheet ships; not a hyphen. */
const MINUS = "−";

/**
 * The ONE spend control (R4-G4 §3.2.2): `consumes.resource` IS the `feature_uses` key.
 *
 * Present, so the character owns the resource: a button "Spend N <name>", where <name> is the
 * resource's `name` VERBATIM from `resolved.resources`, never singularized (invariant 3: the data
 * says "Superiority Dice"), and the die label is appended when the index entry carries a die,
 * resolved at the OWNER's class level through `resourceLevelFor`. The button is disabled when fewer
 * than N remain and writes `spendFeatureUse(id, N)`.
 *
 * ABSENT key, so nothing was seeded (a cross-book id, a dangling ref, the other edition's id):
 * nothing is rendered and ONE `warnOnce` per id fires (§13: no pool is synthesised from a spender).
 *
 * The ABSENCE rule for the INDEX (§3.2.2, a different case from the absent key): a present key whose
 * index entry is missing renders the RAW id as <name> with no die label and never throws, so a
 * fixture that casts a `ResolvedCharacter` without `resources` still gets a working control.
 *
 * A RANGE (`consumes.amount_max > consumes.amount`) takes the other branch: a stepper, a bare `Spend`
 * pill and a charge bar, all on one line ({@link renderRangeSpend}). The chosen quantity goes to
 * `spendFeatureUse`, which is already a clamped quantity-taking primitive, so the branch adds a
 * PICKER and no new arithmetic. `amount_max` has zero emitted carriers in shipped data today, so this
 * branch is reachable only from authored data.
 *
 * `free_uses` and `expend_condition` render as captions from `RESET_LABELS` and
 * `EXPEND_CONDITION_LABELS`; their SEMANTICS (the auto-free first use, spending only on a failed
 * roll) are G8's, not this control's.
 *
 * Returns the BUTTON, or null when nothing was rendered; the `pc-spend` wrapper holds the captions.
 */
export function renderSpendControl(host: HTMLElement, opts: { consumes: ResourceConsumption; ctx: ComponentRenderContext }): HTMLElement | null {
  const { consumes, ctx } = opts;
  const id = consumes.resource;
  if (!id) return null;
  const fu = ctx.resolved.state.feature_uses?.[id];
  if (!fu) {
    warnOnce(`spend-control:${id}`, `spend control: "${id}" is not an owned resource (cross-book or dangling); no control rendered`);
    return null;
  }
  const res = ctx.resolved.resources?.get(id);
  const name = res?.name ?? id;
  const die = res?.die ? resolveScalingDie(res.die, resourceLevelFor(res.owner.source, ctx.resolved)) : undefined;
  const amount = consumes.amount;
  const wrap = host.createDiv({ cls: "pc-spend" });
  const btn = consumes.amount_max !== undefined && consumes.amount_max > amount
    ? renderRangeSpend(wrap, { id, consumes, ctx, remaining: fu.max - fu.used, max: fu.max, amountMax: consumes.amount_max })
    : renderFixedSpend(wrap, { id, ctx, amount, label: `Spend ${amount} ${name}${die ? ` (${die})` : ""}`, remaining: fu.max - fu.used });
  if (consumes.free_uses) {
    const n = consumes.free_uses.amount;
    // The plural on "use" is English copy for a counted caption, not game vocabulary: the resource
    // NAME above is never touched.
    wrap.createSpan({ cls: "pc-spend-caption", text: `${n} free use${n === 1 ? "" : "s"} / ${RESET_LABELS[consumes.free_uses.reset]}` });
  }
  if (consumes.expend_condition) wrap.createSpan({ cls: "pc-spend-caption", text: EXPEND_CONDITION_LABELS[consumes.expend_condition] });
  return btn;
}

/** The shipped single-amount control: one button, the whole spend in its label. */
function renderFixedSpend(
  wrap: HTMLElement,
  o: { id: string; ctx: ComponentRenderContext; amount: number; label: string; remaining: number },
): HTMLElement {
  const btn = wrap.createEl("button", { cls: "pc-spend-control", text: o.label });
  btn.disabled = o.remaining < o.amount;
  btn.addEventListener("click", (e) => { e.stopPropagation(); o.ctx.editState?.spendFeatureUse(o.id, o.amount); });
  return btn;
}

/**
 * THE RANGE SPEND (`consumes.amount_max > consumes.amount`) — one row, one line:
 * a crimson stepper, the `Spend` pill, and a charge bar with its count beside the
 * track.
 *
 * The bar is the readout, so the button's label stops counting: the number the
 * spend takes is in the field the player just set, and the bar shows what it
 * leaves. The hatched zone is what has already been spent — it carries no figure
 * of its own, because that is what the hatching is FOR, and a second number
 * beside the first only makes the reader do the subtraction the bar already did.
 *
 * The pending zone previews the spend against the remainder while the stepper
 * moves, so the cost is visible before the click rather than after it.
 *
 * `spendFeatureUse` already floors and truncates its quantity, so the clamp here
 * is about what the CONTROL may offer — never below the declared minimum, never
 * above the declared maximum, never more than is left.
 */
function renderRangeSpend(
  wrap: HTMLElement,
  o: { id: string; consumes: ResourceConsumption; ctx: ComponentRenderContext; remaining: number; max: number; amountMax: number },
): HTMLElement {
  const min = o.consumes.amount;
  const ceiling = (): number => Math.max(min, Math.min(o.amountMax, o.remaining));
  const spendable = o.remaining >= min;
  // Opens at the declared minimum — the cheapest thing the feature can do, which
  // is also the only quantity the shipped single-amount control ever offered.
  // `sync()` clamps it against what is actually left.
  let qty = min;

  wrap.addClass("pc-spend-range");
  const step = wrap.createSpan({ cls: "pc-step" });
  const dec = step.createEl("button", { cls: "pc-step-btn pc-step-minus", text: MINUS, attr: { "aria-label": "One fewer" } });
  const field = step.createEl("input", {
    cls: "pc-step-input",
    attr: { type: "number", min: String(min), max: String(ceiling()), "aria-label": `Amount of ${o.consumes.resource ?? "resource"} to spend` },
  });
  const inc = step.createEl("button", { cls: "pc-step-btn pc-step-plus", text: "+", attr: { "aria-label": "One more" } });

  const btn = wrap.createEl("button", { cls: "pc-spend-control", text: "Spend" });
  const bar = renderChargeBar(wrap, { remaining: o.remaining, max: o.max, pending: 0, inline: true });

  const sync = (): void => {
    qty = Math.max(min, Math.min(ceiling(), Math.floor(qty) || min));
    field.value = String(qty);
    dec.disabled = !spendable || qty <= min;
    inc.disabled = !spendable || qty >= ceiling();
    field.disabled = btn.disabled = !spendable;
    setChargeBar(bar, o.remaining, o.max, spendable ? qty : 0);
  };

  dec.addEventListener("click", (e) => { e.stopPropagation(); qty -= 1; sync(); });
  inc.addEventListener("click", (e) => { e.stopPropagation(); qty += 1; sync(); });
  field.addEventListener("click", (e) => e.stopPropagation());
  field.addEventListener("input", () => { qty = Number(field.value); sync(); });
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!spendable) return;
    o.ctx.editState?.spendFeatureUse(o.id, qty);
  });
  sync();
  return btn;
}
