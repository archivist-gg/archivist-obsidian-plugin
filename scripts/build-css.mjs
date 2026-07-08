#!/usr/bin/env node
/**
 * CSS Build Script
 * Concatenates the D&D-specific CSS from src/styles/archivist-dnd.css,
 * src/styles/archivist-edit.css, and the PC module styles into the root
 * styles.css for the Obsidian plugin.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname, resolve, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DND_CSS_FILE = join(ROOT, 'packages', 'obsidian', 'src','styles', 'archivist-dnd.css');
const EDIT_CSS_FILE = join(ROOT, 'packages', 'obsidian', 'src','styles', 'archivist-edit.css');
const PC_STYLE_DIR = join(ROOT, 'packages', 'obsidian', 'src','modules', 'pc', 'styles');
const PC_INDEX_FILE = join(PC_STYLE_DIR, 'index.css');
const OUTPUT = join(ROOT, 'styles.css');

const IMPORT_PATTERN = /^\s*@import\s+(?:url\()?['"]([^'"]+)['"]\)?\s*;/gm;

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

function build() {
  let dndCss = buildDndCss();
  const editCss = buildEditCss();
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
    '/* Built from src/styles/archivist-dnd.css + src/styles/archivist-edit.css + src/modules/pc/styles/ */',
    '',
    '/* ================================================================',
    '   PART 1: D&D 5e Entity Blocks (from src/styles/archivist-dnd.css)',
    '   ================================================================ */',
    '',
    dndCss,
    '',
    '/* ================================================================',
    '   PART 2: Edit Mode (from src/styles/archivist-edit.css)',
    '   ================================================================ */',
    '',
    editCss,
    '',
    '/* ================================================================',
    '   PART 3: PC Module (from src/modules/pc/styles/)',
    '   ================================================================ */',
    '',
    pcCss,
  ].join('\n');

  writeFileSync(OUTPUT, output);
  console.log(`Built styles.css (${(output.length / 1024).toFixed(1)} KB)`);
}

build();
