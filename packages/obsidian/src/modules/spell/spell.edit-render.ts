import * as yaml from "js-yaml";
import { setIcon, Notice } from "obsidian";
import type { MarkdownPostProcessorContext } from "obsidian";
// The plugin type below is the documented accepted seam (convention doc §6 /
// 0f spec §0.2): EditContext.plugin stays `unknown`; edit renderers recover the
// concrete plugin class via a type-only import.
import type ArchivistPlugin from "../../main";
import type { Spell } from "@archivist-gg/dnd5e/spell/spell.types";
import { renderSideButtons } from "../../shared/edit/side-buttons";
import { createSvgBar } from "../../shared/rendering/renderer-utils";
import { SaveAsNewModal, CreateCompendiumModal } from "../../shared/entities/compendium-modal";
import { showCompendiumPicker } from "../../shared/edit/compendium-picker";

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
// Serialization
// ---------------------------------------------------------------------------

/**
 * Build the clean YAML data object for a spell draft: the ONE serialization
 * builder every save path in this file shares (in-place save, save into a
 * compendium, save-as-new). Before R4-G2 Task 7 this object was built twice —
 * a `buildClean()` closure and an inline duplicate inside `saveAndExit()` —
 * and both copies dropped five declared `Spell` fields (`damage`,
 * `saving_throw`, `casting_options`, `source`, `edition`) on every user save.
 *
 * Emission semantics are ruled by spec §2.1 and are deliberately NOT uniform:
 *
 * - The twelve historic fields keep their EXISTING per-field guards verbatim
 *   (truthiness / length guards, `level`'s `=== 0` literal write, the literal
 *   `true` for `concentration` / `ritual`). So `concentration: false`,
 *   `ritual: false`, `description: ""` and `classes: []` stay ABSENT from the
 *   saved YAML, exactly as before: saves stay byte-stable. Widening these to
 *   `!= null` would start serializing `concentration: false` on every save —
 *   an unbooked user-visible delta. Downstream every one of these flags is
 *   read by truthiness, so `false` and absent are indistinguishable anyway.
 * - The five restored fields and the fourteen §2 keys use `!= null`, appended
 *   after the historic field order. Truthiness would be wrong for them: all
 *   1,048 converter `rendering_hint` values are `''`, and a truthiness guard
 *   would silently strip every one.
 */
