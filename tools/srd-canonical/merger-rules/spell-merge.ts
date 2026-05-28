import type { MergeRule, CanonicalEntry } from "../merger";
import type { Overlay } from "../overlay.schema";
import type { CastingOption } from "../../../src/modules/spell/spell.types";
import { rewriteCrossRefs } from "../cross-ref-map";
import { flattenEntries } from "./condition-merge";

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
  classes?: string[];
  at_higher_levels?: string[];
  damage?: { types: string[] };
  saving_throw?: { ability: string };
  casting_options?: CastingOption[];
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
    school: normalizeSchool(base.school),
    casting_time: (base.casting_time as string | undefined) ?? "",
    range: normalizeRange(base),
    components: composeComponents(base),
    duration: (base.duration as string | undefined) ?? "",
    concentration: base.concentration === true,
    ritual: base.ritual === true,
    description: "",  // filled below — see "description" comment
  };

  // description sourcing:
  //
  // Open5e's `desc` is the preferred source — it's pre-rendered prose with
  // plain-text cells, so wikilinks and dice tags don't end up inside table
  // cells (which would break GFM table parsing because `|` is the column
  // separator).
  //
  // Two failure modes force a switch to structured-rules entries:
  //   1. Open5e flattened a table onto a single line ("...direction. Table:
  //      Precipitation | Stage | Condition | |---|---| | 1 | Clear | …").
  //      Some 2024 spells (Control Weather) ship like this. The pipes are
  //      intact but no line breaks → markdown can't recognise the table.
  //   2. Open5e omits tables that the rules text needs (Control Weather
  //      2014 ships prose-only, no precipitation/temperature/wind tables).
  //
  // For (1) we replace the description entirely with the structured-rules
  // rendering; for (2) we keep the prose and append the structured tables.
  // We never use structured-rules when Open5e has properly-formatted tables
  // — that's where the wikilink-in-cell breakage lives, e.g. Animate
  // Objects's Animated Object Statistics table whose cells reference
  // `{@creature animated object (tiny)|MM}` and become `[[X|alias]]` with
  // pipes that collide with the column separator.
  const open5eDesc = (base.desc as string) ?? "";
  const hasProperTable = /\n\s*\|[^\n|]*\|/.test(open5eDesc);
  const hasFlattenedTable = !hasProperTable && /Table:.*\|.*\|.*\|/i.test(open5eDesc);

  let descText = open5eDesc;
  if (hasFlattenedTable && structured && Array.isArray(structured.entries) && structured.entries.length > 0) {
    // Replace entirely — Open5e's broken table can't be salvaged.
    descText = flattenEntries(structured.entries);
  } else if (!hasProperTable && structured && Array.isArray(structured.entries)) {
    // Augment — append any structured tables the prose doesn't have.
    const tables = (structured.entries as unknown[]).filter(
      e => e !== null && typeof e === "object" && (e as { type?: unknown }).type === "table",
    );
    if (tables.length > 0) {
      descText = `${descText}\n\n${flattenEntries(tables)}`.trim();
    }
  }
  out.description = rewriteCrossRefs(descText, entry.edition);

  // classes: Open5e v2 emits objects { name, key }; surface as lowercased name array.
  if (Array.isArray(base.classes)) {
    const classes = (base.classes as Array<unknown>)
      .map(c => {
        if (typeof c === "string") return c;
        if (c && typeof c === "object") {
          const obj = c as { name?: unknown; key?: unknown };
          if (typeof obj.name === "string") return obj.name;
          if (typeof obj.key === "string") return obj.key;
        }
        return "";
      })
      .map(s => s.toLowerCase())
      // Open5e class keys carry a "srd_" prefix (e.g. "srd_wizard"); strip it for runtime parity.
      .map(s => s.replace(/^srd_/, ""))
      .filter(Boolean);
    if (classes.length > 0) out.classes = classes;
  }

  // at_higher_levels: prefer Open5e v2's `higher_level` prose; fall back to structured-rules.
  // Parser expects string[] — wrap accordingly.
  if (typeof base.higher_level === "string" && base.higher_level.length > 0) {
    out.at_higher_levels = [rewriteCrossRefs(base.higher_level, entry.edition)];
  } else if (structured && Array.isArray(structured.entriesHigherLevel)) {
    const text = flattenEntries(structured.entriesHigherLevel);
    if (text) out.at_higher_levels = [rewriteCrossRefs(text, entry.edition)];
  }

  // damage: prefer Open5e v2's structured `damage_types`; fall back to structured-rules.
  if (Array.isArray(base.damage_types) && base.damage_types.length > 0) {
    out.damage = { types: (base.damage_types as unknown[]).map(String) };
  } else if (structured && Array.isArray(structured.damageInflict) && structured.damageInflict.length > 0) {
    out.damage = { types: structured.damageInflict as string[] };
  }

  // saving_throw: prefer Open5e v2's `saving_throw_ability`; fall back to structured-rules.
  if (typeof base.saving_throw_ability === "string" && base.saving_throw_ability.length > 0) {
    out.saving_throw = { ability: base.saving_throw_ability.toLowerCase() };
  } else if (structured && Array.isArray(structured.savingThrow) && structured.savingThrow.length > 0) {
    out.saving_throw = { ability: (structured.savingThrow as string[])[0] };
  }

  // casting_options: pass through Open5e v2's per-slot scaling rows.
  // The 2014 dataset includes a "default" row that just mirrors baseline (all-null
  // scaling fields) — fold it out, keeping only rows with actual scaling info.
  if (Array.isArray(base.casting_options)) {
    const all = base.casting_options as Array<Record<string, unknown>>;
    const filtered = all
      .filter(opt => opt.type !== "default" || hasScalingFields(opt))
      .map(opt => normalizeCastingOption(opt));
    if (filtered.length > 0) {
      out.casting_options = filtered;
    }
  }

  return out;
}

