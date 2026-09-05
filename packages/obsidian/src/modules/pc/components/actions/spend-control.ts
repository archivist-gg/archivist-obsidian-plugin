import type { ResourceConsumption } from "@archivist-gg/dnd5e/types/resource";
import { resolveScalingDie } from "@archivist-gg/dnd5e/dnd/resource-die";
import { resourceLevelFor } from "@archivist-gg/dnd5e/pc/pc.resources";
import { warnOnce } from "@archivist-gg/dnd5e/dnd/warn-once";
import type { ComponentRenderContext } from "../component.types";
import { RESET_LABELS } from "./reset-labels";
import { EXPEND_CONDITION_LABELS } from "./expend-condition-labels";

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
  const btn = wrap.createEl("button", { cls: "pc-spend-control", text: `Spend ${amount} ${name}${die ? ` (${die})` : ""}` });
  btn.disabled = fu.max - fu.used < amount;
  btn.addEventListener("click", (e) => { e.stopPropagation(); ctx.editState?.spendFeatureUse(id, amount); });
  if (consumes.free_uses) {
    const n = consumes.free_uses.amount;
    // The plural on "use" is English copy for a counted caption, not game vocabulary: the resource
    // NAME above is never touched.
    wrap.createSpan({ cls: "pc-spend-caption", text: `${n} free use${n === 1 ? "" : "s"} / ${RESET_LABELS[consumes.free_uses.reset]}` });
  }
  if (consumes.expend_condition) wrap.createSpan({ cls: "pc-spend-caption", text: EXPEND_CONDITION_LABELS[consumes.expend_condition] });
  return btn;
}
