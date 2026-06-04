import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const RUNTIME = path.resolve(__dirname, "../../src/srd/data/runtime");
const EDITIONS = ["2014", "2024"] as const;

// Prose that signals a limited-use feature.
const LIMITED_USE = [
  /regain[^.]{0,40}\bexpended\b/i,
  /\bper\b[^.]{0,20}\b(short|long)?\s*rest\b/i,
  /\/\s*day\b/i,
  /\bcharges?\b/i,
  /a number of times equal to/i,
  /\byou can use (it|this)\b[^.]{0,40}\btimes\b/i,
  /\bnumber of (rages|uses)\b/i,
];

// Features whose prose trips the regex but which legitimately have no pooled
// resource (passive scaling, prose-only flavor, etc). Keep this list short and
// justified; each entry is "<entity-slug>:<feature-or-trait-slug>".
const OPT_OUT = new Set<string>([
  // Spell slots — tracked by the spell system, not a per-feature resource pool.
  "srd-5e_bard:spellcasting", "srd-5e_cleric:spellcasting", "srd-5e_druid:spellcasting",
  "srd-5e_paladin:spellcasting", "srd-5e_ranger:spellcasting", "srd-5e_sorcerer:spellcasting",
  "srd-5e_wizard:spellcasting", "srd-5e_warlock:pact-magic",
  "srd-2024_bard:spellcasting", "srd-2024_cleric:spellcasting", "srd-2024_druid:spellcasting",
  "srd-2024_paladin:spellcasting", "srd-2024_ranger:spellcasting", "srd-2024_sorcerer:spellcasting",
  "srd-2024_wizard:spellcasting", "srd-2024_warlock:pact-magic",
  // Modifiers/automatic features with no discrete spendable pool of their own.
  "srd-5e_bard:font-of-inspiration",        // changes Bardic Inspiration recovery; no own pool
  "srd-5e_sorcerer:sorcerous-restoration",  // 2014: regains points every short rest (unlimited)
  "srd-2024_bard:font-of-inspiration",      // changes Bardic Inspiration recovery; no own pool
  "srd-2024_bard:superior-inspiration",     // auto-regain on initiative; no use count
  "srd-2024_monk:perfect-focus",            // auto-regain Focus on initiative; no use count
  "srd-2024_druid:archdruid",               // auto-regain Wild Shape on initiative; passive
  "srd-2024_warlock:eldritch-master",       // modifies Magical Cunning; no own pool
  "srd-2024_thief:use-magic-device",        // d6 magic-item charge saver; not a personal pool
  "srd-2024_gnome:gnomish-lineage",         // lineage choice; any uses live in the sub-options
]);

type FeatureLike = { id?: string; name?: string; description?: string; resources?: unknown[] };

function smells(desc: string): boolean {
  return LIMITED_USE.some(re => re.test(desc));
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function collect(entityKind: string, edition: string): { key: string; desc: string; hasResources: boolean }[] {
  const file = path.join(RUNTIME, `${entityKind}.${edition}.json`);
  if (!fs.existsSync(file)) return [];
  const entries = JSON.parse(fs.readFileSync(file, "utf8")) as Array<Record<string, unknown>>;
  const out: { key: string; desc: string; hasResources: boolean }[] = [];
  for (const e of entries) {
    const eslug = (e.slug as string) ?? "";
    const push = (f: FeatureLike) => {
      const fslug = f.id ?? (f.name ? slug(f.name) : "?");
      out.push({ key: `${eslug}:${fslug}`, desc: f.description ?? "", hasResources: Array.isArray(f.resources) && f.resources.length > 0 });
    };
    const byLevel = e.features_by_level as Record<string, FeatureLike[]> | undefined;
    if (byLevel) for (const fs0 of Object.values(byLevel)) for (const f of fs0) push(f);
    const traits = e.traits as FeatureLike[] | undefined;
    if (traits) for (const t of traits) push(t);
    const feature = e.feature as FeatureLike | undefined;
    if (feature) push(feature);
    if (entityKind === "feat") push(e as FeatureLike);
  }
  return out;
}

describe("resource coverage", () => {
  for (const edition of EDITIONS) {
    for (const kind of ["class", "subclass", "race", "feat", "background"]) {
      it(`${kind}.${edition}: every limited-use feature has resources`, () => {
        const gaps = collect(kind, edition)
          .filter(f => smells(f.desc) && !f.hasResources && !OPT_OUT.has(f.key))
          .map(f => f.key);
        expect(gaps, `Uncovered limited-use features (add resources in the overlay, or opt out):\n${gaps.join("\n")}`).toEqual([]);
      });
    }
  }
});
