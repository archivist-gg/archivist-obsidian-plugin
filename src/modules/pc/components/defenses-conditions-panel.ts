import type { SheetComponent, ComponentRenderContext } from "./component.types";
import { openConditionsPopover } from "./conditions-popover";

const DEFENSE_ROWS: ReadonlyArray<[label: string, key: "resistances" | "immunities" | "vulnerabilities" | "condition_immunities"]> = [
  ["Damage Resistances", "resistances"],
  ["Damage Immunities", "immunities"],
  ["Damage Vulnerabilities", "vulnerabilities"],
  ["Condition Immunities", "condition_immunities"],
];

/**
 * Merged Defenses + Conditions panel. Single .pc-panel with vertical divider.
 * Left: monster-style property-lines. "none" shown once if all four are empty.
 * Right: active condition chips + static "+" button (SP4 wires the picker).
 */
export class DefensesConditionsPanel implements SheetComponent {
  readonly type = "defenses-conditions-panel";

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const panel = el.createDiv({ cls: "pc-panel pc-def-cond" });

    const left = panel.createDiv({ cls: "pc-def-cond-left" });
    left.createDiv({ cls: "pc-def-cond-title", text: "DEFENSES" });
    const def = ctx.derived.defenses;
    const anyDef = DEFENSE_ROWS.some(([, k]) => (def[k]?.length ?? 0) > 0);
    if (!anyDef) {
      left.createDiv({ cls: "pc-def-cond-empty", text: "none" });
    } else {
      for (const [label, key] of DEFENSE_ROWS) {
        const vals = def[key] ?? [];
        if (vals.length === 0) continue;
        const p = left.createEl("p", { cls: "pc-def-line" });
        p.createEl("b", { text: label });
        p.createSpan({ text: " " + vals.join(", ") });
      }
    }

    const right = panel.createDiv({ cls: "pc-def-cond-right" });
    const head = right.createDiv({ cls: "pc-def-cond-head" });
    head.createDiv({ cls: "pc-def-cond-title", text: "CONDITIONS" });
    const addBtn = head.createEl("button", {
      cls: "pc-cond-add",
      text: "+",
      attr: { title: "Add condition" },
    });
    if (ctx.editState) {
      addBtn.addEventListener("click", () => openConditionsPopover(addBtn, ctx));
    }

    const conds = ctx.resolved?.state?.conditions ?? [];
    const body = right.createDiv({ cls: "pc-cond-body" });
    if (conds.length === 0) {
      body.createDiv({ cls: "pc-cond-empty", text: "no active conditions" });
    } else {
      for (const c of conds) {
        const chip = body.createSpan({ cls: "pc-cond-chip", text: c });
        if (ctx.editState) {
          const x = chip.createSpan({ cls: "pc-cond-chip-x", text: "×" });
          x.addEventListener("click", (e) => {
            e.stopPropagation();
            ctx.editState!.toggleCondition(c);
          });
        }
      }
    }
  }
}
