import type { InformationalBonus } from "../../item/item.conditions.types";
import { attachStatTooltip } from "./stat-tooltip";
import { renderSituationalRows } from "./situational-rows";

type Term = { source: string; amount: number };

/** The same base/bonus/override reading as the AC hover, for the other numbers. */
export function attachStatBreakdown(
  anchor: HTMLElement,
  opts: { title: string; total: number; terms?: Term[]; overridden?: boolean; informational?: InformationalBonus[]; unit?: string },
): void {
  attachStatTooltip(anchor, (host) => {
    const display = (n: number, signed = true) => opts.unit
      ? `${signed && n > 0 ? "+" : ""}${n} ${opts.unit}`
      : n >= 0 ? `+${n}` : `−${Math.abs(n)}`;
    host.createDiv({ cls: "pc-stat-tooltip-title", text: `${opts.title}: ${display(opts.total, false)}${opts.overridden ? " (overridden)" : ""}` });
    if (opts.overridden) {
      host.createDiv({ cls: "pc-ac-tooltip-row pc-ac-tooltip-override", text: `Override: ${display(opts.total, false)}` });
      host.createDiv({ cls: "pc-ac-tooltip-divider", text: "── underlying ──" });
    }
    for (const term of opts.terms ?? [{ source: "Original", amount: opts.total }]) {
      const row = host.createDiv({ cls: `pc-ac-tooltip-row${opts.overridden ? " is-greyed" : ""}` });
      row.createSpan({ cls: "pc-ac-tooltip-source", text: term.source });
      row.createSpan({ cls: "pc-ac-tooltip-amount", text: display(term.amount, term.source !== "Base speed" && term.source !== "Original") });
    }
    if (opts.informational?.length) {
      host.createDiv({ cls: "pc-ac-tooltip-divider", text: "── situational ──" });
      renderSituationalRows(host, opts.informational);
    }
  });
}
