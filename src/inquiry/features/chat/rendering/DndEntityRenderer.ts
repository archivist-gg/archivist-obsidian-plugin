import type { App } from "obsidian";
import { setIcon, Notice } from "obsidian";

import type { EntityRegistry, RegisteredEntity } from "../../../../entities/entity-registry";
import { parseMonster } from "../../../../parsers/monster-parser";
import { parseSpell } from "../../../../parsers/spell-parser";
import { parseItem } from "../../../../parsers/item-parser";
import { renderMonsterBlock } from "../../../../renderers/monster-renderer";
import { renderSpellBlock } from "../../../../renderers/spell-renderer";
import { renderItemBlock } from "../../../../renderers/item-renderer";

import { isDndCodeFence, parseDndCodeFence, type DndCodeFenceResult } from "./dndCodeFence";

// Re-export pure functions and types for external consumers
export { isDndCodeFence, parseDndCodeFence, type DndCodeFenceResult } from "./dndCodeFence";

export type CopyAndSaveCallback = (entityType: string, yamlSource: string, name: string) => Promise<string | undefined> | void;
export type UpdateEntityCallback = (slug: string, data: Record<string, unknown>) => Promise<void>;

/**
 * Renders a D&D entity stat block into the given container element.
 * Includes action buttons based on whether the entity exists in the compendium.
 */
export function renderDndEntityBlock(
  containerEl: HTMLElement,
  result: DndCodeFenceResult,
  onCopyAndSave?: CopyAndSaveCallback,
  entityRegistry?: EntityRegistry | null,
  app?: App | null,
  onUpdate?: UpdateEntityCallback,
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

  // Action buttons
  if (onCopyAndSave) {
    const actionsRow = wrapper.createDiv({ cls: "claudian-dnd-actions" });

    // Check if entity already exists in registry (by name + type)
    const existingEntity = entityRegistry?.search(result.name, result.entityType, 1)
      .find(e => e.name.toLowerCase() === result.name.toLowerCase());

    if (existingEntity) {
      renderSavedEntityActions(actionsRow, result, existingEntity, onCopyAndSave, onUpdate, entityRegistry, app);
    } else {
      renderCopyAndSaveButton(actionsRow, result, onCopyAndSave, onUpdate, entityRegistry, app);
    }
  }
}

// ---------------------------------------------------------------------------
// Saved entity actions (entity exists in compendium)
// ---------------------------------------------------------------------------

function renderSavedEntityActions(
  actionsRow: HTMLElement,
  result: DndCodeFenceResult,
  entity: RegisteredEntity,
  onCopyAndSave: CopyAndSaveCallback,
  onUpdate?: UpdateEntityCallback,
  entityRegistry?: EntityRegistry | null,
  app?: App | null,
): void {
  // Copy (widget reference)
  renderCopyWidgetRefButton(actionsRow, result, entity.slug);

  // Update (overwrite existing entity data)
  if (onUpdate && !entity.readonly) {
    renderUpdateButton(actionsRow, result, entity, onUpdate);
  }

  // Save As New (save as a different entity)
  renderSaveAsNewButton(actionsRow, result, onCopyAndSave, onUpdate, entityRegistry, app);

  // File reference link
  renderFileRef(actionsRow, entity.filePath, app);
}

// ---------------------------------------------------------------------------
// Individual button renderers
// ---------------------------------------------------------------------------

/** Copy button that copies {{type:slug}} widget reference. */
function renderCopyWidgetRefButton(container: HTMLElement, result: DndCodeFenceResult, slug: string): void {
  const refText = `{{${result.entityType}:${slug}}}`;
  const btn = container.createEl("button", { cls: "archivist-dnd-action-btn" });
  const iconSpan = btn.createSpan();
  setIcon(iconSpan, "copy");
  const labelSpan = btn.createSpan({ text: "Copy" });

  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(refText);
    } catch { /* clipboard may fail in some contexts */ }
    labelSpan.setText("Copied!");
    setTimeout(() => labelSpan.setText("Copy"), 2000);
  });
}

