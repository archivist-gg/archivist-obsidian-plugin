import * as yaml from "js-yaml";
import { setIcon, Notice } from "obsidian";
import type { MarkdownPostProcessorContext } from "obsidian";
// TODO(phase1): narrow EditContext.plugin to a typed host-plugin handle so
// modules don't reach across into src/main for the concrete class.
import type ArchivistPlugin from "../../main";
import type { Item } from "./item.types";
import { renderSideButtons } from "../../shared/edit/side-buttons";
import { SaveAsNewModal, CreateCompendiumModal } from "../../shared/entities/compendium-modal";
import { showCompendiumPicker } from "../../shared/edit/compendium-picker";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ITEM_TYPES = [
  "Armor", "Weapon", "Potion", "Ring", "Rod", "Scroll",
  "Staff", "Wand", "Wondrous Item", "Adventuring Gear",
];

const ITEM_RARITIES = [
  "Common", "Uncommon", "Rare", "Very Rare", "Legendary", "Artifact",
];

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function renderItemEditMode(
  item: Item,
  el: HTMLElement,
  ctx: MarkdownPostProcessorContext | null | undefined,
  plugin: ArchivistPlugin,
  onCancelExit?: () => void,
  compendiumContext?: { slug: string; compendium: string; readonly: boolean },
  onReplaceRef?: (newRefText: string) => void,
): void {
  // Mutable working copy
  const draft = JSON.parse(JSON.stringify(item)) as Item;

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

  /** Build a clean data object from the draft for serialization. */
  function buildClean(): Record<string, unknown> {
    const clean: Record<string, unknown> = { name: draft.name };
    if (draft.type) clean.type = draft.type;
    if (draft.rarity) clean.rarity = draft.rarity;
    if (draft.attunement !== undefined && draft.attunement !== false) clean.attunement = draft.attunement;
    if (draft.weight != null) clean.weight = draft.weight;
    if (draft.value != null) clean.value = draft.value;
    if (draft.damage) clean.damage = draft.damage;
    if (draft.damage_type) clean.damage_type = draft.damage_type;
    if (draft.properties && draft.properties.length > 0) clean.properties = draft.properties;
    if (draft.charges != null) clean.charges = draft.charges;
    if (draft.recharge) clean.recharge = draft.recharge;
    if (draft.curse) clean.curse = true;
    if (draft.description && draft.description.length > 0) clean.description = draft.description;
    return clean;
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
          const yamlData = buildClean();
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
        const yamlData = buildClean();

        const saveTo = (comp: { name: string }) => {
          plugin.compendiumManager!.saveEntity(comp.name, "item", yamlData)
            .then((registered) => {
              if (onReplaceRef) {
                onReplaceRef(`{{item:${registered.slug}}}`);
              } else {
                const info = ctx?.getSectionInfo(el);
                if (info) {
                  const editor = plugin.app.workspace.activeEditor?.editor;
                  if (editor) {
                    const from = { line: info.lineStart, ch: 0 };
                    const to = { line: info.lineEnd, ch: editor.getLine(info.lineEnd).length };
                    editor.replaceRange(`{{item:${registered.slug}}}`, from, to);
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
  const wrapper = el.createDiv({ cls: "archivist-item-block-wrapper" });
  const block = wrapper.createDiv({ cls: "archivist-item-block editing" });

  // =========================================================================
  // 1. HEADER
  // =========================================================================

  const header = block.createDiv({ cls: "archivist-item-block-header" });

  // Name
  const nameInput = header.createEl("input", { cls: "archivist-edit-input-name" });
  nameInput.type = "text";
  nameInput.value = draft.name;
  nameInput.placeholder = "Item name";
  nameInput.addEventListener("input", () => { draft.name = nameInput.value; markDirty(); });

  // Type + Rarity row
  const subtitleRow = header.createDiv({ cls: "archivist-item-subtitle" });

  const typeSelect = subtitleRow.createEl("select", { cls: "archivist-edit-select" });
  const typeEmpty = typeSelect.createEl("option", { text: "-- type --" });
  typeEmpty.value = "";
  if (!draft.type) typeEmpty.selected = true;
  for (const t of ITEM_TYPES) {
    const opt = typeSelect.createEl("option", { text: t });
    opt.value = t.toLowerCase();
    if (t.toLowerCase() === (draft.type ?? "").toLowerCase()) opt.selected = true;
  }
  typeSelect.addEventListener("change", () => { draft.type = typeSelect.value || undefined; markDirty(); });

  const raritySelect = subtitleRow.createEl("select", { cls: "archivist-edit-select" });
  const rarEmpty = raritySelect.createEl("option", { text: "-- rarity --" });
  rarEmpty.value = "";
  if (!draft.rarity) rarEmpty.selected = true;
  for (const r of ITEM_RARITIES) {
    const opt = raritySelect.createEl("option", { text: r });
    opt.value = r.toLowerCase();
    if (r.toLowerCase() === (draft.rarity ?? "").toLowerCase()) opt.selected = true;
  }
  raritySelect.addEventListener("change", () => { draft.rarity = raritySelect.value || undefined; markDirty(); });

  // =========================================================================
  // 2. Properties
  // (Header's border-bottom is the divider; no SVG bar — view mode doesn't
  //  use one either, and stacking both produced a duplicate horizontal line.)
  // =========================================================================

  const props = block.createDiv({ cls: "archivist-item-properties" });

  // Attunement row: toggle + optional condition
  const attuneRow = props.createDiv({ cls: "archivist-property-line" });
  const attuneIcon = attuneRow.createDiv({ cls: "archivist-property-icon" });
  setIcon(attuneIcon, "sparkles");
  attuneRow.createDiv({ cls: "archivist-property-name", text: "Attunement:" });

  const attuneCheck = attuneRow.createEl("input");
  attuneCheck.type = "checkbox";
  attuneCheck.checked = !!draft.attunement;
  attuneCheck.addClass("archivist-edit-checkbox");
  attuneCheck.addEventListener("change", () => {
    if (!attuneCheck.checked) {
      draft.attunement = undefined;
      attuneCondInput.value = "";
      attuneCondInput.addClass("archivist-hidden");
    } else {
      draft.attunement = true;
      attuneCondInput.removeClass("archivist-hidden");
    }
    markDirty();
  });

  const attuneCondInput = attuneRow.createEl("input", { cls: "archivist-edit-input wide" });
  attuneCondInput.type = "text";
  attuneCondInput.placeholder = "Condition (e.g. By a cleric)";
  if (typeof draft.attunement === "string") {
    attuneCondInput.value = draft.attunement;
  }
  if (!draft.attunement) {
    attuneCondInput.addClass("archivist-hidden");
  }
  attuneCondInput.addEventListener("input", () => {
    const val = attuneCondInput.value.trim();
    draft.attunement = val ? val : true;
    markDirty();
  });

  // Weight
  createEditableProperty(props, "scale", "Weight:", draft.weight != null ? String(draft.weight) : "", (v) => {
    draft.weight = v ? Number(v) : undefined;
    markDirty();
  });

  // Value
  createEditableProperty(props, "coins", "Value:", draft.value != null ? String(draft.value) : "", (v) => {
    draft.value = v ? Number(v) : undefined;
    markDirty();
  });

  // Damage
  const damageStr = typeof draft.damage === "string" ? draft.damage : "";
  createEditableProperty(props, "swords", "Damage:", damageStr, (v) => {
    draft.damage = v || undefined;
    markDirty();
  });

  // Damage Type
  createEditableProperty(props, "swords", "Damage Type:", draft.damage_type ?? "", (v) => {
    draft.damage_type = v || undefined;
    markDirty();
  });

  // Properties (comma-separated)
  createEditableProperty(props, "shield", "Properties:", (draft.properties ?? []).join(", "), (v) => {
    draft.properties = v ? v.split(",").map((s) => s.trim()).filter(Boolean) : undefined;
    markDirty();
  });

  // Charges (number)
  const chargesStr = typeof draft.charges === "number" ? String(draft.charges) : "";
  createEditableProperty(props, "zap", "Charges:", chargesStr, (v) => {
    draft.charges = v ? Number(v) : undefined;
    markDirty();
  });

  // Recharge
  createEditableProperty(props, "refresh-cw", "Recharge:", draft.recharge ?? "", (v) => {
    draft.recharge = v || undefined;
    markDirty();
  });

  // Curse toggle
  const curseRow = props.createDiv({ cls: "archivist-property-line" });
  const curseIcon = curseRow.createDiv({ cls: "archivist-property-icon" });
  setIcon(curseIcon, "skull");
  curseRow.createDiv({ cls: "archivist-property-name", text: "Cursed:" });
  const curseCheck = curseRow.createEl("input");
  curseCheck.type = "checkbox";
  curseCheck.checked = draft.curse ?? false;
  curseCheck.addClass("archivist-edit-checkbox");
  curseCheck.addEventListener("change", () => {
    draft.curse = curseCheck.checked || undefined;
    markDirty();
  });

  // =========================================================================
  // 4. Description
  // (Single textarea backed by `draft.description: string`. Newlines separate
  //  paragraphs as standard markdown — same convention as spell.edit-render.)
  // =========================================================================

  const descSection = block.createDiv({ cls: "archivist-item-description" });
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
  // Save & Cancel
  // =========================================================================

  function saveAndExit() {
    // Clean up empty optional fields
    const clean: Record<string, unknown> = { name: draft.name };
    if (draft.type) clean.type = draft.type;
    if (draft.rarity) clean.rarity = draft.rarity;
    if (draft.attunement !== undefined && draft.attunement !== false) clean.attunement = draft.attunement;
    if (draft.weight != null) clean.weight = draft.weight;
    if (draft.value != null) clean.value = draft.value;
    if (draft.damage) clean.damage = draft.damage;
    if (draft.damage_type) clean.damage_type = draft.damage_type;
    if (draft.properties && draft.properties.length > 0) clean.properties = draft.properties;
    if (draft.charges != null) clean.charges = draft.charges;
    if (draft.recharge) clean.recharge = draft.recharge;
    if (draft.curse) clean.curse = true;
    if (draft.description && draft.description.length > 0) clean.description = draft.description;

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
    const newContent = "```item\n" + yamlStr + "```";
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
