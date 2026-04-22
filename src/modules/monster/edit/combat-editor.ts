import { setIcon } from "obsidian";
import type { MonsterEditState } from "../monster.edit-state";
import { createSpinButtons } from "../../../shared/edit/spin-buttons";
import { wireOverride } from "../../../shared/edit/override-system";
import type { DomRefs } from "./types";

/**
 * Renders the Core Properties block: Armor Class, Hit Points, and
 * Speed (walk + add-on fly/swim/climb/burrow rows with a dropdown
 * picker).
 */
export function renderCombat(
  block: HTMLElement,
  state: MonsterEditState,
  refs: DomRefs,
): void {
  const m = state.current;
  const coreProps = block.createDiv({ cls: "property-block" });

  // -- AC --
  const acLine = coreProps.createDiv({ cls: "property-line" });
  acLine.createEl("h4", { text: "Armor class" });
  acLine.appendText(" ");
  const acNumWrap = acLine.createDiv({ cls: "archivist-num-wrap" });
  const acInput = acNumWrap.createEl("input", { cls: "archivist-num-in" });
  acInput.type = "number";
  acInput.value = String(m.ac?.[0]?.ac ?? 10);
  acInput.addEventListener("input", () => {
    const acArr = state.current.ac ?? [{ ac: 10 }];
    acArr[0] = { ...acArr[0], ac: parseInt(acInput.value) || 10 };
    state.updateField("ac", acArr);
  });
  createSpinButtons(acNumWrap, acInput);

  const acSourceInput = acLine.createEl("input", { cls: "archivist-edit-input wide" });
  acSourceInput.type = "text";
  acSourceInput.value = m.ac?.[0]?.from?.join(", ") ?? "";
  acSourceInput.placeholder = "(Source)";
  acSourceInput.addEventListener("input", () => {
    const acArr = state.current.ac ?? [{ ac: 10 }];
    const fromArr = acSourceInput.value.trim() ? acSourceInput.value.split(",").map(s => s.trim()) : undefined;
    acArr[0] = { ...acArr[0], from: fromArr };
    state.updateField("ac", acArr);
  });

  // -- HP --
  const hpLine = coreProps.createDiv({ cls: "property-line" });
  hpLine.createEl("h4", { text: "Hit points" });
  hpLine.appendText(" ");
  const hpValueEl = hpLine.createEl("span", { cls: "archivist-auto-value", text: String(m.hp?.average ?? 0) });
  refs.hpValue = hpValueEl;
  const hpAutoLabel = hpLine.createEl("span", { cls: "archivist-auto-label", text: "(Auto)" });
  wireOverride(hpValueEl, hpAutoLabel, "hp", () => state.current.hp?.average ?? 0, (val) => {
    const hp = { ...state.current.hp!, average: val };
    state.setOverride("hp", val);
    state.updateField("hp", hp);
  }, () => {
    state.clearOverride("hp");
  });

  hpLine.appendText(" ");
  const hpFormulaInput = hpLine.createEl("input", { cls: "archivist-edit-input formula" });
  hpFormulaInput.type = "text";
  hpFormulaInput.value = m.hp?.formula ?? "";
  hpFormulaInput.placeholder = "E.g. 4D8";
  refs.hpFormula = hpFormulaInput;
  hpFormulaInput.addEventListener("input", () => {
    const hp = { ...state.current.hp!, formula: hpFormulaInput.value };
    state.updateField("hp.formula", hpFormulaInput.value);
    state.updateField("hp", hp);
  });

  // -- Speed --
  const speedLine = coreProps.createDiv({ cls: "property-line" });
  speedLine.createEl("h4", { text: "Speed" });
  speedLine.appendText(" ");

  const walkWrap = speedLine.createDiv({ cls: "archivist-num-wrap" });
  const walkInput = walkWrap.createEl("input", { cls: "archivist-num-in" });
  walkInput.type = "number";
  walkInput.value = String(m.speed?.walk ?? 30);
  walkInput.addEventListener("input", () => {
    const speed = { ...state.current.speed, walk: parseInt(walkInput.value) || 0 };
    state.updateField("speed", speed);
  });
  createSpinButtons(walkWrap, walkInput);
  speedLine.appendText(" Ft.");

  // Extra speed modes — one row per mode, + Add Speed button at bottom
  const speedExtraSection = coreProps.createDiv({ cls: "archivist-speed-extra-section" });
  const extraRowsContainer = speedExtraSection.createDiv({ cls: "archivist-speed-extra-rows" });

  const extraModeKeys: Array<"fly" | "swim" | "climb" | "burrow"> = ["fly", "swim", "climb", "burrow"];
  const activeSpeedModes: Set<string> = new Set();

  function addSpeedMode(key: "fly" | "swim" | "climb" | "burrow"): void {
    if (activeSpeedModes.has(key)) return;
    activeSpeedModes.add(key);

    const row = extraRowsContainer.createDiv({ cls: "archivist-speed-extra-row" });
    row.dataset.speedMode = key;

    row.createEl("span", {
      cls: "archivist-speed-extra-label",
      text: key.charAt(0).toUpperCase() + key.slice(1),
    });

    const numWrap = row.createDiv({ cls: "archivist-num-wrap" });
    const numInput = numWrap.createEl("input", { cls: "archivist-num-in" });
    numInput.type = "number";
    numInput.value = String(m.speed?.[key] ?? 0);
    numInput.addEventListener("input", () => {
      const speed = { ...state.current.speed, [key]: parseInt(numInput.value) || 0 };
      state.updateField("speed", speed);
    });
    createSpinButtons(numWrap, numInput);

    row.createEl("span", { cls: "archivist-speed-extra-ft", text: "Ft." });

    const removeBtn = row.createEl("button", { cls: "archivist-speed-extra-x" });
    setIcon(removeBtn, "x");
    removeBtn.addEventListener("click", () => {
      activeSpeedModes.delete(key);
      row.remove();
      state.updateField("speed", { ...state.current.speed, [key]: 0 });
      updateAddButton();
    });

    updateAddButton();
  }

  // "+ Add Speed" button wrapped for dropdown positioning
  const addAnchor = speedExtraSection.createDiv({ cls: "archivist-speed-add-wrap" });
  const addBtn = addAnchor.createEl("button", { cls: "archivist-add-btn", text: "+ add speed" });
  let dropdownEl: HTMLElement | null = null;

  function updateAddButton(): void {
    const allAdded = extraModeKeys.every(k => activeSpeedModes.has(k));
    addAnchor.style.display = allAdded ? "none" : "";
  }

  function showSpeedDropdown(): void {
    hideSpeedDropdown();
    dropdownEl = addAnchor.createDiv({ cls: "archivist-speed-dropdown" });
    for (const key of extraModeKeys) {
      const taken = activeSpeedModes.has(key);
      const item = dropdownEl.createDiv({
        cls: taken
          ? "archivist-speed-dropdown-item archivist-speed-dropdown-item-taken"
          : "archivist-speed-dropdown-item",
        text: taken ? `${key.charAt(0).toUpperCase() + key.slice(1)} (added)` : key.charAt(0).toUpperCase() + key.slice(1),
      });
      if (!taken) {
        item.addEventListener("click", () => {
          addSpeedMode(key);
          hideSpeedDropdown();
        });
      }
    }
    attachDropdownCloseHandler();
  }

  let closeHandler: ((e: MouseEvent) => void) | null = null;

  function hideSpeedDropdown(): void {
    if (dropdownEl) { dropdownEl.remove(); dropdownEl = null; }
    if (closeHandler) { activeDocument.removeEventListener("click", closeHandler); closeHandler = null; }
  }

  addBtn.addEventListener("click", () => {
    if (dropdownEl) { hideSpeedDropdown(); } else { showSpeedDropdown(); }
  });

  function attachDropdownCloseHandler(): void {
    closeHandler = (e: MouseEvent) => {
      if (dropdownEl && !addAnchor.contains(e.target as Node)) {
        hideSpeedDropdown();
      }
    };
    activeWindow.setTimeout(() => activeDocument.addEventListener("click", closeHandler!), 0);
  }

  // Pre-populate existing non-zero speeds
  for (const key of extraModeKeys) {
    if ((m.speed?.[key] ?? 0) > 0) {
      addSpeedMode(key);
    }
  }
}
