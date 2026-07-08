import type { App, Component } from "obsidian";
import type { FeatEntity, FeatPrerequisite } from "@archivist/dnd5e/feat/feat.types";
import { el, createIconProperty, sourceBadgeText } from "../../shared/rendering/renderer-utils";
import { renderMarkdownDescription } from "../../shared/rendering/markdown-description";

/** Capitalize only the first letter of each whitespace-delimited word. Anchoring
 *  on start/whitespace (rather than `\b`) avoids uppercasing the letter after an
 *  embedded apostrophe in slug tokens (e.g. a "thieves'-tools" proficiency value
 *  → "Thieves' Tools", a "smith's-tools" value → "Smith's Tools"). labelCase
 *  replaces hyphens with spaces first, so every word still starts after space. */
function titleCase(s: string): string {
  return s.replace(/(^|\s)\w/g, (c) => c.toUpperCase());
}

/** Title-case a hyphenated/slug-ish label, treating dashes as word breaks
 *  (e.g. "saving-throw" → "Saving Throw", "fighting-style" → "Fighting Style"). */
function labelCase(s: string): string {
  return titleCase(s.replace(/-/g, " "));
}

/** Slug → display name: drop the compendium prefix, dashes → spaces.
 *  Assumes a single leading `prefix_` underscore segment (e.g. "srd-5e_high-elf"). */
function slugName(slug: string): string {
  return titleCase(slug.replace(/^[^_]*_/, "").replace(/-/g, " "));
}

function prereqText(p: FeatPrerequisite): string {
  switch (p.kind) {
    case "ability": return `${titleCase(p.ability)} ${p.min}+`;
    case "level": return `Level ${p.min}+`;
    case "spellcaster": return "The ability to cast at least one spell";
    case "proficiency": return `${labelCase(p.proficiency_type)} proficiency: ${labelCase(p.value)}`;
    case "race": return slugName(p.slug);
    case "class": return slugName(p.slug);
  }
}

/** The feat stat block in the shared parchment-card style. Reuses the
 *  .archivist-spell-block classes (the generic parchment card) with
 *  .archivist-feat-block markers for any feat-specific overrides. */
export async function renderFeatBlock(
  data: FeatEntity,
  app?: App,
  component?: Component,
): Promise<HTMLElement> {
  const wrapper = el("div", { cls: "archivist-spell-block-wrapper archivist-feat-block-wrapper" });
  const block = el("div", { cls: "archivist-spell-block archivist-feat-block", parent: wrapper });

  const badgeText = sourceBadgeText(data);
  if (badgeText) el("span", { cls: "source-badge", text: badgeText, parent: block });

  const header = el("div", { cls: "spell-block-header", parent: block });
  el("h3", { cls: "spell-name", text: data.name, parent: header });
  el("div", { cls: "spell-school", text: `${labelCase(data.category)} Feat`, parent: header });

  const props = el("div", { cls: "spell-properties", parent: block });
  if (data.prerequisites.length > 0) {
    createIconProperty(props, "lock", "Prerequisites:", data.prerequisites.map(prereqText).join("; "));
  }
  if (data.repeatable) createIconProperty(props, "repeat", "Repeatable:", "Yes");

  if (data.description && data.description.length > 0) {
    const descDiv = el("div", { cls: "spell-description", parent: block });
    await renderMarkdownDescription(descDiv, data.description, app, component);
  }

  if (data.benefits.length > 0) {
    const benefits = el("div", { cls: "feat-benefits", parent: block });
    const ul = benefits.createEl("ul");
    for (const b of data.benefits) ul.createEl("li", { text: b });
  }

  return wrapper;
}
