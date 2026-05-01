import { buildCanonicalSlug, type MergeRule, type CanonicalEntry } from "../merger";
import type { Overlay } from "../overlay.schema";
import type { StructuredEntry } from "../sources/structured-rules";
import { rewriteCrossRefs } from "../cross-ref-map";

export interface ConditionCanonical {
  slug: string;
  name: string;
  edition: "2014" | "2024";
  source: string;
  description: string;
  /** Future-extensible structured effects (e.g., "advantage on saves vs charm"). */
  effects?: string[];
}

export const conditionMergeRule: MergeRule = {
  kind: "condition",
  pickOverlay(_overlay: Overlay, _slug: string): unknown {
    // Conditions are fully captured by Open5e desc / structured-rules entries;
    // no overlay needed.
    return null;
  },
};

export function toConditionCanonical(entry: CanonicalEntry): ConditionCanonical {
  const base = entry.base as Record<string, unknown>;
  const baseDesc = (base.desc as string | undefined) ?? "";
  // Open5e exposes no SRD conditions; fall back to the structured-rules
  // (5etools dump) entries when the Open5e desc is empty. The Open5e path
  // is retained as the primary read so future Open5e publication of
  // conditions would just work.
  const description = baseDesc.length > 0
    ? baseDesc
    : structuredToDescription(entry.structured);

  return {
    slug: entry.slug,
    name: base.name as string,
    edition: entry.edition,
    source: entry.edition === "2014" ? "SRD 5.1" : "SRD 5.2",
    description: rewriteCrossRefs(description, entry.edition),
  };
}

/**
 * Build CanonicalEntry list directly from structured-rules condition entries.
 *
 * Mirrors the optional-features pattern: Open5e provides nothing for this
 * kind, so the structured-rules dump is source-of-truth. Each entry gets a
 * synthetic Open5eEntry stub so downstream code (writers, tests, projection)
 * can read identity fields off `entry.base.name`/`entry.base.key`.
 */
export function buildConditionsFromStructured(
  structured: StructuredEntry[],
  edition: "2014" | "2024",
): CanonicalEntry[] {
  return structured.map((s): CanonicalEntry => {
    const slug = buildCanonicalSlug(edition, s.name);
    return {
      slug,
      edition,
      kind: "condition",
      base: {
        key: slug,
        name: s.name,
      },
      structured: s,
      activation: null,
      overlay: null,
    };
  });
}

/**
 * Flatten a 5etools `entries` array into a single description string.
 * Handles the shapes seen in conditionsdiseases.json:
 *   - bare strings
 *   - `{ type: "list", items: [...] }`
 *   - `{ type: "entries", name?, entries: [...] }` (recursive; XPHB sub-headings)
 *   - `{ type: "table", caption?, colLabels, rows }` (e.g. Exhaustion levels)
 * Other unknown types are skipped. Output uses double-newline paragraphs,
 * "- " bullets, and pipe-tables.
 */
function structuredToDescription(structured: CanonicalEntry["structured"]): string {
  if (!structured) return "";
  const entries = (structured as { entries?: unknown[] }).entries;
  if (!Array.isArray(entries)) return "";
  return flattenEntries(entries).trim();
}

export function flattenEntries(entries: unknown[]): string {
  const parts: string[] = [];
  for (const e of entries) {
    if (typeof e === "string") {
      parts.push(e);
      continue;
    }
    if (!e || typeof e !== "object") continue;
    const obj = e as {
      type?: string;
      name?: string;
      caption?: string;
      items?: unknown[];
      entries?: unknown[];
      colLabels?: unknown[];
      rows?: unknown[];
    };
    if (obj.type === "list" && Array.isArray(obj.items)) {
      const bullets = obj.items
        .map(it => typeof it === "string" ? `- ${it}` : "")
        .filter(Boolean)
        .join("\n");
      if (bullets) parts.push(bullets);
      continue;
    }
    if (obj.type === "entries" && Array.isArray(obj.entries)) {
      const heading = obj.name ? `**${obj.name}.**` : "";
      const inner = flattenEntries(obj.entries).trim();
      if (heading && inner) parts.push(`${heading} ${inner}`);
      else if (inner) parts.push(inner);
      continue;
    }
    if (obj.type === "table" && Array.isArray(obj.colLabels) && Array.isArray(obj.rows)) {
      const rendered = renderTable(obj.colLabels, obj.rows, obj.caption);
      if (rendered) parts.push(rendered);
      continue;
    }
    // Unknown nested shapes are intentionally skipped.
  }
  return parts.join("\n\n");
}

/**
 * Render a 5etools `{type: "table"}` block as a markdown pipe-table.
 *
 * Cells may be plain strings or nested objects (e.g. `{type: "cell", entry}`
 * or `{type: "cell", roll: {...}}`). For non-string cells, attempt to flatten
 * via {@link flattenEntries}; if that yields nothing, fall back to JSON. Any
 * pipe characters inside cells are escaped so they don't break the table.
 *
 * 5etools cross-ref tags (`{@dice ...}`, `{@condition ...}`, etc.) are passed
 * through unchanged — `rewriteCrossRefs` runs on the assembled description
 * later and handles them uniformly.
 */
function renderTable(colLabels: unknown[], rows: unknown[], caption?: string): string {
  const headers = colLabels.map(cellToText);
  const lines: string[] = [];
  if (caption && typeof caption === "string" && caption.trim().length > 0) {
    lines.push(`**${caption.trim()}**`);
  }
  lines.push(`| ${headers.join(" | ")} |`);
  lines.push(`| ${headers.map(() => "---").join(" | ")} |`);
  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    const cells = row.map(cellToText);
    lines.push(`| ${cells.join(" | ")} |`);
  }
  return lines.join("\n");
}

function cellToText(cell: unknown): string {
  let text: string;
  if (typeof cell === "string") {
    text = cell;
  } else if (cell && typeof cell === "object") {
    const obj = cell as { type?: string; entry?: unknown; entries?: unknown[]; roll?: unknown };
    if (typeof obj.entry === "string") {
      text = obj.entry;
    } else if (Array.isArray(obj.entries)) {
      text = flattenEntries(obj.entries).replace(/\n+/g, " ").trim();
    } else {
      // Exotic shape (e.g. {type:"cell", roll:{exact:5}}): preserve as JSON
      // rather than crashing.
      try {
        text = JSON.stringify(cell);
      } catch {
        text = "";
      }
    }
  } else if (typeof cell === "number" || typeof cell === "boolean") {
    text = String(cell);
  } else {
    text = "";
  }
  // Escape pipes inside cells so they don't terminate the markdown column.
  return text.replace(/\|/g, "\\|");
}