export function buildSpellYamlObject(draft: Spell): Record<string, unknown> {
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
  // Restored by R4-G2 Task 7 (spec §2.1): declared `Spell` fields both former
  // builders dropped on every save.
  if (draft.damage != null) clean.damage = draft.damage;
  if (draft.saving_throw != null) clean.saving_throw = draft.saving_throw;
  if (draft.casting_options != null) clean.casting_options = draft.casting_options;
  if (draft.source != null) clean.source = draft.source;
  if (draft.edition != null) clean.edition = draft.edition;
  // The fourteen §2 keys, in spec-table order.
  if (draft.rendering_hint != null) clean.rendering_hint = draft.rendering_hint;
  if (draft.misc_tags != null) clean.misc_tags = draft.misc_tags;
  if (draft.area_tags != null) clean.area_tags = draft.area_tags;
  if (draft.condition_inflict != null) clean.condition_inflict = draft.condition_inflict;
  if (draft.affects_creature_type != null) clean.affects_creature_type = draft.affects_creature_type;
  if (draft.spell_attack != null) clean.spell_attack = draft.spell_attack;
  if (draft.ability_check != null) clean.ability_check = draft.ability_check;
  if (draft.damage_resist != null) clean.damage_resist = draft.damage_resist;
  if (draft.damage_immune != null) clean.damage_immune = draft.damage_immune;
  if (draft.condition_immune != null) clean.condition_immune = draft.condition_immune;
  if (draft.damage_vulnerable != null) clean.damage_vulnerable = draft.damage_vulnerable;
  if (draft.has_fluff != null) clean.has_fluff = draft.has_fluff;
  if (draft.image != null) clean.image = draft.image;
  if (draft.has_fluff_images != null) clean.has_fluff_images = draft.has_fluff_images;
  return clean;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function renderSpellEditMode(
  spell: Spell,
  el: HTMLElement,
  ctx: MarkdownPostProcessorContext | null | undefined,
  plugin: ArchivistPlugin,
  onCancelExit?: () => void,
  compendiumContext?: { slug: string; compendium: string; readonly: boolean },
  onReplaceRef?: (newRefText: string) => void,
): void {
  // Mutable working copy
  const draft = JSON.parse(JSON.stringify(spell)) as Spell;

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
    const sideState = compendiumContext ? "compendium-pending" as const : "pending" as const;
    renderSideButtons(sideBtns, {
      state: sideState,
      isColumnActive: false,
      isReadonly: compendiumContext?.readonly,
      onEdit: () => cancelAndExit(),
      onSave: () => {
        if (compendiumContext) {
          const yamlData = buildSpellYamlObject(draft);
          plugin.compendiumManager?.updateEntity(compendiumContext.slug, yamlData)
            .then(() => {
              new Notice(`Updated ${compendiumContext.slug} in compendium`);
              if (onCancelExit) onCancelExit();
            })
            .catch((e: Error) => new Notice(`Failed to save: ${e.message}`));
        } else {
          saveAndExit();
        }
      },
      onSaveAsNew: () => {
        const writable = plugin.compendiumManager?.getWritable() ?? [];
        const yamlData = buildSpellYamlObject(draft);

        const saveTo = (comp: { name: string }) => {
          plugin.compendiumManager!.saveEntity(comp.name, "spell", yamlData)
            .then((registered) => {
              if (onReplaceRef) {
                onReplaceRef(`{{spell:${registered.slug}}}`);
              } else {
                const info = ctx?.getSectionInfo(el);
                if (info) {
                  const editor = plugin.app.workspace.activeEditor?.editor;
                  if (editor) {
                    const from = { line: info.lineStart, ch: 0 };
                    const to = { line: info.lineEnd, ch: editor.getLine(info.lineEnd).length };
                    editor.replaceRange(`{{spell:${registered.slug}}}`, from, to);
                  }
                }
              }
              new Notice(`Saved as new to ${comp.name}`);
              if (onCancelExit) onCancelExit();
            })
            .catch((e: Error) => new Notice(`Failed to save: ${e.message}`));
        };

        if (onReplaceRef) {
          if (writable.length === 0) {
            new CreateCompendiumModal(plugin.app, plugin.compendiumManager!, saveTo).open();
          } else if (writable.length === 1) {
            saveTo(writable[0]);
          } else {
            showCompendiumPicker(sideBtns, writable, saveTo);
          }
        } else {
          if (writable.length === 0) {
            new CreateCompendiumModal(plugin.app, plugin.compendiumManager!, (comp) => {
              yamlData.name = draft.name;
              saveTo(comp);
            }).open();
          } else {
            new SaveAsNewModal(plugin.app, writable, draft.name, (comp, name) => {
              yamlData.name = name;
              saveTo(comp);
            }, plugin.compendiumManager!).open();
          }
        }
      },
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
  nameInput.placeholder = "Spell name";
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
  concLabel.createEl("span", { text: "Concentration" });
  concCheck.addEventListener("change", () => { draft.concentration = concCheck.checked || undefined; markDirty(); });

  // Ritual toggle
  const ritLabel = tagsDiv.createEl("label", { cls: "archivist-edit-toggle-label" });
  const ritCheck = ritLabel.createEl("input");
  ritCheck.type = "checkbox";
  ritCheck.checked = draft.ritual ?? false;
  ritCheck.addClass("archivist-edit-checkbox");
  ritLabel.createEl("span", { text: "Ritual" });
  ritCheck.addEventListener("change", () => { draft.ritual = ritCheck.checked || undefined; markDirty(); });

  // =========================================================================
  // 5. Description
  // =========================================================================

  const descSection = block.createDiv({ cls: "spell-description" });
  const descHeader = descSection.createDiv({ cls: "higher-levels-header" });
  descHeader.textContent = "Description";

  const descTa = descSection.createEl("textarea", { cls: "archivist-feat-text-input" });
  descTa.value = draft.description ?? "";
  descTa.rows = 6;
  descTa.addEventListener("input", () => {
    draft.description = descTa.value.length > 0 ? descTa.value : undefined;
    markDirty();
  });

  // =========================================================================
  // 6. At Higher Levels
  // =========================================================================

  const higherSection = block.createDiv({ cls: "spell-higher-levels" });
  const higherHeader = higherSection.createDiv({ cls: "higher-levels-header" });
  higherHeader.textContent = "At higher levels";

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

  const classesDiv = block.createDiv({ cls: "spell-classes archivist-property-line" });
  const classesIcon = classesDiv.createEl("div", { cls: "archivist-property-icon" });
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
    const clean = buildSpellYamlObject(draft);

    const yamlStr = yaml.dump(clean, {
      lineWidth: -1,
      quotingType: '"',
      forceQuotes: false,
      sortKeys: false,
      noRefs: true,
    });

    if (!ctx) { cancelAndExit(); return; }
    const info = ctx.getSectionInfo(el);
    if (!info) { cancelAndExit(); return; }
    const editor = plugin.app.workspace.activeEditor?.editor;
    if (!editor) { cancelAndExit(); return; }

    const fromLine = info.lineStart;
    const toLine = info.lineEnd;
    const endCh = editor.getLine(toLine).length;
    const newContent = "```spell\n" + yamlStr + "```";
    editor.replaceRange(newContent, { line: fromLine, ch: 0 }, { line: toLine, ch: endCh });
    editor.setCursor({ line: fromLine, ch: 0 });
    // Obsidian re-renders the code block after replaceRange, destroying this DOM.
    // If re-render is delayed or content is identical, exit edit mode explicitly.
    if (onCancelExit) onCancelExit();
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
  const iconEl = row.createDiv({ cls: "archivist-property-icon" });
  setIcon(iconEl, icon);
  row.createDiv({ cls: "archivist-property-name", text: label });
  const input = row.createEl("input", { cls: "archivist-edit-input wide" });
  input.type = "text";
  input.value = value;
  input.addEventListener("input", () => onChange(input.value));
}
