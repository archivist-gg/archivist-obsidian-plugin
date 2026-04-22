#!/usr/bin/env node
/**
 * CSS Build Script
 * Concatenates:
 *   1. Claudian modular CSS from src/modules/inquiry/style/ (via index.css @imports)
 *   2. D&D-specific CSS from src/styles/archivist-dnd.css
 * into the root styles.css for the Obsidian plugin.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname, resolve, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CLAUDIAN_STYLE_DIR = join(ROOT, 'src', 'modules', 'inquiry', 'style');
const DND_CSS_FILE = join(ROOT, 'src', 'styles', 'archivist-dnd.css');
const EDIT_CSS_FILE = join(ROOT, 'src', 'styles', 'archivist-edit.css');
const LAYOUT_OVERRIDES_FILE = join(ROOT, 'src', 'styles', 'archivist-layout-overrides.css');
const PC_STYLE_DIR = join(ROOT, 'src', 'modules', 'pc', 'styles');
const PC_INDEX_FILE = join(PC_STYLE_DIR, 'index.css');
const OUTPUT = join(ROOT, 'styles.css');
const INDEX_FILE = join(CLAUDIAN_STYLE_DIR, 'index.css');

const IMPORT_PATTERN = /^\s*@import\s+(?:url\()?['"]([^'"]+)['"]\)?\s*;/gm;

function getModuleOrder() {
  if (!existsSync(INDEX_FILE)) {
    console.error('Missing src/modules/inquiry/style/index.css');
    process.exit(1);
  }

  const content = readFileSync(INDEX_FILE, 'utf-8');
  const matches = [...content.matchAll(IMPORT_PATTERN)];

  if (matches.length === 0) {
    console.error('No @import entries found in src/modules/inquiry/style/index.css');
    process.exit(1);
  }

  return matches.map((match) => match[1]);
}

function listCssFiles(dir, baseDir = dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...listCssFiles(entryPath, baseDir));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.css')) {
      const relativePath = relative(baseDir, entryPath).split('\\').join('/');
      files.push(relativePath);
    }
  }

  return files;
}

function buildClaudianCss() {
  const moduleOrder = getModuleOrder();
  const parts = [];
  const missingFiles = [];
  const invalidImports = [];
  const normalizedImports = [];

  for (const modulePath of moduleOrder) {
    const resolvedPath = resolve(CLAUDIAN_STYLE_DIR, modulePath);
    const relativePath = relative(CLAUDIAN_STYLE_DIR, resolvedPath);

    if (relativePath.startsWith('..') || !relativePath.endsWith('.css')) {
      invalidImports.push(modulePath);
      continue;
    }

    const normalizedPath = relativePath.split('\\').join('/');
    normalizedImports.push(normalizedPath);

    if (!existsSync(resolvedPath)) {
      missingFiles.push(normalizedPath);
      continue;
    }

    const content = readFileSync(resolvedPath, 'utf-8');
    const header = `\n/* ============================================\n   ${normalizedPath}\n   ============================================ */\n`;
    parts.push(header + content);
  }

  let hasErrors = false;

  if (invalidImports.length > 0) {
    console.error('Invalid @import entries in src/modules/inquiry/style/index.css:');
    invalidImports.forEach((modulePath) => console.error(`  - ${modulePath}`));
    hasErrors = true;
  }

  if (missingFiles.length > 0) {
    console.error('Missing CSS files:');
    missingFiles.forEach((f) => console.error(`  - ${f}`));
    hasErrors = true;
  }

  const allCssFiles = listCssFiles(CLAUDIAN_STYLE_DIR).filter((file) => file !== 'index.css');
  const importedSet = new Set(normalizedImports);
  const unlistedFiles = allCssFiles.filter((file) => !importedSet.has(file));

  if (unlistedFiles.length > 0) {
    console.error('Unlisted CSS files (not imported in src/modules/inquiry/style/index.css):');
    unlistedFiles.forEach((file) => console.error(`  - ${file}`));
    hasErrors = true;
  }

  if (hasErrors) {
    process.exit(1);
  }

  return parts.join('\n');
}

function buildPcCss() {
  if (!existsSync(PC_INDEX_FILE)) {
    return '';
  }
  const content = readFileSync(PC_INDEX_FILE, 'utf-8');
  const matches = [...content.matchAll(IMPORT_PATTERN)];
  const parts = [];
  for (const match of matches) {
    const modulePath = match[1];
    const resolvedPath = resolve(PC_STYLE_DIR, modulePath);
    const relativePath = relative(PC_STYLE_DIR, resolvedPath);
    if (relativePath.startsWith('..') || !relativePath.endsWith('.css')) {
      console.error(`Invalid @import in pc index.css: ${modulePath}`);
      process.exit(1);
    }
    if (!existsSync(resolvedPath)) {
      console.error(`Missing PC CSS file: ${relativePath}`);
      process.exit(1);
    }
    const body = readFileSync(resolvedPath, 'utf-8');
    const normalized = relativePath.split('\\').join('/');
    const header = `\n/* ============================================\n   pc/${normalized}\n   ============================================ */\n`;
    parts.push(header + body);
  }
  return parts.join('\n');
}

function buildDndCss() {
  if (!existsSync(DND_CSS_FILE)) {
    console.error('Missing src/styles/archivist-dnd.css');
    process.exit(1);
  }

  return readFileSync(DND_CSS_FILE, 'utf-8');
}

function buildEditCss() {
  if (!existsSync(EDIT_CSS_FILE)) {
    console.error('Missing src/styles/archivist-edit.css');
    process.exit(1);
  }

  return readFileSync(EDIT_CSS_FILE, 'utf-8');
}

function buildLayoutOverridesCss() {
  if (!existsSync(LAYOUT_OVERRIDES_FILE)) {
    console.error('Missing src/styles/archivist-layout-overrides.css');
    process.exit(1);
  }

  return readFileSync(LAYOUT_OVERRIDES_FILE, 'utf-8');
}

function build() {
  const claudianCss = buildClaudianCss();
  let dndCss = buildDndCss();
  const editCss = buildEditCss();
  const layoutOverridesCss = buildLayoutOverridesCss();
  const pcCss = buildPcCss();

  // Extract @import lines from D&D CSS - they must appear at the very top of the output
  // per CSS spec (browsers silently ignore @import rules that appear after other rules)
  // Pattern handles url() with embedded semicolons (e.g. Google Fonts URLs)
  const importPattern = /^@import\s+url\(['"][^'"]*['"]\)\s*;/gm;
  const importLines = dndCss.match(importPattern) || [];
  dndCss = dndCss.replace(importPattern, '').trimStart();

  const output = [
    ...importLines,
    ...(importLines.length > 0 ? [''] : []),
    '/* Archivist - Plugin Styles */',
    '/* Built from src/modules/inquiry/style/ modules + src/styles/archivist-dnd.css + src/styles/archivist-edit.css */',
    '',
    '/* ================================================================',
    '   PART 1: Claudian Chat UI (from src/modules/inquiry/style/)',
    '   ================================================================ */',
    claudianCss,
    '',
    '/* ================================================================',
    '   PART 2: D&D 5e Entity Blocks (from src/styles/archivist-dnd.css)',
    '   ================================================================ */',
    '',
    dndCss,
    '',
    '/* ================================================================',
    '   PART 3: Edit Mode (from src/styles/archivist-edit.css)',
    '   ================================================================ */',
    '',
    editCss,
    '',
    '/* ================================================================',
    '   PART 4: Layout Overrides (from src/styles/archivist-layout-overrides.css)',
    '   ================================================================ */',
    '',
    layoutOverridesCss,
    '',
    '/* ================================================================',
    '   PART 5: PC Module (from src/modules/pc/styles/)',
    '   ================================================================ */',
    '',
    pcCss,
  ].join('\n');

  writeFileSync(OUTPUT, output);
  console.log(`Built styles.css (${(output.length / 1024).toFixed(1)} KB)`);
}

build();
