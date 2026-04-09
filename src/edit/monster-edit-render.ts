import * as yaml from "js-yaml";
import { setIcon, Notice } from "obsidian";
import type { MarkdownPostProcessorContext } from "obsidian";
import type ArchivistPlugin from "../main";
import type { Monster, MonsterAbilities, MonsterFeature } from "../types/monster";
import type { EditableMonster } from "../dnd/editable-monster";
import { MonsterEditState } from "./edit-state";
import { attachTagAutocomplete } from "./tag-autocomplete";
import { createSearchableTagSelect } from "./searchable-tag-select";
import { renderSideButtons } from "./side-buttons";
import { createSvgBar } from "../renderers/renderer-utils";
import { SaveAsNewModal, CreateCompendiumModal } from "../entities/compendium-modal";
import { showCompendiumPicker } from "./compendium-picker";
import {
  ABILITY_KEYS, ABILITY_NAMES, ALL_SIZES, ALL_SKILLS, SKILL_ABILITY,
  STANDARD_SENSES, ALL_SECTIONS, ALIGNMENT_ETHICAL, ALIGNMENT_MORAL,
  ALL_CR_VALUES, DAMAGE_TYPES, DAMAGE_NONMAGICAL_VARIANTS, CONDITIONS,
} from "../dnd/constants";
import {
  abilityModifier, formatModifier,
  savingThrow, skillBonus, passivePerception,
} from "../dnd/math";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DomRefs {
  hpValue: HTMLElement;
  hpFormula: HTMLInputElement;
  xpValue: HTMLElement;
  abilityModCells: Record<string, HTMLElement>;
  abilityScoreCells: Record<string, HTMLInputElement>;
  savesGrid: HTMLElement;
  saveValues: Record<string, HTMLElement>;
  saveToggles: Record<string, HTMLElement>;
  skillsGrid: HTMLElement;
  skillValues: Record<string, HTMLElement>;
  skillToggles: Record<string, HTMLElement>;
  sensePPValue: HTMLElement;
  tabContent: HTMLElement;
  tabBar: HTMLElement;
}

// Section key used in activeSections / EditableMonster
type SectionKey = "traits" | "actions" | "reactions" | "legendary" | "bonus_actions" | "lair_actions" | "mythic_actions";

const SECTION_LABELS: Record<string, string> = {
  traits: "Traits", actions: "Actions", reactions: "Reactions",
  legendary: "Legendary Actions", bonus_actions: "Bonus Actions",
  lair_actions: "Lair Actions", mythic_actions: "Mythic Actions",
};

const SECTION_SINGULAR: Record<string, string> = {
  traits: "Trait", actions: "Action", reactions: "Reaction",
  legendary: "Legendary Action", bonus_actions: "Bonus Action",
  lair_actions: "Lair Action", mythic_actions: "Mythic Action",
};

