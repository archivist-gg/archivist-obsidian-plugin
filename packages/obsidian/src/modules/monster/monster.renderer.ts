import type { App } from "obsidian";
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
import { imageEmbeds } from "../../shared/rendering/image-embeds";
import type { FormulaContext } from "@archivist-gg/dnd5e";
import { proficiencyBonusFromCR } from "@archivist-gg/dnd5e/dnd/math";
// R4-G6 §6 / §8.1: size, type, alignment, cr, ac, hp, speed and the qualifier lists are DECODED at read time by
// the dnd5e formatters, never by a local helper here. `capitalizeWords` is the same historical helper this file
// used to define, now imported so the saves / skills / languages lines keep their byte-identical casing.
import {
  capitalizeWords,
  challengeLine,
  crString,
  formatAC,
  formatAlignment,
  formatGear,
  formatHP,
  formatInitiative,
  formatQualifiers,
  formatSize,
  formatLanguages,
  formatSkillsOther,
  formatSpeed,
  formatType,
  skillDisplayName,
} from "@archivist-gg/dnd5e/monster/monster.format";
import type { MonsterMarkdownRender, SectionDef } from "./monster.sections";
import { buildSections, fillMarkdown, renderSpellcastingEntry } from "./monster.sections";
import { renderMarkdownDescription } from "../../shared/rendering/markdown-description";

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

/**
 * B026-D1 (R4-G7 T8 wave E; the G7 regression of T4 `da091724`). Q-11 renders a feature's prose through the markdown
 * path, and Obsidian's MarkdownRenderer emits BLOCK children into the INLINE `span.archivist-feature-entry`: MEASURED
 * live in W-Er, a one-paragraph entry's children are exactly `[p]` and a two-block entry's are `[p, #text("\n"), ul]`.
 * A block child splits its inline parent, so the prose started on the line BELOW its bold name, and `.archivist-feature`'s
 * -1em hanging indent (which the name needs) was inherited by that `p`, pulling its FIRST line out to the card's own
 * edge: the "hung continuation" the eye pass reported on all 24 notes with entries.
 *
 * The LEAD paragraph is therefore unwrapped in place: its child nodes take its position, so the first paragraph is inline
 * after the name exactly as it was before Q-11, while everything else Q-11 gained stays what it is (a second paragraph, a
 * list, a table). Nothing else is touched: a lead node that is NOT a paragraph (an entry that opens with a list) is left
 * alone, and prose already inline (the injected renders of the pins and of the row-9 tests) has nothing to unwrap.
 */
function inlineLeadParagraph(entry: HTMLElement): void {
  for (const node of Array.from(entry.childNodes)) {
    // whitespace between blocks is what MarkdownRenderer leaves behind; real text means the prose is already inline
    if (node.nodeType === 3) {
      if (!/\S/.test(node.nodeValue ?? "")) continue;
      return;
    }
    if (node.nodeType !== 1 || (node as Element).tagName !== "P") return;
    const p = node as HTMLElement;
    while (p.firstChild) entry.insertBefore(p.firstChild, p);
    p.remove();
    return;
  }
}

/**
 * The feature cards of one section. Every card's DOM is built SYNCHRONOUSLY (the name with its recharge suffix, the
 * entry span, the attack lines), so the card order and the section's structure never depend on a fill; only each
 * feature's PROSE is asynchronous, because Q-11 (spec §7.6) renders it through the markdown path instead of through
 * `renderTextWithInlineTags`. The returned promise settles when every entry has landed, and `renderSection` joins it
 * into `renderMonsterBlock`'s `ready`.
 */
