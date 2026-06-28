import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as yaml from "js-yaml";
import { choiceSchema } from "@archivist/dnd5e/schemas/choice-schema";
import { DECISION_SIGNAL } from "../../packages/obsidian/src/modules/pc/decision-recognizer";

const RUNTIME = path.resolve(__dirname, "../../packages/dnd5e/src/srd/data/runtime");
const EDITIONS = ["2014", "2024"] as const;
const KINDS = ["class", "subclass", "race", "feat", "background"] as const;

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

type FeatureLike = { id?: string; name?: string; description?: string; benefits?: string[]; choices?: unknown[] };

function loadOptOuts(): Set<string> {
  // noChoices: true entries in the overlays are the single source of opt-out
  // truth; we collect the opted-out feature keys and match by feature-slug
  // (scoped or bare), same resolution as the merge rules.
  const out = new Set<string>();
  for (const ed of ["srd-5e", "srd-2024"]) {
    const o = yaml.load(fs.readFileSync(
      path.resolve(__dirname, `../../tools/srd-canonical/overlays/${ed}.yaml`), "utf8")) as Record<string, Record<string, { noChoices?: true }>>;
    for (const section of ["class_features", "race_traits", "feat_features", "background_features"]) {
      for (const [key, v] of Object.entries(o?.[section] ?? {})) {
        if (v?.noChoices) out.add(key);
      }
    }
  }
  return out;
}

function collect(kind: string, edition: string): { key: string; bare: string; scoped: string; desc: string; hasChoices: boolean }[] {
  const file = path.join(RUNTIME, `${kind}.${edition}.json`);
  if (!fs.existsSync(file)) return [];
  const entries = JSON.parse(fs.readFileSync(file, "utf8")) as Array<Record<string, unknown>>;
  const out: ReturnType<typeof collect> = [];
  for (const e of entries) {
    const eslug = (e.slug as string) ?? "";
    const bareOwner = eslug.includes("_") ? eslug.slice(eslug.indexOf("_") + 1) : eslug;
    const push = (f: FeatureLike) => {
      const fslug = f.id ?? (f.name ? slug(f.name) : "?");
      out.push({
        key: `${eslug}:${fslug}`, bare: fslug, scoped: `${bareOwner}:${fslug}`,
        // Feats carry their decision prose in benefits[] with an empty
        // description; scan both so feat gaps can't slip through.
        desc: [f.description ?? "", ...(f.benefits ?? [])].join("\n"),
        hasChoices: Array.isArray(f.choices) && f.choices.length > 0,
      });
    };
    const byLevel = e.features_by_level as Record<string, FeatureLike[]> | undefined;
    if (byLevel) for (const fs0 of Object.values(byLevel)) for (const f of fs0) push(f);
    const traits = e.traits as FeatureLike[] | undefined;
    if (traits) for (const t of traits) push(t);
    const feature = e.feature as FeatureLike | undefined;
    if (feature) push(feature);
    if (kind === "feat") push(e as FeatureLike);
  }
  return out;
}

describe("choice coverage (SP2 Plan 3 gate)", () => {
  const optOut = loadOptOuts();
  for (const edition of EDITIONS) {
    for (const kind of KINDS) {
      it(`${kind}.${edition}: every decision-prose feature has choices or an opt-out`, () => {
        const gaps = collect(kind, edition)
          .filter(f => DECISION_SIGNAL.some(re => re.test(f.desc)))
          .filter(f => !f.hasChoices && !optOut.has(f.bare) && !optOut.has(f.scoped))
          .map(f => f.key);
        expect(gaps, `Author choices in the overlay or add noChoices:\n${gaps.join("\n")}`).toEqual([]);
      });
    }
  }
});

describe("authored choices validate against choiceSchema", () => {
  for (const edition of EDITIONS) {
    for (const kind of KINDS) {
      it(`${kind}.${edition}`, () => {
        const file = path.join(RUNTIME, `${kind}.${edition}.json`);
        if (!fs.existsSync(file)) return;
        const raw = JSON.parse(fs.readFileSync(file, "utf8")) as Array<Record<string, unknown>>;
        const validate = (f: FeatureLike, eslug: string) => {
          for (const c of f.choices ?? []) {
            const r = choiceSchema.safeParse(c);
            expect(r.success, `${eslug}:${f.id ?? f.name}: ${JSON.stringify(c)}`).toBe(true);
          }
        };
        for (const e of raw) {
          const eslug = (e.slug as string) ?? "";
          const byLevel = e.features_by_level as Record<string, FeatureLike[]> | undefined;
          if (byLevel) for (const fs0 of Object.values(byLevel)) for (const f of fs0) validate(f, eslug);
          const traits = e.traits as FeatureLike[] | undefined;
          if (traits) for (const t of traits) validate(t, eslug);
          const feature = e.feature as FeatureLike | undefined;
          if (feature) validate(feature, eslug);
          if (kind === "feat") validate(e as FeatureLike, eslug);
          const entityChoices = e.choices as unknown[] | undefined;
          if (entityChoices && kind !== "feat") for (const c of entityChoices) {
            expect(choiceSchema.safeParse(c).success, `${eslug} entity-level: ${JSON.stringify(c)}`).toBe(true);
          }
        }
      });
    }
  }
});
