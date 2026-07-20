#!/usr/bin/env node
// migrate-homebrew.mjs
// ---------------------------------------------------------------------------
// P1 slug type-namespacing — migrate the vault's NON-bundle homebrew
// compendium .md files so each entity's OWN slug becomes 3-part
// (`<prefix>_<entity_type>_<name>`). SRD compendiums are bundle-managed and
// handled by regen+reseed elsewhere — this script NEVER touches them.
//
// Rules (spec D7.2, own-slug-only, computed from frontmatter):
//   * Rewrite ONLY the entity's OWN slug: the frontmatter `slug:` line AND the
//     FIRST top-level `slug:` line in the first body code fence, WHEN PRESENT
//     and equal to the old own-slug (class/subclass/boon/monster/spell/race
//     bodies have one; many item bodies do not — never invent one).
//   * New slug is COMPUTED from frontmatter (compendium, entity_type, name),
//     never parsed from the old slug string.
//   * LEAVE every cross-reference untouched (parent_class, available_to,
//     pool_grants, base_item, starting_equipment, body {@spell ...} markup).
//   * Idempotent: skip already-migrated slugs; re-running is a zero-diff no-op.
//
// Usage:
//   node migrate-homebrew.mjs            # DRY RUN — prints a unified diff
//   node migrate-homebrew.mjs --apply    # writes changes to disk
//
// Default is DRY RUN. Nothing is written unless --apply is passed.

import fs from "node:fs";
import path from "node:path";
import { computeNewSlug, isMigrated } from "./slug-core.mjs";

const VAULT_COMPENDIUM = "/Users/shinoobi/Obsidian/DnD/Compendium";
const HOMEBREW_DIRS = ["MCDM", "DMG 2024", "Eberron - Forge of the Artificer", "Me"];
// NEVER these — bundle-managed:
const FORBIDDEN_DIRS = new Set(["SRD 2024", "SRD 5e"]);

const APPLY = process.argv.includes("--apply");

// --- helpers ---------------------------------------------------------------

/** Strip a matching pair of surrounding single/double quotes from a YAML scalar. */
function unquote(v) {
  const s = v.trim();
  if (s.length >= 2 && ((s[0] === '"' && s.at(-1) === '"') || (s[0] === "'" && s.at(-1) === "'"))) {
    return s.slice(1, -1);
  }
  return s;
}

/** Recursively collect candidate .md files, skipping ignore patterns. */
function collectMd(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectMd(full));
      continue;
    }
    if (!entry.isFile()) continue;
    const n = entry.name;
    if (n === "_compendium.md") continue;
    if (n === ".DS_Store") continue;
    if (n.includes(".bak")) continue;
    if (!n.endsWith(".md")) continue;
    out.push(full);
  }
  return out;
}

/**
 * Produce a real unified diff for a pure line-substitution edit (old and new
 * have identical line counts). `changed` is the sorted set of differing line
 * indices; hunks group nearby changes with `ctx` lines of context.
 */
function unifiedDiff(relpath, oldLines, newLines, changed, ctx = 3) {
  if (changed.length === 0) return "";
  const groups = [];
  for (const idx of changed) {
    const last = groups.at(-1);
    if (last && idx - last.at(-1) <= ctx * 2 + 1) last.push(idx);
    else groups.push([idx]);
  }
  let out = `--- a/${relpath}\n+++ b/${relpath}\n`;
  for (const g of groups) {
    const start = Math.max(0, g[0] - ctx);
    const end = Math.min(oldLines.length - 1, g.at(-1) + ctx);
    const count = end - start + 1; // equal on both sides (substitution only)
    const changedSet = new Set(g);
    out += `@@ -${start + 1},${count} +${start + 1},${count} @@\n`;
    for (let i = start; i <= end; i++) {
      if (changedSet.has(i)) {
        out += `-${oldLines[i]}\n`;
        out += `+${newLines[i]}\n`;
      } else {
        out += ` ${oldLines[i]}\n`;
      }
    }
  }
  return out;
}

// --- core transform --------------------------------------------------------

/**
 * Compute the migrated content for a single file.
 * @returns {{status: string, reason?: string, newContent?: string,
 *            oldLines?: string[], newLines?: string[], changed?: number[],
 *            oldSlug?: string, newSlug?: string, entityType?: string,
 *            nonSlugChanged?: number[]}}
 */
