import { Item } from "./item.types";
import type { ItemEntity } from "./item.types";
import type { ConditionalBonus } from "./item.conditions.types";
import {
  el,
  createIconProperty,
  renderTextWithInlineTags,
} from "../../shared/rendering/renderer-utils";

function capitalizeWords(str: string): string {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatAttunement(attunement: Item["attunement"]): string {
  if (attunement === true) return "Required";
  if (typeof attunement === "string") return attunement;
  if (typeof attunement === "object" && attunement !== null) {
    const required = (attunement as { required?: boolean }).required === true;
    if (!required) return "Not Required";
    const restriction = (attunement as { restriction?: string }).restriction;
    return restriction ? `Required (${restriction})` : "Required";
  }
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

  if (typeof item.damage === "string") {
    const damageStr = item.damage_type
      ? `${item.damage} ${item.damage_type}`
      : item.damage;
    createIconProperty(props, "swords", "Damage:", damageStr);
  }
  // TODO(SP5/Task 11): render structured damage (object form)

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
      renderTextWithInlineTags(typeof entry === "string" ? entry : String(entry), p);
    }
  }

  // 4. Charges
  if (typeof item.charges === "number") {
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
  // TODO(SP5/Task 11): render structured charges (object form)

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

// ──────────────────────────────────────────────────────────────────────────
// Mechanical summary — compact display of structured magic-item fields.
// Returns null when no structured fields are present (legacy prose-only items).
// ──────────────────────────────────────────────────────────────────────────

function appendSummaryRow(parent: HTMLElement, label: string, value: string): void {
  const doc = parent.ownerDocument ?? activeDocument;
  const row = doc.createElement("div");
  row.className = "archivist-item-summary-row";
  const labelEl = doc.createElement("span");
  labelEl.className = "archivist-item-summary-label";
  labelEl.textContent = label;
  const valueEl = doc.createElement("span");
  valueEl.className = "archivist-item-summary-value";
  valueEl.textContent = value;
  row.appendChild(labelEl);
  row.appendChild(valueEl);
  parent.appendChild(row);
}

function formatBonus(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

// Phase 0: item-card summary renders only flat-number bonuses; conditional
// bonuses are surfaced later in the inventory row expand (Task 21).
function flatBonus(b: number | ConditionalBonus | undefined): number | undefined {
  return typeof b === "number" ? b : undefined;
}

function describeBonuses(b: NonNullable<ItemEntity["bonuses"]>): string[] {
  const out: string[] = [];
  const ac = flatBonus(b.ac);
  if (ac !== undefined) out.push(`AC ${formatBonus(ac)}`);
  const atk = flatBonus(b.weapon_attack);
  if (atk !== undefined) out.push(`Atk ${formatBonus(atk)}`);
  const dmg = flatBonus(b.weapon_damage);
  if (dmg !== undefined) out.push(`Dmg ${formatBonus(dmg)}`);
  const spellAtk = flatBonus(b.spell_attack);
  if (spellAtk !== undefined) out.push(`Spell Atk ${formatBonus(spellAtk)}`);
  const spellDc = flatBonus(b.spell_save_dc);
  if (spellDc !== undefined) out.push(`Spell DC ${formatBonus(spellDc)}`);
  const saves = flatBonus(b.saving_throws);
  if (saves !== undefined) out.push(`Saves ${formatBonus(saves)}`);
  if (b.speed) {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(b.speed)) {
      if (typeof v === "number") parts.push(`${k} ${v} ft`);
      else if (v === "walk") parts.push(`${k} walk`);
      // else: ConditionalBonus — skip, surface in Task 21
    }
    if (parts.length > 0) out.push(`Speed ${parts.join(", ")}`);
  }
  if (b.ability_scores?.static) {
    for (const [k, v] of Object.entries(b.ability_scores.static)) {
      out.push(`${k.toUpperCase()} = ${v}`);
    }
  }
  return out;
}

function describeCharges(c: NonNullable<ItemEntity["charges"]>): string {
  if (typeof c === "number") return `${c} charges`;
  const parts = [`${c.max} charges`];
  if (c.recharge) parts.push(`recharge ${c.recharge}`);
  if (c.recharge_amount) parts.push(`${c.recharge_amount}`);
  return parts.join(" • ");
}

function describeSpells(s: NonNullable<ItemEntity["attached_spells"]>): string {
  const parts: string[] = [];
  if (s.will?.length) parts.push(`At will: ${s.will.join(", ")}`);
  if (s.charges) {
    for (const [cost, names] of Object.entries(s.charges).sort(
      ([a], [b]) => Number(a) - Number(b),
    )) {
      parts.push(`${cost} ch: ${names.join(", ")}`);
    }
  }
  if (s.daily) {
    for (const [k, names] of Object.entries(s.daily)) {
      parts.push(`${k}/day: ${names.join(", ")}`);
    }
  }
  if (s.rest) {
    for (const [k, names] of Object.entries(s.rest)) {
      parts.push(`${k}/rest: ${names.join(", ")}`);
    }
  }
  return parts.join(" • ");
}

function hasMechanicalSummary(item: ItemEntity): boolean {
  if (item.bonuses && Object.keys(item.bonuses).length > 0) return true;
  if (item.charges) return true;
  if (item.attached_spells) return true;
  if (item.grants && Object.keys(item.grants).length > 0) return true;
  if (item.resist && item.resist.length > 0) return true;
  if (item.immune && item.immune.length > 0) return true;
  if (item.vulnerable && item.vulnerable.length > 0) return true;
  return false;
}

export function renderItemMechanicalSummary(item: ItemEntity): HTMLElement | null {
  if (!hasMechanicalSummary(item)) return null;

  const summary = activeDocument.createElement("div");
  summary.className = "archivist-item-summary";

  if (item.bonuses) {
    const bonusList = describeBonuses(item.bonuses);
    if (bonusList.length > 0) appendSummaryRow(summary, "Bonuses", bonusList.join(", "));
  }
  if (item.charges) {
    appendSummaryRow(summary, "Charges", describeCharges(item.charges));
  }
  if (item.attached_spells) {
    const desc = describeSpells(item.attached_spells);
    if (desc) appendSummaryRow(summary, "Spells", desc);
  }
  if (item.resist?.length) appendSummaryRow(summary, "Resist", item.resist.join(", "));
  if (item.immune?.length) appendSummaryRow(summary, "Immune", item.immune.join(", "));
  if (item.vulnerable?.length)
    appendSummaryRow(summary, "Vulnerable", item.vulnerable.join(", "));
  if (item.grants) {
    const parts: string[] = [];
    if (item.grants.proficiency) parts.push("Proficiency");
    if (item.grants.languages) {
      if (item.grants.languages === true) parts.push("Languages");
      else parts.push(`Languages: ${item.grants.languages.join(", ")}`);
    }
    if (item.grants.senses) {
      for (const [k, v] of Object.entries(item.grants.senses)) {
        if (v !== undefined) parts.push(`${k} ${v} ft`);
      }
    }
    if (parts.length > 0) appendSummaryRow(summary, "Grants", parts.join(" • "));
  }

  return summary;
}
