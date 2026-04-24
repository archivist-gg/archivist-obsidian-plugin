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
 * Left pane: single `+` button on the title row opens a tabbed picker that
 * selects kind (resistance / immunity / vulnerability / condition immunity)
 * then type. Body shows grouped chips per kind — empty kinds are hidden, and
 * when nothing is set the body shows "no active defenses".
 * Right pane: conditions chips + exhaustion + `+` (unchanged from SP4).
 */
export class DefensesConditionsPanel implements SheetComponent {
  readonly type = "defenses-conditions-panel";

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const panel = el.createDiv({ cls: "pc-panel pc-def-cond" });

    // ─── Left pane: DEFENSES ───────────────────────────────────────
    const left = panel.createDiv({ cls: "pc-def-cond-left" });
    const leftHead = left.createDiv({ cls: "pc-def-cond-head" });
    leftHead.createDiv({ cls: "pc-def-cond-title", text: "DEFENSES" });
    if (ctx.editState) {
      const defAdd = leftHead.createEl("button", {
        cls: "pc-def-add-main",
        text: "+",
        attr: { title: "Add defense" },
      });
      defAdd.addEventListener("click", (e) => {
        e.stopPropagation();
        openDefenseTypePopover(defAdd, ctx);
      });
    }

    const def = ctx.derived.defenses;
    const leftBody = left.createDiv({ cls: "pc-def-body" });
    const allEmpty = DEFENSE_ROWS.every(([, key]) => (def[key] ?? []).length === 0);
    if (allEmpty) {
      leftBody.createDiv({ cls: "pc-def-empty", text: "no active defenses" });
    } else {
      for (const [label, key] of DEFENSE_ROWS) {
        const vals = def[key] ?? [];
        if (vals.length === 0) continue;
        const row = leftBody.createEl("p", { cls: "pc-def-line" });
        row.createEl("b", { text: label });
        row.appendText(" ");
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
      }
    }

    // ─── Right pane: CONDITIONS (unchanged from SP4) ───────────────
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
