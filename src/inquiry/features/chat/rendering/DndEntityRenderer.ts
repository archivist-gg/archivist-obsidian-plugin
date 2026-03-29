import { setIcon } from "obsidian";

import { parseMonster } from "../../../../parsers/monster-parser";
import { parseSpell } from "../../../../parsers/spell-parser";
import { parseItem } from "../../../../parsers/item-parser";
import { renderMonsterBlock } from "../../../../renderers/monster-renderer";
import { renderSpellBlock } from "../../../../renderers/spell-renderer";
import { renderItemBlock } from "../../../../renderers/item-renderer";

import { isDndCodeFence, parseDndCodeFence, type DndCodeFenceResult } from "./dndCodeFence";

// Re-export pure functions and types for external consumers
export { isDndCodeFence, parseDndCodeFence, type DndCodeFenceResult } from "./dndCodeFence";

export type CopyAndSaveCallback = (entityType: string, yamlSource: string, name: string) => void;

/**
 * Renders a D&D entity stat block into the given container element.
 * Includes a source badge and optional Copy & Save button.
 */
export function renderDndEntityBlock(
  containerEl: HTMLElement,
  result: DndCodeFenceResult,
  onCopyAndSave?: CopyAndSaveCallback
): void {
  const wrapper = containerEl.createDiv({ cls: "claudian-dnd-entity-block" });

  // Source badge
  const badge = wrapper.createDiv({ cls: "claudian-dnd-source-badge" });
  badge.setText(result.entityType);

  // Render the stat block using the appropriate parser and renderer
  let statBlockEl: HTMLElement | null = null;

  switch (result.entityType) {
    case "monster": {
      const parsed = parseMonster(result.yamlSource);
      if (parsed.success) {
        statBlockEl = renderMonsterBlock(parsed.data);
      }
      break;
    }
    case "spell": {
      const parsed = parseSpell(result.yamlSource);
      if (parsed.success) {
        statBlockEl = renderSpellBlock(parsed.data);
      }
      break;
    }
    case "item": {
      const parsed = parseItem(result.yamlSource);
      if (parsed.success) {
        statBlockEl = renderItemBlock(parsed.data);
      }
      break;
    }
  }

  if (statBlockEl) {
    wrapper.appendChild(statBlockEl);
  } else {
    // Fallback: show raw YAML in a pre block
    const fallback = wrapper.createEl("pre", { cls: "claudian-dnd-fallback" });
    fallback.createEl("code", { text: result.yamlSource });
  }

  // Copy & Save button
  if (onCopyAndSave) {
    const btnRow = wrapper.createDiv({ cls: "claudian-dnd-actions" });
    const btn = btnRow.createEl("button", { cls: "claudian-dnd-copy-save-btn" });
    const iconSpan = btn.createSpan();
    setIcon(iconSpan, "save");
    btn.createSpan({ text: "Copy & Save" });
    btn.addEventListener("click", () => {
      onCopyAndSave(result.entityType, result.yamlSource, result.name);
    });
  }
}

/**
 * Scans an element for `<pre><code>` blocks with D&D language classes
 * and replaces them with rendered stat blocks.
 */
export function replaceDndCodeFences(
  el: HTMLElement,
  onCopyAndSave?: CopyAndSaveCallback
): void {
  const codeBlocks = el.querySelectorAll("pre > code");
  for (const code of Array.from(codeBlocks)) {
    const classMatch = code.className.match(/language-(\w+)/);
    if (!classMatch) continue;

    const language = classMatch[1];
    if (!isDndCodeFence(language)) continue;

    const yamlSource = code.textContent || "";
    const result = parseDndCodeFence(language, yamlSource);
    if (!result) continue;

    const pre = code.parentElement;
    if (!pre) continue;

    // Also remove the claudian-code-wrapper if it exists
    const wrapper = pre.parentElement;
    const insertTarget = wrapper?.classList.contains("claudian-code-wrapper") ? wrapper : pre;
    const parent = insertTarget.parentElement;
    if (!parent) continue;

    const container = document.createElement("div");
    parent.insertBefore(container, insertTarget);
    insertTarget.remove();

    renderDndEntityBlock(container, result, onCopyAndSave);
  }
}
