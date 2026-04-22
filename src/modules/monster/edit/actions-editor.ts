import { setIcon } from "obsidian";
import type { MonsterEditState } from "../monster.edit-state";
// TODO(phase1): narrow EditContext.plugin to a typed host-plugin handle so
// modules don't reach across into src/main for the concrete class.
import type ArchivistPlugin from "../../../main";
// TODO(phase1): promote ConfirmModal (and other generic dialogs) out of
// inquiry/shared/modals into a top-level shared/modals tree so cross-module
// reuse doesn't reach into a sibling module.
import { confirm as confirmModal } from "../../inquiry/shared/modals/ConfirmModal";
import { ALL_SECTIONS } from "../../../shared/dnd/constants";
import { createSvgBar } from "../../../shared/rendering/renderer-utils";
import { createSpinButtons } from "../../../shared/edit/spin-buttons";
import {
  type DomRefs,
  SECTION_LABELS,
  SECTION_SINGULAR,
  SECTION_KEY_MAP,
} from "./types";
import { renderFeatureCard, getFeatures } from "./traits-editor";

/**
 * Builds the tab-bar chrome: left/right scroll arrows + the tabs
 * container + the "+" add-tab button + the tab content container.
 * Populates `refs.tabBar` and `refs.tabContent`, and returns the add
 * button and a scroll-arrow updater the caller re-invokes after
 * content changes.
 */
export function setupTabBar(
  block: HTMLElement,
  refs: DomRefs,
): { addTabBtn: HTMLElement; updateScrollArrows: () => void } {
  const tabWrap = block.createDiv({ cls: "archivist-tab-wrap" });

  const scrollLeft = tabWrap.createEl("button", { cls: "archivist-tab-scroll archivist-tab-scroll-left" });
  setIcon(scrollLeft, "chevron-left");

  const tabBarEl = tabWrap.createDiv({ cls: "archivist-tabs" });
  refs.tabBar = tabBarEl;

  const scrollRight = tabWrap.createEl("button", { cls: "archivist-tab-scroll archivist-tab-scroll-right" });
  setIcon(scrollRight, "chevron-right");

  const addTabBtn = tabWrap.createEl("button", { cls: "archivist-tab add-tab", text: "+" });

  const tabContentEl = block.createDiv({ cls: "archivist-tab-content" });
  refs.tabContent = tabContentEl;

  function updateScrollArrows() {
    const canScrollLeft = tabBarEl.scrollLeft > 0;
    const canScrollRight = tabBarEl.scrollLeft + tabBarEl.clientWidth < tabBarEl.scrollWidth - 1;
    scrollLeft.toggleClass("visible", canScrollLeft);
    scrollRight.toggleClass("visible", canScrollRight);
  }

  tabBarEl.addEventListener("scroll", updateScrollArrows);
  scrollLeft.addEventListener("click", () => { tabBarEl.scrollLeft -= 120; });
  scrollRight.addEventListener("click", () => { tabBarEl.scrollLeft += 120; });

  return { addTabBtn, updateScrollArrows };
}

/**
 * Renders the tab bar (one button per active section) into
 * `refs.tabBar`. Clicking a tab invokes `onTabClick(sectionKey)`;
 * clicking the tab's "x" asks for confirmation then removes the
 * section, auto-switching to the first remaining tab.
 */
export function renderTabs(
  state: MonsterEditState,
  refs: DomRefs,
  activeKey: string | null,
  onTabClick: (key: string) => void,
  plugin: ArchivistPlugin,
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
      void confirmModal(plugin.app, `Remove "${label}" section?`, "Remove").then((ok) => {
        if (!ok) return;
        state.removeSection(sectionKey);
        const remaining = state.current.activeSections;
        onTabClick(remaining.length > 0 ? remaining[0] : "");
      });
    });

    tabBtn.addEventListener("click", () => onTabClick(sectionKey));
  }
}

/**
 * Renders the body of the active tab into `refs.tabContent`: a stack
 * of feature cards plus an "+ Add X" button. Legendary tabs get an
 * extra header row with the action-count and resistance-count spin
 * inputs.
 */
export function renderTabContent(
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

/**
 * Opens a dropdown below the anchor listing every addable section
 * (traits, actions, reactions, legendary actions, bonus actions, lair
 * actions, mythic actions). Clicking an item adds it to
 * `activeSections` and invokes `onAdd` so the caller can refresh the
 * tab bar. Closes on outside click.
 */
export function showSectionDropdown(
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
      activeDocument.removeEventListener("click", closeHandler);
    }
  };
  // Delay to avoid immediate close from the same click
  activeWindow.setTimeout(() => activeDocument.addEventListener("click", closeHandler), 0);
}

function renderLegendaryCheckboxes(container: HTMLElement, state: MonsterEditState): void {
  const section = container.createDiv({ cls: "archivist-legendary-counts" });

  // Legendary Actions count
  const actionsField = section.createDiv({ cls: "archivist-legendary-count-field" });
  actionsField.createEl("span", { cls: "archivist-legendary-count-label", text: "Actions:" });
  const actionsWrap = actionsField.createDiv({ cls: "archivist-num-wrap" });
  const actionsInput = actionsWrap.createEl("input", { cls: "archivist-num-in" });
  actionsInput.type = "number";
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
  resistInput.value = String(state.current.legendary_resistance ?? 0);
  resistInput.addEventListener("input", () => {
    state.updateField("legendary_resistance", parseInt(resistInput.value) || 0);
  });
  createSpinButtons(resistWrap, resistInput);

  createSvgBar(container);
}
