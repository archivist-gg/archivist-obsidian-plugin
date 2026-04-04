import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { parseMonster } from "../parsers/monster-parser";
import { parseSpell } from "../parsers/spell-parser";
import { parseItem } from "../parsers/item-parser";
import { renderMonsterBlock } from "../renderers/monster-renderer";
import { renderSpellBlock } from "../renderers/spell-renderer";
import { renderItemBlock } from "../renderers/item-renderer";
import { EntityRegistry } from "../entities/entity-registry";
import * as yaml from "js-yaml";

// ---------------------------------------------------------------------------
// Module-level registry reference (set by main.ts at plugin load)
// ---------------------------------------------------------------------------

let registryRef: EntityRegistry | null = null;

export function setCompendiumRefRegistry(registry: EntityRegistry): void {
  registryRef = registry;
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

export interface CompendiumRef {
  entityType: string | null;
  slug: string;
}

const VALID_TYPES = new Set([
  "monster", "spell", "item", "feat", "condition",
  "class", "background", "armor", "weapon",
]);

export function parseCompendiumRef(text: string): CompendiumRef | null {
  const match = text.match(/^\{\{\s*(.+?)\s*\}\}$/);
  if (!match) return null;
  const inner = match[1].trim();
  if (!inner) return null;
  const colonIdx = inner.indexOf(":");
  if (colonIdx === -1) return { entityType: null, slug: inner };
  const prefix = inner.substring(0, colonIdx).trim();
  const slug = inner.substring(colonIdx + 1).trim();
  if (!slug) return null;
  if (!VALID_TYPES.has(prefix)) return { entityType: null, slug: inner };
  return { entityType: prefix, slug };
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

  toDOM(): HTMLElement {
    const ref = parseCompendiumRef(this.refText);

    if (!ref || !registryRef) {
      const err = document.createElement("code");
      err.className = "archivist-compendium-ref-error";
      err.textContent = this.refText;
      return err;
    }

    const entity = registryRef.getBySlug(ref.slug);

    // If an explicit entityType was given and it doesn't match, treat as not found
    if (entity && ref.entityType && entity.entityType !== ref.entityType) {
      return this.notFoundEl(ref);
    }

    if (!entity) {
      return this.notFoundEl(ref);
    }

    // Dump entity data to YAML for the parsers
    const yamlStr = yaml.dump(entity.data, { lineWidth: -1 });

    let rendered: HTMLElement | null = null;
    const type = entity.entityType;

    if (type === "monster") {
      const result = parseMonster(yamlStr);
      if (result.success) rendered = renderMonsterBlock(result.data);
    } else if (type === "spell") {
      const result = parseSpell(yamlStr);
      if (result.success) rendered = renderSpellBlock(result.data);
    } else if (type === "item" || type === "magic-item") {
      const result = parseItem(yamlStr);
      if (result.success) rendered = renderItemBlock(result.data);
    }

    if (!rendered) {
      const err = document.createElement("div");
      err.className = "archivist-compendium-ref-error";
      err.textContent = `Cannot render ${type}: ${ref.slug}`;
      return err;
    }

    // Compendium badge
    const badge = document.createElement("div");
    badge.className = "archivist-compendium-badge";
    badge.textContent = entity.compendium;

    // Wrapper container
    const container = document.createElement("div");
    container.className = "archivist-compendium-ref";
    container.appendChild(badge);
    container.appendChild(rendered);
    return container;
  }

  private notFoundEl(ref: CompendiumRef): HTMLElement {
    const el = document.createElement("div");
    el.className = "archivist-compendium-ref-error";
    el.textContent = `Entity not found: ${ref.entityType ? ref.entityType + ":" : ""}${ref.slug}`;
    return el;
  }
}

// ---------------------------------------------------------------------------
// Decoration builder
// ---------------------------------------------------------------------------

const COMPENDIUM_REF_RE = /\{\{[^}]+\}\}/g;

function buildCompendiumRefDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    let m: RegExpExecArray | null;
    COMPENDIUM_REF_RE.lastIndex = 0;

    while ((m = COMPENDIUM_REF_RE.exec(text)) !== null) {
      const start = from + m.index;
      const end = start + m[0].length;
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
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildCompendiumRefDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  },
);
