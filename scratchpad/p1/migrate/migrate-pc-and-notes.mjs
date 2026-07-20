#!/usr/bin/env node
// migrate-pc-and-notes.mjs
// ---------------------------------------------------------------------------
// P1 slug type-namespacing — rewrite the entity REFERENCES inside the vault's
// PlayerCharacter files AND the `{{type:slug}}` note-embeds, from 2-part
// legacy slugs (`<prefix>_<name>`) to the 3-part type-namespaced form
// (`<prefix>_<entity_type>_<name>`).
//
// This is CONTEXT-TYPED, LOSSLESS and REGISTRY-LOOKUP-DRIVEN (spec D7.3):
//   * There is NO flat old->new string map. `srd-2024_shield` is the *armor*
//     in `equipment[].item` but the *spell* in `spells.known[]` — the field's
//     context type-set disambiguates it.
//   * The lookup universe is built from the REGENERATED SRD bundle
//     (.compendium-bundle/index.json, already 3-part) PLUS the Task-8-migrated
//     homebrew vault compendiums (MCDM / DMG 2024 / Eberron / Me).
//   * A ref resolves only to a UNIQUE match with the SAME prefix inside the
//     field's type-set. Zero matches (dead) or multiple (ambiguous) => the ref
//     is LEFT untouched and WARNED. The prefix is NEVER changed; refs are never
//     guessed.
//   * Only VALUES are rewritten, never keys. The PC code fence is the only
//     region walked, so the outer identity `slug`/`name`/`compendium` and any
//     backstory prose are structurally untouchable.
//   * Idempotent: an already-3-part ref (parts[1] in the 12-type set) is
//     skipped, so re-running is a zero-diff no-op.
//
// Usage:
//   node migrate-pc-and-notes.mjs            # DRY RUN — unified diff to stdout,
//                                            #   summary to stderr, nothing written
//   node migrate-pc-and-notes.mjs --apply    # writes changes to disk
//
// Default is DRY RUN.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TYPES, isMigrated, slugifyName } from "./slug-core.mjs";

// --- constants -------------------------------------------------------------

const VAULT = "/Users/shinoobi/Obsidian/DnD";
const COMPENDIUM_ROOT = path.join(VAULT, "Compendium");
const BUNDLE_PATH = "/Users/shinoobi/w/archivist-obsidian/.compendium-bundle/index.json";
const PC_DIR = path.join(VAULT, "PlayerCharacters");
const HOMEBREW_DIRS = ["MCDM", "DMG 2024", "Eberron - Forge of the Artificer", "Me"];
const BACKUP_DIR = "/Users/shinoobi/w/archivist-obsidian/scratchpad/p1/backup-pc";

// SRD editions <-> bundle prefix (for the PREFIX-LESS composite-variant case).
const EDITION_PREFIX = { "2014": "srd-5e", "2024": "srd-2024" };

const TYPESET = (arr) => new Set(arr);
const ALL12 = TYPESET(TYPES);
const EQUIP_TYPES = ["armor", "weapon", "item"]; // equipment[].item context (ordered)

// --- tiny YAML-frontmatter reader (shared shape with Task 8) ---------------

function unquote(v) {
  const s = String(v).trim();
  if (s.length >= 2 && ((s[0] === '"' && s.at(-1) === '"') || (s[0] === "'" && s.at(-1) === "'"))) {
    return s.slice(1, -1);
  }
  return s;
}

/** Parse the top `---`..`---` frontmatter block into a flat key->value map. */
function parseFrontmatter(content) {
  const lines = content.split("\n");
  if (lines[0] !== "---") return null;
  const fm = {};
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === "---") return fm;
    const m = lines[i].match(/^([A-Za-z_][\w-]*):\s?(.*)$/);
    if (m) fm[m[1]] = unquote(m[2]);
  }
  return null; // unterminated
}