/** Update button that overwrites the existing compendium entity with chat data. */
function renderUpdateButton(
  container: HTMLElement,
  result: DndCodeFenceResult,
  entity: RegisteredEntity,
  onUpdate: UpdateEntityCallback,
): void {
  const btn = container.createEl("button", { cls: "archivist-dnd-action-btn" });
  const iconSpan = btn.createSpan();
  setIcon(iconSpan, "refresh-cw");
  const labelSpan = btn.createSpan({ text: "Update" });

  btn.addEventListener("click", async () => {
    try {
      await onUpdate(entity.slug, result.data);
      labelSpan.setText("Updated!");
      setTimeout(() => labelSpan.setText("Update"), 2000);
    } catch (e: any) {
      new Notice(`Failed to update: ${e.message}`);
    }
  });
}

/** Save As New button for saving as a different entity when one already exists. */
function renderSaveAsNewButton(
  actionsRow: HTMLElement,
  result: DndCodeFenceResult,
  onCopyAndSave: CopyAndSaveCallback,
  onUpdate?: UpdateEntityCallback,
  entityRegistry?: EntityRegistry | null,
  app?: App | null,
): void {
  const btn = actionsRow.createEl("button", { cls: "archivist-dnd-action-btn" });
  const iconSpan = btn.createSpan();
  setIcon(iconSpan, "save");
  btn.createSpan({ text: "Save As New" });

  btn.addEventListener("click", async () => {
    const slugResult = await onCopyAndSave(result.entityType, result.yamlSource, result.name);
    const slug = typeof slugResult === "string" ? slugResult : undefined;

    if (slug) {
      // Copy widget reference
      try {
        await navigator.clipboard.writeText(`{{${result.entityType}:${slug}}}`);
      } catch { /* clipboard may fail */ }

      // Transition: re-render with the newly saved entity
      actionsRow.empty();
      const newEntity = entityRegistry?.getBySlug(slug);
      if (newEntity) {
        renderSavedEntityActions(actionsRow, result, newEntity, onCopyAndSave, onUpdate, entityRegistry, app);
      } else {
        renderCopyWidgetRefButton(actionsRow, result, slug);
      }
    }
  });
}

/** Copy & Save button for entities not yet in the compendium. */
function renderCopyAndSaveButton(
  actionsRow: HTMLElement,
  result: DndCodeFenceResult,
  onCopyAndSave: CopyAndSaveCallback,
  onUpdate?: UpdateEntityCallback,
  entityRegistry?: EntityRegistry | null,
  app?: App | null,
): void {
  const btn = actionsRow.createEl("button", { cls: "archivist-dnd-action-btn" });
  const iconSpan = btn.createSpan();
  setIcon(iconSpan, "save");
  btn.createSpan({ text: "Copy & Save" });

  btn.addEventListener("click", async () => {
    const slugResult = await onCopyAndSave(result.entityType, result.yamlSource, result.name);
    const slug = typeof slugResult === "string" ? slugResult : undefined;

    // Copy widget reference (or code fence fallback)
    const refText = slug
      ? `{{${result.entityType}:${slug}}}`
      : "```" + result.entityType + "\n" + result.yamlSource + "\n```";
    try {
      await navigator.clipboard.writeText(refText);
    } catch { /* clipboard may fail */ }

    // Transition to saved state
    actionsRow.empty();
    if (slug) {
      const newEntity = entityRegistry?.getBySlug(slug);
      if (newEntity) {
        renderSavedEntityActions(actionsRow, result, newEntity, onCopyAndSave, onUpdate, entityRegistry, app);
      } else {
        renderCopyWidgetRefButton(actionsRow, result, slug);
      }
    }
  });
}

/** File reference link that opens the saved entity file. */
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

/**
 * Scans an element for `<pre><code>` blocks with D&D language classes
 * and replaces them with rendered stat blocks.
 */
export function replaceDndCodeFences(
  el: HTMLElement,
  onCopyAndSave?: CopyAndSaveCallback,
  entityRegistry?: EntityRegistry | null,
  app?: App | null,
  onUpdate?: UpdateEntityCallback,
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

    renderDndEntityBlock(container, result, onCopyAndSave, entityRegistry, app, onUpdate);
  }
}
