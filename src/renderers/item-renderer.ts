import { Item } from "../types/item";
import {
  el,
  createIconProperty,
  renderTextWithInlineTags,
} from "./renderer-utils";

function capitalizeWords(str: string): string {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatAttunement(attunement: Item["attunement"]): string {
  if (attunement === true) return "Required";
  if (typeof attunement === "string") return attunement;
  return "Not Required";
}

function buildSubtitle(item: Item): string {
  const parts: string[] = [];

  if (item.type) {
    parts.push(capitalizeWords(item.type));
  }

  if (item.rarity && item.rarity !== "unknown") {
    parts.push(capitalizeWords(item.rarity));
  }

  if (item.attunement) {
    if (typeof item.attunement === "string") {
      parts.push(`(requires attunement by ${item.attunement})`);
    } else {
      parts.push("(requires attunement)");
    }
  }

  return parts.join(", ");
}

export function renderItemBlock(item: Item): HTMLElement {
  const wrapper = el("div", { cls: "archivist-item-block-wrapper" });
  const block = el("div", { cls: "archivist-item-block", parent: wrapper });

  // 1. Header
  const header = el("div", {
    cls: "archivist-item-block-header",
    parent: block,
  });
  el("h3", {
    cls: "archivist-item-name",
    text: item.name,
    parent: header,
  });
  const subtitle = buildSubtitle(item);
  if (subtitle) {
    el("div", {
      cls: "archivist-item-subtitle",
      text: subtitle,
      parent: header,
    });
  }

  // 2. Properties with icons
  const props = el("div", { cls: "archivist-item-properties", parent: block });

  if (item.attunement !== undefined) {
    createIconProperty(
      props,
      "sparkles",
      "Attunement:",
      formatAttunement(item.attunement),
    );
  }

  if (item.weight) {
    createIconProperty(props, "scale", "Weight:", `${item.weight} lb.`);
  }

  if (item.value) {
    createIconProperty(props, "coins", "Value:", `${item.value} gp`);
  }

  if (item.damage) {
    const damageStr = item.damage_type
      ? `${item.damage} ${item.damage_type}`
      : item.damage;
    createIconProperty(props, "swords", "Damage:", damageStr);
  }

  if (item.properties && item.properties.length > 0) {
    createIconProperty(
      props,
      "shield",
      "Properties:",
      item.properties.map(capitalizeWords).join(", "),
    );
  }

  // 3. Description
  if (item.entries && item.entries.length > 0) {
    const descDiv = el("div", {
      cls: "archivist-item-description",
      parent: block,
    });
    for (const entry of item.entries) {
      const p = el("div", { cls: "description-paragraph", parent: descDiv });
      renderTextWithInlineTags(entry, p);
    }
  }

  // 4. Charges
  if (item.charges) {
    let chargesText = `${item.charges} charges`;
    if (item.recharge) {
      chargesText += `. Recharge: ${item.recharge}`;
    }
    el("div", {
      cls: "archivist-item-charges",
      text: chargesText,
      parent: block,
    });
  }

  // 5. Curse
  if (item.curse) {
    el("div", {
      cls: "archivist-item-curse",
      text: "Cursed",
      parent: block,
    });
  }

  return wrapper;
}
