import { Monster } from "./monster.types";
import type { Feature, FeatureRecharge } from "../../shared/types";
import type { Attack } from "../../shared/types/attack";
import { abilityModifier, formatModifier } from "../../shared/dnd/math";
import {
  el,
  createSvgBar,
  createPropertyLine,
  renderTextWithInlineTags,
} from "../../shared/rendering/renderer-utils";
import type { FormulaContext } from "../../shared/types";
import { proficiencyBonusFromCR } from "../../shared/dnd/math";

function capitalizeWords(str: string): string {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatSpeed(speed: Monster["speed"]): string {
  if (!speed) return "0 ft.";
  return Object.entries(speed)
    .filter(([_, v]) => v)
    .map(([type, value]) => `${capitalizeWords(type)} ${value} ft.`)
    .join(", ");
}

function formatAC(monster: Monster): string {
  if (!monster.ac || monster.ac.length === 0) return "10";
  const primary = monster.ac[0];
  let result = String(primary.ac);
  if (primary.from && primary.from.length > 0) {
    result += ` (${primary.from.map((f) => capitalizeWords(f)).join(", ")})`;
  }
  return result;
}

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
  const legendaryCount = monster.legendary_actions ?? 3;
  const monsterName = monster.name.toLowerCase();

  const introText = `The ${monsterName} can take ${legendaryCount} legendary actions, choosing from the options below. Only one legendary action option can be used at a time and only at the end of another creature's turn. The ${monsterName} regains spent legendary actions at the start of its turn.`;
  el("p", { cls: "archivist-legendary-intro", text: introText, parent });
  renderLegendaryBoxes(parent, legendaryCount);
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
    ? { abilities: monster.abilities, proficiencyBonus: proficiencyBonusFromCR(monster.cr ?? "0") }
    : undefined;

  // In two-column mode, all content goes inside a flow container with column-count: 2
  const contentTarget = isTwoCol
    ? el("div", { cls: "archivist-monster-two-col-flow", parent: block })
    : block;

  // 1. Header
  const header = el("div", { cls: "stat-block-header", parent: contentTarget });
  el("div", { cls: "monster-name", text: monster.name, parent: header });
  const typeText = [
    monster.size ? capitalizeWords(monster.size) : "",
    monster.type ? capitalizeWords(monster.type) : "",
  ]
    .filter(Boolean)
    .join(" ");
  const fullType = monster.alignment
    ? `${typeText}, ${capitalizeWords(monster.alignment)}`
    : typeText;
  el("p", { cls: "monster-type", text: fullType, parent: header });

  // 2. SVG Bar
  createSvgBar(contentTarget);

  // 3. Core properties (AC, HP, Speed)
  const coreProps = el("div", { cls: "property-block", parent: contentTarget });
  createPropertyLine(coreProps, "Armor Class", formatAC(monster));
  createRichPropertyLine(coreProps, "Hit Points", (valueEl) => {
    if (!monster.hp) {
      valueEl.textContent = "0";
      return;
    }
    const doc = valueEl.ownerDocument ?? activeDocument;
    valueEl.appendChild(doc.createTextNode(String(monster.hp.average)));
    if (monster.hp.formula) {
      valueEl.appendChild(doc.createTextNode(" ("));
      // Run the formula through the inline-tag pipeline; decorateProseDice
      // inside convert5eToolsTags turns "19d12+133" into a dice pill.
      renderTextWithInlineTags(monster.hp.formula, valueEl, true, monsterCtx);
      valueEl.appendChild(doc.createTextNode(")"));
    }
  });
  createPropertyLine(coreProps, "Speed", formatSpeed(monster.speed), true);

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
    createPropertyLine(secondaryProps, "Saving Throws", savesStr);
    hasSecondary = true;
  }

  if (monster.skills && Object.keys(monster.skills).length > 0) {
    const skillsStr = Object.entries(monster.skills)
      .map(([k, v]) => `${capitalizeWords(k)} ${formatModifier(v)}`)
      .join(", ");
    createPropertyLine(secondaryProps, "Skills", skillsStr);
    hasSecondary = true;
  }

  if (
    monster.damage_vulnerabilities &&
    monster.damage_vulnerabilities.length > 0
  ) {
    createPropertyLine(
      secondaryProps,
      "Damage Vulnerabilities",
      monster.damage_vulnerabilities.map(capitalizeWords).join(", "),
    );
    hasSecondary = true;
  }

  if (monster.damage_resistances && monster.damage_resistances.length > 0) {
    createPropertyLine(
      secondaryProps,
      "Damage Resistances",
      monster.damage_resistances.map(capitalizeWords).join(", "),
    );
    hasSecondary = true;
  }

  if (monster.damage_immunities && monster.damage_immunities.length > 0) {
    createPropertyLine(
      secondaryProps,
      "Damage Immunities",
      monster.damage_immunities.map(capitalizeWords).join(", "),
    );
    hasSecondary = true;
  }

  if (
    monster.condition_immunities &&
    monster.condition_immunities.length > 0
  ) {
    createPropertyLine(
      secondaryProps,
      "Condition Immunities",
      monster.condition_immunities.map(capitalizeWords).join(", "),
    );
    hasSecondary = true;
  }

  if (monster.senses && monster.senses.length > 0) {
    let sensesStr = monster.senses.join(", ");
    if (monster.passive_perception) {
      sensesStr += `, passive Perception ${monster.passive_perception}`;
    }
    createPropertyLine(secondaryProps, "Senses", sensesStr);
    hasSecondary = true;
  } else if (monster.passive_perception) {
    createPropertyLine(
      secondaryProps,
      "Senses",
      `passive Perception ${monster.passive_perception}`,
    );
    hasSecondary = true;
  }

  if (monster.languages && monster.languages.length > 0) {
    createPropertyLine(
      secondaryProps,
      "Languages",
      monster.languages.map(capitalizeWords).join(", "),
    );
    hasSecondary = true;
  }

  if (monster.cr) {
    createPropertyLine(secondaryProps, "Challenge", monster.cr);
    hasSecondary = true;
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
    { id: "legendary", label: "Legendary Actions", features: monster.legendary },
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
