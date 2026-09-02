import type { ACTerm } from "@archivist-gg/dnd5e/pc/pc.types";
import type { InformationalBonus } from "../../item/item.conditions.types";
import { renderSituationalRows } from "./situational-rows";
import { plainText } from "../../../shared/rendering/plain-text";

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
    // The term's situational qualifier, from the granting `ac-bonus` effect (R4-G3a §3.2.5).
    // A `title` rather than a nested line: the row is already inside a tooltip. Authored prose,
    // so markup comes off first; never evaluated.
    if (t.condition) row.setAttribute("title", plainText(t.condition));
    row.createSpan({ cls: "pc-ac-tooltip-source", text: t.source });
    row.createSpan({ cls: "pc-ac-tooltip-amount", text: formatSignedAmount(t.amount) });
  }

  const info = opts.informational ?? [];
  if (info.length > 0) {
    tip.createDiv({ cls: "pc-ac-tooltip-divider", text: "── situational ──" });
    renderSituationalRows(tip, info);
  }

  return tip;
}

function formatSignedAmount(n: number): string {
  if (n === 0) return "+0";
  return n > 0 ? `+${n}` : String(n);
}
