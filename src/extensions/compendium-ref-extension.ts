import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { RangeSetBuilder, StateEffect } from "@codemirror/state";
import { setIcon, Notice, MarkdownView, type WorkspaceLeaf } from "obsidian";
import type ArchivistPlugin from "../main";
import { confirm as confirmModal } from "../inquiry/shared/modals/ConfirmModal";
import { parseMonster } from "../parsers/monster-parser";
import { parseSpell } from "../parsers/spell-parser";
import { parseItem } from "../parsers/item-parser";
import { renderMonsterBlock } from "../renderers/monster-renderer";
import { renderSpellBlock } from "../renderers/spell-renderer";
import { renderItemBlock } from "../renderers/item-renderer";
import { renderMonsterEditMode } from "../edit/monster-edit-render";
import { renderSpellEditMode } from "../edit/spell-edit-render";
import { renderItemEditMode } from "../edit/item-edit-render";
import { renderSideButtons } from "../shared/edit/side-buttons";
import { EntityRegistry } from "../entities/entity-registry";
import type { RegisteredEntity } from "../entities/entity-registry";
import * as yaml from "js-yaml";

// ---------------------------------------------------------------------------
// Module-level registry reference (set by main.ts at plugin load)
// ---------------------------------------------------------------------------

let registryRef: EntityRegistry | null = null;

export function setCompendiumRefRegistry(registry: EntityRegistry): void {
  registryRef = registry;
}

// Module-level plugin reference (set by main.ts at plugin load)
let pluginRef: ArchivistPlugin | null = null;

export function setCompendiumRefPlugin(plugin: ArchivistPlugin): void {
  pluginRef = plugin;
}

// ---------------------------------------------------------------------------
// Cross-document refresh
// ---------------------------------------------------------------------------

/** Dispatch this effect to force compendium ref decorations to rebuild. */
export const compendiumRefreshEffect = StateEffect.define<null>();

/**
 * Refresh compendium ref widgets in all open editor views.
 * Call after updateEntity() or saveEntity() to propagate changes.
 */
export function refreshAllCompendiumRefs(plugin: ArchivistPlugin | null): void {
  if (!plugin) return;
  plugin.app.workspace.iterateAllLeaves((leaf: WorkspaceLeaf) => {
    if (leaf.view instanceof MarkdownView) {
      const editorView = (leaf.view.editor as unknown as { cm?: EditorView }).cm;
      if (editorView) {
        editorView.dispatch({ effects: compendiumRefreshEffect.of(null) });
      }
    }
  });
}

// Re-export parser from its own module (kept separate so tests can import without pulling in CM6/obsidian deps)
export { parseCompendiumRef, CompendiumRef } from "./compendium-ref-parser";
import { parseCompendiumRef, CompendiumRef } from "./compendium-ref-parser";

// ---------------------------------------------------------------------------
// CM6 Widget
// ---------------------------------------------------------------------------

class CompendiumRefWidget extends WidgetType {
  constructor(private refText: string) {
    super();
  }

  eq(other: CompendiumRefWidget): boolean {
    return this.refText === other.refText;
  }

  ignoreEvent(): boolean {
    return true;
  }

  toDOM(view: EditorView): HTMLElement {
    const doc = view.dom.doc;
    const ref = parseCompendiumRef(this.refText);

    if (!ref || !registryRef) {
      const err = doc.createElement("code");
      err.className = "archivist-compendium-ref-error";
      err.textContent = this.refText;
      return err;
    }

    const entity = registryRef.getBySlug(ref.slug);

    if (ref.entityType && entity && entity.entityType !== ref.entityType) {
      return this.notFoundEl(ref, doc);
    }

    if (!entity) {
      return this.notFoundEl(ref, doc);
    }

    const rendered = this.renderEntityBlock(entity);
    if (!rendered) {
      const err = doc.createElement("div");
      err.className = "archivist-compendium-ref-error";
      err.textContent = `Cannot render ${entity.entityType}: ${ref.slug}`;
      return err;
    }

    // Badge inside the stat block wrapper, top-right
    const badge = doc.createElement("div");
    badge.className = "archivist-compendium-badge";
    badge.textContent = entity.compendium;
    rendered.appendChild(badge);

    // Container
    const container = doc.createElement("div");
    container.className = "archivist-compendium-ref";
    container.tabIndex = 0;
    container.appendChild(rendered);

    // Side buttons: column state lives here so it persists across re-renders
    let columns = 1;
    const sideBtns = doc.createElement("div");
    sideBtns.className = "archivist-side-btns";
    container.appendChild(sideBtns);

    this.renderViewSideButtons(sideBtns, entity, ref, view, container, () => columns, (c) => { columns = c; });

    return container;
  }

