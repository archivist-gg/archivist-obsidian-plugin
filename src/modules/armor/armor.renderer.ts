import type { ArmorEntity } from "./armor.types";

function buildSubtitle(armor: ArmorEntity): string {
  const parts: string[] = [];
  if (armor.category) parts.push(capitalize(armor.category));
  if (armor.rarity) parts.push(capitalize(armor.rarity));
  return parts.join(" • ");
}

function capitalize(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/_/g, " ");
}

function formatAC(ac: ArmorEntity["ac"]): string {
  if (ac.description) return ac.description;

  let formula = String(ac.base);
  if (ac.flat) formula += ` + ${ac.flat}`;

  const mods: string[] = [];
  if (ac.add_dex) {
    mods.push(ac.dex_max !== undefined ? `Dex modifier (max ${ac.dex_max})` : "Dex modifier");
  }
  if (ac.add_con) mods.push("Con modifier");
  if (ac.add_wis) mods.push("Wis modifier");
  return mods.length > 0 ? `${formula} + ${mods.join(" + ")}` : formula;
}

export function renderArmorBlock(armor: ArmorEntity): HTMLElement {
  const doc = activeDocument;
  const wrapper = doc.createElement("div");
  wrapper.className = "archivist-armor-block-wrapper archivist-item-block-wrapper";

  const block = doc.createElement("div");
  block.className = "archivist-item-block";
  wrapper.appendChild(block);

  const header = doc.createElement("div");
  header.className = "archivist-item-block-header";
  block.appendChild(header);

  const title = doc.createElement("h3");
  title.className = "archivist-item-name";
  title.textContent = armor.name;
  header.appendChild(title);

  const subtitle = buildSubtitle(armor);
  if (subtitle) {
    const sub = doc.createElement("div");
    sub.className = "archivist-item-subtitle";
    sub.textContent = subtitle;
    header.appendChild(sub);
  }

  const props = doc.createElement("div");
  props.className = "archivist-item-properties";
  block.appendChild(props);

  appendProperty(props, "Armor Class", formatAC(armor.ac));
  if (armor.strength_requirement !== undefined) {
    appendProperty(props, "Strength", `Str ${armor.strength_requirement}`);
  }
  if (armor.stealth_disadvantage) {
    appendProperty(props, "Stealth", "Disadvantage");
  }
  if (armor.weight !== undefined && armor.weight !== "") {
    appendProperty(props, "Weight", typeof armor.weight === "number" ? `${armor.weight} lb` : String(armor.weight));
  }
  if (armor.cost) {
    appendProperty(props, "Cost", armor.cost);
  }

  return wrapper;
}

function appendProperty(parent: HTMLElement, label: string, value: string): void {
  const doc = parent.ownerDocument ?? activeDocument;
  const row = doc.createElement("div");
  row.className = "archivist-item-property";

  const labelEl = doc.createElement("span");
  labelEl.className = "archivist-item-property-label";
  labelEl.textContent = label;

  const valueEl = doc.createElement("span");
  valueEl.className = "archivist-item-property-value";
  valueEl.textContent = value;

  row.appendChild(labelEl);
  row.appendChild(valueEl);
  parent.appendChild(row);
}
