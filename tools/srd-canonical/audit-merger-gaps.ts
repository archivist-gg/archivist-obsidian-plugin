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

import { slugifyName, editionPrefix } from "./sources/slug-normalize";

export interface ItemPair {
  slug: string;
  edition: "2014" | "2024";
  open5e: Record<string, unknown> | undefined;
  fivetools: Record<string, unknown> | undefined;
}

export function joinSources(
  open5eItems: Array<Record<string, unknown>>,
  fivetoolsItems: Array<Record<string, unknown>>,
  edition: "2014" | "2024",
): ItemPair[] {
  const prefix = editionPrefix(edition);
  const byOpen5eKey = new Map<string, Record<string, unknown>>();
  for (const o of open5eItems) {
    const key = (o.key as string) ?? "";
    if (key) byOpen5eKey.set(key, o);
  }
  const byFiveToolsSlug = new Map<string, Record<string, unknown>>();
  for (const f of fivetoolsItems) {
    const slug = `${prefix}${slugifyName(f.name as string)}`;
    byFiveToolsSlug.set(slug, f);
  }
  const allSlugs = new Set<string>([...byOpen5eKey.keys(), ...byFiveToolsSlug.keys()]);
  const out: ItemPair[] = [];
  for (const slug of allSlugs) {
    out.push({
      slug,
      edition,
      open5e: byOpen5eKey.get(slug),
      fivetools: byFiveToolsSlug.get(slug),
    });
  }
  return out;
}

export interface Finding {
  slug: string;
  edition: "2014" | "2024";
  field: string;
  gapClass: GapClass;
  materiality: "material" | "informational";
  open5e: unknown;
  fivetools: unknown;
}

export function auditPair(pair: ItemPair): Finding[] {
  const findings: Finding[] = [];
  const o = pair.open5e ?? {};
  const f = pair.fivetools ?? {};
  for (const p of FIELD_PAIRINGS) {
    const ov = p.open5eExtract(o);
    const fv = p.fivetoolsExtract(f);
    findings.push({
      slug: pair.slug,
      edition: pair.edition,
      field: p.canonicalField,
      gapClass: classifyGap(ov, fv, p.type),
      materiality: p.materiality,
      open5e: ov,
      fivetools: fv,
    });
  }
  return findings;
}

export interface FindingBuckets {
  material: Finding[];
  materialDisagree: Finding[];
  informational: Finding[];
  informationalDisagree: Finding[];
  symmetric: Finding[];
}

export function partitionFindings(findings: Finding[]): FindingBuckets {
  const buckets: FindingBuckets = {
    material: [],
    materialDisagree: [],
    informational: [],
    informationalDisagree: [],
    symmetric: [],
  };
  for (const f of findings) {
    if (f.gapClass === "match" || f.gapClass === "open5e-only") continue;
    if (f.gapClass === "both-empty") {
      if (f.materiality === "material") buckets.symmetric.push(f);
      continue;
    }
    if (f.gapClass === "5etools-only") {
      (f.materiality === "material" ? buckets.material : buckets.informational).push(f);
      continue;
    }
    if (f.gapClass === "disagree") {
      (f.materiality === "material" ? buckets.materialDisagree : buckets.informationalDisagree).push(f);
    }
  }
  return buckets;
}

function fmtValue(v: unknown): string {
  if (v === null || v === undefined) return "_(empty)_";
  if (typeof v === "string") return v.length > 60 ? `${v.slice(0, 57)}…` : v;
  if (Array.isArray(v)) return `[${v.length} entries]`;
  return JSON.stringify(v);
}

function findingRow(f: Finding): string {
  return `| ${f.slug} | ${f.edition} | \`${f.field}\` | ${f.gapClass} | ${fmtValue(f.open5e)} | ${fmtValue(f.fivetools)} |`;
}

