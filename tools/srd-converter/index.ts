#!/usr/bin/env tsx
import * as fs from "node:fs";
import * as path from "node:path";
import * as yaml from "js-yaml";
import { loadConfig, type ConverterConfig } from "./config";
import { normalizeSrdClass, type Open5eClassJson } from "../../src/modules/class/class.normalizer";
import { normalizeSrdRace, type Open5eRaceJson } from "../../src/modules/race/race.normalizer";
import { normalizeSrdSubclass, type Open5eArchetypeJson } from "../../src/modules/subclass/subclass.normalizer";
import { normalizeSrdBackground, type Open5eBackgroundJson } from "../../src/modules/background/background.normalizer";
import { normalizeSrdFeat, type Open5eFeatJson } from "../../src/modules/feat/feat.normalizer";
import type { NormalizedEntity } from "../../src/modules/class/class.normalizer";

const INVALID_FILENAME_CHARS = /[/:*?"<>|\\]/g;

function sanitizeFilename(name: string): string {
  return name.replace(INVALID_FILENAME_CHARS, "_");
}

function loadJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function writeMd(
  outputRoot: string,
  typeFolder: string,
  entity: NormalizedEntity<unknown>,
  codeBlockTag: string,
): void {
  const dir = path.join(outputRoot, typeFolder);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${sanitizeFilename(entity.frontmatter.name)}.md`);
  const frontmatterYaml = yaml.dump(entity.frontmatter, { lineWidth: -1, noRefs: true }).trimEnd();
  const bodyYaml = yaml.dump(entity.data, { lineWidth: -1, noRefs: true }).trimEnd();
  const md = `---\n${frontmatterYaml}\n---\n\n\`\`\`${codeBlockTag}\n${bodyYaml}\n\`\`\`\n`;
  fs.writeFileSync(file, md, "utf8");
}

interface ConversionSummary {
  type: string;
  total: number;
  included: number;
  excluded: number;
}

function convertClasses(cfg: ConverterConfig, summaries: ConversionSummary[]): void {
  const allPath = path.join(cfg.sourceDir, "classes", "all.json");
  if (!fs.existsSync(allPath)) {
    console.warn(`classes/all.json not found at ${allPath}`);
    return;
  }
  const classes = loadJson<Open5eClassJson[]>(allPath);
  let included = 0;
  let excluded = 0;
  const subclassSummary: ConversionSummary = { type: "subclasses", total: 0, included: 0, excluded: 0 };
  const subclassSlugsSeen = new Set<string>();

  for (const cls of classes) {
    if (!cfg.includeDocumentSlugs.has(cls.document__slug ?? "")) { excluded++; continue; }
    included++;
    const normalized = normalizeSrdClass(cls, { edition: cfg.edition });
    writeMd(cfg.outputDir, "classes", normalized, "class");

    for (const archetype of cls.archetypes ?? []) {
      subclassSummary.total++;
      const arch = archetype as unknown as Open5eArchetypeJson;
      if (!cfg.includeDocumentSlugs.has(arch.document__slug ?? "")) { subclassSummary.excluded++; continue; }
      if (subclassSlugsSeen.has(arch.slug)) {
        throw new Error(`subclass slug collision: "${arch.slug}" (from class "${cls.name}")`);
      }
      subclassSlugsSeen.add(arch.slug);
      const normalizedArch = normalizeSrdSubclass(arch, { parentClassName: cls.name, edition: cfg.edition });
      writeMd(cfg.outputDir, "subclasses", normalizedArch, "subclass");
      subclassSummary.included++;
    }
  }
  summaries.push({ type: "classes", total: classes.length, included, excluded });
  summaries.push(subclassSummary);
}

function convertRaces(cfg: ConverterConfig, summaries: ConversionSummary[]): void {
  const allPath = path.join(cfg.sourceDir, "races", "all.json");
  if (!fs.existsSync(allPath)) { console.warn(`races/all.json not found at ${allPath}`); return; }
  const races = loadJson<Open5eRaceJson[]>(allPath);
  let included = 0;
  let excluded = 0;
  for (const race of races) {
    if (!cfg.includeDocumentSlugs.has(race.document__slug ?? "")) { excluded++; continue; }
    included++;
    writeMd(cfg.outputDir, "races", normalizeSrdRace(race, { edition: cfg.edition }), "race");
  }
  summaries.push({ type: "races", total: races.length, included, excluded });
}

function convertBackgrounds(cfg: ConverterConfig, summaries: ConversionSummary[]): void {
  const allPath = path.join(cfg.sourceDir, "backgrounds", "all.json");
  if (!fs.existsSync(allPath)) { console.warn(`backgrounds/all.json not found at ${allPath}`); return; }
  const backgrounds = loadJson<Open5eBackgroundJson[]>(allPath);
  let included = 0;
  let excluded = 0;
  for (const bg of backgrounds) {
    if (!cfg.includeDocumentSlugs.has(bg.document__slug ?? "")) { excluded++; continue; }
    included++;
    writeMd(cfg.outputDir, "backgrounds", normalizeSrdBackground(bg, { edition: cfg.edition }), "background");
  }
  summaries.push({ type: "backgrounds", total: backgrounds.length, included, excluded });
}

function convertFeats(cfg: ConverterConfig, summaries: ConversionSummary[]): void {
  const allPath = path.join(cfg.sourceDir, "feats", "all.json");
  if (!fs.existsSync(allPath)) { console.warn(`feats/all.json not found at ${allPath}`); return; }
  const feats = loadJson<Open5eFeatJson[]>(allPath);
  let included = 0;
  let excluded = 0;
  for (const feat of feats) {
    if (!cfg.includeDocumentSlugs.has(feat.document__slug ?? "")) { excluded++; continue; }
    included++;
    writeMd(cfg.outputDir, "feats", normalizeSrdFeat(feat, { edition: cfg.edition }), "feat");
  }
  summaries.push({ type: "feats", total: feats.length, included, excluded });
}

function main(): void {
  const cfg = loadConfig();
  console.log(`Converting SRD data`);
  console.log(`  source:  ${cfg.sourceDir}`);
  console.log(`  output:  ${cfg.outputDir}`);
  console.log(`  edition: ${cfg.edition}`);
  console.log(`  include: ${Array.from(cfg.includeDocumentSlugs).join(", ")}`);
  console.log();

  fs.mkdirSync(cfg.outputDir, { recursive: true });

  const summaries: ConversionSummary[] = [];
  convertClasses(cfg, summaries);
  convertRaces(cfg, summaries);
  convertBackgrounds(cfg, summaries);
  convertFeats(cfg, summaries);

  console.log("Conversion summary:");
  for (const s of summaries) {
    console.log(`  ${s.type}: ${s.included} included, ${s.excluded} excluded (of ${s.total})`);
  }
}

main();
