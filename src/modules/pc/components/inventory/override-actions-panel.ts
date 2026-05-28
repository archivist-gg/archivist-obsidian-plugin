import type { EquipmentEntry } from "../../pc.types";
import type { CharacterEditState } from "../../pc.edit-state";

export interface OverrideActionsPanelOpts {
  entry: EquipmentEntry;
  entryIndex: number;
  editState: CharacterEditState;
}

const COSTS = ["action", "bonus-action", "reaction", "free", "special"] as const;
const RESETS = ["dawn", "short", "long", "special"] as const;

export function renderOverrideActionsPanel(parent: HTMLElement, opts: OverrideActionsPanelOpts): HTMLElement {
  const wrap = parent.createDiv({ cls: "pc-override-actions" });
  wrap.createDiv({ cls: "pc-override-actions-title", text: "Action overrides" });

  const grid = wrap.createDiv({ cls: "pc-override-actions-grid" });

  // Action cost
  const costLabel = grid.createEl("label", { text: "Cost" });
  const costSel = costLabel.createEl("select");
  costSel.setAttribute("data-field", "action");
  costSel.createEl("option", { text: "—", attr: { value: "" } });
  for (const c of COSTS) costSel.createEl("option", { text: c, attr: { value: c } });
  costSel.value = opts.entry.overrides?.action ?? "";
  costSel.addEventListener("change", () => {
    opts.editState.setEquipmentOverride(opts.entryIndex, { action: (costSel.value || undefined) as never });
  });

  // Range
  const rangeLabel = grid.createEl("label", { text: "Range" });
  const rangeInput = rangeLabel.createEl("input");
  rangeInput.setAttribute("data-field", "range");
  rangeInput.setAttribute("type", "text");
  rangeInput.value = opts.entry.overrides?.range ?? "";
  rangeInput.addEventListener("change", () => {
    opts.editState.setEquipmentOverride(opts.entryIndex, { range: rangeInput.value || undefined });
  });

  // Max charges
  const maxLabel = grid.createEl("label", { text: "Max charges" });
  const maxInput = maxLabel.createEl("input");
  maxInput.setAttribute("data-field", "max_charges");
  maxInput.setAttribute("type", "number");
  maxInput.value = String(opts.entry.state?.charges?.max ?? "");
  maxInput.addEventListener("change", () => {
    opts.editState.setEquipmentState(opts.entryIndex, { charges: { max: Number(maxInput.value) || 0 } });
  });

  // Current charges
  const curLabel = grid.createEl("label", { text: "Current" });
  const curInput = curLabel.createEl("input");
  curInput.setAttribute("data-field", "current_charges");
  curInput.setAttribute("type", "number");
  curInput.value = String(opts.entry.state?.charges?.current ?? "");
  curInput.addEventListener("change", () => {
    opts.editState.setEquipmentState(opts.entryIndex, { charges: { current: Number(curInput.value) || 0 } });
  });

  // Recovery reset
  const resetLabel = grid.createEl("label", { text: "Recovery" });
  const resetSel = resetLabel.createEl("select");
  resetSel.setAttribute("data-field", "recovery_reset");
  resetSel.createEl("option", { text: "—", attr: { value: "" } });
  for (const r of RESETS) resetSel.createEl("option", { text: r, attr: { value: r } });
  resetSel.value = opts.entry.state?.recovery?.reset ?? "";
  resetSel.addEventListener("change", () => {
    if (!resetSel.value) return;
    const amount = opts.entry.state?.recovery?.amount ?? "1";
    opts.editState.setEquipmentState(opts.entryIndex, {
      recovery: { amount, reset: resetSel.value as never },
    });
  });

  // Recovery amount
  const amtLabel = grid.createEl("label", { text: "Recovery amount" });
  const amtInput = amtLabel.createEl("input");
  amtInput.setAttribute("data-field", "recovery_amount");
  amtInput.setAttribute("type", "text");
  amtInput.value = opts.entry.state?.recovery?.amount ?? "";
  amtInput.addEventListener("change", () => {
    if (!opts.entry.state?.recovery?.reset) return;
    opts.editState.setEquipmentState(opts.entryIndex, {
      recovery: { amount: amtInput.value, reset: opts.entry.state.recovery.reset },
    });
  });

  return wrap;
}
