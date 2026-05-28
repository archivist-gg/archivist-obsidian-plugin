// tools/srd-canonical/audit-conditions.ts
//
// One-shot worklist generator. Walks every magic item in the runtime bundle,
// classifies coverage, and writes audit-conditions.report.md (gitignored).
// Run after the canonical pipeline:
//
//   STRUCTURED_RULES_PATH=... npm run build:srd-canonical
//   npx tsx tools/srd-canonical/audit-conditions.ts
//
// Edit data/item-conditions.ts to add curated entries; re-run to see the
// "needs review" count drop.

import * as fs from "node:fs";
import * as path from "node:path";
import { CURATED_ITEM_CONDITIONS } from "./data/item-conditions";

export interface AuditItem {
  slug: string;
  name: string;
  bonuses?: Record<string, unknown>;
  description?: string;
}

export interface AuditInput {
  items2014: AuditItem[];
  items2024: AuditItem[];
}

export type CoverageStatus =
  | "curated"
  | "foundry"
  | "flat"
  | "prose-only"
  | "none";

export interface AuditEntry {
  slug: string;
  name: string;
  status: CoverageStatus;
  /** Best-effort conditional-language match for the report's "Suggested" hint. */
  conditionHint?: string;
}

export interface AuditReport {
  byStatus: Record<CoverageStatus, number>;
  entries: AuditEntry[];
  renderMarkdown(): string;
}

const CONDITIONAL_PHRASE_PATTERNS = [
  /\bif you are wearing no armor\b/i,
  /\bif you (?:are not|aren't) using a (?:\{[^}]+\})?shield\b/i,
  /\bagainst ranged attack/i,
  /\bon ranged attacks?\b/i,
  /\bagainst (?:undead|fiend|construct|aberration|beast|elemental|fey|giant|monstrosity|ooze|plant|celestial|dragon)/i,
  /\bunderwater\b/i,
  /\bin dim light\b/i,
  /\bwhile flying\b/i,
];

function hasFlatBonus(item: AuditItem): boolean {
  const b = item.bonuses;
  if (!b) return false;
  for (const v of Object.values(b)) {
    if (typeof v === "number") return true;
    if (v && typeof v === "object" && typeof (v as { static?: unknown }).static !== "undefined") {
      return true;
    }
  }
  return false;
}

function hasConditionalBonus(item: AuditItem): boolean {
  const b = item.bonuses;
  if (!b) return false;
  for (const v of Object.values(b)) {
    if (v && typeof v === "object" && Array.isArray((v as { when?: unknown }).when)) return true;
  }
  return false;
}

function detectConditionalProse(desc: string | undefined): string | undefined {
  if (!desc) return undefined;
  for (const re of CONDITIONAL_PHRASE_PATTERNS) {
    const m = re.exec(desc);
    if (m) return m[0];
  }
  return undefined;
}

export function computeAuditReport(input: AuditInput): AuditReport {
  const all = [...input.items2014, ...input.items2024];
  const entries: AuditEntry[] = [];
  for (const item of all) {
    const status = classify(item);
    const conditionHint = status === "prose-only" ? detectConditionalProse(item.description) : undefined;
    entries.push({ slug: item.slug, name: item.name, status, conditionHint });
  }
  const byStatus: Record<CoverageStatus, number> = { curated: 0, foundry: 0, flat: 0, "prose-only": 0, none: 0 };
  for (const e of entries) byStatus[e.status] += 1;
  return {
    byStatus,
    entries,
    renderMarkdown(): string {
      return renderMarkdown(entries, byStatus);
    },
  };
}

function classify(item: AuditItem): CoverageStatus {
  if (hasConditionalBonus(item)) {
    return CURATED_ITEM_CONDITIONS[item.slug] ? "curated" : "foundry";
  }
  const flat = hasFlatBonus(item);
  const prose = detectConditionalProse(item.description) !== undefined;
  if (flat && prose) return "prose-only";
  if (!flat && prose) return "prose-only";
  if (flat) return "flat";
  return "none";
}

function renderMarkdown(
  entries: AuditEntry[],
  byStatus: Record<CoverageStatus, number>,
): string {
  const date = new Date().toISOString().slice(0, 10);
  const lines: string[] = [];
  lines.push(`# Conditional-bonus audit (run on ${date})`);
  lines.push("");
  lines.push("## Items needing review (prose-only — no curated/foundry mapping)");
  lines.push("");
  const needs = entries.filter(e => e.status === "prose-only").sort((a, b) => a.slug.localeCompare(b.slug));
  for (const e of needs) {
    lines.push(`### ${e.slug}`);
    lines.push(`- Name: ${e.name}`);
    if (e.conditionHint) lines.push(`- Match: \`${e.conditionHint}\``);
    lines.push(`- [ ] reviewed`);
    lines.push("");
  }
  lines.push("## Coverage summary");
  lines.push("");
  lines.push("| Status | Count |");
  lines.push("|---|---|");
  for (const k of Object.keys(byStatus) as CoverageStatus[]) {
    lines.push(`| ${k} | ${byStatus[k]} |`);
  }
  lines.push("");
  return lines.join("\n");
}

function readBundleItems(file: string): AuditItem[] {
  if (!fs.existsSync(file)) return [];
  const data = JSON.parse(fs.readFileSync(file, "utf8")) as Array<Record<string, unknown>>;
  return data.map(d => ({
    slug: d.slug as string,
    name: d.name as string,
    bonuses: d.bonuses as Record<string, unknown> | undefined,
    description: d.description as string | undefined,
  }));
}

// CLI entrypoint.
if (import.meta.url === `file://${process.argv[1]}`) {
  const root = path.resolve(__dirname, "../../src/srd/data/runtime");
  const input: AuditInput = {
    items2014: readBundleItems(path.join(root, "item.2014.json")),
    items2024: readBundleItems(path.join(root, "item.2024.json")),
  };
  const report = computeAuditReport(input);
  const out = path.resolve(__dirname, "audit-conditions.report.md");
  fs.writeFileSync(out, report.renderMarkdown(), "utf8");
  console.log(`[audit] wrote ${out}`);
  console.log(`[audit] coverage:`, report.byStatus);
}
