import type { SheetComponent, ComponentRenderContext } from "./component.types";
import { openConditionsPopover } from "./conditions-popover";
import { openDefenseTypePopover, type DefenseKind } from "./defense-type-popover";
import { setConditionIcon, setExhaustionIcon } from "../assets/condition-icons";
import { CONDITION_DISPLAY_NAMES, type ConditionSlug } from "../constants/conditions";

const DEFENSE_ROWS: ReadonlyArray<[label: string, key: DefenseKind]> = [
  ["Damage Resistances", "resistances"],
  ["Damage Immunities", "immunities"],
  ["Damage Vulnerabilities", "vulnerabilities"],
  ["Condition Immunities", "condition_immunities"],
];

/**
 * Merged Defenses + Conditions panel.
 * Left pane (SP4b): four editable rows, always visible. Each row has chips
 * for the current values (× removes) and a "+" button that opens the
 * defense-type popover scoped to that row.
 * Right pane: conditions chips + exhaustion + "+" (unchanged from SP4).
 */
export class DefensesConditionsPanel implements SheetComponent {
  readonly type = "defenses-conditions-panel";

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const panel = el.createDiv({ cls: "pc-panel pc-def-cond" });

    const left = panel.createDiv({ cls: "pc-def-cond-left" });
    left.createDiv({ cls: "pc-def-cond-title", text: "DEFENSES" });
    const def = ctx.derived.defenses;
    for (const [label, key] of DEFENSE_ROWS) {
      const row = left.createEl("p", { cls: "pc-def-line" });
      row.createEl("b", { text: label });
      row.appendText(" ");
      const vals = def[key] ?? [];
      for (const v of vals) {
        const chip = row.createSpan({ cls: "pc-def-chip" });
        const displayText = key === "condition_immunities"
          ? (CONDITION_DISPLAY_NAMES[v as ConditionSlug] ?? v)
          : v;
        chip.createSpan({ cls: "pc-def-chip-label", text: displayText });
        if (ctx.editState) {
          const x = chip.createSpan({ cls: "pc-def-chip-x", text: "×" });
          const editState = ctx.editState;
          x.addEventListener("click", (e) => {
            e.stopPropagation();
            if (key === "condition_immunities") {
              editState.removeConditionImmunity(v as ConditionSlug);
            } else {
              editState.removeDefense(key, v);
            }
          });
        }
      }
      if (ctx.editState) {
        const addBtn = row.createEl("button", {
          cls: "pc-def-add",
          text: "+",
          attr: { title: `Add ${label.toLowerCase()}` },
        });
        addBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          openDefenseTypePopover(addBtn, key, ctx);
        });
      }
    }

    // Right pane — unchanged from SP4
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
