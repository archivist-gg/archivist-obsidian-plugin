#!/usr/bin/env node
/**
 * CSS Build Script
 * Concatenates:
 *   1. Claudian modular CSS from src/inquiry/style/ (via index.css @imports)
 *   2. D&D-specific CSS from src/styles/archivist-dnd.css
 * into the root styles.css for the Obsidian plugin.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname, resolve, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CLAUDIAN_STYLE_DIR = join(ROOT, 'src', 'inquiry', 'style');
const DND_CSS_FILE = join(ROOT, 'src', 'styles', 'archivist-dnd.css');
const OUTPUT = join(ROOT, 'styles.css');
const INDEX_FILE = join(CLAUDIAN_STYLE_DIR, 'index.css');

const IMPORT_PATTERN = /^\s*@import\s+(?:url\()?['"]([^'"]+)['"]\)?\s*;/gm;

function getModuleOrder() {
  if (!existsSync(INDEX_FILE)) {
    console.error('Missing src/inquiry/style/index.css');
    process.exit(1);
  }

  const content = readFileSync(INDEX_FILE, 'utf-8');
  const matches = [...content.matchAll(IMPORT_PATTERN)];

  if (matches.length === 0) {
    console.error('No @import entries found in src/inquiry/style/index.css');
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
    console.error('Invalid @import entries in src/inquiry/style/index.css:');
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
    console.error('Unlisted CSS files (not imported in src/inquiry/style/index.css):');
    unlistedFiles.forEach((file) => console.error(`  - ${file}`));
    hasErrors = true;
  }

  if (hasErrors) {
    process.exit(1);
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

function build() {
  const claudianCss = buildClaudianCss();
  const dndCss = buildDndCss();

  const output = [
    '/* Archivist TTRPG Blocks - Plugin Styles */',
    '/* Built from src/inquiry/style/ modules + src/styles/archivist-dnd.css */',
    '',
    '/* ================================================================',
    '   PART 1: Claudian Chat UI (from src/inquiry/style/)',
    '   ================================================================ */',
    claudianCss,
    '',
    '/* ================================================================',
    '   PART 2: D&D 5e Entity Blocks (from src/styles/archivist-dnd.css)',
    '   ================================================================ */',
    '',
    dndCss,
  ].join('\n');

  writeFileSync(OUTPUT, output);
  console.log(`Built styles.css (${(output.length / 1024).toFixed(1)} KB)`);
}

build();
