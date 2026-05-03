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