/** Recursively collect .md files under `dir`, skipping compendium/junk files. */
function collectMd(dir, { skipCompendium = true } = {}) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectMd(full, { skipCompendium }));
      continue;
    }
    if (!entry.isFile()) continue;
    const n = entry.name;
    if (!n.endsWith(".md")) continue;
    if (skipCompendium && n === "_compendium.md") continue;
    if (n.includes(".bak")) continue;
    out.push(full);
  }
  return out;
}

// --- lookup universe -------------------------------------------------------

/**
 * Register one entity (from bundle or homebrew) into the universe maps.
 * Keys are derived from the STORED migrated slug when present (authoritative —
 * the migration target must be an actually-existing slug); otherwise computed
 * from frontmatter. Both agree because the same slugify produced the stored
 * slug.
 */
function registerEntity(universe, fm) {
  if (!fm) return;
  const type = fm.entity_type;
  const compendium = fm.compendium;
  const name = fm.name;
  if (!type || !compendium || !name) return;

  let prefix, nameSlug, newSlug;
  if (fm.slug && isMigrated(fm.slug)) {
    const parts = fm.slug.split("_");
    prefix = parts[0];
    nameSlug = parts.slice(2).join("_");
    newSlug = fm.slug;
  } else {
    prefix = slugifyName(compendium);
    nameSlug = slugifyName(name);
    newSlug = `${prefix}_${type}_${nameSlug}`;
  }

  universe.knownPrefixes.add(prefix);
  universe.compendiums.add(compendium);

  const kPT = `${prefix}|${nameSlug}|${type}`;
  universe.byPrefixNameType.set(kPT, newSlug);

  const kPN = `${prefix}|${nameSlug}`;
  if (!universe.byPrefixName.has(kPN)) universe.byPrefixName.set(kPN, []);
  universe.byPrefixName.get(kPN).push({ type, newSlug });

  const kNT = `${type}|${nameSlug}`;
  if (!universe.byNameType.has(kNT)) universe.byNameType.set(kNT, []);
  universe.byNameType.get(kNT).push({ prefix, newSlug });
}

function buildUniverse({
  bundlePath = BUNDLE_PATH,
  compendiumRoot = COMPENDIUM_ROOT,
  homebrewDirs = HOMEBREW_DIRS,
} = {}) {
  const universe = {
    knownPrefixes: new Set(),
    compendiums: new Set(),
    byPrefixNameType: new Map(),
    byPrefixName: new Map(),
    byNameType: new Map(),
    stats: { bundle: 0, homebrew: 0 },
  };

  // 1. SRD bundle (regenerated, 3-part).
  const bundle = JSON.parse(fs.readFileSync(bundlePath, "utf8"));
  for (const [, content] of Object.entries(bundle)) {
    const fm = parseFrontmatter(content);
    if (fm && fm.entity_type) {
      registerEntity(universe, fm);
      universe.stats.bundle++;
    }
  }

  // 2. Task-8-migrated homebrew vault compendiums.
  for (const dirName of homebrewDirs) {
    const root = path.join(compendiumRoot, dirName);
    for (const file of collectMd(root)) {
      const fm = parseFrontmatter(fs.readFileSync(file, "utf8"));
      if (fm && fm.entity_type) {
        registerEntity(universe, fm);
        universe.stats.homebrew++;
      }
    }
  }

  return universe;
}

// --- ref shape helpers -----------------------------------------------------

/** A candidate ref token: lowercase, `[a-z0-9]`-start, then `[a-z0-9_-]`. */
function slugShaped(token) {
  return /^[a-z0-9][a-z0-9_-]*$/.test(token);
}

/**
 * Pull the core slug token out of a raw YAML scalar value, stripping quotes
 * and a `[[...]]` wikilink wrapper. Returns { core, wrap } or null when the
 * value plainly carries no candidate token.
 */
function extractCore(rawValue) {
  let s = String(rawValue).trim();
  if (s === "") return null;
  // strip one layer of surrounding quotes
  s = unquote(s);
  let wrap = "bare";
  const wl = s.match(/^\[\[(.+)\]\]$/);
  if (wl) {
    s = wl[1].trim();
    wrap = "wikilink";
  }
  return { core: s, wrap };
}