  /** Render entity data into a stat block element. */
  private renderEntityBlock(entity: { entityType: string; data: Record<string, unknown> }, columns?: number): HTMLElement | null {
    const yamlStr = yaml.dump(entity.data, { lineWidth: -1 });
    const type = entity.entityType;

    if (type === "monster") {
      const result = parseMonster(yamlStr);
      if (result.success) return renderMonsterBlock(result.data, columns ?? 1);
    } else if (type === "spell") {
      const result = parseSpell(yamlStr);
      if (result.success) return renderSpellBlock(result.data);
    } else if (type === "item") {
      const result = parseItem(yamlStr);
      if (result.success) return renderItemBlock(result.data);
    }
    return null;
  }

  /** Render side buttons for view mode (default state). */
  private renderViewSideButtons(
    sideBtns: HTMLElement,
    entity: RegisteredEntity,
    ref: CompendiumRef,
    view: EditorView,
    container: HTMLElement,
    getColumns: () => number,
    setColumns: (c: number) => void,
  ): void {
    const isMonster = entity.entityType === "monster";

    renderSideButtons(sideBtns, {
      state: "default",
      isColumnActive: getColumns() === 2,
      showColumnToggle: isMonster,
      onEdit: () => {
        this.enterEditMode(container, sideBtns, entity, ref, view);
      },
      onJumpToRef: () => {
        if (pluginRef && entity.filePath) {
          void pluginRef.app.workspace.openLinkText(entity.filePath, "", true);
        }
      },
      onSave: () => {},
      onSaveAsNew: () => {},
      onCompendium: () => {},
      onCancel: () => {},
      onDelete: () => {},
      onDeleteRef: () => {
        this.deleteRefFromDocument(view, container);
      },
      onDeleteEntity: () => {
        this.deleteEntityFromCompendium(entity, view, container);
      },
      onColumnToggle: () => {
        if (!isMonster) return;
        const newCols = getColumns() === 1 ? 2 : 1;
        setColumns(newCols);
        const renderedBlock = container.querySelector(".archivist-monster-block-wrapper");
        if (renderedBlock) {
          const newBlock = this.renderEntityBlock(entity, newCols);
          if (newBlock) renderedBlock.replaceWith(newBlock);
        }
        this.renderViewSideButtons(sideBtns, entity, ref, view, container, getColumns, setColumns);
      },
    });
  }

  /** Get the current document range of this widget's {{...}} text. */
  private getRange(container: HTMLElement, view: EditorView): { from: number; to: number } {
    const from = view.posAtDOM(container);
    return { from, to: from + this.refText.length };
  }

  private enterEditMode(
    container: HTMLElement,
    sideBtns: HTMLElement,
    entity: RegisteredEntity,
    ref: CompendiumRef,
    view: EditorView,
  ): void {
    if (!pluginRef) return;
    const plugin = pluginRef;
    // Remove rendered stat block (keep side buttons and container)
    const badge = container.querySelector(".archivist-compendium-badge");
    const statBlock = container.querySelector(
      ".archivist-monster-block-wrapper, .archivist-spell-block-wrapper, .archivist-item-block-wrapper",
    );
    badge?.remove();
    statBlock?.remove();

    sideBtns.classList.add("always-visible");

    const compendiumContext = {
      slug: entity.slug,
      compendium: entity.compendium,
      readonly: entity.readonly,
    };

    const onCancelExit = () => {
      const doc = container.doc;
      // Re-render view mode directly into the container
      while (container.firstChild) container.firstChild.remove();

      // Re-render stat block with badge inside (fetch fresh data from registry)
      const freshEntity = registryRef?.getBySlug(entity.slug) ?? entity;
      const rendered = this.renderEntityBlock(freshEntity);
      if (rendered) {
        const newBadge = doc.createElement("div");
        newBadge.className = "archivist-compendium-badge";
        newBadge.textContent = freshEntity.compendium;
        rendered.appendChild(newBadge);
        container.appendChild(rendered);
      }

      // Re-render side buttons with fresh column state
      let cols = 1;
      const newSideBtns = doc.createElement("div");
      newSideBtns.className = "archivist-side-btns";
      container.appendChild(newSideBtns);
      this.renderViewSideButtons(newSideBtns, freshEntity, ref, view, container, () => cols, (c) => { cols = c; });

      // Also refresh other docs in case entity data changed
      refreshAllCompendiumRefs(pluginRef);
    };

    const onReplaceRef = (newRefText: string) => {
      // Replace the {{type:slug}} text in the document via CM6 transaction
      const { from, to } = this.getRange(container, view);
      view.dispatch({
        changes: { from, to, insert: newRefText },
      });
    };

    const type = entity.entityType;
    if (type === "monster") {
      const yamlStr = yaml.dump(entity.data, { lineWidth: -1 });
      const result = parseMonster(yamlStr);
      if (result.success) {
        renderMonsterEditMode(
          result.data, container, null, plugin,
          onCancelExit, compendiumContext, onReplaceRef,
        );
      }
    } else if (type === "spell") {
      const yamlStr = yaml.dump(entity.data, { lineWidth: -1 });
      const result = parseSpell(yamlStr);
      if (result.success) {
        renderSpellEditMode(
          result.data, container, null, plugin,
          onCancelExit, compendiumContext, onReplaceRef,
        );
      }
    } else if (type === "item") {
      const yamlStr = yaml.dump(entity.data, { lineWidth: -1 });
      const result = parseItem(yamlStr);
      if (result.success) {
        renderItemEditMode(
          result.data, container, null, plugin,
          onCancelExit, compendiumContext, onReplaceRef,
        );
      }
    }
  }