async function renderFeatureBlock(
  parent: HTMLElement,
  features: Feature[],
  monsterCtx: FormulaContext | undefined,
  render: MonsterMarkdownRender,
  app?: App,
): Promise<void> {
  const pending: Promise<void>[] = [];
  for (const feature of features) {
    const featureDiv = el("div", { cls: "archivist-feature", parent });
    const nameSpan = el("span", { cls: "archivist-feature-name", parent: featureDiv });
    nameSpan.textContent = feature.name + formatRechargeSuffix(feature.recharge) + ".";

    if (feature.entries && feature.entries.length > 0) {
      const entrySpan = el("span", { cls: "archivist-feature-entry", parent: featureDiv });
      // The entries join as PARAGRAPHS, never with a space: an entry that is a `- ` list is a list of its own in the
      // markdown, and a blank line is what keeps it one. `monsterCtx` rides along so the tags inside the prose still
      // resolve against this monster's abilities and proficiency bonus.
      const entryText = feature.entries.join("\n\n");
      // B026-D1: the fill settles first, then its LEAD paragraph is unwrapped so the prose is inline after the name.
      pending.push(render(entrySpan, entryText, app, undefined, monsterCtx).then(() => inlineLeadParagraph(entrySpan)));
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
  await Promise.all(pending);
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

/**
 * The Legendary Resistance label + boxes, extracted VERBATIM from what `renderLegendarySection` used to draw after
 * its intro sentence and its action boxes. The intro sentence itself is now DATA: `buildSections` puts either the
 * authored `section_headers` lines or `legendaryIntro`'s generated sentence in `SectionDef.intro`, and the boxes are
 * drawn by `renderMonsterBlock`'s `renderSection` (spec §8.1).
 */
function renderLegendaryResistance(
  parent: HTMLElement,
  monster: Monster,
): void {
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

/**
 * The read-mode monster block. The element is built SYNCHRONOUSLY and returned as `el`, exactly as it always was; the
 * markdown fills it starts (every feature's prose since Q-11, and the entry-tree sections) settle later, and `ready`
 * is the join of them (spec §7.6). A caller that only mounts the block ignores `ready`; a caller that measures the
 * rendered HTML awaits it first. `opts.render` replaces the markdown renderer for the whole block, which is the one
 * seam the SRD render pins use.
 */
export function renderMonsterBlock(
  monster: Monster,
  columns: number = 1,
  app?: App,
  opts?: { render?: MonsterMarkdownRender },
): { el: HTMLElement; ready: Promise<void> } {
  const render = opts?.render ?? renderMarkdownDescription;
  /** Every markdown fill this block starts, joined into `ready` below. */
  const pending: Promise<void>[] = [];
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
  // `size_note`, `level` and `alignment_prefix` are declared on `Monster` since R4-G6 Task 4: read directly.
  const typeText = [formatSize(monster.size, monster.size_note), formatType(monster.type, monster.level)]
    .filter(Boolean)
    .join(" ");
  const alignmentText = formatAlignment(monster.alignment, monster.alignment_prefix);
  const fullType = alignmentText ? `${typeText}, ${alignmentText}` : typeText;
  el("p", { cls: "monster-type", text: fullType, parent: header });
  // The token and the portrait below stay fire-and-forget: they are NOT joined into `ready`. MEASURED again at
  // R4-G7 T4: 0 of the 656 bundle monster notes carry `image` or `thumbnail`, so no pinned sha can race on them,
  // and joining them would make `ready` wait on a vault image lookup that nothing in the block's layout needs.
  if (monster.thumbnail) void fillMarkdown(el("div", { cls: "archivist-monster-token", parent: header }), imageEmbeds(monster.thumbnail).join("\n"), app, render, monsterCtx);

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
  // 3. Core properties (AC, HP, Speed, Initiative)
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
  // Speed gives up the `last` marker to the Initiative line whenever one follows it.
  propertyLine(coreProps, "Speed", formatSpeed(monster.speed), monster.initiative === undefined);
  if (monster.initiative !== undefined) {
    // `formatInitiative` needs the DEX modifier and the proficiency bonus: a 2024 `{proficiency: 1}` initiative is
    // DEX + PB, and `advantage_mode` appends its decoded clause (spec §8.1).
    const init = formatInitiative(monster.initiative, monster.abilities, proficiencyBonusFromCR(crString(monster.cr) ?? "0"));
    if (init) createRichPropertyLine(coreProps, "Initiative", (v) => renderTextWithInlineTags(init, v, true, monsterCtx), true);
  }

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
  // Declared beside the two bindings it closes over: a call from the CORE block above would hit their temporal dead
  // zone and throw. Every secondary line goes through it.
  const richLine = (label: string, value: string) => { propertyLine(secondaryProps, label, value); hasSecondary = true; };

  if (monster.saves && Object.keys(monster.saves).length > 0) {
    const savesStr = Object.entries(monster.saves)
      .map(([k, v]) => `${capitalizeWords(k)} ${formatModifier(v as number)}`)
      .join(", ");
    richLine("Saving Throws", savesStr);
  }

  if (monster.skills && Object.keys(monster.skills).length > 0) {
    // R4 {G5, G6} live rider 3, Z-9-8: the skill KEY is named by the canonical list, not title-cased. The keys
    // carry a separator (`animal_handling`), and `capitalizeWords` only upper-cases the first letter of each
    // word, so the SRD 5.1 Donkey's line read `Animal_handling +0, ... Sleight_of_hand +0`. `skillDisplayName`
    // (dnd5e `monster/monster.format`) answers from `ALL_SKILLS` and keeps `capitalizeWords` for a key that
    // list does not know, which is what every other key already rendered.
    const skillsStr = Object.entries(monster.skills)
      .map(([k, v]) => `${skillDisplayName(k)} ${formatModifier(v)}`)
      .join(", ");
    // `skills_other` (Adult Oblex's "plus one of: ...") is a SUFFIX of the Skills value, never a second Skills line.
    const other = formatSkillsOther(monster.skills_other);
    richLine("Skills", other ? `${skillsStr} ${other}` : skillsStr);
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
    // R4 {G5, G6} live rider 3, Z-9-9: `formatLanguages` (dnd5e `monster/monster.format`) title-cases each
    // entry exactly as `capitalizeWords` did, except that the word right after an amount keeps its authored
    // case, because that word is the amount's unit. The line read `Telepathy 120 Ft.` while the Senses line
    // right above printed its own `darkvision 120 ft.` verbatim.
    richLine("Languages", formatLanguages(monster.languages));
  }

  if (monster.gear && monster.gear.length > 0) {
    richLine("Gear", formatGear(monster.gear));
  }

  // A `pb_note` WITHOUT a `cr` has no Challenge line to carry it, so it becomes a line of its own; with a `cr`,
  // `challengeLine` prints it inside the Challenge parentheses (spec §8.1).
  if (monster.cr === undefined && monster.pb_note) {
    richLine("Proficiency Bonus", monster.pb_note);
  }

  // The Challenge line carries the XP and the proficiency bonus: the ONE named SRD delta of this phase (invariant 5).
  const ch = challengeLine(monster.cr, monster.pb_note);
  if (ch) {
    richLine("Challenge", ch);
  }

  // 9. Sections: ONE list (the UNION of the native arrays, the placed spellcasting blocks and the entry trees, in
  // the fixed print order of spec §8.1) drives the tab strip in one column and the flowing headers in two. It is
  // COMPUTED here, above bar 8, because bar 8 only exists to open it (B026-D14 below); `buildSections` is pure, so
  // nothing about the DOM order changes by asking it earlier.
  const activeSections = buildSections(monster);

  // 8. SVG Bar (only if secondary props exist AND there is a section for it to open). R4-G7 T8 wave E, B026-D14: the
  // bar was drawn from `hasSecondary` alone, before the sections were known, so a monster with a Senses or Challenge
  // line and NO traits, actions or reactions closed its card with a heavy red divider that opened nothing. MEASURED
  // live in W-Er on the SRD Donkey: 4 `.stat-block-bar` with 0 sections.
  if (hasSecondary && activeSections.length > 0) {
    createSvgBar(contentTarget);
  }

  /**
   * One section body, drawn identically in both column modes: the intro lines, the legendary / mythic boxes, the
   * note, then EITHER a markdown fill (the entry trees, which own the container from there on) OR the feature cards
   * followed by any spellcasting block `displayAs` placed in this section. It returns the promise of whichever fills
   * it started, so `ready` covers the section's markdown AND its feature prose (spec §7.6).
   */
  const renderSection = (container: HTMLElement, s: SectionDef): Promise<void> => {
    if (s.intro && s.intro.length > 0) {
      for (const line of s.intro) el("p", { cls: "archivist-legendary-intro", text: line, parent: container });
    }
    // A Legendary section that holds ONLY a placed spellcasting block gets no intro and no boxes (Gate 2 M-1).
    if (s.id === "legendary_actions" && s.features.length > 0) {
      renderLegendaryBoxes(container, monster.legendary_action_uses ?? 3);
      renderLegendaryResistance(container, monster);
    }
    if (s.id === "mythic") renderLegendaryBoxes(container, monster.legendary_action_uses ?? 3);
    if (s.note) el("p", { cls: "archivist-legendary-intro", text: s.note, parent: container });
    if (s.markdown !== undefined) return fillMarkdown(container, s.markdown, app, render, monsterCtx);
    // The feature cards are all in the DOM by the time `renderFeatureBlock` returns its promise, so the spellcasting
    // entries still append AFTER them, exactly as they did when the whole section was synchronous.
    const features = s.features.length > 0 ? renderFeatureBlock(container, s.features, monsterCtx, render, app) : Promise.resolve();
    for (const block of s.spellcasting) renderSpellcastingEntry(container, block, monsterCtx);
    return features;
  };

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

      pending.push(renderSection(sectionDiv, section));
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

    // Tab content. A NATIVE pane is built exactly as it always was, with no added class or attribute; a
    // markdown-filled pane is the same pane plus what `fillMarkdown` puts on it (spec §8.1's container contract).
    for (let i = 0; i < activeSections.length; i++) {
      const tab = activeSections[i];
      const content = el("div", {
        cls: "original-tab-content",
        parent: contentTarget,
      });
      content.style.display = i === 0 ? "" : "none";
      contentDivs.set(tab.id, content);

      pending.push(renderSection(content, tab));
    }
  }

  if (monster.image) void fillMarkdown(el("div", { cls: "archivist-monster-portrait", parent: block }), imageEmbeds(monster.image).join("\n\n"), app, render, monsterCtx);

  return { el: wrapper, ready: Promise.all(pending).then(() => undefined) };
}
