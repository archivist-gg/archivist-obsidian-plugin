import * as yaml from "js-yaml";
import { setIcon } from "obsidian";
import type { MarkdownPostProcessorContext } from "obsidian";
import type ArchivistPlugin from "../main";
import type { Spell } from "../types/spell";
import { renderSideButtons } from "./side-buttons";
import { createSvgBar } from "../renderers/renderer-utils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SPELL_LEVELS = [
  "Cantrip", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th",
];

const SPELL_SCHOOLS = [
  "Abjuration", "Conjuration", "Divination", "Enchantment",
  "Evocation", "Illusion", "Necromancy", "Transmutation",
];

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function renderSpellEditMode(
  spell: Spell,
  el: HTMLElement,
  ctx: MarkdownPostProcessorContext,
  plugin: ArchivistPlugin,
  onCancelExit?: () => void,
): void {
  // Mutable working copy
  const draft: Spell = JSON.parse(JSON.stringify(spell));

  // --- Side buttons ---
  let sideBtns = el.querySelector<HTMLElement>(".archivist-side-btns");
  if (!sideBtns) {
    sideBtns = el.createDiv({ cls: "archivist-side-btns always-visible" });
  } else {
    sideBtns.addClass("always-visible");
  }

  function markDirty() {
    updateSideBtns();
  }

  function updateSideBtns() {
    if (!sideBtns) return;
    const btnState = "pending" as const;
    renderSideButtons(sideBtns!, {
      state: btnState,
      isColumnActive: false,
      onEdit: () => cancelAndExit(),
      onSave: () => saveAndExit(),
      onCompendium: () => {},
      onCancel: () => cancelAndExit(),
      onDelete: () => {},
      onColumnToggle: () => {},
    });
  }
  updateSideBtns();

  // --- Wrapper ---
  const wrapper = el.createDiv({ cls: "archivist-spell-block-wrapper" });
  const block = wrapper.createDiv({ cls: "archivist-spell-block editing" });

  // =========================================================================
  // 1. HEADER
  // =========================================================================

  const header = block.createDiv({ cls: "spell-block-header" });

  // Name
  const nameInput = header.createEl("input", { cls: "archivist-edit-input-name" });
  nameInput.type = "text";
  nameInput.value = draft.name;
  nameInput.placeholder = "Spell Name";
  nameInput.addEventListener("input", () => { draft.name = nameInput.value; markDirty(); });

  // Level + School row
  const subRow = header.createDiv({ cls: "spell-school" });

  const levelSelect = subRow.createEl("select", { cls: "archivist-edit-select" });
  for (let i = 0; i < SPELL_LEVELS.length; i++) {
    const opt = levelSelect.createEl("option", { text: SPELL_LEVELS[i] });
    opt.value = String(i);
    if (i === (draft.level ?? 0)) opt.selected = true;
  }
  levelSelect.addEventListener("change", () => { draft.level = Number(levelSelect.value); markDirty(); });

  subRow.appendText(" ");

  const schoolSelect = subRow.createEl("select", { cls: "archivist-edit-select" });
  for (const s of SPELL_SCHOOLS) {
    const opt = schoolSelect.createEl("option", { text: s });
    opt.value = s;
    if (s.toLowerCase() === (draft.school ?? "").toLowerCase()) opt.selected = true;
  }
  schoolSelect.addEventListener("change", () => { draft.school = schoolSelect.value; markDirty(); });

  // =========================================================================
  // 2. SVG Bar
  // =========================================================================
  createSvgBar(block);

  // =========================================================================
  // 3. Properties
  // =========================================================================

  const props = block.createDiv({ cls: "spell-properties" });

  // Casting Time
  createEditableProperty(props, "clock", "Casting Time:", draft.casting_time ?? "", (v) => { draft.casting_time = v || undefined; markDirty(); });

  // Range
  createEditableProperty(props, "target", "Range:", draft.range ?? "", (v) => { draft.range = v || undefined; markDirty(); });

  // Components
  createEditableProperty(props, "box", "Components:", draft.components ?? "", (v) => { draft.components = v || undefined; markDirty(); });

  // Duration
  createEditableProperty(props, "sparkles", "Duration:", draft.duration ?? "", (v) => { draft.duration = v || undefined; markDirty(); });

  // =========================================================================
  // 4. Tags (Concentration & Ritual)
  // =========================================================================

  const tagsDiv = block.createDiv({ cls: "spell-tags" });

  // Concentration toggle
  const concLabel = tagsDiv.createEl("label", { cls: "archivist-edit-toggle-label" });
  const concCheck = concLabel.createEl("input");
  concCheck.type = "checkbox";
  concCheck.checked = draft.concentration ?? false;
  concCheck.addClass("archivist-edit-checkbox");
  concLabel.appendText(" Concentration");
  concCheck.addEventListener("change", () => { draft.concentration = concCheck.checked || undefined; markDirty(); });

  tagsDiv.appendText("  ");

  // Ritual toggle
  const ritLabel = tagsDiv.createEl("label", { cls: "archivist-edit-toggle-label" });
  const ritCheck = ritLabel.createEl("input");
  ritCheck.type = "checkbox";
  ritCheck.checked = draft.ritual ?? false;
  ritCheck.addClass("archivist-edit-checkbox");
  ritLabel.appendText(" Ritual");
  ritCheck.addEventListener("change", () => { draft.ritual = ritCheck.checked || undefined; markDirty(); });

  // =========================================================================
  // 5. Description
  // =========================================================================

  const descSection = block.createDiv({ cls: "spell-description" });
  const descHeader = descSection.createDiv({ cls: "higher-levels-header" });
  descHeader.textContent = "Description";

  const descEntries = draft.description ?? [""];
  if (descEntries.length === 0) descEntries.push("");

  for (let i = 0; i < descEntries.length; i++) {
    const ta = descSection.createEl("textarea", { cls: "archivist-feat-text-input" });
    ta.value = descEntries[i];
    ta.rows = 3;
    const idx = i;
    ta.addEventListener("input", () => {
      descEntries[idx] = ta.value;
      draft.description = descEntries.filter((e) => e.trim().length > 0);
      markDirty();
    });
  }

  // Add description paragraph button
  const addDescBtn = descSection.createDiv({ cls: "archivist-side-btn", attr: { style: "display:inline-block;margin-top:4px;" } });
  setIcon(addDescBtn, "plus");
  addDescBtn.setAttribute("aria-label", "Add paragraph");
  addDescBtn.addEventListener("click", () => {
    descEntries.push("");
    const ta = descSection.createEl("textarea", { cls: "archivist-feat-text-input" });
    ta.rows = 3;
    // Insert before the add button
    descSection.insertBefore(ta, addDescBtn);
    const idx = descEntries.length - 1;
    ta.addEventListener("input", () => {
      descEntries[idx] = ta.value;
      draft.description = descEntries.filter((e) => e.trim().length > 0);
      markDirty();
    });
    ta.focus();
  });

  // =========================================================================
  // 6. At Higher Levels
  // =========================================================================

  const higherSection = block.createDiv({ cls: "spell-higher-levels" });
  const higherHeader = higherSection.createDiv({ cls: "higher-levels-header" });
  higherHeader.textContent = "At Higher Levels";

  const higherEntries = draft.at_higher_levels ?? [""];
  if (higherEntries.length === 0) higherEntries.push("");

  for (let i = 0; i < higherEntries.length; i++) {
    const ta = higherSection.createEl("textarea", { cls: "archivist-feat-text-input" });
    ta.value = higherEntries[i];
    ta.rows = 2;
    const idx = i;
    ta.addEventListener("input", () => {
      higherEntries[idx] = ta.value;
      draft.at_higher_levels = higherEntries.filter((e) => e.trim().length > 0);
      markDirty();
    });
  }

  // =========================================================================
  // 7. Classes
  // =========================================================================

  const classesDiv = block.createDiv({ cls: "spell-classes" });
  const classesIcon = classesDiv.createEl("span", { cls: "archivist-property-icon" });
  setIcon(classesIcon, "book-open");

  const classesInput = classesDiv.createEl("input", { cls: "archivist-edit-input wide" });
  classesInput.type = "text";
  classesInput.value = (draft.classes ?? []).join(", ");
  classesInput.placeholder = "Classes (comma-separated)";
  classesInput.addEventListener("input", () => {
    const val = classesInput.value.trim();
    draft.classes = val ? val.split(",").map((s) => s.trim()).filter(Boolean) : undefined;
    markDirty();
  });

  // =========================================================================
  // Save & Cancel
  // =========================================================================

  function saveAndExit() {
    // Clean up empty optional fields
    const clean: Record<string, unknown> = { name: draft.name };
    if (draft.level !== undefined && draft.level !== 0) clean.level = draft.level;
    if (draft.level === 0) clean.level = 0;
    if (draft.school) clean.school = draft.school;
    if (draft.casting_time) clean.casting_time = draft.casting_time;
    if (draft.range) clean.range = draft.range;
    if (draft.components) clean.components = draft.components;
    if (draft.duration) clean.duration = draft.duration;
    if (draft.concentration) clean.concentration = true;
    if (draft.ritual) clean.ritual = true;
    if (draft.description && draft.description.length > 0) clean.description = draft.description;
    if (draft.at_higher_levels && draft.at_higher_levels.length > 0) clean.at_higher_levels = draft.at_higher_levels;
    if (draft.classes && draft.classes.length > 0) clean.classes = draft.classes;

    const yamlStr = yaml.dump(clean, {
      lineWidth: -1,
      quotingType: '"',
      forceQuotes: false,
      sortKeys: false,
      noRefs: true,
    });

    const info = ctx.getSectionInfo(el);
    if (!info) return;
    const editor = plugin.app.workspace.activeEditor?.editor;
    if (!editor) return;

    const fromLine = info.lineStart;
    const toLine = info.lineEnd;
    const endCh = editor.getLine(toLine).length;
    const newContent = "```spell\n" + yamlStr + "```";
    editor.replaceRange(newContent, { line: fromLine, ch: 0 }, { line: toLine, ch: endCh });
    editor.setCursor({ line: fromLine, ch: 0 });
  }

  function cancelAndExit() {
    if (onCancelExit) {
      onCancelExit();
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createEditableProperty(
  parent: HTMLElement,
  icon: string,
  label: string,
  value: string,
  onChange: (value: string) => void,
): void {
  const row = parent.createDiv({ cls: "archivist-property-line" });
  const iconSpan = row.createEl("span", { cls: "archivist-property-icon" });
  setIcon(iconSpan, icon);
  row.createEl("span", { cls: "archivist-property-name", text: label });
  const input = row.createEl("input", { cls: "archivist-edit-input wide" });
  input.type = "text";
  input.value = value;
  input.addEventListener("input", () => onChange(input.value));
}
