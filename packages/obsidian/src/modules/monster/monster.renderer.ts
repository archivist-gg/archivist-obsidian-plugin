import { Monster } from "@archivist-gg/dnd5e/monster/monster.types";
import type { Feature, FeatureRecharge } from "@archivist-gg/dnd5e";
import type { Attack } from "@archivist-gg/dnd5e/types/attack";
import { abilityModifier, formatModifier } from "@archivist-gg/dnd5e/dnd/math";
import {
  el,
  createSvgBar,
  createPropertyLine,
  renderTextWithInlineTags,
} from "../../shared/rendering/renderer-utils";
import type { FormulaContext } from "@archivist-gg/dnd5e";
import { proficiencyBonusFromCR } from "@archivist-gg/dnd5e/dnd/math";
// R4-G6 §6 / §8.1: size, type, alignment, cr, ac, hp, speed and the qualifier lists are DECODED at read time by
// the dnd5e formatters, never by a local helper here. `capitalizeWords` is the same historical helper this file
// used to define, now imported so the saves / skills / languages lines keep their byte-identical casing.
import {
  capitalizeWords,
  crString,
  formatAC,
  formatAlignment,
  formatHP,
  formatQualifiers,
  formatSize,
  formatSpeed,
  formatType,
} from "@archivist-gg/dnd5e/monster/monster.format";

function renderAttackLine(
  parent: HTMLElement,
  attack: Attack,
): void {
  const line = el("div", { cls: "archivist-monster-attack", parent });
  const doc = line.ownerDocument ?? activeDocument;

  const bonus = attack.bonus ?? 0;
  const bonusStr = bonus >= 0 ? `+${bonus}` : `${bonus}`;
  el("span", {
    cls: "archivist-monster-attack-bonus",
    text: `${bonusStr} to hit`,
    parent: line,
  });

  // Range / reach
  if (attack.range?.reach != null) {
    line.appendChild(doc.createTextNode(`, reach ${attack.range.reach} ft. `));
  } else if (attack.range?.normal != null) {
    const long = attack.range.long ?? attack.range.normal;
    line.appendChild(doc.createTextNode(`, range ${attack.range.normal}/${long} ft. `));
  } else {
    line.appendChild(doc.createTextNode(", "));
  }

  // Hit damage
  const damageStr = attack.damage ?? "";
  const damageType = attack.damage_type ?? "";
  el("span", {
    cls: "archivist-monster-attack-damage",
    text: `Hit: ${damageStr}${damageType ? ` ${damageType}` : ""} damage`,
    parent: line,
  });

  // Extra damage
  if (attack.extra_damage) {
    const extra = attack.extra_damage;
    line.appendChild(
      doc.createTextNode(` plus ${extra.dice} ${extra.type} damage`),
    );
  }
}

function formatRechargeSuffix(r: FeatureRecharge | undefined): string {
  if (!r) return "";
  switch (r.type) {
    case "recharge_on_roll":
      // En-dash range; param=6 collapses to "Recharge 6".
      return r.param >= 6 ? ` (Recharge ${r.param})` : ` (Recharge ${r.param}–6)`;
    case "per_day":
      return ` (${r.param}/Day)`;
    case "per_short_rest":
      return ` (${r.param}/Short Rest)`;
    case "per_long_rest":
      return ` (${r.param}/Long Rest)`;
  }
}

function renderFeatureBlock(
  parent: HTMLElement,
  features: Feature[],
  monsterCtx?: FormulaContext,
): void {
  for (const feature of features) {
    const featureDiv = el("div", { cls: "archivist-feature", parent });
    const nameSpan = el("span", { cls: "archivist-feature-name", parent: featureDiv });
    nameSpan.textContent = feature.name + formatRechargeSuffix(feature.recharge) + ".";

    if (feature.entries && feature.entries.length > 0) {
      const entrySpan = el("span", { cls: "archivist-feature-entry", parent: featureDiv });
      const entryText = feature.entries.join(" ");
      renderTextWithInlineTags(entryText, entrySpan, true, monsterCtx);
    } else if (feature.attacks && feature.attacks.length > 0) {
      const attacksWrap = el("span", {
        cls: "archivist-feature-attacks",
        parent: featureDiv,
      });
      for (const attack of feature.attacks) {
        renderAttackLine(attacksWrap, attack);
      }
    }
  }
}

