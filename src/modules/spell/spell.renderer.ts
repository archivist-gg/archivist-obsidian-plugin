import { setIcon, type App, Component } from "obsidian";
import { Spell } from "./spell.types";
import {
  el,
  createIconProperty,
  renderTextWithInlineTags,
} from "../../shared/rendering/renderer-utils";
import { renderMarkdownDescription } from "../../shared/rendering/markdown-description";

function ordinal(n: number): string {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, c => c.toUpperCase());
}

function getSpellHeader(spell: Spell): string {
  const level = spell.level ?? 0;
  const school = titleCase(spell.school ?? "Unknown");
  if (level === 0) return `${school} cantrip`;
  return `${ordinal(level)}-level ${school}`;
}

export async function renderSpellBlock(
  spell: Spell,
  app?: App,
  component?: Component,
): Promise<HTMLElement> {
  const wrapper = el("div", { cls: "archivist-spell-block-wrapper" });
  const block = el("div", { cls: "archivist-spell-block", parent: wrapper });

  // Header
  const header = el("div", { cls: "spell-block-header", parent: block });
  el("h3", { cls: "spell-name", text: spell.name, parent: header });
  el("div", { cls: "spell-school", text: getSpellHeader(spell), parent: header });

  // Properties (icon-prefixed)
  const props = el("div", { cls: "spell-properties", parent: block });
  if (spell.casting_time) createIconProperty(props, "clock", "Casting Time:", spell.casting_time);
  if (spell.range) createIconProperty(props, "target", "Range:", spell.range);
  if (spell.components) createIconProperty(props, "box", "Components:", spell.components);
  if (spell.duration) createIconProperty(props, "sparkles", "Duration:", spell.duration);
  if (spell.damage?.types && spell.damage.types.length > 0) {
    createIconProperty(props, "flame", "Damage Type:", spell.damage.types.map(titleCase).join(", "));
  }
  if (spell.saving_throw?.ability) {
    createIconProperty(props, "shield-alert", "Save:", titleCase(spell.saving_throw.ability));
  }

  // Description (markdown)
  if (spell.description && spell.description.length > 0) {
    const descDiv = el("div", { cls: "spell-description", parent: block });
    await renderMarkdownDescription(descDiv, spell.description, app, component);
  }

  // At Higher Levels — always prose; casting_options stays in the data model
  // but is NOT displayed in the spell card (consumed later by PC spellcasting).
  if (spell.at_higher_levels && spell.at_higher_levels.length > 0) {
    const higherDiv = el("div", { cls: "spell-higher-levels", parent: block });
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

  // Classes (wikilinked via inline-tags)
  if (spell.classes && spell.classes.length > 0) {
    const classesDiv = el("div", { cls: "spell-classes", parent: block });
    const iconSpan = el("span", { cls: "archivist-property-icon", parent: classesDiv });
    setIcon(iconSpan, "book-open");
    const list = el("span", { cls: "classes-list", parent: classesDiv });
    const wikilinkText = spell.classes
      .map(c => `[[${c.toLowerCase()}|${titleCase(c)}]]`)
      .join(", ");
    renderTextWithInlineTags(wikilinkText, list);
  }

  // Tags
  const tagsDiv = el("div", { cls: "spell-tags", parent: block });
  if (spell.concentration) {
    el("span", { cls: ["spell-tag", "concentration"], text: "Concentration", parent: tagsDiv });
  }
  if (spell.ritual) {
    el("span", { cls: ["spell-tag", "ritual"], text: "Ritual", parent: tagsDiv });
  }

  return wrapper;
}
