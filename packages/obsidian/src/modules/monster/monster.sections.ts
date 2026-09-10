import type { App, Component } from "obsidian";
import type { Feature, FormulaContext } from "@archivist-gg/dnd5e";
import type { Monster, MonsterSpellcasting } from "@archivist-gg/dnd5e/monster/monster.types";
import type { PlacedSection } from "@archivist-gg/dnd5e/monster/monster.format";
import { displayAsSection, entriesToMarkdown, legendaryIntro, sectionHeader, spellcastingLines } from "@archivist-gg/dnd5e/monster/monster.format";
import { el, renderTextWithInlineTags } from "../../shared/rendering/renderer-utils";
import { renderMarkdownDescription } from "../../shared/rendering/markdown-description";

export type SectionId = "traits" | "actions" | "bonus_actions" | "reactions" | "legendary_actions" | "mythic" | "lair_actions" | "regional_actions" | "variant";

export interface SectionDef {
  id: SectionId;
  label: string;
  features: Feature[];
  spellcasting: MonsterSpellcasting[];
  /** A markdown fill (the entry trees) instead of feature cards. */
  markdown?: string;
  /** The intro lines (a section header from the data, or the generated legendary intro). */
  intro?: string[];
  note?: string;
}

const ORDER: { id: SectionId; label: string }[] = [
  { id: "traits", label: "Traits" }, { id: "actions", label: "Actions" }, { id: "bonus_actions", label: "Bonus Actions" },
  { id: "reactions", label: "Reactions" }, { id: "legendary_actions", label: "Legendary Actions" }, { id: "mythic", label: "Mythic Actions" },
  { id: "lair_actions", label: "Lair Actions" }, { id: "regional_actions", label: "Regional Effects" }, { id: "variant", label: "Variants" },
];

/** The UNION of the non-empty native feature arrays, the sections that receive a placed spellcasting block, and the
 *  non-empty entry trees, in the fixed print order (R4-G6 §8.1). ONE list drives both column modes. */
export function buildSections(monster: Monster): SectionDef[] {
  const placed = new Map<SectionId, MonsterSpellcasting[]>();
  for (const block of monster.spellcasting ?? []) {
    // `PlacedSection` is dnd5e's own vocabulary for where a block MAY land, and every member of it is a `SectionId`
    // that renders feature cards. Keeping the narrow type instead of asserting `SectionId` is what makes it
    // impossible to place a block into one of the three markdown-fill sections, where `renderSection`'s early return
    // would drop it silently.
    const id: PlacedSection = displayAsSection(block.displayAs);
    placed.set(id, [...(placed.get(id) ?? []), block]);
  }
  const out: SectionDef[] = [];
  for (const { id, label } of ORDER) {
    // The three entry-tree sections have no native feature array; for the rest `id` narrows to a `Feature[]` key.
    const features = (id === "lair_actions" || id === "regional_actions" || id === "variant") ? [] : (monster[id] ?? []);
    const spellcasting = placed.get(id) ?? [];
    let markdown: string | undefined;
    if (id === "lair_actions" && (monster.lair_actions?.length ?? 0) > 0) markdown = entriesToMarkdown(monster.lair_actions);
    if (id === "regional_actions" && (monster.regional_actions?.length ?? 0) > 0) markdown = entriesToMarkdown(monster.regional_actions);
    if (id === "variant" && (monster.variant?.length ?? 0) > 0) markdown = (monster.variant as unknown[]).map((v) => entriesToMarkdown([v])).join("\n\n");
    if (features.length === 0 && spellcasting.length === 0 && markdown === undefined) continue;
    const def: SectionDef = { id, label, features, spellcasting, markdown };
    // A spellcasting-only Legendary section gets no generated intro (Runed Behir, 1 doc: Gate 2 M-1).
    if (id === "legendary_actions") def.intro = features.length > 0 ? (sectionHeader(monster, "legendary_actions") ?? [legendaryIntro(monster, monster.legendary_action_uses ?? 3)]) : sectionHeader(monster, "legendary_actions");
    if (id === "mythic") def.intro = sectionHeader(monster, "mythic");
    // The 22 authored `reactions` headers render as the section's intro (spec C2-I-2).
    if (id === "reactions") { def.intro = sectionHeader(monster, "reactions"); def.note = monster.reaction_note; }
    if (id === "actions") def.note = monster.action_note;
    out.push(def);
  }
  return out;
}

/** The spellcasting entry: ONE feature-style card, the name then one line per `spellcastingLines` line. */
export function renderSpellcastingEntry(parent: HTMLElement, block: MonsterSpellcasting, monsterCtx?: FormulaContext): void {
  const card = el("div", { cls: ["archivist-feature", "archivist-monster-spellcasting"], parent });
  const name = el("span", { cls: "archivist-feature-name", parent: card });
  name.textContent = `${block.name ?? "Spellcasting"}.`;
  for (const line of spellcastingLines(block)) {
    const p = el("div", { cls: "archivist-feature-entry", parent: card });
    renderTextWithInlineTags(line, p, true, monsterCtx);
  }
}

/** The markdown seam every monster render goes through (Q-11, R4-G7 spec §7.6): the section fills AND, since Q-11,
 *  each feature's prose. `renderMarkdownDescription` is the default; the pin fixture injects its own. */
export type MonsterMarkdownRender = (parent: HTMLElement, markdown: string, app?: App, component?: Component, monsterCtx?: FormulaContext) => Promise<void>;

/** Fills a markdown section: the container exists SYNCHRONOUSLY (the tab strip is never wrong); the fill itself is
 *  asynchronous, with the MANDATORY catch (the condition module's pattern). The settled promise is RETURNED so
 *  `renderMonsterBlock` can join it into its `ready` (spec §7.6); a caller that wants the old fire-and-forget
 *  behaviour simply drops it. `monsterCtx` reaches the widget walker, so a section's own tags resolve too. */
export function fillMarkdown(
  container: HTMLElement,
  markdown: string,
  app?: App,
  render: MonsterMarkdownRender = renderMarkdownDescription,   // injectable for the row-39 fixture
  monsterCtx?: FormulaContext,
): Promise<void> {
  container.dataset.fill = "markdown";
  container.classList.add("archivist-monster-section");
  return render(container, markdown, app, undefined, monsterCtx).catch((err: unknown) => {
    console.error("[Archivist] monster section render failed", err);
    el("div", { cls: "archivist-block-error", text: `Section failed to render: ${String(err)}`, parent: container });
  });
}
