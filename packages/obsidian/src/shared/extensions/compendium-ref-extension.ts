import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { RangeSetBuilder, StateEffect } from "@codemirror/state";
import { setIcon, Notice, MarkdownView, type WorkspaceLeaf, type App, type Plugin } from "obsidian";
import type { ModuleRegistry } from "../../core/module-registry";
import type { ArchivistModule, EditContext, RenderContext } from "../../core/module-api";
import { renderSideButtons } from "../edit/side-buttons";
import { EntityRegistry } from "../entities/entity-registry";
import type { RegisteredEntity } from "../entities/entity-registry";
import * as yaml from "js-yaml";

// ---------------------------------------------------------------------------
// Module-level references (set by main.ts at plugin load)
// ---------------------------------------------------------------------------

let registryRef: EntityRegistry | null = null;

export function setCompendiumRefRegistry(registry: EntityRegistry): void {
  registryRef = registry;
}

let moduleRegistry: ModuleRegistry | null = null;

export function setCompendiumRefModuleRegistry(registry: ModuleRegistry): void {
  moduleRegistry = registry;
}

/**
 * Minimal plugin-host shape needed by the compendium-ref widget. Typed with
 * the fields this extension actually touches (app, workspace, compendium
 * manager) so we avoid importing ArchivistPlugin from src/main and closing
 * the shared-tree cross-module dependency.
 */
interface CompendiumRefHostPlugin extends Plugin {
  app: App;
  compendiumManager: {
    countReferences(slug: string): Promise<number>;
    deleteEntity(slug: string): Promise<void>;
  } | null;
}

let pluginRef: CompendiumRefHostPlugin | null = null;

