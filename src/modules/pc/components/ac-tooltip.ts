import type { ACTerm } from "../pc.types";
import type { InformationalBonus } from "../../item/item.conditions.types";
import { conditionsToText } from "../../item/item.conditions";

export interface ACTooltipOpts {
  ac: number;
  breakdown: ACTerm[];
  overridden: boolean;
  informational?: InformationalBonus[];
}

export function renderACTooltip(parent: HTMLElement, opts: ACTooltipOpts): HTMLElement {
  const tip = parent.createDiv({ cls: "pc-ac-tooltip" });
  const header = tip.createDiv({ cls: "pc-ac-tooltip-total" });
  header.setText(`Armor Class: ${opts.ac}${opts.overridden ? "  (overridden)" : ""}`);
  if (opts.overridden) {
    tip.createDiv({ cls: "pc-ac-tooltip-row pc-ac-tooltip-override", text: `Override: ${opts.ac}` });
    tip.createDiv({ cls: "pc-ac-tooltip-divider", text: "── underlying ──" });
  }
  for (const t of opts.breakdown) {
    const row = tip.createDiv({ cls: `pc-ac-tooltip-row${opts.overridden ? " is-greyed" : ""}` });
    row.createSpan({ cls: "pc-ac-tooltip-source", text: t.source });
    row.createSpan({ cls: "pc-ac-tooltip-amount", text: formatSignedAmount(t.amount) });
  }

  const info = opts.informational ?? [];
  if (info.length > 0) {
    tip.createDiv({ cls: "pc-ac-tooltip-divider", text: "── situational ──" });
    for (const i of info) {
      const row = tip.createDiv({ cls: "pc-ac-tooltip-row pc-ac-tooltip-row--situational" });
      row.createSpan({ cls: "pc-ac-tooltip-source", text: i.source });
      row.createSpan({ cls: "pc-ac-tooltip-amount", text: formatSignedAmount(i.value) });
      row.createSpan({ cls: "pc-ac-tooltip-condition", text: conditionsToText(i.conditions) });
    }
  }

  return tip;
}

function formatSignedAmount(n: number): string {
  if (n === 0) return "+0";
  return n > 0 ? `+${n}` : String(n);
}
