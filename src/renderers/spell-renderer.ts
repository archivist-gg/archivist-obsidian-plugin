import { setIcon } from "obsidian";
import { Spell } from "../types/spell";
import {
  el,
  createIconProperty,
  renderTextWithInlineTags,
} from "../shared/rendering/renderer-utils";

function getSpellHeader(spell: Spell): string {
  const level = spell.level ?? 0;
  const school = spell.school ?? "Unknown";
  if (level === 0) {
    return `${school} cantrip`;
  }
  const ordinal =
    level === 1
      ? "1st"
      : level === 2
        ? "2nd"
        : level === 3
          ? "3rd"
          : `${level}th`;
  return `${ordinal}-level ${school.toLowerCase()}`;
}

export function renderSpellBlock(spell: Spell): HTMLElement {
  const wrapper = el("div", { cls: "archivist-spell-block-wrapper" });
  const block = el("div", { cls: "archivist-spell-block", parent: wrapper });

  // 1. Header
  const header = el("div", { cls: "spell-block-header", parent: block });
  el("h3", { cls: "spell-name", text: spell.name, parent: header });
  el("div", {
    cls: "spell-school",
    text: getSpellHeader(spell),
    parent: header,
  });

  // 2. Properties with icons
  const props = el("div", { cls: "spell-properties", parent: block });
  if (spell.casting_time) {
    createIconProperty(props, "clock", "Casting Time:", spell.casting_time);
  }
  if (spell.range) {
    createIconProperty(props, "target", "Range:", spell.range);
  }
  if (spell.components) {
    createIconProperty(props, "box", "Components:", spell.components);
  }
  if (spell.duration) {
    createIconProperty(props, "sparkles", "Duration:", spell.duration);
  }

  // 3. Description
  if (spell.description && spell.description.length > 0) {
    const descDiv = el("div", { cls: "spell-description", parent: block });
    for (const paragraph of spell.description) {
      const p = el("div", { cls: "description-paragraph", parent: descDiv });
      renderTextWithInlineTags(paragraph, p);
    }
  }

  // 4. At Higher Levels
  if (spell.at_higher_levels && spell.at_higher_levels.length > 0) {
    const higherDiv = el("div", {
      cls: "spell-higher-levels",
      parent: block,
    });
    el("div", {
      cls: "higher-levels-header",
      text: "At Higher Levels.",
      parent: higherDiv,
    });
    for (const text of spell.at_higher_levels) {
      const p = el("div", { cls: "description-paragraph", parent: higherDiv });
      renderTextWithInlineTags(text, p);
    }
  }

  // 5. Classes
  if (spell.classes && spell.classes.length > 0) {
    const classesDiv = el("div", { cls: "spell-classes", parent: block });
    const iconSpan = el("span", { cls: "archivist-property-icon", parent: classesDiv });
    setIcon(iconSpan, "book-open");
    el("span", {
      cls: "classes-list",
      text: spell.classes
        .map((c) => c.charAt(0).toUpperCase() + c.slice(1).toLowerCase())
        .join(", "),
      parent: classesDiv,
    });
  }

  // 6. Tags
  const tagsDiv = el("div", { cls: "spell-tags", parent: block });
  if (spell.concentration) {
    el("span", {
      cls: ["spell-tag", "concentration"],
      text: "Concentration",
      parent: tagsDiv,
    });
  }
  if (spell.ritual) {
    el("span", {
      cls: ["spell-tag", "ritual"],
      text: "Ritual",
      parent: tagsDiv,
    });
  }

  return wrapper;
}
