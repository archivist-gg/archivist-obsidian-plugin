// tools/srd-canonical/audit-merger-gaps.ts
//
// Diff Open5e vs 5etools per-field for canonical magic items. Produces a
// gap report partitioned into material/informational/symmetric sections.
// Mirrors the audit-conditions.ts pattern.
//
// Design: each FIELD_PAIRING (Slice 2) carries per-source extractor functions
// that produce canonical comparable values. isEmpty / classifyGap operate on
// canonical values only.
//
// Run after `npm run build:srd-canonical` (or after the cache is fresh):
//   npx tsx tools/srd-canonical/audit-merger-gaps.ts

export type FieldType = "string" | "number" | "cost" | "boolean";

export function isEmpty(value: unknown, type: FieldType): boolean {
  switch (type) {
    case "string":
      return value === null || value === undefined || value === "";
    case "number":
      return value === null || value === undefined;
    case "cost":
      return value === null || value === undefined || value === "" || value === "0.00";
    case "boolean":
      return value !== true;
  }
}

export type GapClass =
  | "match"
  | "disagree"
  | "open5e-only"
  | "5etools-only"
  | "both-empty";

export function classifyGap(open5e: unknown, fivetools: unknown, type: FieldType): GapClass {
  const aEmpty = isEmpty(open5e, type);
  const bEmpty = isEmpty(fivetools, type);
  if (aEmpty && bEmpty) return "both-empty";
  if (aEmpty) return "5etools-only";
  if (bEmpty) return "open5e-only";
  return open5e === fivetools ? "match" : "disagree";
}

export interface FieldPairing {
  canonicalField: string;
  open5eExtract: (item: Record<string, unknown>) => unknown;
  fivetoolsExtract: (item: Record<string, unknown>) => unknown;
  type: FieldType;
  materiality: "material" | "informational";
}

function asStringOrUndef(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function subobjectName(v: unknown): string | undefined {
  if (v === null || v === undefined || typeof v !== "object") return undefined;
  const name = (v as { name?: unknown }).name;
  return typeof name === "string" && name.length > 0 ? name : undefined;
}

function slugToTitleName(slug: unknown): string | undefined {
  if (typeof slug !== "string" || slug.length === 0) return undefined;
  const base = slug.split("|")[0];
  if (!base) return undefined;
  const titled = base.split(/[-_]+/).filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  return titled.length > 0 ? titled : undefined;
}

function entriesAsProse(entries: unknown): string | undefined {
  if (!Array.isArray(entries) || entries.length === 0) return undefined;
  if (!entries.every((e): e is string => typeof e === "string")) return undefined;
  return entries.join("\n\n");
}

function cpToGpStringForAudit(cp: unknown): string | undefined {
  if (typeof cp !== "number" || cp <= 0) return undefined;
  return (cp / 100).toFixed(2);
}

export const FIELD_PAIRINGS: FieldPairing[] = [
  // Material — runtime-impact; Phase 2 fix candidates.
  {
    canonicalField: "description",
    open5eExtract: (o) => asStringOrUndef(o.desc),
    fivetoolsExtract: (f) => entriesAsProse(f.entries),
    type: "string",
    materiality: "material",
  },
  {
    canonicalField: "base_item",
    open5eExtract: (o) => subobjectName(o.weapon) ?? subobjectName(o.armor),
    fivetoolsExtract: (f) => slugToTitleName(f.baseItem),
    type: "string",
    materiality: "material",
  },
  {
    canonicalField: "attunement.required",
    open5eExtract: (o) => o.requires_attunement === true,
    fivetoolsExtract: (f) => f.reqAttune === true || (typeof f.reqAttune === "string" && f.reqAttune.length > 0),
    type: "boolean",
    materiality: "material",
  },
  {
    canonicalField: "attunement.restriction",
    open5eExtract: (o) => asStringOrUndef(o.attunement_detail),
    fivetoolsExtract: (f) => typeof f.reqAttune === "string" ? f.reqAttune : undefined,
    type: "string",
    materiality: "material",
  },
  {
    canonicalField: "weight",
    open5eExtract: (o) => typeof o.weight === "number" ? o.weight : undefined,
    fivetoolsExtract: (f) => typeof f.weight === "number" ? f.weight : undefined,
    type: "number",
    materiality: "material",
  },
  {
    canonicalField: "cost",
    open5eExtract: (o) => typeof o.cost === "string" ? o.cost : undefined,
    fivetoolsExtract: (f) => cpToGpStringForAudit(f.value),
    type: "cost",
    materiality: "material",
  },
  {
    canonicalField: "rarity",
    open5eExtract: (o) => asStringOrUndef(o.rarity),
    fivetoolsExtract: (f) => asStringOrUndef(f.rarity),
    type: "string",
    materiality: "material",
  },

  // Informational — recorded, no Phase 2 action.
  {
    canonicalField: "name",
    open5eExtract: (o) => asStringOrUndef(o.name),
    fivetoolsExtract: (f) => asStringOrUndef(f.name),
    type: "string",
    materiality: "informational",
  },
  {
    canonicalField: "category",
    open5eExtract: (o) => asStringOrUndef(o.category),
    fivetoolsExtract: (f) => asStringOrUndef(f.type),
    type: "string",
    materiality: "informational",
  },
  {
    canonicalField: "size",
    open5eExtract: (o) => asStringOrUndef(o.size),
    fivetoolsExtract: (f) => asStringOrUndef(f.size),
    type: "string",
    materiality: "informational",
  },
];
