import type { WeaponEntity, WeaponProperty } from "@archivist-gg/dnd5e/weapon/weapon.types";
import type { AttackRow } from "@archivist-gg/dnd5e/pc/pc.types";
import { humanizeToken } from "../../shared/rendering/renderer-utils";

function formatDamage(d: WeaponEntity["damage"]): string {
  if (!d.dice || d.dice === "0") return "—";
  const versatile = d.versatile_dice ? ` (${d.versatile_dice})` : "";
  const type = d.type ? ` ${d.type}` : "";
  return `${d.dice}${versatile}${type}`;
}

function formatRange(r: { normal: number; long: number } | undefined): string | null {
  if (!r) return null;
  return `${r.normal} / ${r.long} ft`;
}

function formatProperty(p: WeaponProperty): string {
  if (typeof p === "string") return humanizeToken(p);
  return humanizeToken(p.uid);
}

export function renderWeaponBlock(weapon: WeaponEntity, mastery?: AttackRow["mastery"]): HTMLElement {
  const doc = activeDocument;
  const wrapper = doc.createElement("div");
  wrapper.className = "archivist-weapon-block-wrapper archivist-item-block-wrapper";

  const block = doc.createElement("div");
  block.className = "archivist-item-block";
  wrapper.appendChild(block);

  const header = doc.createElement("div");
  header.className = "archivist-item-block-header";
  block.appendChild(header);

  const title = doc.createElement("h3");
  title.className = "archivist-item-name";
  title.textContent = weapon.name;
  header.appendChild(title);

  const subtitle = humanizeToken(weapon.category);
  const sub = doc.createElement("div");
  sub.className = "archivist-item-subtitle";
  sub.textContent = subtitle;
  header.appendChild(sub);

  const props = doc.createElement("div");
  props.className = "archivist-item-properties";
  block.appendChild(props);

  appendProperty(props, "Damage", formatDamage(weapon.damage));
  const range = formatRange(weapon.range);
  if (range) appendProperty(props, "Range", range);

  if (weapon.properties && weapon.properties.length > 0) {
    const propsDoc = props.ownerDocument ?? activeDocument;
    const row = propsDoc.createElement("div");
    row.className = "archivist-item-property";
    const labelEl = propsDoc.createElement("span");
    labelEl.className = "archivist-item-property-label";
    labelEl.textContent = "Properties";
    const valueEl = propsDoc.createElement("span");
    valueEl.className = "archivist-item-property-value";
    weapon.properties.forEach((p, i) => {
      const span = propsDoc.createElement("span");
      span.textContent = formatProperty(p);
      if (typeof p === "object" && p.note) {
        span.title = p.note;
        span.className = "archivist-weapon-conditional-property";
      }
      valueEl.appendChild(span);
      if (i < weapon.properties.length - 1) valueEl.appendChild(propsDoc.createTextNode(", "));
    });
    row.appendChild(labelEl);
    row.appendChild(valueEl);
    props.appendChild(row);
  }

  if (weapon.weight !== undefined && weapon.weight !== "") {
    appendProperty(props, "Weight", typeof weapon.weight === "number" ? `${weapon.weight} lb` : String(weapon.weight));
  }
  if (weapon.cost) appendProperty(props, "Cost", weapon.cost);

  // 2024 Weapon Mastery: an in-card section AFTER the properties block, present
  // only when the Actions-tab weapons table threads a mastery (Inventory/
  // compendium call sites pass none → byte-identical output to before). The
  // heading uses a MIDDLE DOT (never an em dash). The single separator between
  // properties and this section is supplied by the existing
  // `.archivist-item-properties:has(+ *)` rule, so this section carries no
  // border of its own (no orphan separator when it is the last child).
  if (mastery) appendMasterySection(block, mastery);

  return wrapper;
}

function appendMasterySection(block: HTMLElement, mastery: NonNullable<AttackRow["mastery"]>): void {
  const doc = block.ownerDocument ?? activeDocument;
  const section = doc.createElement("div");
  section.className = "archivist-weapon-mastery-section";

  const heading = doc.createElement("div");
  heading.className = "archivist-weapon-mastery-heading";
  const label = doc.createElement("span");
  label.className = "archivist-weapon-mastery-label";
  label.textContent = `Weapon Mastery · ${mastery.label}`;
  heading.appendChild(label);
  if (mastery.derived) {
    const dc = doc.createElement("span");
    dc.className = "archivist-weapon-mastery-dc";
    dc.textContent = `${mastery.derived.label} ${mastery.derived.value}`;
    heading.appendChild(dc);
  }
  section.appendChild(heading);

  const desc = doc.createElement("div");
  desc.className = "archivist-weapon-mastery-desc";
  desc.textContent = mastery.description;
  section.appendChild(desc);

  block.appendChild(section);
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
