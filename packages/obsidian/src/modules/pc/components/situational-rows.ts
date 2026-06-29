import type { InformationalBonus } from "../../item/item.conditions.types";
import { conditionsToText } from "../../item/item.conditions";

function formatSignedAmount(n: number): string {
  if (n === 0) return "+0";
  return n > 0 ? `+${n}` : String(n);
}

/** Shared renderer for "Situational" bonus rows across AC / saves / spell /
 *  speed tooltips and the attack table. Renders nothing when `info` is empty.
 *  Pass `opts.divider` to prepend a "── situational ──" caption.
 *
 *  Pass `opts.fieldLabel` to render a per-row field caption (e.g. the weapons
 *  table maps `weapon_attack`→"to hit", `weapon_damage`→"dmg") between the
 *  amount and the condition. When omitted — or when it returns an empty string
 *  for a row's field — no label span is rendered (AC/saves/spell/speed). */
export function renderSituationalRows(
  parent: HTMLElement,
  info: InformationalBonus[],
  opts: { divider?: boolean; fieldLabel?: (field: string) => string } = {},
): void {
  if (info.length === 0) return;
  if (opts.divider) {
    parent.createDiv({ cls: "pc-situational-divider", text: "── situational ──" });
  }
  for (const i of info) {
    const row = parent.createDiv({ cls: "pc-situational-row" });
    row.createSpan({ cls: "pc-situational-source", text: i.source });
    row.createSpan({ cls: "pc-situational-amount", text: formatSignedAmount(i.value) });
    const label = opts.fieldLabel?.(i.field);
    if (label) row.createSpan({ cls: "pc-situational-field", text: label });
    row.createSpan({ cls: "pc-situational-condition", text: conditionsToText(i.conditions) });
  }
}