// --- context resolution (spec D7.3 field-context sets) ---------------------

/**
 * Given the key-path of a leaf value inside the `pc` block, return the field's
 * ref-resolution context, or null for "never a ref field" (default-deny).
 *   { kind: 'types'|'equipment'|'boon'|'dynamic', types: Set<string> }
 */
function contextFor(kp) {
  if (kp.length === 0) return null;

  if (kp.length === 1) {
    if (kp[0] === "race" || kp[0] === "subrace") return { kind: "types", types: TYPESET(["race"]) };
    if (kp[0] === "background") return { kind: "types", types: TYPESET(["background"]) };
    return null;
  }

  if (kp[0] === "class") {
    if (kp.length === 2 && kp[1] === "name") return { kind: "types", types: TYPESET(["class"]) };
    if (kp.length === 2 && kp[1] === "subclass") return { kind: "types", types: TYPESET(["subclass"]) };
    if (kp[1] === "choices" && kp.length >= 4) {
      const seg = kp[3]; // key immediately under class/choices/<level>
      if (seg === "weapon-mastery") return { kind: "types", types: TYPESET(["weapon"]) };
      if (seg === "interdict-boons") return { kind: "boon", types: TYPESET(["optional-feature"]) };
      if (seg === "skills") return null; // ability/skill enum values — never
      if (seg === "feat" && kp.length === 4) return { kind: "types", types: TYPESET(["feat"]) };
      // Heterogeneous / dynamic choice key (lies-weapon, combat-mastery,
      // moloch-skill, asi-or-feat, feat:asi, asi, ...): resolve across all 12
      // type buckets requiring a UNIQUE same-prefix match. Non-slug / bare
      // values simply never match and stay untouched.
      return { kind: "dynamic", types: ALL12 };
    }
    return null;
  }

  if (kp[0] === "spells") {
    if (kp[1] === "known") {
      if (kp.length === 2) return { kind: "types", types: TYPESET(["spell"]) }; // scalar entry
      if (kp.length === 3 && kp[2] === "spell") return { kind: "types", types: TYPESET(["spell"]) };
      if (kp.length === 3 && kp[2] === "class") return { kind: "types", types: TYPESET(["class"]) };
      return null; // prepared, etc.
    }
    return null; // spells.overrides — not enumerated
  }

  if (kp[0] === "equipment") {
    if (kp.length === 2 && kp[1] === "item") return { kind: "equipment", types: TYPESET(EQUIP_TYPES) };
    if (kp.length === 3 && kp[1] === "overrides" && kp[2] === "spell") {
      return { kind: "types", types: TYPESET(["spell"]) };
    }
    return null; // granted_by/qty/spell_ability/resist/state/...
  }

  if (kp[0] === "origin_choices") {
    if (kp.length >= 2) {
      // background:feat:* spell picks -> {spell}; everything else -> dynamic.
      if (kp.some((seg) => /mi-cantrip|mi-level|cantrip/.test(seg))) {
        return { kind: "types", types: TYPESET(["spell"]) };
      }
      return { kind: "dynamic", types: ALL12 };
    }
    return null;
  }

  if (kp[0] === "state") {
    if (kp.length === 2 && kp[1] === "concentration") return { kind: "types", types: TYPESET(["spell"]) };
    if (kp.length === 2 && kp[1] === "active_buffs") {
      return { kind: "dynamic", types: TYPESET(["optional-feature", "spell"]) };
    }
    return null; // feature_uses / conditions / hp / hit_dice / ...
  }

  return null;
}

// --- the resolver ----------------------------------------------------------

/**
 * resolveRef — context-typed, registry-lookup-driven.
 * @returns {{status:string, result:string|null, ...diag}}
 *   result is the new 3-part slug on success, else null (leave). status:
 *     resolved | no-context | skip-nonslug | skip-migrated |
 *     skip-nonref-prefixless | left-dead | left-dead-prefixless |
 *     left-dead-boon | left-ambiguous
 */