const SECTION_KEY_MAP: Record<string, SectionKey> = {
  "Traits": "traits", "Actions": "actions", "Reactions": "reactions",
  "Legendary Actions": "legendary", "Bonus Actions": "bonus_actions",
  "Lair Actions": "lair_actions", "Mythic Actions": "mythic_actions",
};

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function renderMonsterEditMode(
  monster: Monster,
  el: HTMLElement,
  ctx: MarkdownPostProcessorContext | null | undefined,
  plugin: ArchivistPlugin,
  onCancelExit?: () => void,
  compendiumContext?: { slug: string; compendium: string; readonly: boolean },
  onReplaceRef?: (newRefText: string) => void,
): void {
  const refs: DomRefs = {} as DomRefs;
  refs.saveValues = {};
  refs.saveToggles = {};
  refs.skillValues = {};
  refs.skillToggles = {};

  let activeTabKey: string | null = null;

  // --- State ---
  const state = new MonsterEditState(monster, () => {
    updateDom(state, refs);
    updateSideBtns();
  });

  const m = state.current;

  // --- Side buttons ---
  // Find or create side-btns container (may already exist from main.ts)
  let sideBtns = el.querySelector<HTMLElement>(".archivist-side-btns");
  if (!sideBtns) {
    sideBtns = el.createDiv({ cls: "archivist-side-btns always-visible" });
  } else {
    sideBtns.addClass("always-visible");
  }

  function updateSideBtns() {
    if (!sideBtns) return;
    const sideState = compendiumContext ? "compendium-pending" as const : "pending" as const;
    renderSideButtons(sideBtns!, {
      state: sideState,
      isColumnActive: false,
      isReadonly: compendiumContext?.readonly,
      onEdit: () => cancelAndExit(),
      onSave: () => {
        if (compendiumContext) {
          const yamlStr = state.toYaml();
          const yamlData = yaml.load(yamlStr) as Record<string, unknown>;
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
        const yamlStr = state.toYaml();
        const yamlData = yaml.load(yamlStr) as Record<string, unknown>;

        const saveTo = (comp: { name: string }) => {
          plugin.compendiumManager!.saveEntity(comp.name, "monster", yamlData)
            .then((registered) => {
              if (onReplaceRef) {
                onReplaceRef(`{{monster:${registered.slug}}}`);
              } else {
                const info = ctx?.getSectionInfo(el);
                if (info) {
                  const editor = plugin.app.workspace.activeEditor?.editor;
                  if (editor) {
                    const from = { line: info.lineStart, ch: 0 };
                    const to = { line: info.lineEnd, ch: editor.getLine(info.lineEnd).length };
                    editor.replaceRange(`{{monster:${registered.slug}}}`, from, to);
                  }
                }
              }
              new Notice(`Saved as new to ${comp.name}`);
              if (onCancelExit) onCancelExit();
            })
            .catch((e: Error) => new Notice(`Failed to save: ${e.message}`));
        };

        if (onReplaceRef) {
          // Widget path: no modal for name
          if (writable.length === 0) {
            new CreateCompendiumModal(plugin.app, plugin.compendiumManager!, saveTo).open();
          } else if (writable.length === 1) {
            saveTo(writable[0]);
          } else {
            showCompendiumPicker(sideBtns!, writable, saveTo);
          }
        } else {
          // Code block path: use modal for name
          if (writable.length === 0) {
            new CreateCompendiumModal(plugin.app, plugin.compendiumManager!, (comp) => {
              yamlData.name = state.current.name;
              saveTo(comp);
            }).open();
          } else {
            new SaveAsNewModal(plugin.app, writable, state.current.name, (comp, name) => {
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
  const wrapper = el.createDiv({ cls: "archivist-monster-block-wrapper" });
  const block = wrapper.createDiv({ cls: "archivist-monster-block editing" });

  // =========================================================================
  // 1. HEADER
  // =========================================================================

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

  // =========================================================================
  // 2. SVG Bar
  // =========================================================================
  createSvgBar(block);

  // =========================================================================
  // 3. Core Properties (AC, HP, Speed)
  // =========================================================================

  const coreProps = block.createDiv({ cls: "property-block" });

  // -- AC --
  const acLine = coreProps.createDiv({ cls: "property-line" });
  acLine.createEl("h4", { text: "Armor Class" });
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
  acSourceInput.placeholder = "(source)";
  acSourceInput.addEventListener("input", () => {
    const acArr = state.current.ac ?? [{ ac: 10 }];
    const fromArr = acSourceInput.value.trim() ? acSourceInput.value.split(",").map(s => s.trim()) : undefined;
    acArr[0] = { ...acArr[0], from: fromArr };
    state.updateField("ac", acArr);
  });

  // -- HP --
  const hpLine = coreProps.createDiv({ cls: "property-line" });
  hpLine.createEl("h4", { text: "Hit Points" });
  hpLine.appendText(" ");
  const hpValueEl = hpLine.createEl("span", { cls: "archivist-auto-value", text: String(m.hp?.average ?? 0) });
  refs.hpValue = hpValueEl;
  const hpAutoLabel = hpLine.createEl("span", { cls: "archivist-auto-label", text: "(auto)" });
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
  hpFormulaInput.placeholder = "e.g. 4d8";
  refs.hpFormula = hpFormulaInput;
  hpFormulaInput.addEventListener("input", () => {
    const hp = { ...state.current.hp!, formula: hpFormulaInput.value };
    state.updateField("hp.formula", hpFormulaInput.value);
    state.updateField("hp", hp);
  });

  // -- Speed --
  const speedLine = coreProps.createDiv({ cls: "property-line last" });
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
  speedLine.appendText(" ft.");

  // Extra speed modes — inline pick-and-add
  const extraModeKeys: Array<"fly" | "swim" | "climb" | "burrow"> = ["fly", "swim", "climb", "burrow"];
  const activeSpeedModes: Set<string> = new Set();

  function addSpeedMode(key: "fly" | "swim" | "climb" | "burrow"): void {
    if (activeSpeedModes.has(key)) return;
    activeSpeedModes.add(key);

    // Insert comma before this mode
    const comma = document.createTextNode(", ");
    speedLine.insertBefore(comma, addAnchor);

    const modeSpan = document.createElement("span");
    modeSpan.dataset.speedMode = key;
    speedLine.insertBefore(modeSpan, addAnchor);

    const label = document.createTextNode(`${key} `);
    modeSpan.appendChild(label);

    const numWrap = modeSpan.createDiv({ cls: "archivist-num-wrap" });
    const numInput = numWrap.createEl("input", { cls: "archivist-num-in" });
    numInput.type = "number";
    numInput.value = String(m.speed?.[key] ?? 0);
    numInput.addEventListener("input", () => {
      const speed = { ...state.current.speed, [key]: parseInt(numInput.value) || 0 };
      state.updateField("speed", speed);
    });
    createSpinButtons(numWrap, numInput);

    const ftText = document.createTextNode(" ft.");
    modeSpan.appendChild(ftText);

    const removeBtn = modeSpan.createEl("span", { cls: "archivist-speed-remove", text: "\u00d7" });
    removeBtn.addEventListener("click", () => {
      activeSpeedModes.delete(key);
      // Remove the preceding comma
      const prev = modeSpan.previousSibling;
      if (prev && prev.nodeType === Node.TEXT_NODE && prev.textContent?.includes(",")) {
        prev.remove();
      }
      modeSpan.remove();
      state.updateField("speed", { ...state.current.speed, [key]: 0 });
      updateAddButton();
    });

    updateAddButton();
  }

  // The "+ more" anchor (dropdown container)
  const addAnchor = speedLine.createEl("span", { cls: "archivist-speed-dropdown-anchor" });
  const addBtn = addAnchor.createEl("button", { cls: "archivist-speed-add-btn", text: "+ more" });
  addBtn.style.marginLeft = "6px";
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
    if (closeHandler) { document.removeEventListener("click", closeHandler); closeHandler = null; }
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
    setTimeout(() => document.addEventListener("click", closeHandler!), 0);
  }

  // Pre-populate existing non-zero speeds
  for (const key of extraModeKeys) {
    if ((m.speed?.[key] ?? 0) > 0) {
      addSpeedMode(key);
    }
  }

  // =========================================================================
  // 4. SVG Bar
  // =========================================================================
  createSvgBar(block);

  // =========================================================================
  // 5. Ability Scores
  // =========================================================================

  const abilitiesBlock = block.createDiv({ cls: "abilities-block" });
  const abTable = abilitiesBlock.createEl("table", { cls: "abilities-table" });
  const abThead = abTable.createEl("thead");
  const abHeadRow = abThead.createEl("tr");
  const abTbody = abTable.createEl("tbody");
  const abValRow = abTbody.createEl("tr");

  refs.abilityModCells = {};
  refs.abilityScoreCells = {};

  for (const key of ABILITY_KEYS) {
    abHeadRow.createEl("th", { text: ABILITY_NAMES[key] });

    const valTd = abValRow.createEl("td");
    const scoreWrap = valTd.createDiv({ cls: "archivist-num-wrap" });
    const scoreInput = scoreWrap.createEl("input", { cls: "archivist-num-in" });
    scoreInput.type = "number";
    scoreInput.value = String(getAbilityScore(m, key));
    scoreInput.addEventListener("input", () => {
      const abilities = { ...(state.current.abilities ?? { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }) };
      abilities[key as keyof MonsterAbilities] = parseInt(scoreInput.value) || 10;
      state.updateField("abilities", abilities);
    });
    createSpinButtons(scoreWrap, scoreInput);
    refs.abilityScoreCells[key] = scoreInput;

    // Modifier in SAME td, below the input
    const modDiv = valTd.createDiv({ cls: "archivist-ability-mod" });
    const mod = abilityModifier(getAbilityScore(m, key));
    modDiv.textContent = `(${formatModifier(mod)})`;
    refs.abilityModCells[key] = modDiv;
  }

  // =========================================================================
  // 6. SVG Bar
  // =========================================================================
  createSvgBar(block);

  // =========================================================================
  // 7. Collapsible Saving Throws
  // =========================================================================

  const savesSection = block.createDiv({ cls: "property-block" });
  const { grid: savesGrid } = createCollapsible(savesSection, "Saving Throws", true);
  savesGrid.addClass("archivist-saves-grid");
  refs.savesGrid = savesGrid;

  for (const key of ABILITY_KEYS) {
    const item = savesGrid.createDiv({ cls: "archivist-save-item" });

    const toggle = item.createDiv({ cls: "archivist-prof-toggle" });
    if (state.current.saveProficiencies[key]) toggle.addClass("proficient");
    toggle.addEventListener("click", () => {
      state.toggleSaveProficiency(key);
      updateSaveToggle(toggle, state.current.saveProficiencies[key]);
    });
    refs.saveToggles[key] = toggle;

    item.createEl("span", { cls: "archivist-save-ability", text: ABILITY_NAMES[key] });

    const valEl = item.createEl("span", { cls: "archivist-auto-value" });
    const score = getAbilityScore(state.current, key);
    const profBonus = state.current.proficiencyBonus;
    const saveIsOverridden = state.current.overrides.has(`saves.${key}`);
    const saveVal = saveIsOverridden && state.current.saves?.[key] !== undefined
      ? state.current.saves[key]!
      : savingThrow(score, state.current.saveProficiencies[key], profBonus);
    valEl.textContent = formatModifier(saveVal);
    if (state.current.saveProficiencies[key]) valEl.addClass("proficient-value");
    refs.saveValues[key] = valEl;

    const saveAutoLabel = item.createEl("span", { cls: "archivist-auto-label" });
    wireOverride(valEl, saveAutoLabel, `saves.${key}`,
      () => {
        const sc = getAbilityScore(state.current, key);
        return savingThrow(sc, state.current.saveProficiencies[key], state.current.proficiencyBonus);
      },
      (val) => {
        if (!state.current.saves) state.current.saves = {};
        state.current.saves[key] = val;
        state.setOverride(`saves.${key}`, val);
      },
      () => {
        state.clearOverride(`saves.${key}`);
      },
      formatModifier,
      saveIsOverridden,
    );
  }

  // =========================================================================
  // 8. Collapsible Skills
  // =========================================================================

  const skillsSection = block.createDiv({ cls: "property-block" });
  const { grid: skillsGrid } = createCollapsible(skillsSection, "Skills", false);
  skillsGrid.addClass("archivist-skills-grid");
  refs.skillsGrid = skillsGrid;

  for (const skill of ALL_SKILLS) {
    const skillLower = skill.toLowerCase();
    const abilityKey = SKILL_ABILITY[skillLower];
    const item = skillsGrid.createDiv({ cls: "archivist-skill-item" });

    const profLevel = state.current.skillProficiencies[skillLower] ?? "none";
    const toggle = item.createDiv({ cls: `archivist-prof-toggle${profLevel !== "none" ? ` ${profLevel}` : ""}` });
    toggle.addEventListener("click", () => {
      state.cycleSkillProficiency(skillLower);
      updateSkillToggle(toggle, state.current.skillProficiencies[skillLower] ?? "none");
    });
    refs.skillToggles[skillLower] = toggle;

    item.createEl("span", { cls: "archivist-skill-name", text: skill });

    const valEl = item.createEl("span", { cls: "archivist-skill-value archivist-auto-value" });
    const score = getAbilityScore(state.current, abilityKey);
    const skillIsOverridden = state.current.overrides.has(`skills.${skillLower}`);
    // Capitalize skill name for Monster.skills format (e.g., "animal handling" -> "Animal Handling")
    const skillDisplayName = skillLower.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    const bonus = skillIsOverridden && state.current.skills?.[skillDisplayName] !== undefined
      ? state.current.skills[skillDisplayName]
      : skillBonus(score, profLevel, state.current.proficiencyBonus);
    valEl.textContent = formatModifier(bonus);
    if (profLevel !== "none") valEl.addClass("proficient-value");
    refs.skillValues[skillLower] = valEl;

    const skillAutoLabel = item.createEl("span", { cls: "archivist-auto-label" });
    wireOverride(valEl, skillAutoLabel, `skills.${skillLower}`,
      () => {
        const sc = getAbilityScore(state.current, abilityKey);
        const prof = state.current.skillProficiencies[skillLower] ?? "none";
        return skillBonus(sc, prof, state.current.proficiencyBonus);
      },
      (val) => {
        if (!state.current.skills) state.current.skills = {};
        state.current.skills[skillDisplayName] = val;
        state.setOverride(`skills.${skillLower}`, val);
      },
      () => {
        state.clearOverride(`skills.${skillLower}`);
      },
      formatModifier,
      skillIsOverridden,
    );
  }

  // =========================================================================
  // 9. Collapsible Senses
  // =========================================================================

  const sensesSection = block.createDiv({ cls: "property-block" });
  const { grid: sensesGrid } = createCollapsible(sensesSection, "Senses", true);
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
  ppRow.createEl("span", { cls: "archivist-sense-pp-label", text: "Passive Perception" });
  const ppValue = ppRow.createEl("span", { cls: "archivist-auto-value" });
  const wisScore = getAbilityScore(state.current, "wis");
  const percProf = state.current.skillProficiencies["perception"] ?? "none";
  ppValue.textContent = String(passivePerception(wisScore, percProf, state.current.proficiencyBonus));
  if (percProf !== "none") ppValue.addClass("proficient-value");
  refs.sensePPValue = ppValue;

  // Add sense button
  const addSenseBtn = sensesGrid.createEl("button", { cls: "archivist-add-btn", text: "+ Add Custom Sense" });
  addSenseBtn.addEventListener("click", () => {
    state.current.customSenses.push("New Sense 60 ft.");
    const idx = state.current.customSenses.length - 1;
    const row = renderCustomSenseRow(sensesGrid, state, idx, true);
    addSenseBtn.before(row);
    state.updateField("customSenses", state.current.customSenses);
  });

  // =========================================================================
  // 10. Languages
  // =========================================================================

  const langLine = sensesSection.createDiv({ cls: "property-line" });
  langLine.createEl("h4", { text: "Languages" });
  langLine.appendText(" ");
  const langInput = langLine.createEl("input", { cls: "archivist-edit-input lang" });
  langInput.type = "text";
  langInput.value = m.languages?.join(", ") ?? "";
  langInput.placeholder = "Common, Draconic, ...";
  langInput.addEventListener("input", () => {
    const langs = langInput.value.split(",").map(s => s.trim()).filter(Boolean);
    state.updateField("languages", langs);
  });

  // =========================================================================
  // 11. Challenge Rating
  // =========================================================================

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
  crLine.createEl("span", { cls: "archivist-auto-label", text: "(auto)" });

  // =========================================================================
  // 11b. Damage & Condition Immunities (Collapsible)
  // =========================================================================

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
    const wrapper = sensesSection.createDiv();
    const header = wrapper.createDiv({ cls: "archivist-collapse-header" });
    const arrow = header.createEl("span", { cls: "archivist-collapse-arrow", text: "\u25B6" });
    header.createEl("span", { cls: "archivist-collapse-title", text: cf.title });
    const countEl = header.createEl("span", { cls: "archivist-collapse-count", text: `(${cf.selected.length})` });

    const body = wrapper.createDiv({ cls: "archivist-collapse-body" });
    // Expand if has values, collapse if empty
    if (cf.selected.length === 0) {
      body.addClass("archivist-collapse-body-hidden");
    } else {
      arrow.addClass("archivist-collapse-arrow-open");
    }

    header.addEventListener("click", () => {
      body.classList.toggle("archivist-collapse-body-hidden");
      arrow.classList.toggle("archivist-collapse-arrow-open");
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

  // Last property before SVG bar
  const condImmWrapper = sensesSection.lastElementChild;
  if (condImmWrapper) condImmWrapper.addClass("last");

  // =========================================================================
  // 12. SVG Bar
  // =========================================================================
  createSvgBar(block);

  // =========================================================================
  // 13. Tab Bar & Feature Sections
  // =========================================================================

  const tabWrap = block.createDiv({ cls: "archivist-tab-wrap" });

  // Scroll arrows
  const scrollLeft = tabWrap.createEl("button", { cls: "archivist-tab-scroll archivist-tab-scroll-left" });
  setIcon(scrollLeft, "chevron-left");

  const tabBarEl = tabWrap.createDiv({ cls: "archivist-tabs" });
  refs.tabBar = tabBarEl;

  const scrollRight = tabWrap.createEl("button", { cls: "archivist-tab-scroll archivist-tab-scroll-right" });
  setIcon(scrollRight, "chevron-right");

  // Add tab button
  const addTabBtn = tabWrap.createEl("button", { cls: "archivist-tab add-tab", text: "+" });

  const tabContentEl = block.createDiv({ cls: "archivist-tab-content" });
  refs.tabContent = tabContentEl;

  // Scroll arrow visibility logic
  function updateScrollArrows() {
    const el = tabBarEl;
    const canScrollLeft = el.scrollLeft > 0;
    const canScrollRight = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    scrollLeft.toggleClass("visible", canScrollLeft);
    scrollRight.toggleClass("visible", canScrollRight);
  }

  tabBarEl.addEventListener("scroll", updateScrollArrows);
  scrollLeft.addEventListener("click", () => { tabBarEl.scrollLeft -= 120; });
  scrollRight.addEventListener("click", () => { tabBarEl.scrollLeft += 120; });

  // Set initial active tab
  if (state.current.activeSections.length > 0) {
    activeTabKey = state.current.activeSections[0];
  }

  function rebuildTabs() {
    renderTabs(state, refs, activeTabKey, (key) => {
      activeTabKey = key;
      rebuildTabs();
      renderTabContent(state, refs, activeTabKey);
    });
    // Update arrows after DOM settles
    requestAnimationFrame(updateScrollArrows);
  }

  rebuildTabs();
  renderTabContent(state, refs, activeTabKey);

  // Add tab dropdown
  addTabBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    showSectionDropdown(addTabBtn, state, () => {
      if (!activeTabKey && state.current.activeSections.length > 0) {
        activeTabKey = state.current.activeSections[state.current.activeSections.length - 1];
      }
      rebuildTabs();
      renderTabContent(state, refs, activeTabKey);
    });
  });

  // =========================================================================
  // Save & Cancel
  // =========================================================================

  function saveAndExit() {
    const yamlStr = state.toYaml();
    if (!ctx) { cancelAndExit(); return; }
    const info = ctx.getSectionInfo(el);
    if (!info) { cancelAndExit(); return; }
    const editor = plugin.app.workspace.activeEditor?.editor;
    if (!editor) { cancelAndExit(); return; }

    const fromLine = info.lineStart;
    const toLine = info.lineEnd;
    const endCh = editor.getLine(toLine).length;
    const newContent = "```monster\n" + yamlStr + "```";
    editor.replaceRange(newContent, { line: fromLine, ch: 0 }, { line: toLine, ch: endCh });
    editor.setCursor({ line: fromLine, ch: 0 });
    // Obsidian re-renders the code block after replaceRange, destroying this DOM.
    // If re-render is delayed or content is identical, exit edit mode explicitly.
    if (onCancelExit) onCancelExit();
  }

  function cancelAndExit() {
    state.cancel();
    if (onCancelExit) {
      onCancelExit();
    }
  }
}

// ===========================================================================
// Helper: update DOM after state change
// ===========================================================================

function updateDom(state: MonsterEditState, refs: DomRefs): void {
  const m = state.current;
  const abilities = m.abilities ?? { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  const profBonus = m.proficiencyBonus;

  // HP
  if (refs.hpValue) {
    flashUpdate(refs.hpValue, String(m.hp?.average ?? 0));
  }

  // XP
  if (refs.xpValue) {
    flashUpdate(refs.xpValue, formatXP(m.xp));
  }

  // Ability modifiers
  for (const key of ABILITY_KEYS) {
    if (refs.abilityModCells[key]) {
      const score = abilities[key as keyof MonsterAbilities];
      refs.abilityModCells[key].textContent = `(${formatModifier(abilityModifier(score))})`;
    }
  }

  // Saves
  for (const key of ABILITY_KEYS) {
    if (refs.saveValues[key]) {
      if (!m.overrides.has(`saves.${key}`)) {
        const score = abilities[key as keyof MonsterAbilities];
        const sv = savingThrow(score, m.saveProficiencies[key], profBonus);
        flashUpdate(refs.saveValues[key], formatModifier(sv));
      }
      if (m.saveProficiencies[key]) {
        refs.saveValues[key].addClass("proficient-value");
      } else {
        refs.saveValues[key].removeClass("proficient-value");
      }
    }
    if (refs.saveToggles[key]) {
      updateSaveToggle(refs.saveToggles[key], m.saveProficiencies[key]);
    }
  }

  // Skills
  for (const skill of ALL_SKILLS) {
    const skillLower = skill.toLowerCase();
    const abilityKey = SKILL_ABILITY[skillLower];
    if (refs.skillValues[skillLower]) {
      if (!m.overrides.has(`skills.${skillLower}`)) {
        const score = abilities[abilityKey as keyof MonsterAbilities];
        const prof = m.skillProficiencies[skillLower] ?? "none";
        const bonus = skillBonus(score, prof, profBonus);
        flashUpdate(refs.skillValues[skillLower], formatModifier(bonus));
      }
      const prof = m.skillProficiencies[skillLower] ?? "none";
      if (prof !== "none") {
        refs.skillValues[skillLower].addClass("proficient-value");
      } else {
        refs.skillValues[skillLower].removeClass("proficient-value");
      }
    }
    if (refs.skillToggles[skillLower]) {
      updateSkillToggle(refs.skillToggles[skillLower], m.skillProficiencies[skillLower] ?? "none");
    }
  }

  // Passive Perception
  if (refs.sensePPValue) {
    const wisScore = abilities.wis;
    const percProf = m.skillProficiencies["perception"] ?? "none";
    flashUpdate(refs.sensePPValue, String(passivePerception(wisScore, percProf, profBonus)));
    if (percProf !== "none") {
      refs.sensePPValue.addClass("proficient-value");
    } else {
      refs.sensePPValue.removeClass("proficient-value");
    }
  }
}

// ===========================================================================
// Helper: Tab rendering
// ===========================================================================

function renderTabs(
  state: MonsterEditState,
  refs: DomRefs,
  activeKey: string | null,
  onTabClick: (key: string) => void,
): void {
  const tabBar = refs.tabBar;
  tabBar.empty();

  for (const sectionKey of state.current.activeSections) {
    const label = SECTION_LABELS[sectionKey] ?? sectionKey;
    const tabBtn = tabBar.createEl("button", {
      cls: `archivist-tab${sectionKey === activeKey ? " active" : ""}`,
    });

    // Inner wrapper for label + close button
    const inner = tabBtn.createSpan({ cls: "archivist-tab-inner" });
    inner.createSpan({ text: label });

    // Close button (x)
    const closeBtn = inner.createEl("span", { cls: "archivist-tab-close" });
    setIcon(closeBtn, "x");
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (confirm(`Remove "${label}" section?`)) {
        state.removeSection(sectionKey);
        const remaining = state.current.activeSections;
        onTabClick(remaining.length > 0 ? remaining[0] : "");
      }
    });

    tabBtn.addEventListener("click", () => onTabClick(sectionKey));
  }
}

function renderTabContent(
  state: MonsterEditState,
  refs: DomRefs,
  activeKey: string | null,
): void {
  const container = refs.tabContent;
  container.empty();

  if (!activeKey) {
    container.createDiv({ cls: "archivist-auto-label", text: "Click + to add a section" });
    return;
  }

  // Legendary checkboxes at top of legendary tab
  if (activeKey === "legendary") {
    renderLegendaryCheckboxes(container, state);
  }

  const features = getFeatures(state.current, activeKey);
  if (!features) return;

  for (let i = 0; i < features.length; i++) {
    const feature = features[i];
    renderFeatureCard(container, feature, state, activeKey, i, () => {
      renderTabContent(state, refs, activeKey);
    });
  }

  // Add feature button
  const singular = SECTION_SINGULAR[activeKey] ?? "Feature";
  const addBtn = container.createEl("button", { cls: "archivist-add-btn", text: `+ Add ${singular}` });
  addBtn.addEventListener("click", () => {
    state.addFeature(activeKey);
    renderTabContent(state, refs, activeKey);
  });
}

function renderLegendaryCheckboxes(container: HTMLElement, state: MonsterEditState): void {
  const section = container.createDiv({ cls: "archivist-legendary-counts" });

  // Legendary Actions count
  const actionsField = section.createDiv({ cls: "archivist-legendary-count-field" });
  actionsField.createEl("span", { cls: "archivist-legendary-count-label", text: "Actions:" });
  const actionsWrap = actionsField.createDiv({ cls: "archivist-num-wrap" });
  const actionsInput = actionsWrap.createEl("input", { cls: "archivist-num-in" });
  actionsInput.type = "number";
  actionsInput.style.width = "36px";
  actionsInput.value = String(state.current.legendary_actions ?? 3);
  actionsInput.addEventListener("input", () => {
    state.updateField("legendary_actions", parseInt(actionsInput.value) || 0);
  });
  createSpinButtons(actionsWrap, actionsInput);

  // Legendary Resistance count
  const resistField = section.createDiv({ cls: "archivist-legendary-count-field" });
  resistField.createEl("span", { cls: "archivist-legendary-count-label", text: "Resistance:" });
  const resistWrap = resistField.createDiv({ cls: "archivist-num-wrap" });
  const resistInput = resistWrap.createEl("input", { cls: "archivist-num-in" });
  resistInput.type = "number";
  resistInput.style.width = "36px";
  resistInput.value = String(state.current.legendary_resistance ?? 0);
  resistInput.addEventListener("input", () => {
    state.updateField("legendary_resistance", parseInt(resistInput.value) || 0);
  });
  createSpinButtons(resistWrap, resistInput);

  createSvgBar(container);
}

function renderFeatureCard(
  container: HTMLElement,
  feature: MonsterFeature,
  state: MonsterEditState,
  sectionKey: string,
  index: number,
  onRemove: () => void,
): void {
  const card = container.createDiv({ cls: "archivist-feat-card" });

  // Remove button
  const removeBtn = card.createEl("button", { cls: "archivist-feat-card-x" });
  setIcon(removeBtn, "x");
  removeBtn.addEventListener("click", () => {
    state.removeFeature(sectionKey, index);
    onRemove();
  });

  // Name input
  const nameInput = card.createEl("input", { cls: "archivist-feat-name-input" });
  nameInput.type = "text";
  nameInput.value = feature.name;
  nameInput.addEventListener("input", () => {
    feature.name = nameInput.value;
    state.updateField(sectionKey, getFeatures(state.current, sectionKey));
  });

  // Text textarea
  const textArea = card.createEl("textarea", { cls: "archivist-feat-text-input" });
  textArea.value = feature.entries.join("\n");
  textArea.rows = Math.max(2, feature.entries.join("\n").split("\n").length);
  textArea.addEventListener("input", () => {
    feature.entries = textArea.value.split("\n");
    state.updateField(sectionKey, getFeatures(state.current, sectionKey));
    // Auto-resize
    textArea.rows = Math.max(2, textArea.value.split("\n").length);
  });

  // Attach backtick-triggered tag autocomplete
  attachTagAutocomplete(textArea, state);
}

// ===========================================================================
// Helper: Section dropdown
// ===========================================================================

function showSectionDropdown(
  anchor: HTMLElement,
  state: MonsterEditState,
  onAdd: () => void,
): void {
  // Remove any existing dropdown — use tab-wrap (overflow: visible) as container
  const tabWrap = anchor.closest(".archivist-tab-wrap") ?? anchor.parentElement!;
  const existing = tabWrap.querySelector(".archivist-section-dropdown");
  if (existing) { existing.remove(); return; }

  const dropdown = (tabWrap as HTMLElement).createDiv({ cls: "archivist-section-dropdown" });
  // Position below the "+" button by measuring its offset within tab-wrap
  const anchorRect = anchor.getBoundingClientRect();
  const wrapRect = (tabWrap as HTMLElement).getBoundingClientRect();
  dropdown.style.left = `${anchorRect.left - wrapRect.left}px`;

  for (const section of ALL_SECTIONS) {
    const sectionKey = SECTION_KEY_MAP[section];
    if (!sectionKey) continue;

    const isActive = state.current.activeSections.includes(sectionKey);
    const item = dropdown.createEl("button", {
      cls: `archivist-section-dropdown-item${isActive ? " disabled" : ""}`,
      text: section,
    });

    if (!isActive) {
      item.addEventListener("click", () => {
        state.addSection(sectionKey);
        dropdown.remove();
        onAdd();
      });
    }
  }

  // Close on click outside
  const closeHandler = (e: MouseEvent) => {
    if (!dropdown.contains(e.target as Node) && e.target !== anchor) {
      dropdown.remove();
      document.removeEventListener("click", closeHandler);
    }
  };
  // Delay to avoid immediate close from the same click
  setTimeout(() => document.addEventListener("click", closeHandler), 0);
}

// ===========================================================================
// Helper: Collapsible section
// ===========================================================================

function createCollapsible(
  parent: HTMLElement,
  title: string,
  startOpen: boolean,
): { header: HTMLElement; grid: HTMLElement } {
  const headerEl = parent.createDiv({ cls: "archivist-coll-header" });
  const chevron = headerEl.createEl("span", { cls: `archivist-coll-chevron${startOpen ? " open" : ""}` });
  setIcon(chevron, "chevron-right");
  headerEl.createEl("h4", { text: title });

  const grid = parent.createDiv();
  grid.style.display = startOpen ? "" : "none";

  headerEl.addEventListener("click", () => {
    const isOpen = chevron.hasClass("open");
    if (isOpen) {
      chevron.removeClass("open");
      grid.style.display = "none";
    } else {
      chevron.addClass("open");
      grid.style.display = "";
    }
  });

  return { header: headerEl, grid };
}

// ===========================================================================
// Helper: Custom number spinners
// ===========================================================================

function createSpinButtons(wrap: HTMLElement, input: HTMLInputElement): void {
  const spinDiv = wrap.createDiv({ cls: "archivist-num-spin" });

  const upBtn = spinDiv.createEl("button");
  upBtn.textContent = "\u25B2"; // triangle up
  upBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    input.value = String((parseInt(input.value) || 0) + 1);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });

  const downBtn = spinDiv.createEl("button");
  downBtn.textContent = "\u25BC"; // triangle down
  downBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    input.value = String((parseInt(input.value) || 0) - 1);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

// ===========================================================================
// Helper: Override system
// ===========================================================================

function wireOverride(
  valueEl: HTMLElement,
  autoLabel: HTMLElement,
  field: string,
  getAutoValue: () => number,
  onSet: (val: number) => void,
  onClear: () => void,
  fmt: (val: number) => string = String,
  isAlreadyOverridden = false,
): void {
  let overrideInput: HTMLInputElement | null = null;
  let overrideMark: HTMLElement | null = null;

  function createOverrideMark(): HTMLElement {
    const mark = document.createElement("span");
    mark.className = "archivist-override-mark";
    mark.textContent = "*";
    mark.title = "Overridden -- click to restore auto-calculation";
    mark.addEventListener("click", (e) => {
      e.stopPropagation();
      onClear();
      if (overrideMark) { overrideMark.remove(); overrideMark = null; }
      autoLabel.textContent = "(auto)";
    });
    return mark;
  }

  // If already overridden on initial render, show the asterisk mark immediately
  if (isAlreadyOverridden) {
    overrideMark = createOverrideMark();
    valueEl.after(overrideMark);
  }

  valueEl.addEventListener("click", () => {
    if (overrideInput) return; // already open

    const currentVal = parseInt(valueEl.textContent ?? "0") || 0;
    overrideInput = document.createElement("input");
    overrideInput.type = "number";
    overrideInput.value = String(currentVal);
    overrideInput.className = "archivist-num-in";
    overrideInput.style.width = "50px";
    overrideInput.style.display = "inline-block";

    valueEl.textContent = "";
    valueEl.appendChild(overrideInput);
    autoLabel.textContent = "";
    overrideInput.focus();
    overrideInput.select();

    const commit = () => {
      const val = parseInt(overrideInput?.value ?? "") || getAutoValue();
      if (overrideInput) {
        overrideInput.remove();
        overrideInput = null;
      }
      valueEl.textContent = fmt(val);
      onSet(val);

      // Add override mark (asterisk)
      if (!overrideMark) {
        overrideMark = createOverrideMark();
      }
      valueEl.after(overrideMark);
    };

    overrideInput.addEventListener("blur", commit);
    overrideInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); commit(); }
      if (e.key === "Escape") {
        if (overrideInput) { overrideInput.remove(); overrideInput = null; }
        valueEl.textContent = fmt(getAutoValue());
        autoLabel.textContent = "(auto)";
      }
    });
  });
}

// ===========================================================================
// Helper: Custom sense row
// ===========================================================================

function renderCustomSenseRow(
  grid: HTMLElement,
  state: MonsterEditState,
  index: number,
  returnOnly = false,
): HTMLElement {
  const row = document.createElement("div");
  row.className = "archivist-sense-custom";

  // Filled circle indicator (matches standard sense toggle in "proficient" state)
  const indicator = document.createElement("div");
  indicator.className = "archivist-prof-toggle proficient";
  row.appendChild(indicator);

  // Parse stored string like "Devil's Sight 60 ft." into name + range
  const raw = state.current.customSenses[index] ?? "";
  const rangeMatch = raw.match(/(\d+\s*ft\.?\s*)$/i);
  const parsedName = rangeMatch ? raw.slice(0, raw.length - rangeMatch[0].length).trim() : raw;
  const parsedRange = rangeMatch ? rangeMatch[1].trim() : "60 ft.";

  const nameInput = document.createElement("input");
  nameInput.className = "archivist-sense-custom-name";
  nameInput.type = "text";
  nameInput.value = parsedName;
  nameInput.placeholder = "Sense name";
  nameInput.addEventListener("input", () => {
    state.current.customSenses[index] = `${nameInput.value} ${rangeInput.value}`.trim();
    state.updateField("customSenses", state.current.customSenses);
  });
  row.appendChild(nameInput);

  const rangeInput = document.createElement("input");
  rangeInput.className = "archivist-sense-range";
  rangeInput.type = "text";
  rangeInput.value = parsedRange;
  rangeInput.placeholder = "-- ft.";
  rangeInput.addEventListener("input", () => {
    state.current.customSenses[index] = `${nameInput.value} ${rangeInput.value}`.trim();
    state.updateField("customSenses", state.current.customSenses);
  });
  row.appendChild(rangeInput);

  const removeBtn = document.createElement("button");
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

// ===========================================================================
// Helper: Toggle updates
// ===========================================================================

function updateSaveToggle(toggle: HTMLElement, isProficient: boolean): void {
  toggle.removeClass("proficient");
  if (isProficient) toggle.addClass("proficient");
}

function updateSkillToggle(toggle: HTMLElement, level: "none" | "proficient" | "expertise"): void {
  toggle.removeClass("proficient");
  toggle.removeClass("expertise");
  if (level !== "none") toggle.addClass(level);
}

// ===========================================================================
// Helper: Flash update animation
// ===========================================================================

function flashUpdate(el: HTMLElement, newValue: string): void {
  if (el.textContent === newValue) return;
  el.textContent = newValue;
  el.removeClass("flash");
  // Force reflow
  void el.offsetWidth;
  el.addClass("flash");
}

// ===========================================================================
// Helper: Alignment parsing
// ===========================================================================

function selectByAlignment(selectEl: HTMLSelectElement, alignment: string | undefined, axis: "ethical" | "moral"): void {
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

// ===========================================================================
// Helper: Get ability score safely
// ===========================================================================

function getAbilityScore(m: EditableMonster | Monster, key: string): number {
  if (!m.abilities) return 10;
  return m.abilities[key as keyof MonsterAbilities] ?? 10;
}

// ===========================================================================
// Helper: Get features array for a section key
// ===========================================================================

function getFeatures(m: EditableMonster, key: string): MonsterFeature[] | undefined {
  const featureMap: Record<string, MonsterFeature[] | undefined> = {
    traits: m.traits,
    actions: m.actions,
    reactions: m.reactions,
    legendary: m.legendary,
  };
  const result = featureMap[key] ?? (m as Record<string, unknown>)[key] as MonsterFeature[] | undefined;
  // If the section is active but has no features array yet, return empty array
  // so the add button still renders
  if (!result && m.activeSections?.includes(key)) return [];
  return result;
}

// ===========================================================================
// Helper: Format XP with commas
// ===========================================================================

function formatXP(xp: number): string {
  return xp.toLocaleString();
}