function renderLegendaryBoxes(parent: HTMLElement, count: number): void {
  const row = el("div", { cls: "archivist-toggle-box-row", parent });
  const boxes: HTMLElement[] = [];
  const CHECKED = "archivist-toggle-box-checked";

  for (let i = 0; i < count; i++) {
    const box = el("div", { cls: "archivist-toggle-box", parent: row });
    boxes.push(box);
    box.addEventListener("click", () => {
      const clickedIndex = i;
      const isChecked = box.hasClass(CHECKED);
      const currentCount = boxes.filter((b) => b.hasClass(CHECKED)).length;
      // Click a checked box → decrement count (consume from the rightmost).
      // Click an unchecked box → fill from the left up to and including the clicked box.
      const newCount = isChecked ? currentCount - 1 : clickedIndex + 1;

      boxes.forEach((b, j) => {
        if (j < newCount) {
          b.addClass(CHECKED);
        } else {
          b.removeClass(CHECKED);
        }
      });
    });
  }
}

function renderLegendarySection(
  parent: HTMLElement,
  monster: Monster,
): void {
  const legendaryCount = monster.legendary_action_uses ?? 3;
  const monsterName = monster.name.toLowerCase();

  const introText = `The ${monsterName} can take ${legendaryCount} legendary actions, choosing from the options below. Only one legendary action option can be used at a time and only at the end of another creature's turn. The ${monsterName} regains spent legendary actions at the start of its turn.`;
  el("p", { cls: "archivist-legendary-intro", text: introText, parent });
  renderLegendaryBoxes(parent, legendaryCount);

  if (monster.legendary_resistance && monster.legendary_resistance > 0) {
    const resCount = monster.legendary_resistance;
    const resBlock = el("div", { cls: "archivist-legendary-resistance", parent });
    // Just a label + toggles; full prose lives in the TRAITS tab as the actual trait.
    el("p", {
      cls: "archivist-legendary-resistance-label",
      text: `Legendary Resistance (${resCount}/Day)`,
      parent: resBlock,
    });
    renderLegendaryBoxes(resBlock, resCount);
  }
}

function createRichPropertyLine(
  parent: HTMLElement,
  label: string,
  renderValue: (valueEl: HTMLElement) => void,
  isLast?: boolean,
): HTMLElement {
  const line = el("div", {
    cls: isLast ? ["property-line", "last"] : "property-line",
    parent,
  });
  el("h4", { text: label, parent: line });
  const valueEl = el("p", { parent: line });
  renderValue(valueEl);
  return line;
}