function resolveRef(core, context, edition, universe) {
  if (context == null) return { status: "no-context", result: null };
  if (!slugShaped(core)) return { status: "skip-nonslug", result: null };
  if (isMigrated(core)) return { status: "skip-migrated", result: null };

  const parts = core.split("_");
  const prefixed = parts.length >= 2 && universe.knownPrefixes.has(parts[0]);

  // Branch 1 — prefixed 2-part legacy ref: unique SAME-prefix match in the set.
  if (prefixed) {
    const prefix = parts[0];
    const name = parts.slice(1).join("_"); // names carry no underscore; defensive
    const matches = [];
    for (const t of context.types) {
      const ns = universe.byPrefixNameType.get(`${prefix}|${name}|${t}`);
      if (ns) matches.push({ type: t, newSlug: ns });
    }
    if (matches.length === 1) {
      return { status: "resolved", result: matches[0].newSlug, via: "prefixed", type: matches[0].type };
    }
    if (matches.length === 0) {
      return { status: "left-dead", result: null, prefix, name, types: [...context.types] };
    }
    return { status: "left-ambiguous", result: null, matches, prefix, name };
  }

  // Branch 2 — PREFIX-LESS composite variant, ONLY in equipment[].item:
  // resolve by name within the PC's edition among {item,armor,weapon}.
  if (context.kind === "equipment") {
    const editions = [edition, edition === "2024" ? "2014" : "2024"];
    for (const ed of editions) {
      const pfx = EDITION_PREFIX[ed];
      if (!pfx) continue;
      const matches = [];
      for (const t of EQUIP_TYPES) {
        const ns = universe.byPrefixNameType.get(`${pfx}|${core}|${t}`);
        if (ns) matches.push({ type: t, newSlug: ns });
      }
      if (matches.length === 1) {
        return { status: "resolved", result: matches[0].newSlug, via: "prefixless-equipment", type: matches[0].type, edition: ed };
      }
      if (matches.length > 1) return { status: "left-ambiguous", result: null, matches, name: core };
    }
    return { status: "left-dead-prefixless", result: null, name: core };
  }

  // Branch 3 — bare boon pick -> optional-feature by name across compendiums.
  if (context.kind === "boon") {
    const arr = universe.byNameType.get(`optional-feature|${core}`) || [];
    if (arr.length === 1) return { status: "resolved", result: arr[0].newSlug, via: "boon", type: "optional-feature" };
    if (arr.length === 0) return { status: "left-dead-boon", result: null, name: core };
    return { status: "left-ambiguous", result: null, matches: arr, name: core };
  }

  // Prefix-less token in a types/dynamic context (e.g. `cleric`, `wis`, `lies`,
  // `null`, `by-level`) — not a ref. Untouched, no warning.
  return { status: "skip-nonref-prefixless", result: null };
}

// --- the PC code-fence walker ----------------------------------------------

/** Collect the map-key path from a stack (item frames contribute nothing). */
function keysFromStack(stack) {
  const out = [];
  for (const f of stack) if (f.kind === "map") out.push(f.key);
  return out;
}

/** Split `key: value` honoring keys that themselves contain colons (feat:asi,
 * background:feat:mi-cantrips). The separator is the first colon that is at EOL
 * or followed by whitespace. Returns { key, value } or null (no separator). */
function splitKeyValue(content) {
  for (let p = 0; p < content.length; p++) {
    if (content[p] === ":" && (p + 1 === content.length || /\s/.test(content[p + 1]))) {
      return { key: unquote(content.slice(0, p).trim()), value: content.slice(p + 1).trim() };
    }
  }
  return null;
}

/**
 * Walk the interior of a PC file's ```pc fence, rewriting reference values.
 * Pure: returns { newLines, decisions } without touching disk.
 */
