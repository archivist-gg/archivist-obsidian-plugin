import type { ComponentRenderContext } from "../component.types";
import { STANDARD_ACTIONS } from "@archivist-gg/dnd5e/dnd/constants";
import type { Edition } from "@archivist-gg/dnd5e/types/edition";

/** The Actions tab's footer: the standard combat actions of the CHARACTER'S edition (R4-G7 T8 RIDER-22). The list is
 *  dnd5e's `STANDARD_ACTIONS` table; this renderer once held a 16-name union of both editions, so a 2014 character read
 *  Utilize and never Use an Object. A definition with no known edition (unreachable through the schema, which requires
 *  one) renders no block rather than guessing an edition. */
export function renderStandardActionsList(parent: HTMLElement, ctx: ComponentRenderContext): HTMLElement | null {
  const edition = ctx.resolved.definition?.edition as Edition | undefined;
  const actions = edition ? STANDARD_ACTIONS[edition] : undefined;
  if (!actions) return null;
  const block = parent.createDiv({ cls: "pc-standard-actions" });
  block.createDiv({ cls: "pc-standard-actions-title", text: "Standard combat actions" });
  block.createDiv({ cls: "pc-standard-actions-body", text: actions.join(", ") + "." });
  if (ctx.derived.conditionEffects?.actions_disabled) block.addClass("pc-row-disabled");
  return block;
}
