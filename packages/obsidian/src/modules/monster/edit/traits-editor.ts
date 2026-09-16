import { setIcon } from "obsidian";
import type { Feature } from "@archivist-gg/dnd5e";
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
  feature: Feature,
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
  const entries = feature.entries ?? [];
  textArea.value = entries.join("\n");
  textArea.rows = Math.max(2, entries.join("\n").split("\n").length);
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
 * Looks up the features array stored under a section key on the editable monster. Returns `undefined` for unknown
 * and inactive keys; returns an empty array if the section is ACTIVE but carries no array, so that the "add
 * feature" button still renders.
 *
 * R4-G7 §7.4 · the answer is decided by SHAPE (`Array.isArray`), never by truthiness. An authored scalar under a
 * section key (`traits: some text`) is truthy, so the old test handed the STRING back cast as `Feature[]` and the
 * tab rendered one blank feature card per character of it. This is the only exported reader of a section array
 * (there is no exported `addFeature`; `MonsterEditState.addFeature` reads the key directly).
 */
export function getFeatures(m: EditableMonster, key: string): Feature[] | undefined {
  const featureMap: Record<string, Feature[] | undefined> = {
    traits: m.traits,
    actions: m.actions,
    reactions: m.reactions,
    legendary_actions: m.legendary_actions,
  };
  const result = featureMap[key] ?? (m as unknown as Record<string, unknown>)[key] as Feature[] | undefined;
  return Array.isArray(result) ? result : (m.activeSections?.includes(key) ? [] : undefined);
}