function walkPcBody(lines, fenceStart, fenceEnd, edition, universe) {
  const newLines = lines.slice();
  const decisions = [];
  const stack = [];

  const popTo = (col) => {
    while (stack.length && stack.at(-1).col >= col) stack.pop();
  };

  // Resolve + record a single leaf value at a given key-path.
  const handleLeaf = (lineIdx, keyPath, rawValue) => {
    const ex = extractCore(rawValue);
    if (!ex) return;
    const ctx = contextFor(keyPath);
    const res = resolveRef(ex.core, ctx, edition, universe);
    const record = {
      line: lineIdx + 1,
      keyPath: keyPath.join("."),
      oldToken: ex.core,
      wrap: ex.wrap,
      status: res.status,
      newSlug: res.result || null,
      context: ctx ? ctx.kind : null,
      diag: res,
    };
    if (res.status === "resolved" && res.result && res.result !== ex.core) {
      // In-place, single-occurrence token substitution (preserves wrapping,
      // quotes and spacing exactly).
      const line = newLines[lineIdx];
      const first = line.indexOf(ex.core);
      const last = line.lastIndexOf(ex.core);
      if (first === -1 || first !== last) {
        record.status = "anomaly-occurrence";
        decisions.push(record);
        return;
      }
      newLines[lineIdx] = line.slice(0, first) + res.result + line.slice(first + ex.core.length);
    }
    decisions.push(record);
  };

  for (let i = fenceStart + 1; i < fenceEnd; i++) {
    const raw = lines[i];
    if (raw.trim() === "") continue;

    const listM = raw.match(/^(\s*)-(\s+(.*))?$/);
    if (listM) {
      const dashCol = listM[1].length;
      popTo(dashCol);
      const listKey = stack.length ? stack.at(-1).key : null;
      stack.push({ col: dashCol, kind: "item", listKey });
      const content = (listM[3] ?? "").trim();
      if (content === "") continue; // empty list element
      const kv = splitKeyValue(content);
      if (kv) {
        // `- key: value` — element is a map; the key sits at dashCol+2.
        const col = dashCol + 2;
        popTo(col);
        const keyPath = [...keysFromStack(stack), kv.key];
        if (kv.value === "") stack.push({ col, key: kv.key, kind: "map" });
        else handleLeaf(i, keyPath, kv.value);
      } else {
        // `- scalar` — leaf under the list's key.
        const keyPath = keysFromStack(stack);
        handleLeaf(i, keyPath, content);
      }
      continue;
    }

    const mapM = raw.match(/^(\s*)(\S.*)$/);
    if (!mapM) continue;
    const col = mapM[1].length;
    const content = mapM[2];
    const kv = splitKeyValue(content);
    if (!kv) continue; // not a mapping line (shouldn't happen at map scope)
    popTo(col);
    const keyPath = [...keysFromStack(stack), kv.key];
    if (kv.value === "") stack.push({ col, key: kv.key, kind: "map" });
    else handleLeaf(i, keyPath, kv.value);
  }

  return { newLines, decisions };
}

