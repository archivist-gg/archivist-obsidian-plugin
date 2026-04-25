import type { WeaponEntity, WeaponProperty } from "./weapon.types";

function capitalize(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/_/g, " ");
}

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
  if (typeof p === "string") return capitalize(p);
  return capitalize(p.uid);
}

export function renderWeaponBlock(weapon: WeaponEntity): HTMLElement {
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

  const subtitle = capitalize(weapon.category);
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
