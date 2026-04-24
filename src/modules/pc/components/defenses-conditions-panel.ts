import type { SheetComponent, ComponentRenderContext } from "./component.types";
import { openConditionsPopover } from "./conditions-popover";
import { setConditionIcon, setExhaustionIcon } from "../assets/condition-icons";
import { CONDITION_DISPLAY_NAMES } from "../constants/conditions";

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
    const exhaustion = ctx.resolved?.state?.exhaustion ?? 0;
    const body = right.createDiv({ cls: "pc-cond-body" });
    if (conds.length === 0 && exhaustion === 0) {
      body.createDiv({ cls: "pc-cond-empty", text: "no active conditions" });
    } else {
      // Exhaustion pill — surfaces level set via the popover so users can
      // see it on the sheet and click through to adjust without re-opening
      // the "+" button each time.
      if (exhaustion > 0) {
        const chip = body.createSpan({ cls: "pc-cond-chip pc-cond-chip-exhaustion" });
        const iconWrap = chip.createSpan({ cls: "pc-cond-chip-icon" });
        setExhaustionIcon(iconWrap);
        chip.createSpan({ cls: "pc-cond-chip-label", text: `Exhaustion ${exhaustion}` });
        if (ctx.editState) {
          chip.addEventListener("click", () => openConditionsPopover(addBtn, ctx));
        }
      }
      for (const c of conds) {
        const chip = body.createSpan({ cls: "pc-cond-chip" });
        const iconWrap = chip.createSpan({ cls: "pc-cond-chip-icon" });
        setConditionIcon(iconWrap, c);
        chip.createSpan({ cls: "pc-cond-chip-label", text: CONDITION_DISPLAY_NAMES[c] });
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
