import type { MergeRule, CanonicalEntry } from "../merger";
import type { Overlay } from "../overlay.schema";
import { rewriteCrossRefs } from "../cross-ref-map";

export interface SpellCanonical {
  slug: string;
  name: string;
  edition: "2014" | "2024";
  source: string;
  level: number; // 0 = cantrip
  school: string;
  casting_time: string;
  range: string;
  components: string;
  duration: string;
  concentration: boolean;
  ritual: boolean;
  description: string;
  at_higher_levels?: string;
  damage?: { types: string[] };
  saving_throw?: { ability: string };
}

export const spellMergeRule: MergeRule = {
  kind: "spell",
  pickOverlay(_overlay: Overlay, _slug: string): unknown {
    // Spells rarely need overlay (their semantics are well-captured by Open5e + structured-rules).
    return null;
  },
};

export function toSpellCanonical(entry: CanonicalEntry): SpellCanonical {
  const base = entry.base as Record<string, unknown>;
  const structured = entry.structured as Record<string, unknown> | null;

  const out: SpellCanonical = {
    slug: entry.slug,
    name: base.name as string,
    edition: entry.edition,
    source: entry.edition === "2014" ? "SRD 5.1" : "SRD 5.2",
    level: typeof base.level === "number" ? base.level : 0,
    school: (base.school as string | undefined) ?? "",
    casting_time: (base.casting_time as string | undefined) ?? "",
    range: (base.range as string | undefined) ?? "",
    components: (base.components as string | undefined) ?? "",
    duration: (base.duration as string | undefined) ?? "",
    concentration: base.concentration === true,
    ritual: base.ritual === true,
    description: rewriteCrossRefs((base.desc as string) ?? "", entry.edition),
  };

  if (structured) {
    if (Array.isArray(structured.entriesHigherLevel)) {
      const text = entriesToText(structured.entriesHigherLevel);
      if (text) out.at_higher_levels = rewriteCrossRefs(text, entry.edition);
    }
    if (Array.isArray(structured.damageInflict) && structured.damageInflict.length > 0) {
      out.damage = { types: structured.damageInflict as string[] };
    }
    if (Array.isArray(structured.savingThrow) && structured.savingThrow.length > 0) {
      out.saving_throw = { ability: (structured.savingThrow as string[])[0] };
    }
  }

  return out;
}

/**
 * Flatten a structured-rules entries array (mix of strings and nested objects with `entries`)
 * into a single newline-joined string. Falls back to JSON.stringify for unrecognized objects.
 */
function entriesToText(entries: unknown[]): string {
  const parts: string[] = [];
  for (const e of entries) {
    if (typeof e === "string") {
      parts.push(e);
    } else if (e && typeof e === "object") {
      const obj = e as Record<string, unknown>;
      if (Array.isArray(obj.entries)) {
        const inner = entriesToText(obj.entries);
        if (inner) parts.push(inner);
      } else {
        parts.push(JSON.stringify(obj));
      }
    }
  }
  return parts.join("\n\n");
}
