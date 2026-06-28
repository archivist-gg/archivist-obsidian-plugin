import { setIcon } from "obsidian";
import type { MonsterEditState } from "../monster.edit-state";
import {
  ALL_SIZES,
  ALIGNMENT_ETHICAL,
  ALIGNMENT_MORAL,
  ALL_CR_VALUES,
  STANDARD_SENSES,
  DAMAGE_TYPES,
  DAMAGE_NONMAGICAL_VARIANTS,
  CONDITIONS,
} from "../../../shared/dnd/constants";
import { passivePerception } from "../../../shared/dnd/math";
import { createSearchableTagSelect } from "../../../shared/edit/searchable-tag-select";
import { createCollapsible } from "../../../shared/edit/collapsible";
import { type DomRefs, formatXP, getAbilityScore } from "./types";

/**
 * Renders the monster header line: name input + size select + type
 * input + two-part alignment selects (ethical + moral).
 */
export function renderHeader(block: HTMLElement, state: MonsterEditState): void {
  const m = state.current;
  const header = block.createDiv({ cls: "stat-block-header" });

  // Name
  const nameInput = header.createEl("input", { cls: "archivist-edit-input-name" });
  nameInput.type = "text";
  nameInput.value = m.name;
  nameInput.addEventListener("input", () => state.updateField("name", nameInput.value));

  // Type line: Size + Type + Alignment
  const typeLine = header.createDiv({ cls: "monster-type" });

  // Size select
  const sizeSelect = typeLine.createEl("select", { cls: "archivist-edit-select" });
  for (const sz of ALL_SIZES) {
    const opt = sizeSelect.createEl("option", { text: sz });
    opt.value = sz.toLowerCase();
    if (sz.toLowerCase() === (m.size ?? "medium").toLowerCase()) opt.selected = true;
  }
  sizeSelect.addEventListener("change", () => state.updateField("size", sizeSelect.value));

  // Type input
  const typeInput = typeLine.createEl("input", { cls: "archivist-edit-input" });
  typeInput.type = "text";
  typeInput.value = m.type ? m.type.charAt(0).toUpperCase() + m.type.slice(1) : "";
  typeInput.placeholder = "Type";
  typeInput.addEventListener("input", () => state.updateField("type", typeInput.value));

  // Alignment: ethical + moral
  const alignEthical = typeLine.createEl("select", { cls: "archivist-edit-select" });
  for (const a of ALIGNMENT_ETHICAL) {
    const opt = alignEthical.createEl("option", { text: a });
    opt.value = a.toLowerCase();
  }
  selectByAlignment(alignEthical, m.alignment, "ethical");
  alignEthical.addEventListener("change", () => updateAlignment());

  const alignMoral = typeLine.createEl("select", { cls: "archivist-edit-select" });
  for (const a of ALIGNMENT_MORAL) {
    const opt = alignMoral.createEl("option", { text: a });
    opt.value = a.toLowerCase();
  }
  selectByAlignment(alignMoral, m.alignment, "moral");
  alignMoral.addEventListener("change", () => updateAlignment());

  function updateAlignment() {
    const eth = alignEthical.value;
    const mor = alignMoral.value;
    if (eth === "unaligned" || eth === "any") {
      state.updateField("alignment", eth);
    } else {
      const combo = eth === mor ? eth : `${eth} ${mor}`;
      state.updateField("alignment", combo);
    }
  }
}

/**
 * Renders the four collapsible damage/condition sections (damage
 * vulnerabilities, damage resistances, damage immunities, condition
 * immunities) each backed by a searchable tag select.
 */
