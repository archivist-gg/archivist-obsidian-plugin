#!/usr/bin/env node
// scripts/snapshot-repoint.mjs
//
// Re-point the PUBLIC plugin snapshot from local `file:` siblings to the npm
// registry, bump the release version, and regenerate package-lock.json.
// See docs/release-snapshot-recipe.md for the full snapshot procedure.
//
// Usage (run at repo ROOT):
//   node scripts/snapshot-repoint.mjs                 # full: repoint deps + versions + lock regen (SNAPSHOT)
//   node scripts/snapshot-repoint.mjs --versions-only # versions only (dev `main`; deps + lock UNtouched)
//
// The full mode runs `npm install --package-lock-only` (needs network; never
// writes node_modules). Run it in a checkout WITHOUT @archivist-gg/* symlinks in
// node_modules (a fresh clone or an rsync'd copy excluding node_modules) so the
// lock resolves purely from the registry. Idempotent.

import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const CORE_PKG = "@archivist-gg/core";
const DND5E_PKG = "@archivist-gg/dnd5e";
const CORE_RANGE = "^0.1.0";
const DND5E_RANGE = "^0.1.0";
const TARGET_VERSION = "0.2.26";
const MIN_APP = "1.7.2";
const BACKFILL = { "0.2.24": "1.7.2" };

const versionsOnly = process.argv.includes("--versions-only");

function readJson(p) { return JSON.parse(readFileSync(p, "utf8")); }
function writeJson(p, o) { writeFileSync(p, JSON.stringify(o, null, 2) + "\n"); }
function isExact(spec) { return /^\d+\.\d+\.\d+$/.test(spec || ""); }
function satisfiesCaret(version, minor) {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(version || "");
  return !!m && m[1] === "0" && m[2] === String(minor);
}

function bumpVersions() {
  const m = readJson("manifest.json"); m.version = TARGET_VERSION; writeJson("manifest.json", m);
  const r = readJson("package.json"); r.version = TARGET_VERSION; writeJson("package.json", r);
  const v = readJson("versions.json");
  v[TARGET_VERSION] = MIN_APP;
  for (const [ver, app] of Object.entries(BACKFILL)) v[ver] = app;
  writeJson("versions.json", v);
  console.log(`[versions] manifest+root=${TARGET_VERSION}; versions.json += ${TARGET_VERSION}, ${Object.keys(BACKFILL).join(",")}`);
}

function repointDeps() {
  const p = "packages/obsidian/package.json";
  const pkg = readJson(p);
  const deps = pkg.dependencies ?? {};
  for (const [name, range] of [[CORE_PKG, CORE_RANGE], [DND5E_PKG, DND5E_RANGE]]) {
    const cur = deps[name];
    if (cur === undefined) throw new Error(`${p}: missing dependency ${name}`);
    if (String(cur).startsWith("file:")) deps[name] = range;
    else if (cur !== range) throw new Error(`${p}: ${name} is "${cur}"; expected file:… or ${range}`);
  }
  writeJson(p, pkg);
  console.log(`[repoint] ${CORE_PKG}=${deps[CORE_PKG]} ${DND5E_PKG}=${deps[DND5E_PKG]}`);
}

function assertLock() {
  const lock = readJson("package-lock.json");
  const pkgs = lock.packages ?? {};
  for (const name of [CORE_PKG, DND5E_PKG]) {
    const e = pkgs[`node_modules/${name}`];
    if (!e) throw new Error(`[assert] lock missing node_modules/${name}`);
    if (!/^https:\/\/registry\.npmjs\.org\//.test(e.resolved || "")) throw new Error(`[assert] ${name} not registry-resolved: ${e.resolved}`);
    if (!e.integrity) throw new Error(`[assert] ${name} missing integrity`);
    if (e.link) throw new Error(`[assert] ${name} is still a link`);
    if (!satisfiesCaret(e.version, 1)) throw new Error(`[assert] ${name}@${e.version} not ⊨ ^0.1.0`);
  }
  const ws = pkgs["node_modules/@archivist-gg/obsidian"];
  if (!ws || ws.link !== true) throw new Error("[assert] @archivist-gg/obsidian workspace link missing/incorrect");
  const obs = pkgs["node_modules/obsidian"];
  const cmState = pkgs["node_modules/@codemirror/state"];
  const cmView = pkgs["node_modules/@codemirror/view"];
  if (!obs || !cmState || !cmView) throw new Error("[assert] obsidian/@codemirror lock entries missing");
  const peers = obs.peerDependencies ?? {};
  for (const [peer, got] of [["@codemirror/state", cmState.version], ["@codemirror/view", cmView.version]]) {
    const want = peers[peer];
    if (isExact(want) && want !== got) throw new Error(`[assert] obsidian peer ${peer} wants exact ${want} but lock has ${got}`);
  }
  const orphans = Object.keys(pkgs).filter((k) => /@archivist\/(core|dnd5e|obsidian)/.test(k));
  if (orphans.length) throw new Error(`[assert] old-scope orphans in lock: ${orphans.join(", ")}`);
  console.log(`[assert] lock OK: ${CORE_PKG}@${pkgs["node_modules/" + CORE_PKG].version}, ${DND5E_PKG}@${pkgs["node_modules/" + DND5E_PKG].version}; 1 workspace link; peers satisfied; 0 orphans`);
}

function regenLock() {
  const p = "package-lock.json";
  const lock = readJson(p);
  const pkgs = lock.packages ?? {};
  const isDepEntry = (k) => /(^|\/)node_modules\/@archivist(-gg)?\/(core|dnd5e)$/.test(k);
  const isStaleSibling = (k) => /^\.\.\/archivist-(core|dnd5e)$/.test(k) || /^packages\/(core|dnd5e)$/.test(k);
  const pruned = [];
  for (const k of Object.keys(pkgs)) {
    if (isDepEntry(k) || isStaleSibling(k)) { delete pkgs[k]; pruned.push(k); }
  }
  writeJson(p, lock);
  console.log(`[lock] pruned ${pruned.length}: ${pruned.join(", ") || "(none)"}`);
  execFileSync("npm", ["install", "--package-lock-only"], { stdio: "inherit" });
  assertLock();
}

if (versionsOnly) {
  bumpVersions();
  console.log("[done] --versions-only");
} else {
  repointDeps();
  bumpVersions();
  regenLock();
  console.log("[done] full re-point");
}
