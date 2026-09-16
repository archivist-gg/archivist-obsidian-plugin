import type { App, Component } from "obsidian";
import type {
  BackgroundEntity,
  BackgroundToolProficiency,
  BackgroundLanguageProficiency,
} from "@archivist-gg/dnd5e/background/background.types";
import type { StartingEquipmentEntry } from "@archivist-gg/dnd5e/types/equipment-grant";
import { el, createIconProperty, sourceBadgeText, fixedGrantLines } from "../../shared/rendering/renderer-utils";
import { renderMarkdownDescription } from "../../shared/rendering/markdown-description";
import {
  renderBackgroundTables,
  renderSuggestedCharacteristics,
  tablesNotInDescription,
} from "../../shared/rendering/background-tables";

/** Capitalize only the first letter of each whitespace-delimited word. Anchoring
 *  on start/whitespace (rather than `\b`) avoids uppercasing the letter after an
 *  embedded apostrophe — slug tokens like "calligrapher's-supplies" become
 *  "Calligrapher's Supplies", not "Calligrapher'S Supplies". (labelCase replaces
 *  hyphens with spaces first, so every word still starts after whitespace.) */
function titleCase(s: string): string {
  return s.replace(/(^|\s)\w/g, (c) => c.toUpperCase());
}

/** Title-case a hyphenated/slug-ish label, treating dashes as word breaks
 *  (e.g. "animal-handling" → "Animal Handling", "sleight-of-hand" → "Sleight Of Hand").
 *  Mirrors the race/feat renderer helper. */
function labelCase(s: string): string {
  return titleCase(s.replace(/-/g, " "));
}

/** Flatten a tool-proficiency entry into display text. Tokens are stored as
 *  hyphenated slugs, so humanize them through labelCase (consistent with skills). */
function toolText(t: BackgroundToolProficiency): string {
  if (t.kind === "fixed") return t.items.map(labelCase).join(", ");
  return `Choose ${t.count} (${t.from.map(labelCase).join(", ")})`;
}

/** Flatten a language-proficiency entry into display text. The `from` tokens are
 *  hyphenated slugs (humanized), but a bare string sentinel like "any" is free
 *  text and is left untouched. */
function languageText(l: BackgroundLanguageProficiency): string {
  if (l.kind === "fixed") return l.languages.map(labelCase).join(", ");
  const from = Array.isArray(l.from) ? l.from.map(labelCase).join(", ") : l.from;
  return `Choose ${l.count} (${from})`;
}

/** Flatten one structured starting-equipment entry to display text: a choice's
 *  option labels joined " or ", a fixed entry's label (or its humanized
 *  grants), or a gold amount. */
function equipmentText(e: StartingEquipmentEntry): string {
  if (e.kind === "choice") return e.options.map((o) => o.label).join(" or ");
  if (e.kind === "fixed") return fixedGrantLines(e);
  return `${e.amount} GP`;
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

  // R4-G3b §10: the converter roll tables and the suggested characteristics
  // render on the BLOCK element, so the `.archivist-background-block
  // table.archivist-table` dress reaches them; every cell text goes through the
  // shared markdown path.
  // R4-G3b Task 15: on the NOTE the prose's OWN copy wins. The converter emits
  // every one of its 88 roll tables twice · as a `tables:` entry and as a pipe
  // table inside prose · and BOTH prose fields above go through the markdown
  // path, which `.archivist-table`-tags the tables it renders. So only the
  // tables neither field embeds are rendered structurally here.
  // R4-G3b Task 15c: the split is 84 inside `description` and the remaining 4
  // inside the feature's description (Astral Drifter, GGtR Dimir Operative,
  // GGtR Rakdos Cultist, SCAG Inheritor; none is in neither), which is why the
  // filter is handed both fields. The builder step filters too, against the
  // feature's description alone: it shows the background description as text.
  renderBackgroundTables(block, tablesNotInDescription(data.tables, data.description, data.feature?.description), app, component);
  renderSuggestedCharacteristics(block, data.suggested_characteristics, app, component);

  return wrapper;
}
