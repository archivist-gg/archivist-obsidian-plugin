import * as yaml from "js-yaml";
import { Notice } from "obsidian";
import type { MarkdownPostProcessorContext } from "obsidian";
// TODO(phase1): narrow EditContext.plugin to a typed host-plugin handle so
// modules don't reach across into src/main for the concrete class.
import type ArchivistPlugin from "../../../main";
import type { Monster } from "../monster.types";
import { MonsterEditState } from "../monster.edit-state";
import { renderSideButtons } from "../../../shared/edit/side-buttons";
import { createSvgBar } from "../../../shared/rendering/renderer-utils";
import { SaveAsNewModal, CreateCompendiumModal } from "../../../shared/entities/compendium-modal";
import { showCompendiumPicker } from "../../../shared/edit/compendium-picker";
import type { DomRefs } from "./types";
import { renderHeader, renderDamageAndConditions, renderSenses, renderLanguagesAndCR } from "./info-editor";
import { renderCombat } from "./combat-editor";
import { renderAbilities } from "./abilities-editor";
import { renderSaves } from "./saves-editor";
import { renderSkills } from "./skills-editor";
import { setupTabBar, renderTabs, renderTabContent, showSectionDropdown } from "./actions-editor";
import { updateDom } from "./reactive-updates";

/**
 * Entry point for edit-mode rendering of a monster stat block.
 * Orchestrates the section editors (info, combat, abilities, saves,
 * skills, damage/condition, senses, languages, CR, feature tabs) and
 * wires save/cancel through the shared side-buttons bar.
 */
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

  const state = new MonsterEditState(monster, () => {
    updateDom(state, refs);
    updateSideBtns();
  });

  // --- Side buttons (save / save-as-new / cancel) ---
  let sideBtns = el.querySelector<HTMLElement>(".archivist-side-btns");
  if (!sideBtns) {
    sideBtns = el.createDiv({ cls: "archivist-side-btns always-visible" });
  } else {
    sideBtns.addClass("always-visible");
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
      onSaveAsNew: () => handleSaveAsNew(),
      onCompendium: () => {},
      onCancel: () => cancelAndExit(),
      onDelete: () => {},
      onColumnToggle: () => {},
    });
  }

  function handleSaveAsNew() {
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
      if (writable.length === 0) {
        new CreateCompendiumModal(plugin.app, plugin.compendiumManager!, saveTo).open();
      } else if (writable.length === 1) {
        saveTo(writable[0]);
      } else {
        showCompendiumPicker(sideBtns!, writable, saveTo);
      }
    } else {
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
  }
  updateSideBtns();

  // --- Wrapper + sub-editors ---
  const wrapper = el.createDiv({ cls: "archivist-monster-block-wrapper" });
  const block = wrapper.createDiv({ cls: "archivist-monster-block editing" });

  renderHeader(block, state);
  createSvgBar(block);
  renderCombat(block, state, refs);
  createSvgBar(block);
  renderAbilities(block, state, refs);
  createSvgBar(block);
  renderSaves(block, state, refs);
  renderSkills(block, state, refs);
  renderDamageAndConditions(block, state);
  const sensesSection = renderSenses(block, state, refs);
  renderLanguagesAndCR(sensesSection, state, refs);
  createSvgBar(block);

  // --- Tab bar + feature sections ---
  const { addTabBtn, updateScrollArrows } = setupTabBar(block, refs);

  if (state.current.activeSections.length > 0) {
    activeTabKey = state.current.activeSections[0];
  }

  function rebuildTabs() {
    renderTabs(state, refs, activeTabKey, (key) => {
      activeTabKey = key;
      rebuildTabs();
      renderTabContent(state, refs, activeTabKey);
    }, plugin);
    requestAnimationFrame(updateScrollArrows);
  }

  rebuildTabs();
  renderTabContent(state, refs, activeTabKey);

  addTabBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    showSectionDropdown(addTabBtn, state, () => {
      if (state.current.activeSections.length > 0) {
        activeTabKey = state.current.activeSections[state.current.activeSections.length - 1];
      }
      rebuildTabs();
      renderTabContent(state, refs, activeTabKey);
    });
  });

  // --- Save & cancel ---
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