/** Locate the ```pc ... ``` fence and migrate its interior. */
function migratePcContent(content, universe) {
  const lines = content.split("\n");
  let fenceStart = -1;
  let fenceEnd = -1;
  for (let i = 0; i < lines.length; i++) {
    if (fenceStart === -1) {
      if (/^```pc\s*$/.test(lines[i])) fenceStart = i;
    } else if (/^```\s*$/.test(lines[i])) {
      fenceEnd = i;
      break;
    }
  }
  if (fenceStart === -1 || fenceEnd === -1) {
    return { changed: false, reason: "no-pc-fence", decisions: [], lines, newLines: lines, changedIdx: [] };
  }

  // Read edition from a top-level `edition:` line inside the fence.
  let edition = null;
  for (let i = fenceStart + 1; i < fenceEnd; i++) {
    const m = lines[i].match(/^edition:\s*(.+)$/);
    if (m) {
      edition = unquote(m[1]);
      break;
    }
  }

  const { newLines, decisions } = walkPcBody(lines, fenceStart, fenceEnd, edition, universe);
  const changedIdx = [];
  for (let i = 0; i < lines.length; i++) if (lines[i] !== newLines[i]) changedIdx.push(i);

  // Safety: every changed line MUST live strictly inside the fence.
  const outside = changedIdx.filter((i) => i <= fenceStart || i >= fenceEnd);

  return {
    changed: changedIdx.length > 0,
    edition,
    decisions,
    lines,
    newLines,
    newContent: newLines.join("\n"),
    changedIdx,
    outside,
  };
}

// --- note-ref pass ({{type:slug}}) -----------------------------------------

const NOTE_REF_RE = /\{\{([a-z][a-z0-9-]*):([A-Za-z0-9][A-Za-z0-9_-]*)\}\}/g;

/** Rewrite `{{type:prefix_name}}` -> `{{type:prefix_type_name}}` (deterministic;
 *  type is explicit). Skips already-3-part and non-entity types. */
function migrateNoteRefs(content) {
  const changes = [];
  const newContent = content.replace(NOTE_REF_RE, (full, type, slug) => {
    if (!TYPES.includes(type)) return full; // not an entity embed
    if (isMigrated(slug)) return full; // already 3-part
    const us = slug.indexOf("_");
    if (us === -1) {
      changes.push({ from: full, to: null, reason: "prefix-less-note-ref" });
      return full; // no prefix to split — leave + warn
    }
    const prefix = slug.slice(0, us);
    const name = slug.slice(us + 1);
    const newSlug = `${prefix}_${type}_${name}`;
    const to = `{{${type}:${newSlug}}}`;
    changes.push({ from: full, to });
    return to;
  });
  return { newContent, changes, changed: newContent !== content };
}

// --- unified diff (pure line substitution — equal line counts) -------------

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
    const count = end - start + 1;
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

// --- backup ----------------------------------------------------------------

function backupOnce(pcFiles, noteFiles) {
  if (fs.existsSync(BACKUP_DIR)) {
    return { made: false, dir: BACKUP_DIR };
  }
  fs.mkdirSync(path.join(BACKUP_DIR, "PlayerCharacters"), { recursive: true });
  for (const f of pcFiles) {
    fs.copyFileSync(f, path.join(BACKUP_DIR, "PlayerCharacters", path.basename(f)));
  }
  // note files are relative to the vault root; preserve their relative path
  fs.mkdirSync(path.join(BACKUP_DIR, "notes"), { recursive: true });
  for (const f of noteFiles) {
    const rel = path.relative(VAULT, f).replace(/\//g, "__");
    fs.copyFileSync(f, path.join(BACKUP_DIR, "notes", rel));
  }
  return { made: true, dir: BACKUP_DIR };
}

// --- main ------------------------------------------------------------------

function main() {
  const APPLY = process.argv.includes("--apply");
  const universe = buildUniverse();

  const L = (s = "") => process.stderr.write(s + "\n");
  const diffs = [];

  // ---- Pass A: PlayerCharacters ----
  const pcFiles = collectMd(PC_DIR, { skipCompendium: false }).sort();
  const pcResults = [];
  for (const file of pcFiles) {
    const rel = path.relative(VAULT, file);
    const content = fs.readFileSync(file, "utf8");
    const r = migratePcContent(content, universe);
    r.rel = rel;
    r.file = file;
    pcResults.push(r);
    if (r.changed) diffs.push(unifiedDiff(rel, r.lines, r.newLines, r.changedIdx));
  }

  // ---- Pass B: note refs across ALL vault .md ----
  const allMd = collectMd(VAULT, { skipCompendium: false });
  const pcSet = new Set(pcFiles);
  const noteResults = [];
  const noteFilesTouched = [];
  for (const file of allMd) {
    if (pcSet.has(file)) continue; // PC files carry no {{}} refs; handled in Pass A
    const content = fs.readFileSync(file, "utf8");
    if (!content.includes("{{")) continue;
    const r = migrateNoteRefs(content);
    if (r.changed || r.changes.length) {
      const rel = path.relative(VAULT, file);
      noteResults.push({ rel, file, ...r, content });
      if (r.changed) {
        noteFilesTouched.push(file);
        const oldLines = content.split("\n");
        const newLines = r.newContent.split("\n");
        const changedIdx = [];
        for (let i = 0; i < oldLines.length; i++) if (oldLines[i] !== newLines[i]) changedIdx.push(i);
        diffs.push(unifiedDiff(rel, oldLines, newLines, changedIdx));
      }
    }
  }

  // ---- Backup (pristine, before any write) ----
  const backup = backupOnce(pcFiles, noteFilesTouched);

  // ---- Emit diff to stdout ----
  process.stdout.write(diffs.join(""));

  // ---- Apply ----
  if (APPLY) {
    for (const r of pcResults) {
      if (r.changed && r.outside.length === 0) fs.writeFileSync(r.file, r.newContent, "utf8");
    }
    for (const r of noteResults) {
      if (r.changed) fs.writeFileSync(r.file, r.newContent, "utf8");
    }
  }

  // ---- Summary to stderr ----
  L();
  L(`=== ${APPLY ? "APPLY" : "DRY-RUN"} SUMMARY ===`);
  L(
    `Universe: bundle=${universe.stats.bundle} homebrew=${universe.stats.homebrew} ` +
      `prefixes={${[...universe.knownPrefixes].sort().join(", ")}}`,
  );
  L(`Backup: ${backup.made ? "created " + backup.dir : "already exists (kept pristine) " + backup.dir}`);
  L();

  let totalRewrites = 0;
  const warns = [];
  const anomalies = [];
  L("--- PlayerCharacters ---");
  for (const r of pcResults) {
    const rewrites = r.decisions.filter((d) => d.status === "resolved" && d.newSlug);
    totalRewrites += rewrites.length;
    L(`\n# ${r.rel}  (edition=${r.edition ?? "?"})  rewrites=${rewrites.length}`);
    for (const d of rewrites) {
      L(`   [${d.context}] ${d.keyPath}:  ${d.oldToken}  ->  ${d.newSlug}   (L${d.line})`);
    }
    for (const d of r.decisions) {
      if (d.status.startsWith("left")) {
        warns.push({ rel: r.rel, ...d });
        L(`   !! LEAVE+WARN [${d.context}] ${d.keyPath}:  ${d.oldToken}   reason=${d.status}   (L${d.line})`);
      }
      if (d.status === "anomaly-occurrence") {
        anomalies.push({ rel: r.rel, ...d });
        L(`   ?? ANOMALY ${d.keyPath}:  ${d.oldToken}   (L${d.line})`);
      }
    }
    if (r.outside && r.outside.length) {
      anomalies.push({ rel: r.rel, outside: r.outside });
      L(`   ?? CHANGE OUTSIDE FENCE at lines ${r.outside.map((i) => i + 1).join(",")} — NOT WRITTEN`);
    }
  }

  L("\n--- Note refs ({{type:slug}}) ---");
  let noteRewrites = 0;
  for (const r of noteResults) {
    for (const c of r.changes) {
      if (c.to) {
        noteRewrites++;
        L(`   ${r.rel}:  ${c.from}  ->  ${c.to}`);
      } else {
        warns.push({ rel: r.rel, note: c });
        L(`   !! LEAVE+WARN ${r.rel}:  ${c.from}   reason=${c.reason}`);
      }
    }
  }

  L("\n=== TOTALS ===");
  L(`PC files touched:     ${pcResults.filter((r) => r.changed).length} / ${pcResults.length}`);
  L(`PC refs rewritten:    ${totalRewrites}`);
  L(`Note refs rewritten:  ${noteRewrites}  (files: ${noteResults.filter((r) => r.changed).length})`);
  L(`Refs LEFT+WARNED:     ${warns.length}`);
  L(`Anomalies:            ${anomalies.length}`);
  L(APPLY ? "\nAPPLIED." : "\nDRY-RUN only — no files written. Pass --apply to write.");

  if (anomalies.length) process.exitCode = 2;
}

// Only run when invoked directly (the test imports the pure helpers).
const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (invokedDirectly) main();

export {
  buildUniverse,
  registerEntity,
  contextFor,
  resolveRef,
  slugShaped,
  extractCore,
  splitKeyValue,
  walkPcBody,
  migratePcContent,
  migrateNoteRefs,
  EDITION_PREFIX,
};
