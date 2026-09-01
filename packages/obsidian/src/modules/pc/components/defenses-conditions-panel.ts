import { setTooltip } from "obsidian";
import type { SheetComponent, ComponentRenderContext } from "./component.types";
import { openConditionsPopover } from "./conditions-popover";
import {
  openDefenseTypePopover,
  refreshDefenseTypePopover,
  type DefenseKind,
} from "./defense-type-popover";
import { setConditionIcon, setExhaustionIcon } from "../assets/condition-icons";
import type { PCServices } from "../pc.services";
import {
  buildConditionEntityMap,
  conditionDisplayName,
  conditionLabelMapFrom,
  conditionTooltipParagraph,
} from "../condition-labels";
import { hiddenCompendiumSet } from "../../../shared/entities/compendium-visibility";

const DEFENSE_ROWS: ReadonlyArray<[label: string, key: DefenseKind]> = [
  ["Damage Resistances", "resistances"],
  ["Damage Immunities", "immunities"],
  ["Damage Vulnerabilities", "vulnerabilities"],
  ["Condition Immunities", "condition_immunities"],
];

/**
 * The chip tooltip: engine-computed lines first, the condition entity's authored
 * first paragraph under them (spec §6). One expression covers all three cases —
 * lines only (byte-identical to what shipped), lines + authored, and authored
 * ALONE when the engine produced no lines at all, which is the case today's
 * guard left with no tooltip whatsoever (Gate 2 I-9). Empty result means the
 * caller sets no tooltip, so an unresolvable entity leaves behaviour unchanged.
 */
