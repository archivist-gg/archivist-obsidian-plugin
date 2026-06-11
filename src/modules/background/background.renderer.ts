import type { App, Component } from "obsidian";
import type {
  BackgroundEntity,
  BackgroundToolProficiency,
  BackgroundLanguageProficiency,
  BackgroundEquipmentEntry,
} from "./background.types";
import { el, createIconProperty, sourceBadgeText } from "../../shared/rendering/renderer-utils";
import { renderMarkdownDescription } from "../../shared/rendering/markdown-description";

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Title-case a hyphenated/slug-ish label, treating dashes as word breaks
 *  (e.g. "animal-handling" → "Animal Handling", "sleight-of-hand" → "Sleight Of Hand").
 *  Mirrors the race/feat renderer helper. */
function labelCase(s: string): string {
  return titleCase(s.replace(/-/g, " "));
}

/** Flatten a tool-proficiency entry into display text. */
function toolText(t: BackgroundToolProficiency): string {
  if (t.kind === "fixed") return t.items.join(", ");
  return `Choose ${t.count} (${t.from.join(", ")})`;
}

/** Flatten a language-proficiency entry into display text. */
function languageText(l: BackgroundLanguageProficiency): string {
  if (l.kind === "fixed") return l.languages.join(", ");
  const from = Array.isArray(l.from) ? l.from.join(", ") : l.from;
  return `Choose ${l.count} (${from})`;
}

/** Flatten one equipment entry: either an item line or a currency line. */
function equipmentText(e: BackgroundEquipmentEntry): string {
  if ("kind" in e && e.kind === "currency") {
    const coins: string[] = [];
    if (e.pp) coins.push(`${e.pp} pp`);
    if (e.gp) coins.push(`${e.gp} gp`);
    if (e.ep) coins.push(`${e.ep} ep`);
    if (e.sp) coins.push(`${e.sp} sp`);
    if (e.cp) coins.push(`${e.cp} cp`);
    return coins.join(", ");
  }
  const item = e as { item: string; quantity: number };
  return item.quantity > 1 ? `${item.item} (×${item.quantity})` : item.item;
}

/** The background stat block in the shared parchment-card style. Reuses the
 *  .archivist-spell-block classes (the generic parchment card) with
 *  .archivist-background-block markers for any background-specific overrides,
 *  and reuses the race-block trait treatment for the feature entry. */
export async function renderBackgroundBlock(
  data: BackgroundEntity,
  app?: App,
  component?: Component,
): Promise<HTMLElement> {
  const wrapper = el("div", {
    cls: "archivist-spell-block-wrapper archivist-background-block-wrapper",
  });
  const block = el("div", {
    cls: "archivist-spell-block archivist-background-block",
    parent: wrapper,
  });

  const badgeText = sourceBadgeText(data);
  if (badgeText) el("span", { cls: "source-badge", text: badgeText, parent: block });

  const header = el("div", { cls: "spell-block-header", parent: block });
  el("h3", { cls: "spell-name", text: data.name, parent: header });
  el("div", { cls: "spell-school", text: "Background", parent: header });

  const props = el("div", { cls: "spell-properties", parent: block });
  if (data.skill_proficiencies.length > 0) {
    createIconProperty(
      props,
      "sparkles",
      "Skills:",
      data.skill_proficiencies.map(labelCase).join(", "),
    );
  }
  if (data.tool_proficiencies.length > 0) {
    createIconProperty(
      props,
      "wrench",
      "Tools:",
      data.tool_proficiencies.map(toolText).join("; "),
    );
  }
  if (data.language_proficiencies.length > 0) {
    createIconProperty(
      props,
      "languages",
      "Languages:",
      data.language_proficiencies.map(languageText).join("; "),
    );
  }
  if (data.equipment.length > 0) {
    createIconProperty(
      props,
      "backpack",
      "Equipment:",
      data.equipment.map(equipmentText).filter(Boolean).join(", "),
    );
  }

  if (data.description && data.description.length > 0) {
    const descDiv = el("div", { cls: "spell-description", parent: block });
    await renderMarkdownDescription(descDiv, data.description, app, component);
  }

  // The background feature renders as a named entry in the race-trait idiom
  // (bold serif name + markdown body, top-bordered section).
  if (data.feature && data.feature.name) {
    const traits = el("div", { cls: "race-traits", parent: block });
    const traitDiv = el("div", { cls: "race-trait", parent: traits });
    el("span", { cls: "race-trait-name", text: data.feature.name, parent: traitDiv });
    if (data.feature.description && data.feature.description.length > 0) {
      const body = el("div", { cls: "race-trait-body", parent: traitDiv });
      await renderMarkdownDescription(body, data.feature.description, app, component);
    }
  }

  return wrapper;
}