export function renderDamageAndConditions(
  block: HTMLElement,
  state: MonsterEditState,
): void {
  const m = state.current;
  const damagePresets = [...DAMAGE_TYPES, ...DAMAGE_NONMAGICAL_VARIANTS];

  interface CollapseField {
    title: string;
    presets: string[];
    selected: string[];
    field: string;
    placeholder: string;
  }

  const collapseFields: CollapseField[] = [
    { title: "Damage Vulnerabilities", presets: damagePresets, selected: [...(m.damage_vulnerabilities ?? [])], field: "damage_vulnerabilities", placeholder: "Search damage types..." },
    { title: "Damage Resistances", presets: damagePresets, selected: [...(m.damage_resistances ?? [])], field: "damage_resistances", placeholder: "Search damage types..." },
    { title: "Damage Immunities", presets: damagePresets, selected: [...(m.damage_immunities ?? [])], field: "damage_immunities", placeholder: "Search damage types..." },
    { title: "Condition Immunities", presets: CONDITIONS, selected: [...(m.condition_immunities ?? [])], field: "condition_immunities", placeholder: "Search conditions..." },
  ];

  for (const cf of collapseFields) {
    const wrapper = block.createDiv({ cls: "property-block" });
    const header = wrapper.createDiv({ cls: "archivist-coll-header" });
    const chevron = header.createEl("span", { cls: "archivist-coll-chevron" });
    setIcon(chevron, "chevron-right");
    header.createEl("h4", { text: cf.title });
    const countEl = header.createEl("span", { cls: "archivist-collapse-count", text: `(${cf.selected.length})` });

    const body = wrapper.createDiv({ cls: "archivist-collapse-body archivist-collapse-body-hidden" });

    header.addEventListener("click", () => {
      body.classList.toggle("archivist-collapse-body-hidden");
      chevron.classList.toggle("open");
    });

    createSearchableTagSelect({
      container: body,
      presets: cf.presets,
      selected: cf.selected,
      onChange: (values) => {
        state.updateField(cf.field, values);
        countEl.textContent = `(${values.length})`;
      },
      placeholder: cf.placeholder,
    });
  }
}

/**
 * Renders the collapsible Senses section: one row per standard sense
 * with a range input and proficiency toggle, then custom sense rows,
 * then passive perception. Returns the wrapping senses-section block
 * so the caller can hang languages + CR off it.
 */
export function renderSenses(
  block: HTMLElement,
  state: MonsterEditState,
  refs: DomRefs,
): HTMLElement {
  const sensesSection = block.createDiv({ cls: "property-block" });
  const { grid: sensesGrid } = createCollapsible(sensesSection, "Senses", false);
  sensesGrid.addClass("archivist-senses-grid");

  for (const sense of STANDARD_SENSES) {
    const senseKey = sense.toLowerCase();
    const item = sensesGrid.createDiv({ cls: "archivist-sense-item" });

    const senseToggle = item.createDiv({ cls: "archivist-prof-toggle" });
    const hasValue = !!state.current.activeSenses[senseKey];
    if (hasValue) senseToggle.addClass("proficient");

    item.createEl("span", { cls: "archivist-sense-name", text: sense });

    const rangeInput = item.createEl("input", { cls: "archivist-sense-range" });
    rangeInput.type = "text";
    rangeInput.value = state.current.activeSenses[senseKey] ?? "";
    rangeInput.placeholder = "-- ft.";

    senseToggle.addEventListener("click", () => {
      if (state.current.activeSenses[senseKey]) {
        state.current.activeSenses[senseKey] = null;
        rangeInput.value = "";
        senseToggle.removeClass("proficient");
      } else {
        state.current.activeSenses[senseKey] = "60 ft.";
        rangeInput.value = "60 ft.";
        senseToggle.addClass("proficient");
      }
      state.updateField("activeSenses", state.current.activeSenses);
    });

    rangeInput.addEventListener("input", () => {
      state.current.activeSenses[senseKey] = rangeInput.value || null;
      if (rangeInput.value) {
        senseToggle.addClass("proficient");
      } else {
        senseToggle.removeClass("proficient");
      }
      state.updateField("activeSenses", state.current.activeSenses);
    });
  }

  // Custom senses
  for (let i = 0; i < state.current.customSenses.length; i++) {
    renderCustomSenseRow(sensesGrid, state, i);
  }

  // Passive Perception
  const ppRow = sensesGrid.createDiv({ cls: "archivist-sense-pp" });
  ppRow.createEl("span", { cls: "archivist-sense-pp-label", text: "Passive perception" });
  const ppValue = ppRow.createEl("span", { cls: "archivist-auto-value" });
  const wisScore = getAbilityScore(state.current, "wis");
  const percProf = state.current.skillProficiencies["perception"] ?? "none";
  ppValue.textContent = String(passivePerception(wisScore, percProf, state.current.proficiencyBonus));
  if (percProf !== "none") ppValue.addClass("proficient-value");
  refs.sensePPValue = ppValue;

  // Add sense button
  const addSenseBtn = sensesGrid.createEl("button", { cls: "archivist-add-btn", text: "+ add custom sense" });
  addSenseBtn.addEventListener("click", () => {
    state.current.customSenses.push("New Sense 60 ft.");
    const idx = state.current.customSenses.length - 1;
    const row = renderCustomSenseRow(sensesGrid, state, idx, true);
    addSenseBtn.before(row);
    state.updateField("customSenses", state.current.customSenses);
  });

  return sensesSection;
}

/**
 * Renders the languages field + the challenge rating line into the
 * provided container (the senses-section block). Populates
 * `refs.xpValue` so the orchestrator can live-update XP when CR
 * changes.
 */
