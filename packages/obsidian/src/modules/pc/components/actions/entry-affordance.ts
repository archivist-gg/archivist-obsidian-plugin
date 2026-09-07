import type { ComponentRenderContext } from "../component.types";
import type { ResolvedPoolEntry } from "@archivist-gg/dnd5e/pc/pc.types";
import { deriveEntryAffordance, formatAffordanceCaption } from "@archivist-gg/dnd5e/pc/pool-layout";
import { resolveScalingDie } from "@archivist-gg/dnd5e/dnd/resource-die";
import { resourceLevelFor } from "@archivist-gg/dnd5e/pc/pc.resources";
import { renderPickTracker } from "./pick-tracker";

/**
 * The per-ROW affordance route (R4-G5 §4.2.2 a). The entry's own `rendering_hint` is mapped through the
 * dnd5e table `RENDERING_HINT_AFFORDANCE` (own-property guarded there), so this renderer carries no
 * switch on game vocabulary and no slug literal: one lookup, one caption table, one formatter.
 *
 * FOUR call sites at this head, measured with `grep -rn "renderAffordanceCaption(" packages/obsidian/src`:
 * `PoolTab.row`, `PoolTab.grantedRow` and `PoolTab.blockCard` (`../pool-tab`) and `renderBoonRow`
 * (`./boon-rows`). They live in two files that must not import each other, which is why this module
 * exists rather than a helper inside either.
 *
 * The caption is the ONLY new information on the row: the recipient. The shipped
 * "Spend 1 Superiority Dice (d8)" control beside it is untouched, and the die string is resolved HERE,
 * by the same ternary `spend-control.ts` carries verbatim, because `formatAffordanceCaption` is a pure
 * template substitution in the engine and the engine does not know the character's level.
 *
 * THREE guards, each with its case: no affordance (39 of the 43 maneuvers, Parry among them); no INDEX
 * entry for the consumed resource (a cast `ResolvedCharacter` without `resources`, and a cross-edition
 * pick whose owner id the character does not own · a STRICTER guard than the spend control's, which
 * gates on the `feature_uses` key alone); and no die on that entry, which would otherwise print an
 * empty face (no shipped granted-die owner is die-less: both editions' superiority dice carry
 * `die: { base: "d8" }`).
 */
export function renderAffordanceCaption(
  host: HTMLElement,
  entry: ResolvedPoolEntry,
  ctx: ComponentRenderContext,
): void {
  const affordance = deriveEntryAffordance(entry.entity);
  if (!affordance) return;
  const consumes = entry.entity.consumes;
  if (!consumes?.resource) return;
  const res = ctx.resolved.resources?.get(consumes.resource);
  if (!res) return;
  const die = res.die ? resolveScalingDie(res.die, resourceLevelFor(res.owner.source, ctx.resolved)) : undefined;
  if (!die) return;
  host.createSpan({
    cls: "pc-affordance-caption",
    text: formatAffordanceCaption(affordance, { amount: consumes.amount, die }),
  });
}

/**
 * The Active toggle and the pick's own `uses` tracker inside ONE `.pc-buff-group` (R4-G5 §4.2.2 b), so
 * a rune or boon that carries both reads as one control cluster instead of two things at opposite ends
 * of the row, and the pair wraps as a unit at narrow widths.
 *
 * TWO call sites at this head, measured with `grep -rn "renderControlGroup(" packages/obsidian/src`:
 * `renderBoonRow`'s SELECTED arm (`./boon-rows`) and `PoolTab.row` (`../pool-tab`). `grantedRow` and
 * `blockCard` call it not at all: a granted entry is auto-on and takes no toggle, and the block card
 * takes no tracker.
 *
 * The group element is a LAZY THUNK on `renderPoolHead`'s shipped `headEl()` precedent: it is created by
 * the first child that actually renders, so a row with neither a toggle nor a tracker emits NO element
 * (a Warlock 20's invocation tab draws 59 candidate rows, and an empty flex box on each would be 59
 * empty boxes). That is why the thunk is threaded into `renderPickTracker` rather than an element: the
 * tracker's own `if (!fu || !res) return;` guard runs FIRST and the host is resolved behind it.
 *
 * `order` is the one difference the two sites' shipped DOM carries and is therefore a parameter, not a
 * convention: the boon row has always read toggle-then-tracker and the pool row tracker-then-toggle.
 * The spend control is a SIBLING of the group at both sites, created after it.
 */
export function renderControlGroup(
  host: HTMLElement,
  entry: ResolvedPoolEntry,
  ctx: ComponentRenderContext,
  opts: { selected: boolean; order: "toggle-first" | "tracker-first" },
): void {
  let group: HTMLElement | undefined;
  const groupEl = (): HTMLElement => (group ??= host.createDiv({ cls: "pc-buff-group" }));
  const toggle = (): void => {
    if (!opts.selected || !entry.entity.activatable) return;
    const active = (ctx.resolved.state.active_buffs ?? []).includes(entry.slug);
    const btn = groupEl().createEl("button", {
      cls: `pc-pool-active${active ? " on" : ""}`,
      text: active ? "Active" : "Activate",
    });
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      ctx.editState?.toggleActiveBuff(entry.slug);
    });
  };
  const tracker = (): void => renderPickTracker(groupEl, entry, ctx);
  if (opts.order === "toggle-first") { toggle(); tracker(); } else { tracker(); toggle(); }
}