export function setCompendiumRefPlugin(plugin: CompendiumRefHostPlugin): void {
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
export function refreshAllCompendiumRefs(plugin: CompendiumRefHostPlugin | null): void {
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
export { parseCompendiumRef } from "./compendium-ref-parser";
export type { CompendiumRef } from "./compendium-ref-parser";
import { parseCompendiumRef, type CompendiumRef } from "./compendium-ref-parser";

// ---------------------------------------------------------------------------
// Module-registry dispatch helpers
// ---------------------------------------------------------------------------

interface EntityLike {
  entityType: string;
  data: Record<string, unknown>;
}

/**
 * Parse the entity YAML via the owning module and render a view-mode stat
 * block. Returns the rendered HTMLElement, or null when no module is
 * registered for the entity type or the parse/render fails.
 */
function renderEntityViaModule(
  entity: EntityLike,
  host: HTMLElement,
  columns: number | undefined,
): HTMLElement | null {
  const mod = moduleRegistry?.getByEntityType(entity.entityType);
  if (!mod?.parseYaml || !mod.render) return null;

  const yamlStr = yaml.dump(entity.data, { lineWidth: -1 });
  const result = mod.parseYaml(yamlStr);
  if (!result.success) return null;

  const ctx: RenderContext = {
    plugin: pluginRef,
    ctx: null,
    ...(mod.supportsColumns ? { columns } : {}),
  };
  const appended = mod.render(host, result.data, ctx);
  // Modules return the rendered node in the ArchivistModule contract; fall
  // back to the last-appended child when they don't.
  return appended ?? host.lastElementChild as HTMLElement | null;
}

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

    const entity = ref.entityType
      ? registryRef.getByTypeAndSlug(ref.entityType, ref.slug)
      : registryRef.getBySlug(ref.slug);

    if (!entity) {
      return this.notFoundEl(ref, doc);
    }

    // Container holds rendered-block + side-buttons.
    const container = doc.createElement("div");
    container.className = "archivist-compendium-ref";
    container.tabIndex = 0;

    const rendered = this.renderEntityBlock(entity, container);
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

    // Side buttons: column state lives here so it persists across re-renders
    let columns = 1;
    const sideBtns = doc.createElement("div");
    sideBtns.className = "archivist-side-btns";
    container.appendChild(sideBtns);

    this.renderViewSideButtons(sideBtns, entity, ref, view, container, () => columns, (c) => { columns = c; });

    return container;
  }

  /** Render entity data into a stat block element via the module registry. */
  private renderEntityBlock(entity: EntityLike, host: HTMLElement, columns?: number): HTMLElement | null {
    // Scratch element: have the module render into a throwaway container so
    // we can return (and reposition) the produced node. The widget decides
    // where the rendered node lives in its DOM tree.
    const scratch = host.doc.createElement("div");
    const rendered = renderEntityViaModule(entity, scratch, columns);
    if (!rendered) return null;
    if (rendered.parentElement === scratch) scratch.removeChild(rendered);
    host.appendChild(rendered);
    return rendered;
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
    const entityMod = moduleRegistry?.getByEntityType(entity.entityType);
    const showColumnToggle = entityMod?.supportsColumns === true;

    renderSideButtons(sideBtns, {
      state: "default",
      isColumnActive: getColumns() === 2,
      showColumnToggle,
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
        if (!showColumnToggle) return;
        const newCols = getColumns() === 1 ? 2 : 1;
        setColumns(newCols);
        // Structurally the rendered block is always the first child of the
        // container (badge lives inside it, side-buttons are the next
        // sibling).
        const oldBlock = container.firstElementChild as HTMLElement | null;
        if (oldBlock && oldBlock !== sideBtns) {
          const scratch = container.doc.createElement("div");
          const newBlock = renderEntityViaModule(entity, scratch, newCols);
          if (newBlock) {
            const newBadge = container.doc.createElement("div");
            newBadge.className = "archivist-compendium-badge";
            newBadge.textContent = entity.compendium;
            newBlock.appendChild(newBadge);
            oldBlock.replaceWith(newBlock);
          }
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
    const mod: ArchivistModule | undefined = moduleRegistry?.getByEntityType(entity.entityType);
    if (!mod?.parseYaml || !mod.renderEditMode) return;

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
      const freshEntity =
        registryRef?.getByTypeAndSlug(entity.entityType, entity.slug) ?? entity;
      const rendered = this.renderEntityBlock(freshEntity, container);
      if (rendered) {
        const newBadge = doc.createElement("div");
        newBadge.className = "archivist-compendium-badge";
        newBadge.textContent = freshEntity.compendium;
        rendered.appendChild(newBadge);
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

    const yamlStr = yaml.dump(entity.data, { lineWidth: -1 });
    const result = mod.parseYaml(yamlStr);
    if (!result.success) return;

    const editCtx: EditContext = {
      plugin,
      ctx: null,
      source: yamlStr,
      onExit: onCancelExit,
      compendium: compendiumContext,
      onReplaceRef,
    };
    mod.renderEditMode(container, result.data, editCtx);
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
      void confirmViaHost(app, message, "Delete").then((ok) => {
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
// Confirm dialog host hook
// ---------------------------------------------------------------------------
//
// `shared/extensions/` cannot import the inquiry module's ConfirmModal
// directly without breaking the shared-tree invariant. `main.ts` injects a
// confirm-dialog implementation at plugin load via the setter below; when
// unwired, the delete flow silently no-ops.

type ConfirmFn = (app: App, message: string, confirmLabel?: string) => Promise<boolean>;
let confirmFnRef: ConfirmFn | null = null;

export function setCompendiumRefConfirmFn(fn: ConfirmFn): void {
  confirmFnRef = fn;
}

function confirmViaHost(app: App, message: string, confirmLabel?: string): Promise<boolean> {
  if (confirmFnRef) return confirmFnRef(app, message, confirmLabel);
  return Promise.resolve(false);
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

/**
 * Module-registry dispatch used by Reading-mode compendium-ref rendering.
 * Exposed here (rather than duplicated in main.ts) so both the CM6 widget
 * and the reading-mode post-processor use the same code path.
 */
export function renderCompendiumRefReadingMode(
  host: HTMLElement,
  entity: EntityLike & { compendium: string },
): HTMLElement | null {
  const rendered = renderEntityViaModule(entity, host, undefined);
  if (!rendered) return null;
  const badge = host.doc.createElement("div");
  badge.classList.add("archivist-compendium-badge");
  badge.textContent = entity.compendium;
  rendered.prepend(badge);
  return rendered;
}