export function renderMarkdown(buckets: FindingBuckets): string {
  const date = new Date().toISOString().slice(0, 10);
  const lines: string[] = [];
  lines.push(`# Merger gap audit (run on ${date})`);
  lines.push("");

  lines.push("## Material gaps");
  lines.push("");
  lines.push("Open5e empty + 5etools has data, on fields whose absence breaks runtime behavior. **Phase 2 fix list.**");
  lines.push("");
  if (buckets.material.length === 0) {
    lines.push("_(none — Phase 2 may be unnecessary)_");
  } else {
    lines.push("| Slug | Edition | Field | Class | Open5e | 5etools |");
    lines.push("|---|---|---|---|---|---|");
    for (const f of buckets.material) lines.push(findingRow(f));
  }
  lines.push("");

  if (buckets.materialDisagree.length > 0) {
    lines.push("### Material disagreements (out of scope; recorded for review)");
    lines.push("");
    lines.push("| Slug | Edition | Field | Class | Open5e | 5etools |");
    lines.push("|---|---|---|---|---|---|");
    for (const f of buckets.materialDisagree) lines.push(findingRow(f));
    lines.push("");
  }

  lines.push("## Informational gaps");
  lines.push("");
  lines.push("Open5e empty + 5etools has data, on fields not in runtime today. Recorded; no Phase 2 action.");
  lines.push("");
  if (buckets.informational.length === 0) {
    lines.push("_(none)_");
  } else {
    lines.push("| Slug | Edition | Field | Class | Open5e | 5etools |");
    lines.push("|---|---|---|---|---|---|");
    for (const f of buckets.informational) lines.push(findingRow(f));
  }
  lines.push("");

  lines.push("## Symmetric gaps");
  lines.push("");
  lines.push("Both sources empty on material fields. Upstream issues; out of scope.");
  lines.push("");
  if (buckets.symmetric.length === 0) {
    lines.push("_(none)_");
  } else {
    lines.push("| Slug | Edition | Field | Open5e | 5etools |");
    lines.push("|---|---|---|---|---|");
    for (const f of buckets.symmetric) {
      lines.push(`| ${f.slug} | ${f.edition} | \`${f.field}\` | ${fmtValue(f.open5e)} | ${fmtValue(f.fivetools)} |`);
    }
  }
  lines.push("");

  lines.push("## Summary");
  lines.push("");
  lines.push(`| Bucket | Count |`);
  lines.push(`|---|---|`);
  lines.push(`| Material gaps | ${buckets.material.length} |`);
  lines.push(`| Material disagreements | ${buckets.materialDisagree.length} |`);
  lines.push(`| Informational gaps | ${buckets.informational.length} |`);
  lines.push(`| Symmetric gaps | ${buckets.symmetric.length} |`);
  lines.push("");

  return lines.join("\n");
}

// CLI plumbing
import * as fs from "node:fs";
import * as path from "node:path";
import { readStructuredRules } from "./sources/structured-rules";

interface CliOpts {
  edition: "2014" | "2024" | "all";
  reportPath: string;
}

function parseCli(argv: string[]): CliOpts {
  let edition: CliOpts["edition"] = "all";
  let reportPath = path.resolve(__dirname, "audit-merger-gaps.report.md");
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--edition") edition = argv[++i] as CliOpts["edition"];
    else if (a === "--report") reportPath = path.resolve(argv[++i]);
  }
  return { edition, reportPath };
}

function loadOpen5eCache(edition: "2014" | "2024"): Array<Record<string, unknown>> {
  const cachePath = path.resolve(__dirname, ".cache/open5e", `magicitems.${edition}.json`);
  if (!fs.existsSync(cachePath)) {
    throw new Error(`Open5e cache missing: ${cachePath}. Run 'npm run build:srd-canonical' first.`);
  }
  const raw = JSON.parse(fs.readFileSync(cachePath, "utf8")) as { results?: Array<Record<string, unknown>> };
  return raw.results ?? [];
}

async function loadFivetoolsItems(edition: "2014" | "2024", rootPath: string): Promise<Array<Record<string, unknown>>> {
  const slugSet = new Set<string>(); // empty set is fine — readStructuredRules has a magic-items code path that emits all matching-source items.
  const results = await readStructuredRules({ kind: "magicitems", edition, rootPath, slugSet });
  return results as unknown as Array<Record<string, unknown>>;
}

async function runEdition(edition: "2014" | "2024", rootPath: string): Promise<Finding[]> {
  const open5e = loadOpen5eCache(edition);
  const fivetools = await loadFivetoolsItems(edition, rootPath);
  const pairs = joinSources(open5e, fivetools, edition);
  const findings: Finding[] = [];
  for (const p of pairs) findings.push(...auditPair(p));
  return findings;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    const opts = parseCli(process.argv.slice(2));
    const rootPath = process.env.STRUCTURED_RULES_PATH ?? "";
    if (!rootPath) {
      console.error("STRUCTURED_RULES_PATH env var required.");
      process.exit(2);
    }
    const editions: Array<"2014" | "2024"> = opts.edition === "all" ? ["2014", "2024"] : [opts.edition];
    const allFindings: Finding[] = [];
    for (const ed of editions) {
      allFindings.push(...await runEdition(ed, rootPath));
    }
    const buckets = partitionFindings(allFindings);
    const md = renderMarkdown(buckets);
    fs.writeFileSync(opts.reportPath, md, "utf8");
    console.log(`[audit-merger-gaps] wrote ${opts.reportPath}`);
    console.log(`[audit-merger-gaps] material:           ${buckets.material.length}`);
    console.log(`[audit-merger-gaps] material disagree:  ${buckets.materialDisagree.length}`);
    console.log(`[audit-merger-gaps] informational:      ${buckets.informational.length}`);
    console.log(`[audit-merger-gaps] informational disagree: ${buckets.informationalDisagree.length}`);
    console.log(`[audit-merger-gaps] symmetric:          ${buckets.symmetric.length}`);
    if (buckets.material.length > 0) {
      console.log(`[audit-merger-gaps] ⚠️  material gaps present — review report for Phase 2 fix list`);
    }
  })().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
