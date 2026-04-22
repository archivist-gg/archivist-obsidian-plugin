import { setIcon } from "obsidian";
import type { MonsterFeature } from "../monster.types";
import type { EditableMonster, MonsterEditState } from "../monster.edit-state";
import { attachTagAutocomplete } from "../../../shared/edit/tag-autocomplete";

/**
 * Renders a single feature card (name input + entries textarea + delete
 * button). Used by every feature-section tab (traits, actions,
 * reactions, legendary, etc.). On name/text edit, the whole section's
 * feature array is re-committed so serializer output stays in sync.
 */
export function renderFeatureCard(
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

/**
 * Looks up the features array stored under a section key on the
 * editable monster. Returns `undefined` for unknown keys; returns an
 * empty array if the section is active but the array hasn't been
 * initialised yet, so that the "add feature" button still renders.
 */
export function getFeatures(m: EditableMonster, key: string): MonsterFeature[] | undefined {
  const featureMap: Record<string, MonsterFeature[] | undefined> = {
    traits: m.traits,
    actions: m.actions,
    reactions: m.reactions,
    legendary: m.legendary,
  };
  const result = featureMap[key] ?? (m as unknown as Record<string, unknown>)[key] as MonsterFeature[] | undefined;
  // If the section is active but has no features array yet, return empty array
  // so the add button still renders
  if (!result && m.activeSections?.includes(key)) return [];
  return result;
}
