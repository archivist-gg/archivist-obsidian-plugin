import type { App } from "obsidian";
import { setIcon } from "obsidian";

import type { EntityRegistry } from "../../../../entities/entity-registry";
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
  onCopyAndSave?: CopyAndSaveCallback,
  entityRegistry?: EntityRegistry | null,
  app?: App | null,
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

  // Action buttons (Copy / Copy & Save)
  if (onCopyAndSave) {
    const actionsRow = wrapper.createDiv({ cls: "claudian-dnd-actions" });

    // Check if entity already exists in registry
    const existingEntity = entityRegistry?.search(result.name, result.entityType, 1)
      .find(e => e.source === "custom");

    if (existingEntity) {
      // Already saved -- show Copy-only button + file reference link
      renderCopyButton(actionsRow, result);
      renderFileRef(actionsRow, existingEntity.filePath, app);
    } else {
      // Not saved -- show Copy & Save button that transitions to saved state
      renderCopyAndSaveButton(actionsRow, result, onCopyAndSave, entityRegistry, app);
    }
  }
}

/** Renders a Copy-only button that copies the code fence to clipboard. */
function renderCopyButton(container: HTMLElement, result: DndCodeFenceResult): void {
  const btn = container.createEl("button", { cls: "archivist-dnd-action-btn" });
  const iconSpan = btn.createSpan();
  setIcon(iconSpan, "copy");
  const labelSpan = btn.createSpan({ text: "Copy" });

  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText("```" + result.entityType + "\n" + result.yamlSource + "\n```");
    } catch { /* clipboard may fail in some contexts */ }
    labelSpan.setText("Copied!");
    setTimeout(() => labelSpan.setText("Copy"), 2000);
  });
}

/** Renders a file reference link below the button that opens the saved entity file. */
function renderFileRef(container: HTMLElement, filePath: string, app?: App | null): void {
  const ref = container.createDiv({ cls: "archivist-dnd-file-ref" });
  const linkIcon = ref.createSpan({ cls: "archivist-dnd-file-ref-icon" });
  setIcon(linkIcon, "link");
  ref.createSpan({ text: filePath });

  if (app) {
    ref.addEventListener("click", () => {
      void app.workspace.openLinkText(filePath, "", false);
    });
  }
}

/** Renders a Copy & Save button that saves, then transitions to Copy + file ref. */
function renderCopyAndSaveButton(
  actionsRow: HTMLElement,
  result: DndCodeFenceResult,
  onCopyAndSave: CopyAndSaveCallback,
  entityRegistry?: EntityRegistry | null,
  app?: App | null,
): void {
  const btn = actionsRow.createEl("button", { cls: "archivist-dnd-action-btn" });
  const iconSpan = btn.createSpan();
  setIcon(iconSpan, "save");
  btn.createSpan({ text: "Copy & Save" });

  btn.addEventListener("click", async () => {
    // Copy to clipboard
    try {
      await navigator.clipboard.writeText("```" + result.entityType + "\n" + result.yamlSource + "\n```");
    } catch { /* clipboard may fail in some contexts */ }

    // Trigger the save callback
    onCopyAndSave(result.entityType, result.yamlSource, result.name);

    // Transition to saved state: replace actions row contents
    actionsRow.empty();
    renderCopyButton(actionsRow, result);

    // Try to find the newly-saved entity for the file ref
    const saved = entityRegistry?.search(result.name, result.entityType, 1)
      .find(e => e.source === "custom");
    if (saved) {
      renderFileRef(actionsRow, saved.filePath, app);
    }
  });
}

/**
 * Scans an element for `<pre><code>` blocks with D&D language classes
 * and replaces them with rendered stat blocks.
 */
export function replaceDndCodeFences(
  el: HTMLElement,
  onCopyAndSave?: CopyAndSaveCallback,
  entityRegistry?: EntityRegistry | null,
  app?: App | null,
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

    renderDndEntityBlock(container, result, onCopyAndSave, entityRegistry, app);
  }
}