export function renderMonsterBlock(monster: Monster, columns: number = 1): HTMLElement {
  const isTwoCol = columns === 2;
  const wrapperCls = isTwoCol
    ? ["archivist-monster-block-wrapper", "archivist-monster-two-col"]
    : "archivist-monster-block-wrapper";
  const wrapper = el("div", { cls: wrapperCls });
  const block = el("div", { cls: "archivist-monster-block", parent: wrapper });

  // Build formula resolution context for inline tags (e.g. `atk:DEX` -> `+4`)
  const monsterCtx: FormulaContext | undefined = monster.abilities
    ? { abilities: monster.abilities, proficiencyBonus: proficiencyBonusFromCR(crString(monster.cr) ?? "0") }
    : undefined;

  // In two-column mode, all content goes inside a flow container with column-count: 2
  const contentTarget = isTwoCol
    ? el("div", { cls: "archivist-monster-two-col-flow", parent: block })
    : block;

  // 1. Header
  const header = el("div", { cls: "stat-block-header", parent: contentTarget });
  el("div", { cls: "monster-name", text: monster.name, parent: header });
  // `size_note`, `level` and `alignment_prefix` reach the renderer only after the `Monster` interface widens
  // in dnd5e; until then they are read through this local widening (Gate 2 I-8).
  const wide = monster as Monster & { size_note?: string; level?: number; alignment_prefix?: string };
  const typeText = [formatSize(monster.size, wide.size_note), formatType(monster.type, wide.level)]
    .filter(Boolean)
    .join(" ");
  const alignmentText = formatAlignment(monster.alignment, wide.alignment_prefix);
  const fullType = alignmentText ? `${typeText}, ${alignmentText}` : typeText;
  el("p", { cls: "monster-type", text: fullType, parent: header });

  // 2. SVG Bar
  createSvgBar(contentTarget);

  // A property VALUE goes through `renderTextWithInlineTags` ONLY when it carries a wikilink or a backtick tag
  // (spec §8.1's routing SCOPE): routing every value rich would send plain markdown emphasis through
  // `appendMarkdownText`, which turns the SRD's `15 with _mage armor_` into an `<em>`.
  const NEEDS_RICH = /\[\[|`/;
  const propertyLine = (parent: HTMLElement, label: string, value: string, isLast?: boolean) => {
    if (NEEDS_RICH.test(value)) createRichPropertyLine(parent, label, (v) => renderTextWithInlineTags(value, v, true, monsterCtx), isLast);
    else createPropertyLine(parent, label, value, isLast);
  };
  const richLine = (label: string, value: string) => { propertyLine(secondaryProps, label, value); hasSecondary = true; };

  // 3. Core properties (AC, HP, Speed)
  const coreProps = el("div", { cls: "property-block", parent: contentTarget });
  propertyLine(coreProps, "Armor Class", formatAC(monster.ac));
  createRichPropertyLine(coreProps, "Hit Points", (valueEl) => {
    // BOTH halves go through the inline-tag pipeline: an `hp.special` can carry a backtick tag, and
    // decorateProseDice inside convert5eToolsTags turns "19d12+133" into a dice pill.
    const hp = formatHP(monster.hp);
    const doc = valueEl.ownerDocument ?? activeDocument;
    renderTextWithInlineTags(hp.text, valueEl, true, monsterCtx);
    if (hp.formula) {
      valueEl.appendChild(doc.createTextNode(" ("));
      renderTextWithInlineTags(hp.formula, valueEl, true, monsterCtx);
      valueEl.appendChild(doc.createTextNode(")"));
    }
  });
  propertyLine(coreProps, "Speed", formatSpeed(monster.speed), true);

  // 4. SVG Bar
  createSvgBar(contentTarget);

  // 5. Abilities table
  if (monster.abilities) {
    const abilitiesBlock = el("div", { cls: "abilities-block", parent: contentTarget });
    const table = el("table", { cls: "abilities-table", parent: abilitiesBlock });

    const thead = el("thead", { parent: table });
    const headerRow = el("tr", { parent: thead });
    const abilityNames = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];
    for (const name of abilityNames) {
      el("th", { text: name, parent: headerRow });
    }

    const tbody = el("tbody", { parent: table });
    const valueRow = el("tr", { parent: tbody });
    const abilityKeys: (keyof typeof monster.abilities)[] = [
      "str",
      "dex",
      "con",
      "int",
      "wis",
      "cha",
    ];
    for (const key of abilityKeys) {
      const td = el("td", { parent: valueRow });
      const score = monster.abilities[key];
      const mod = abilityModifier(score);
      const scoreSpan = el("span", {
        cls: "ability-score",
        text: String(score),
        parent: td,
      });
      void scoreSpan;
      td.appendChild((td.ownerDocument ?? activeDocument).createTextNode(` (${formatModifier(mod)})`));
    }
  }

  // 6. SVG Bar
  createSvgBar(contentTarget);

  // 7. Secondary properties
  const secondaryProps = el("div", { cls: "property-block", parent: contentTarget });
  let hasSecondary = false;

  if (monster.saves && Object.keys(monster.saves).length > 0) {
    const savesStr = Object.entries(monster.saves)
      .map(([k, v]) => `${capitalizeWords(k)} ${formatModifier(v as number)}`)
      .join(", ");
    richLine("Saving Throws", savesStr);
  }

  if (monster.skills && Object.keys(monster.skills).length > 0) {
    const skillsStr = Object.entries(monster.skills)
      .map(([k, v]) => `${capitalizeWords(k)} ${formatModifier(v)}`)
      .join(", ");
    richLine("Skills", skillsStr);
  }

  if (
    monster.damage_vulnerabilities &&
    monster.damage_vulnerabilities.length > 0
  ) {
    richLine("Damage Vulnerabilities", formatQualifiers(monster.damage_vulnerabilities).join(", "));
  }

  if (monster.damage_resistances && monster.damage_resistances.length > 0) {
    richLine("Damage Resistances", formatQualifiers(monster.damage_resistances).join(", "));
  }

  if (monster.damage_immunities && monster.damage_immunities.length > 0) {
    richLine("Damage Immunities", formatQualifiers(monster.damage_immunities).join(", "));
  }

  if (
    monster.condition_immunities &&
    monster.condition_immunities.length > 0
  ) {
    richLine("Condition Immunities", formatQualifiers(monster.condition_immunities).join(", "));
  }

  if (monster.senses && monster.senses.length > 0) {
    let sensesStr = monster.senses.join(", ");
    if (monster.passive_perception) {
      sensesStr += `, passive Perception ${monster.passive_perception}`;
    }
    richLine("Senses", sensesStr);
  } else if (monster.passive_perception) {
    richLine("Senses", `passive Perception ${monster.passive_perception}`);
  }

  if (monster.languages && monster.languages.length > 0) {
    richLine("Languages", monster.languages.map(capitalizeWords).join(", "));
  }

  // T3 keeps the BARE cr text; the XP / PB clause of spec §8.1 arrives at T7a with `challengeLine`.
  const crText = crString(monster.cr);
  if (crText !== undefined) {
    richLine("Challenge", crText);
  }

  // 8. SVG Bar (only if secondary props exist)
  if (hasSecondary) {
    createSvgBar(contentTarget);
  }

  // 9. Section definitions (shared by tab mode and two-column mode)
  const sectionDefs: {
    id: string;
    label: string;
    features: Feature[] | undefined;
  }[] = [
    { id: "traits", label: "Traits", features: monster.traits },
    { id: "actions", label: "Actions", features: monster.actions },
    { id: "reactions", label: "Reactions", features: monster.reactions },
    { id: "legendary", label: "Legendary Actions", features: monster.legendary_actions },
  ];

  const activeSections = sectionDefs.filter(
    (t) => t.features && t.features.length > 0,
  );

  if (activeSections.length > 0 && isTwoCol) {
    // Two-column mode: render all sections sequentially with headers (no tabs)
    // Content flows naturally through the two-col-flow container
    for (const section of activeSections) {
      const sectionDiv = el("div", {
        cls: "archivist-monster-section",
        parent: contentTarget,
      });

      // Traits render inline without a section header (just like PHB)
      if (section.id !== "traits") {
        el("div", {
          cls: "actions-header",
          text: section.label,
          parent: sectionDiv,
        });
      }

      if (section.id === "legendary") {
        renderLegendarySection(sectionDiv, monster);
      }

      if (section.features) {
        renderFeatureBlock(sectionDiv, section.features, monsterCtx);
      }
    }
  } else if (activeSections.length > 0) {
    // Single-column mode: tabbed navigation (existing behavior)
    const navWrapper = el("div", {
      cls: "original-tab-navigation-wrapper",
      parent: contentTarget,
    });
    const nav = el("div", {
      cls: "original-tab-navigation",
      parent: navWrapper,
    });

    const contentDivs: Map<string, HTMLElement> = new Map();

    for (let i = 0; i < activeSections.length; i++) {
      const tab = activeSections[i];
      const btn = el("button", {
        cls: i === 0
          ? ["original-tab-button", "active"]
          : "original-tab-button",
        text: tab.label,
        parent: nav,
      });

      btn.addEventListener("click", () => {
        nav
          .querySelectorAll(".original-tab-button")
          .forEach((b) => b.removeClass("active"));
        btn.addClass("active");

        contentDivs.forEach((div, id) => {
          div.style.display = id === tab.id ? "" : "none";
        });
      });
    }

    // Tab content
    for (let i = 0; i < activeSections.length; i++) {
      const tab = activeSections[i];
      const content = el("div", {
        cls: "original-tab-content",
        parent: contentTarget,
      });
      content.style.display = i === 0 ? "" : "none";
      contentDivs.set(tab.id, content);

      if (tab.id === "legendary") {
        renderLegendarySection(content, monster);
      }

      if (tab.features) {
        renderFeatureBlock(content, tab.features, monsterCtx);
      }
    }
  }

  return wrapper;
}
