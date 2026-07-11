import type { App, Component } from "obsidian";
import type { RaceEntity, AbilityScoreIncrease, FixedAbilityIncrease } from "@archivist-gg/dnd5e/race/race.types";
import type { Feature } from "@archivist-gg/dnd5e";
import { el, createIconProperty, sourceBadgeText } from "../../shared/rendering/renderer-utils";
import { renderMarkdownDescription } from "../../shared/rendering/markdown-description";

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Title-case a hyphenated/slug-ish label, treating dashes as word breaks
 *  (e.g. "saving-throw" → "Saving Throw"). Mirrors feat.renderer's helper. */
function labelCase(s: string): string {
  return titleCase(s.replace(/-/g, " "));
}

function isFixedIncrease(asi: AbilityScoreIncrease): asi is FixedAbilityIncrease {
  return "ability" in asi;
}

/** Human-readable summary of an ability-score increase entry. */
function asiText(asi: AbilityScoreIncrease): string {
  if (isFixedIncrease(asi)) {
    return `${titleCase(asi.ability)} +${asi.amount}`;
  }
  const pool = asi.pool.map(titleCase).join("/");
  return `Choose ${asi.choose} (${pool}) +${asi.amount}`;
}

/** The flat text body of a single trait: prefer the `description`, fall back
 *  to joining `entries`. Returns "" when neither is present. */
function traitText(trait: Feature): string {
  if (trait.description && trait.description.length > 0) return trait.description;
  if (trait.entries && trait.entries.length > 0) return trait.entries.join(" ");
  return "";
}

/** The race stat block in the shared parchment-card style. Reuses the
 *  .archivist-spell-block classes (the generic parchment card) with
 *  .archivist-race-block markers for any race-specific overrides. */
export async function renderRaceBlock(
  data: RaceEntity,
  app?: App,
  component?: Component,
): Promise<HTMLElement> {
  const wrapper = el("div", { cls: "archivist-spell-block-wrapper archivist-race-block-wrapper" });
  const block = el("div", { cls: "archivist-spell-block archivist-race-block", parent: wrapper });

  const badgeText = sourceBadgeText(data);
  if (badgeText) el("span", { cls: "source-badge", text: badgeText, parent: block });

  const header = el("div", { cls: "spell-block-header", parent: block });
  el("h3", { cls: "spell-name", text: data.name, parent: header });
  el("div", { cls: "spell-school", text: `${labelCase(data.size)} Race`, parent: header });

  const props = el("div", { cls: "spell-properties", parent: block });
  if (typeof data.speed?.walk === "number") {
    createIconProperty(props, "footprints", "Speed:", `${data.speed.walk} ft.`);
  }
  if (typeof data.vision?.darkvision === "number") {
    createIconProperty(props, "eye", "Darkvision:", `${data.vision.darkvision} ft.`);
  }
  if (data.ability_score_increases && data.ability_score_increases.length > 0) {
    createIconProperty(
      props,
      "sparkles",
      "Ability Scores:",
      data.ability_score_increases.map(asiText).join(", "),
    );
  }
  if (data.languages?.fixed && data.languages.fixed.length > 0) {
    createIconProperty(props, "languages", "Languages:", data.languages.fixed.join(", "));
  }

  if (data.description && data.description.length > 0) {
    const descDiv = el("div", { cls: "spell-description", parent: block });
    await renderMarkdownDescription(descDiv, data.description, app, component);
  }

  if (data.traits.length > 0) {
    const traits = el("div", { cls: "race-traits", parent: block });
    for (const trait of data.traits) {
      const traitDiv = el("div", { cls: "race-trait", parent: traits });
      el("span", { cls: "race-trait-name", text: trait.name, parent: traitDiv });
      const body = el("div", { cls: "race-trait-body", parent: traitDiv });
      await renderMarkdownDescription(body, traitText(trait), app, component);
    }
  }

  return wrapper;
}