  private deleteRefFromDocument(view: EditorView, container: HTMLElement): void {
    const { from, to } = this.getRange(container, view);
    view.dispatch({
      changes: { from, to, insert: "" },
    });
  }

  private deleteEntityFromCompendium(
    entity: RegisteredEntity,
    view: EditorView,
    container: HTMLElement,
  ): void {
    if (!pluginRef?.compendiumManager) return;

    const manager = pluginRef.compendiumManager;

    void manager.countReferences(entity.slug).then((refCount: number) => {
      let message = `Delete "${entity.name}" from ${entity.compendium}?`;
      if (refCount > 0) {
        message += `\n\nThis entity is referenced in ${refCount} other location${refCount === 1 ? "" : "s"}. Those references will break.`;
      }

      const app = pluginRef?.app;
      if (!app) return;
      void confirmModal(app, message, "Delete").then((ok) => {
        if (!ok) return;
        // Remove ref from current document
        const { from, to } = this.getRange(container, view);
        view.dispatch({
          changes: { from, to, insert: "" },
        });

        // Delete entity from compendium
        manager.deleteEntity(entity.slug)
          .then(() => {
            new Notice(`Deleted ${entity.name} from ${entity.compendium}`);
            refreshAllCompendiumRefs(pluginRef);
          })
          .catch((e: Error) => new Notice(`Failed to delete: ${e.message}`));
      });
    });
  }

  private notFoundEl(ref: CompendiumRef, doc: Document = activeDocument): HTMLElement {
    const el = doc.createElement("div");
    el.className = "archivist-compendium-ref-error";

    const icon = doc.createElement("div");
    icon.className = "archivist-not-found-icon";
    setIcon(icon, "alert-triangle");
    el.appendChild(icon);

    const textWrap = doc.createElement("div");
    textWrap.className = "archivist-not-found-text";

    const label = doc.createElement("div");
    label.className = "archivist-not-found-label";
    label.textContent = "Entity not found";
    textWrap.appendChild(label);

    const refText = doc.createElement("div");
    refText.className = "archivist-not-found-ref";
    refText.textContent = ref.entityType ? `${ref.entityType}:${ref.slug}` : ref.slug;
    textWrap.appendChild(refText);

    el.appendChild(textWrap);
    return el;
  }
}

// ---------------------------------------------------------------------------
// Decoration builder
// ---------------------------------------------------------------------------

const COMPENDIUM_REF_RE = /\{\{[^}]+\}\}/g;

function buildCompendiumRefDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const cursorPos = view.state.selection.main.head;

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    let m: RegExpExecArray | null;
    COMPENDIUM_REF_RE.lastIndex = 0;

    while ((m = COMPENDIUM_REF_RE.exec(text)) !== null) {
      const start = from + m.index;
      const end = start + m[0].length;

      // Skip decoration when the cursor is strictly inside the reference (user is typing)
      if (cursorPos > start && cursorPos < end) continue;

      builder.add(
        start,
        end,
        Decoration.replace({ widget: new CompendiumRefWidget(m[0]) }),
      );
    }
  }

  return builder.finish();
}

// ---------------------------------------------------------------------------
// CM6 ViewPlugin
// ---------------------------------------------------------------------------

export const compendiumRefPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildCompendiumRefDecorations(view);
    }

    update(update: ViewUpdate) {
      const hasRefresh = update.transactions.some((tr) =>
        tr.effects.some((e) => e.is(compendiumRefreshEffect)),
      );
      if (hasRefresh || update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = buildCompendiumRefDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  },
);