function migrateFile(content) {
  const lines = content.split("\n");

  // 1. locate frontmatter block: line 0 must be '---', find closing '---'.
  if (lines[0] !== "---") return { status: "skip", reason: "no-frontmatter" };
  let fmEnd = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === "---") {
      fmEnd = i;
      break;
    }
  }
  if (fmEnd === -1) return { status: "skip", reason: "unterminated-frontmatter" };

  // 2. parse top-level frontmatter keys.
  const fm = {};
  const fmLineIdx = {};
  for (let i = 1; i < fmEnd; i++) {
    const m = lines[i].match(/^([A-Za-z_][\w-]*):\s?(.*)$/);
    if (m) {
      fm[m[1]] = unquote(m[2]);
      fmLineIdx[m[1]] = i;
    }
  }

  const entityType = fm.entity_type;
  if (!entityType) return { status: "skip", reason: "no-entity_type" };

  const oldSlug = fm.slug;
  if (oldSlug === undefined) return { status: "skip", reason: "no-slug", entityType };
  if (isMigrated(oldSlug)) return { status: "skip", reason: "already-migrated", oldSlug, entityType };

  const compendium = fm.compendium;
  const name = fm.name;
  if (!compendium || !name) {
    return { status: "skip", reason: "missing-compendium-or-name", oldSlug, entityType };
  }

  const newSlug = computeNewSlug({ compendium, entityType, name });
  if (newSlug === oldSlug) return { status: "skip", reason: "noop-equal", oldSlug, entityType };

  const newLines = lines.slice();
  const changed = [];

  // 3a. frontmatter slug line (top-level key `slug` whose value == oldSlug).
  const fmSlugIdx = fmLineIdx.slug;
  if (fmSlugIdx !== undefined) {
    const m = lines[fmSlugIdx].match(/^slug:\s?(.*)$/);
    if (m && unquote(m[1]) === oldSlug) {
      newLines[fmSlugIdx] = `slug: ${newSlug}`;
      changed.push(fmSlugIdx);
    }
  }

  // 3b. FIRST top-level `slug:` line inside the FIRST body code fence, if its
  //     value == oldSlug. Many item bodies have none — leave them untouched.
  let fenceOpen = -1;
  for (let i = fmEnd + 1; i < lines.length; i++) {
    if (lines[i].startsWith("```")) {
      fenceOpen = i;
      break;
    }
  }
  if (fenceOpen !== -1) {
    for (let i = fenceOpen + 1; i < lines.length; i++) {
      if (lines[i].startsWith("```")) break; // closing fence — no body slug
      const m = lines[i].match(/^slug:\s?(.*)$/); // top-level (indent 0) only
      if (m) {
        if (unquote(m[1]) === oldSlug) {
          newLines[i] = `slug: ${newSlug}`;
          changed.push(i);
        }
        break; // FIRST slug line only, regardless of match
      }
    }
  }

  changed.sort((a, b) => a - b);

  // 4. safety: every changed line MUST be a top-level `slug:` line.
  const nonSlugChanged = changed.filter((i) => !lines[i].startsWith("slug:"));

  return {
    status: "change",
    oldSlug,
    newSlug,
    entityType,
    oldLines: lines,
    newLines,
    newContent: newLines.join("\n"),
    changed,
    nonSlugChanged,
  };
}

// --- main ------------------------------------------------------------------

function main() {
  const perComp = {};
  const diffs = [];
  let totalSlugLines = 0;
  const nonSlugOffenders = [];
  const skips = [];

  for (const dirName of HOMEBREW_DIRS) {
    if (FORBIDDEN_DIRS.has(dirName)) throw new Error(`refusing to touch bundle dir ${dirName}`);
    const root = path.join(VAULT_COMPENDIUM, dirName);
    if (!fs.existsSync(root)) {
      console.error(`WARN: missing dir ${root}`);
      continue;
    }
    const files = collectMd(root).sort();
    const stats = (perComp[dirName] = {
      files: files.length,
      changed: 0,
      slugLines: 0,
      skipped: 0,
      skippedNoType: 0,
      alreadyMigrated: 0,
    });

    for (const file of files) {
      const rel = path.relative(VAULT_COMPENDIUM, file);
      const content = fs.readFileSync(file, "utf8");
      const res = migrateFile(content);

      if (res.status === "skip") {
        stats.skipped++;
        if (res.reason === "no-entity_type") stats.skippedNoType++;
        if (res.reason === "already-migrated") stats.alreadyMigrated++;
        skips.push({ rel, reason: res.reason });
        continue;
      }

      // status === change
      stats.changed++;
      stats.slugLines += res.changed.length;
      totalSlugLines += res.changed.length;
      if (res.nonSlugChanged.length > 0) {
        nonSlugOffenders.push({ rel, lines: res.nonSlugChanged.map((i) => res.oldLines[i]) });
      }
      diffs.push(unifiedDiff(rel, res.oldLines, res.newLines, res.changed));

      if (APPLY) {
        fs.writeFileSync(file, res.newContent, "utf8");
      }
    }
  }

  // --- emit diff ---
  const diffText = diffs.join("");
  process.stdout.write(diffText);

  // --- summary to stderr so it never pollutes the piped diff ---
  const L = (s) => process.stderr.write(s + "\n");
  L("");
  L(`=== ${APPLY ? "APPLY" : "DRY-RUN"} SUMMARY ===`);
  for (const [name, s] of Object.entries(perComp)) {
    L(
      `${name}: files=${s.files} changed=${s.changed} slugLines=${s.slugLines} ` +
        `skipped=${s.skipped} (no-type=${s.skippedNoType}, already-migrated=${s.alreadyMigrated})`,
    );
  }
  L(`TOTAL slug lines changed: ${totalSlugLines}`);
  L(`Files with NON-slug lines changed: ${nonSlugOffenders.length}`);
  if (nonSlugOffenders.length > 0) {
    for (const o of nonSlugOffenders) {
      L(`  !! ${o.rel}: ${JSON.stringify(o.lines)}`);
    }
  }
  if (skips.filter((s) => s.reason !== "no-entity_type" && s.reason !== "already-migrated").length) {
    L("Notable skips:");
    for (const s of skips) {
      if (s.reason !== "no-entity_type" && s.reason !== "already-migrated") L(`  - ${s.rel}: ${s.reason}`);
    }
  }
  L(APPLY ? "APPLIED." : "DRY-RUN only — no files written. Pass --apply to write.");

  // Non-zero exit if the safety invariant is violated.
  if (nonSlugOffenders.length > 0) process.exitCode = 2;
}

main();
