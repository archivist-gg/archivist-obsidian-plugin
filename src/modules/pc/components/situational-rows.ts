import type { InformationalBonus } from "../../item/item.conditions.types";
import { conditionsToText } from "../../item/item.conditions";

function formatSignedAmount(n: number): string {
  if (n === 0) return "+0";
  return n > 0 ? `+${n}` : String(n);
}

/** Shared renderer for "Situational" bonus rows across AC / saves / spell /
 *  speed tooltips and the attack table. Renders nothing when `info` is empty.
 *  Pass `opts.divider` to prepend a "── situational ──" caption. */
export function renderSituationalRows(
  parent: HTMLElement,
  info: InformationalBonus[],
  opts: { divider?: boolean } = {},
): void {
  if (info.length === 0) return;
  if (opts.divider) {
    parent.createDiv({ cls: "pc-situational-divider", text: "── situational ──" });
  }
  for (const i of info) {
    const row = parent.createDiv({ cls: "pc-situational-row" });
    row.createSpan({ cls: "pc-situational-source", text: i.source });
    row.createSpan({ cls: "pc-situational-amount", text: formatSignedAmount(i.value) });
    row.createSpan({ cls: "pc-situational-condition", text: conditionsToText(i.conditions) });
  }
}