export function renderLanguagesAndCR(
  sensesSection: HTMLElement,
  state: MonsterEditState,
  refs: DomRefs,
): void {
  const m = state.current;

  const langLine = sensesSection.createDiv({ cls: "property-line" });
  langLine.createEl("h4", { text: "Languages" });
  langLine.appendText(" ");
  const langInput = langLine.createEl("input", { cls: "archivist-edit-input lang" });
  langInput.type = "text";
  langInput.value = m.languages?.join(", ") ?? "";
  langInput.placeholder = "Common, draconic, ...";
  langInput.addEventListener("input", () => {
    const langs = langInput.value.split(",").map(s => s.trim()).filter(Boolean);
    state.updateField("languages", langs);
  });

  const crLine = sensesSection.createDiv({ cls: "property-line" });
  crLine.createEl("h4", { text: "Challenge" });
  crLine.appendText(" ");

  const crSelect = crLine.createEl("select", { cls: "archivist-edit-select" });
  for (const cr of ALL_CR_VALUES) {
    const opt = crSelect.createEl("option", { text: cr });
    opt.value = cr;
    if (cr === (m.cr ?? "0")) opt.selected = true;
  }
  crSelect.addEventListener("change", () => {
    state.updateField("cr", crSelect.value);
  });

  crLine.appendText(" (");
  const xpValueEl = crLine.createEl("span", { cls: "archivist-auto-value", text: formatXP(state.current.xp) });
  refs.xpValue = xpValueEl;
  crLine.appendText(" XP)");
  crLine.createEl("span", { cls: "archivist-auto-label", text: "(Auto)" });
}

function selectByAlignment(
  selectEl: HTMLSelectElement,
  alignment: string | undefined,
  axis: "ethical" | "moral",
): void {
  if (!alignment) return;
  const lower = alignment.toLowerCase();

  if (axis === "ethical") {
    if (lower === "unaligned" || lower === "any") {
      selectEl.value = lower;
      return;
    }
    const parts = lower.split(" ");
    if (parts.length >= 1) selectEl.value = parts[0];
  } else {
    const parts = lower.split(" ");
    if (parts.length >= 2) {
      selectEl.value = parts[1];
    } else if (parts.length === 1 && ["good", "neutral", "evil"].includes(parts[0])) {
      selectEl.value = parts[0];
    }
  }
}

function renderCustomSenseRow(
  grid: HTMLElement,
  state: MonsterEditState,
  index: number,
  returnOnly = false,
): HTMLElement {
  const doc = grid.doc;
  const row = doc.createElement("div");
  row.className = "archivist-sense-custom";

  // Filled circle indicator (matches standard sense toggle in "proficient" state)
  const indicator = doc.createElement("div");
  indicator.className = "archivist-prof-toggle proficient";
  row.appendChild(indicator);

  // Parse stored string like "Devil's Sight 60 ft." into name + range
  const raw = state.current.customSenses[index] ?? "";
  const rangeMatch = raw.match(/(\d+\s*ft\.?\s*)$/i);
  const parsedName = rangeMatch ? raw.slice(0, raw.length - rangeMatch[0].length).trim() : raw;
  const parsedRange = rangeMatch ? rangeMatch[1].trim() : "60 ft.";

  const nameInput = doc.createElement("input");
  nameInput.className = "archivist-sense-custom-name";
  nameInput.type = "text";
  nameInput.value = parsedName;
  nameInput.placeholder = "Sense name";
  nameInput.addEventListener("input", () => {
    state.current.customSenses[index] = `${nameInput.value} ${rangeInput.value}`.trim();
    state.updateField("customSenses", state.current.customSenses);
  });
  row.appendChild(nameInput);

  const rangeInput = doc.createElement("input");
  rangeInput.className = "archivist-sense-range";
  rangeInput.type = "text";
  rangeInput.value = parsedRange;
  rangeInput.placeholder = "-- ft.";
  rangeInput.addEventListener("input", () => {
    state.current.customSenses[index] = `${nameInput.value} ${rangeInput.value}`.trim();
    state.updateField("customSenses", state.current.customSenses);
  });
  row.appendChild(rangeInput);

  const removeBtn = doc.createElement("button");
  removeBtn.className = "archivist-sense-custom-x";
  setIcon(removeBtn, "x");
  removeBtn.addEventListener("click", () => {
    state.current.customSenses.splice(index, 1);
    row.remove();
    state.updateField("customSenses", state.current.customSenses);
  });
  row.appendChild(removeBtn);

  if (!returnOnly) {
    grid.appendChild(row);
  }
  return row;
}
