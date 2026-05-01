import { setIcon } from "obsidian";
import { Spell } from "./spell.types";
import {
  el,
  createIconProperty,
  renderTextWithInlineTags,
} from "../../shared/rendering/renderer-utils";

function ordinal(n: number): string {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

function getSpellHeader(spell: Spell): string {
  const level = spell.level ?? 0;
  const school = spell.school ?? "Unknown";
  if (level === 0) {
    return `${school} cantrip`;
  }
  return `${ordinal(level)}-level ${school.toLowerCase()}`;
}

/**
 * Render the slot-scaling table from casting_options if present, else fall
 * back to the prose at_higher_levels block. Returns true when something was
 * rendered.
 */
function renderSlotScalingOrHigherLevels(parent: HTMLElement, spell: Spell): boolean {
  const slotOpts = (spell.casting_options ?? []).filter((o) =>
    o.type.startsWith("slot_level_"),
  );
  if (slotOpts.length > 0) {
    const wrap = el("div", { cls: "spell-higher-levels", parent });
    el("div", {
      cls: "higher-levels-header",
      text: "At Higher Levels.",
      parent: wrap,
    });
    const table = el("table", { cls: "spell-slot-scaling-table", parent: wrap });
    const thead = el("thead", { parent: table });
    const headerRow = el("tr", { parent: thead });
    el("th", { text: "Slot", parent: headerRow });
    el("th", { text: "Damage", parent: headerRow });
    const tbody = el("tbody", { parent: table });
    for (const opt of slotOpts) {
      const lvlMatch = opt.type.match(/slot_level_(\d+)/);
      const lvl = lvlMatch ? parseInt(lvlMatch[1], 10) : 0;
      const row = el("tr", { parent: tbody });
      el("td", { text: ordinal(lvl), parent: row });
      el("td", {
        text: opt.damage_roll && opt.damage_roll.length > 0 ? opt.damage_roll : "—",
        parent: row,
      });
    }
    return true;
  }

  if (spell.at_higher_levels && spell.at_higher_levels.length > 0) {
    const higherDiv = el("div", { cls: "spell-higher-levels", parent });
    el("div", {
      cls: "higher-levels-header",
      text: "At Higher Levels.",
      parent: higherDiv,
    });
    for (const text of spell.at_higher_levels) {
      const p = el("div", { cls: "description-paragraph", parent: higherDiv });
      renderTextWithInlineTags(text, p);
    }
    return true;
  }

  return false;
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

  // 4. At Higher Levels — table from casting_options[] if present, else prose
  renderSlotScalingOrHigherLevels(block, spell);

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