function hasScalingFields(opt: Record<string, unknown>): boolean {
  return ["damage_roll", "target_count", "duration", "range", "concentration", "shape_size"]
    .some(k => opt[k] != null);
}

function normalizeCastingOption(opt: Record<string, unknown>): CastingOption {
  const co: CastingOption = { type: typeof opt.type === "string" ? opt.type : "" };
  if (typeof opt.damage_roll === "string") co.damage_roll = opt.damage_roll;
  if (typeof opt.target_count === "number") co.target_count = opt.target_count;
  if (typeof opt.duration === "string") co.duration = opt.duration;
  if (typeof opt.range === "number") co.range = opt.range;
  if (typeof opt.concentration === "boolean") co.concentration = opt.concentration;
  if (typeof opt.shape_size === "number") co.shape_size = opt.shape_size;
  if (typeof opt.desc === "string") co.desc = opt.desc;
  return co;
}

/**
 * Open5e v2 spells expose `school` as `{ name: string; key: string }`. Older
 * fixtures may pass a plain string. Normalize to a lowercase string keyed off
 * `key` (preferred) or `name`.
 */
function normalizeSchool(raw: unknown): string {
  if (raw && typeof raw === "object") {
    const obj = raw as { key?: unknown; name?: unknown };
    if (typeof obj.key === "string") return obj.key.toLowerCase();
    if (typeof obj.name === "string") return obj.name.toLowerCase();
    return "";
  }
  if (typeof raw === "string") return raw.toLowerCase();
  return "";
}

/**
 * Open5e v2 spells expose `range` as a number (e.g. 150) and a parallel
 * `range_text` (e.g. "150 feet" / "Self" / "Touch"). Use the human-readable
 * form, falling back to a synthesized "{n} feet" if only the number is set.
 */
function normalizeRange(base: Record<string, unknown>): string {
  if (typeof base.range_text === "string" && base.range_text.length > 0) return base.range_text;
  if (typeof base.range === "string" && base.range.length > 0) return base.range;
  if (typeof base.range === "number") return `${base.range} feet`;
  return "";
}

/**
 * Open5e v2 spells expose components as separate booleans (`verbal`,
 * `somatic`, `material`) plus an optional `material_specified` string.
 * Compose into the canonical "V, S, M (...)" string.
 */
function composeComponents(base: Record<string, unknown>): string {
  // If the entry already provides a composed string (older fixtures or
  // hand-written test data), pass it through unchanged.
  if (typeof base.components === "string" && base.components.length > 0) return base.components;

  const parts: string[] = [];
  if (base.verbal === true) parts.push("V");
  if (base.somatic === true) parts.push("S");
  if (base.material === true) {
    const spec = base.material_specified;
    if (typeof spec === "string" && spec.length > 0) {
      parts.push(`M (${spec})`);
    } else {
      parts.push("M");
    }
  }
  return parts.join(", ");
}

// (Local entriesToText removed — replaced by `flattenEntries` from
// condition-merge, which handles strings, nested entries, lists, AND tables.)
