#!/usr/bin/env node
/**
 * Fails when the tracked styles.css does not equal the build output.
 *
 * styles.css is a TRACKED generated artifact and `npm run check` never rebuilt
 * it, so a hand-edited or badly-merged copy passed the gate green and deployed
 * verbatim. This check is deliberately NON-MUTATING: it builds in memory and
 * compares. A rebuild-then-git-diff would rewrite the tree during `check` and
 * false-fail whenever styles.css legitimately differs from HEAD mid-phase.
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { buildCss } from './build-css.mjs';

const OUTPUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'styles.css');

if (!existsSync(OUTPUT)) {
  console.error('styles.css is missing: run npm run build:css');
  process.exit(1);
}

const onDisk = readFileSync(OUTPUT, 'utf8');
const built = buildCss();

if (onDisk !== built) {
  let at = 0;
  while (at < onDisk.length && at < built.length && onDisk[at] === built[at]) at++;
  console.error('styles.css is stale: run npm run build:css');
  console.error(`  tracked ${onDisk.length} bytes, built ${built.length} bytes, first difference at char ${at}`);
  process.exit(1);
}

console.log(`styles.css matches the build output (${(built.length / 1024).toFixed(1)} KB)`);
