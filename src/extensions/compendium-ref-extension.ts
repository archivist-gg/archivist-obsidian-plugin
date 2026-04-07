import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { RangeSetBuilder, StateEffect } from "@codemirror/state";
import { setIcon } from "obsidian";
import { parseMonster } from "../parsers/monster-parser";
import { parseSpell } from "../parsers/spell-parser";
import { parseItem } from "../parsers/item-parser";
import { renderMonsterBlock } from "../renderers/monster-renderer";
import { renderSpellBlock } from "../renderers/spell-renderer";
import { renderItemBlock } from "../renderers/item-renderer";
import { renderSideButtons } from "../edit/side-buttons";
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
let pluginRef: any = null;

export function setCompendiumRefPlugin(plugin: any): void {
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
export function refreshAllCompendiumRefs(plugin: any): void {
  plugin.app.workspace.iterateAllLeaves((leaf: any) => {
    if (leaf.view?.getViewType?.() === "markdown") {
      const editorView = (leaf.view as any).editor?.cm as EditorView | undefined;
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

  toDOM(view: EditorView): HTMLElement {
    const ref = parseCompendiumRef(this.refText);

    if (!ref || !registryRef) {
      const err = document.createElement("code");
      err.className = "archivist-compendium-ref-error";
      err.textContent = this.refText;
      return err;
    }

    const entity = registryRef.getBySlug(ref.slug);

    if (entity && ref.entityType && entity.entityType !== ref.entityType) {
      return this.notFoundEl(ref);
    }

    if (!entity) {
      return this.notFoundEl(ref);
    }

    const rendered = this.renderEntityBlock(entity);
    if (!rendered) {
      const err = document.createElement("div");
      err.className = "archivist-compendium-ref-error";
      err.textContent = `Cannot render ${entity.entityType}: ${ref.slug}`;
      return err;
    }

    // Badge
    const badge = document.createElement("div");
    badge.className = "archivist-compendium-badge";
    badge.textContent = entity.compendium;

    // Container
    const container = document.createElement("div");
    container.className = "archivist-compendium-ref";
    container.appendChild(badge);
    container.appendChild(rendered);

    // Side buttons
    const sideBtns = document.createElement("div");
    sideBtns.className = "archivist-side-btns";
    container.appendChild(sideBtns);

    this.renderViewSideButtons(sideBtns, entity, ref, view, container);

    return container;
  }

  /** Render entity data into a stat block element. */
  private renderEntityBlock(entity: { entityType: string; data: Record<string, unknown> }): HTMLElement | null {
    const yamlStr = yaml.dump(entity.data, { lineWidth: -1 });
    const type = entity.entityType;

    if (type === "monster") {
      const result = parseMonster(yamlStr);
      if (result.success) return renderMonsterBlock(result.data);
    } else if (type === "spell") {
      const result = parseSpell(yamlStr);
      if (result.success) return renderSpellBlock(result.data);
    } else if (type === "item" || type === "magic-item") {
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
  ): void {
    const isMonster = entity.entityType === "monster";
    let columns = 1;

    renderSideButtons(sideBtns, {
      state: "default",
      isColumnActive: columns === 2,
      showColumnToggle: isMonster,
      onEdit: () => {
        this.enterEditMode(container, sideBtns, entity, ref, view);
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
        columns = columns === 1 ? 2 : 1;
        const renderedBlock = container.querySelector(".archivist-monster-block");
        if (renderedBlock) {
          const newBlock = this.renderEntityBlock({ ...entity, data: { ...entity.data, columns } });
          if (newBlock) renderedBlock.replaceWith(newBlock);
        }
        this.renderViewSideButtons(sideBtns, entity, ref, view, container);
      },
    });
  }

  /** Get the current document range of this widget's {{...}} text. */
  private getRange(container: HTMLElement, view: EditorView): { from: number; to: number } {
    const from = view.posAtDOM(container);
    return { from, to: from + this.refText.length };
  }

  /** Enter edit mode — implemented in Task 10. */
  private enterEditMode(
    container: HTMLElement,
    sideBtns: HTMLElement,
    entity: RegisteredEntity,
    ref: CompendiumRef,
    view: EditorView,
  ): void {
    // TODO: Task 10
  }

  /** Remove the {{type:slug}} text from the document. */
  private deleteRefFromDocument(view: EditorView, container: HTMLElement): void {
    // TODO: Task 10
  }

  /** Delete entity from compendium with confirmation. */
  private deleteEntityFromCompendium(
    entity: RegisteredEntity,
    view: EditorView,
    container: HTMLElement,
  ): void {
    // TODO: Task 10
  }

  private notFoundEl(ref: CompendiumRef): HTMLElement {
    const el = document.createElement("div");
    el.className = "archivist-compendium-ref-error";

    const icon = document.createElement("div");
    icon.className = "archivist-not-found-icon";
    setIcon(icon, "alert-triangle");
    el.appendChild(icon);

    const textWrap = document.createElement("div");
    textWrap.className = "archivist-not-found-text";

    const label = document.createElement("div");
    label.className = "archivist-not-found-label";
    label.textContent = "Entity not found";
    textWrap.appendChild(label);

    const refText = document.createElement("div");
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