function conditionChipTooltip(effects: readonly string[], authored: string): string {
  return [effects.join("\n"), authored].filter((part) => part.length > 0).join("\n\n");
}

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

    // ONE `search("", "condition", ∞)` for the whole render pass: the chips need
    // both the entity NAME (labels) and its authored `description` (tooltips),
    // so the entity map is built once and the label map derived from it. The
    // cast is not cosmetic: several sheet render paths hand components a ctx
    // whose `services` is absent or partial, and the builder is fail-open on
    // exactly that (see condition-labels.ts) — an empty map reproduces the
    // retired `CONDITION_DISPLAY_NAMES` spellings byte for byte.
    const services = ctx.services as Partial<PCServices> | undefined;
    const conditionEntities = buildConditionEntityMap(
      services?.entities,
      hiddenCompendiumSet(services?.plugin?.settings),
    );
    const conditionLabels = conditionLabelMapFrom(conditionEntities);

    // ─── Left pane: DEFENSES ───────────────────────────────────────
    const left = panel.createDiv({ cls: "pc-def-cond-left" });
    const leftHead = left.createDiv({ cls: "pc-def-cond-head" });
    leftHead.createDiv({ cls: "pc-def-cond-title", text: "DEFENSES" });
    let defAdd: HTMLButtonElement | null = null;
    if (ctx.editState) {
      defAdd = leftHead.createEl("button", {
        cls: "pc-def-add-main",
        text: "+",
        attr: { title: "Add defense" },
      });
      // A `const` alias for the handler: `defAdd` is a `let`, which TypeScript
      // will not narrow to non-null inside a closure.
      const addBtn = defAdd;
      addBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openDefenseTypePopover(addBtn, ctx);
      });
    }
    // Repaint an open defense picker from THIS render's ctx, and rebind it to the
    // `+` above · the one it was opened against has just been destroyed. Called
    // UNCONDITIONALLY, as `HpWidget.render`, `SpellsTab.render` and
    // `ProficienciesPanel.render` call their own refreshers: the refresher already
    // no-ops when nothing is open, and a read-mode render is precisely the pass
    // that has to CLOSE the picker rather than skip it. It cannot sit at the TOP of
    // render the way those three do, because the anchor it rebinds to is created
    // directly above it; read mode builds no `+` at all, so `null` goes in and
    // `refreshDefenseTypePopover`'s editState guard closes the picker before any
    // anchor is read.
    refreshDefenseTypePopover(ctx, defAdd);

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
        for (const entry of vals) {
          // `data-type` is the canonical slug, and it is ADDRESSING, not decoration: without it
          // the only thing separating two chips in a row is POSITION, so `.pc-def-chip-x`
          // resolves to the first and naming the second needs an order-fragile `:nth-child`.
          // Do not substitute `.granted` for it · that class is display policy, and it happens
          // to single a chip out only for some characters.
          // NOT a unique address, by design: the same slug in two buckets (resistances AND
          // immunities to fire) renders two chips that both match `[data-type="fire"]`, because
          // neither the chip nor its `p.pc-def-line` carries the bucket. A `data-bucket` on the
          // row would close that; no surface needs it yet.
          const chip = row.createSpan({ cls: "pc-def-chip", attr: { "data-type": entry.value } });
          if (entry.origin !== "manual") chip.addClass("granted");
          // `value` is canonical (toDefenseSlug); `label` is the first-spelling-wins
          // authored display string. Condition immunities get the registered
          // condition entity's name, keyed on the canonical value, and fall back to
          // the authored label.
          // DELIBERATELY NON-TOTAL (spec §6's stated exception): this is the one
          // site that must NOT use `conditionDisplayName`. Its fallback is the
          // AUTHORED label, because an out-of-vocabulary condition immunity
          // ("Bewildered") carries a real authored spelling that a title-cased slug
          // would silently replace.
          const displayText = key === "condition_immunities"
            ? (conditionLabels.get(entry.value) ?? entry.label)
            : entry.label;
          chip.createSpan({ cls: "pc-def-chip-label", text: displayText });
          if (ctx.editState) {
            const x = chip.createSpan({ cls: "pc-def-chip-x", text: "×" });
            const editState = ctx.editState;
            x.addEventListener("click", (e) => {
              e.stopPropagation();
              // Mutators key on the canonical value, never the display label.
              if (key === "condition_immunities") {
                // No cast: R4-P5 C-1 widened the parameter to `string`, because the picker
                // unions in whatever `derived.condition_immunities` holds.
                editState.removeConditionImmunity(entry.value);
              } else {
                editState.removeDefense(key, entry.value);
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
    const ce = ctx.derived.conditionEffects;
    const body = right.createDiv({ cls: "pc-cond-body" });
    if (conds.length === 0 && exhaustion === 0) {
      body.createDiv({ cls: "pc-cond-empty", text: "no active conditions" });
    } else {
      if (exhaustion > 0) {
        const chip = body.createSpan({ cls: "pc-cond-chip pc-cond-chip-exhaustion" });
        const iconWrap = chip.createSpan({ cls: "pc-cond-chip-icon" });
        setExhaustionIcon(iconWrap);
        // Exhaustion is a 15th condition ENTITY (it never lived in the retired
        // table, whose 14 slugs are the boolean vocabulary), so its label comes
        // from the same map. Parity baseline is the inline literal this replaces:
        // `Exhaustion ${exhaustion}`.
        chip.createSpan({
          cls: "pc-cond-chip-label",
          text: `${conditionDisplayName("exhaustion", conditionLabels)} ${exhaustion}`,
        });
        const exhaustionTip = conditionChipTooltip(
          ce?.sources.find((s) => s.condition === "exhaustion")?.effects ?? [],
          conditionTooltipParagraph(conditionEntities.get("exhaustion")),
        );
        if (exhaustionTip.length > 0) setTooltip(chip, exhaustionTip);
        if (ctx.editState) {
          chip.addEventListener("click", () => openConditionsPopover(addBtn, ctx));
        }
      }
      for (const c of conds) {
        const chip = body.createSpan({ cls: "pc-cond-chip" });
        const iconWrap = chip.createSpan({ cls: "pc-cond-chip-icon" });
        setConditionIcon(iconWrap, c);
        chip.createSpan({ cls: "pc-cond-chip-label", text: conditionDisplayName(c, conditionLabels) });
        const chipTip = conditionChipTooltip(
          ce?.sources.find((s) => s.condition === c)?.effects ?? [],
          conditionTooltipParagraph(conditionEntities.get(c)),
        );
        if (chipTip.length > 0) setTooltip(chip, chipTip);
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
