import type { SheetComponent, ComponentRenderContext } from "../component.types";
import { makeInlineInput } from "../edit-primitives";

const COIN_DEFS: { key: "pp" | "gp" | "ep" | "sp" | "cp"; name: string; rate: string; gpFactor: number }[] = [
  { key: "pp", name: "Platinum", rate: "1 pp = 10 gp",  gpFactor: 10 },
  { key: "gp", name: "Gold",     rate: "base",          gpFactor: 1 },
  { key: "ep", name: "Electrum", rate: "1 ep = 0.5 gp", gpFactor: 0.5 },
  { key: "sp", name: "Silver",   rate: "10 sp = 1 gp",  gpFactor: 0.1 },
  { key: "cp", name: "Copper",   rate: "100 cp = 1 gp", gpFactor: 0.01 },
];

export class ManageCoinMode implements SheetComponent {
  readonly type = "manage-coin-mode";

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const root = el.createDiv({ cls: "pc-coin-mgr" });
    const editState = ctx.editState;
    const cur = ctx.resolved.definition.currency ?? { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 };

    let total = 0;
    for (const def of COIN_DEFS) {
      const value = cur[def.key] ?? 0;
      total += value * def.gpFactor;
      const row = root.createDiv({ cls: "pc-coin-row" });
      row.createDiv({ cls: "pc-coin-name", text: def.name });
      row.createDiv({ cls: "pc-coin-rate", text: def.rate });
      const valEl = row.createDiv({ cls: "pc-coin-val", text: String(value) });
      if (editState) {
        valEl.classList.add("editable");
        valEl.addEventListener("click", () => {
          makeInlineInput(valEl, {
            initial: value,
            min: 0,
            max: 999_999,
            onCommit: (n) => editState.setCurrency(def.key, n),
            onCancel: () => { /* re-render handled elsewhere */ },
          });
        });
      }
    }

    const totalRow = root.createDiv({ cls: "pc-coin-total-row" });
    totalRow.createDiv({ cls: "pc-coin-total-lbl", text: "Total in gp" });
    totalRow.createDiv({
      cls: "pc-coin-total-val",
      text: total.toFixed(total % 1 === 0 ? 0 : 2),
    });

    if (editState) {
      const actions = root.createDiv({ cls: "pc-coin-actions" });
      const clearBtn = actions.createEl("button", { cls: "pc-coin-clear", text: "× clear all" });
      clearBtn.addEventListener("click", () => {
        for (const def of COIN_DEFS) editState.setCurrency(def.key, 0);
      });
    }
  }
}
