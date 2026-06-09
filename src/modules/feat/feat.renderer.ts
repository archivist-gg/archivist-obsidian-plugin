import type { App, Component } from "obsidian";
import type { FeatEntity, FeatPrerequisite } from "./feat.types";
import { el, createIconProperty, sourceBadgeText } from "../../shared/rendering/renderer-utils";
import { renderMarkdownDescription } from "../../shared/rendering/markdown-description";

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Slug → display name: drop the compendium prefix, dashes → spaces. */
function slugName(slug: string): string {
  return titleCase(slug.replace(/^[^_]*_/, "").replace(/-/g, " "));
}

function prereqText(p: FeatPrerequisite): string {
  switch (p.kind) {
    case "ability": return `${titleCase(p.ability)} ${p.min}+`;
    case "level": return `Level ${p.min}+`;
    case "spellcaster": return "The ability to cast at least one spell";
    case "proficiency": return `${titleCase(p.proficiency_type)} proficiency: ${titleCase(p.value)}`;
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
  el("div", { cls: "spell-school", text: `${titleCase(data.category)} Feat`, parent: header });

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
