// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { installObsidianDomHelpers } from "../fixtures/pc/dom-helpers"; // S1: real path (used by monster-render-equivalence.test.ts:9)
import type { RenderContext } from "../../packages/obsidian/src/shared/rendering/entity-presenter";
import { classCodec } from "@archivist/dnd5e/class/class.codec";
import { parseClass } from "@archivist/dnd5e/class/class.parser"; // moved parser (post-move path)
import { classModule } from "../../packages/obsidian/src/modules/class/class.module"; // (a2) uses the module's real render (B1)

const SRD_DIRS = ["SRD 5e", "SRD 2024"].map((d) => join(".compendium-bundle", d, "Classes"));

// A schema-valid class body (mirrors tests/class-parser.test.ts's known-good minimal class).
const VALID_CLASS = [
  "slug: rogue",
  "name: Rogue",
  'edition: "2014"',
  'source: "SRD 5.1"',
  "description: Stealthy.",
  "hit_die: d8",
  "primary_abilities: [dex]",
  "saving_throws: [dex, int]",
  "proficiencies:",
  "  armor: [light]",
  "  weapons: { fixed: [simple, hand-crossbow, longsword, rapier, shortsword] }",
  "  tools: { fixed: [thieves-tools] }",
  "skill_choices:",
  "  count: 4",
  "  from: [stealth, deception, investigation, sleight-of-hand]",
  "starting_equipment:",
  "  - { kind: fixed, label: leather armor, grants: [{ item: leather-armor }] }",
  "spellcasting: null",
  "subclass_level: 3",
  'subclass_feature_name: "Roguish Archetype"',
  "weapon_mastery: null",
  "epic_boon_level: null",
  "table:",
  '  "1": { prof_bonus: 2, feature_ids: [expertise, sneak-attack] }',
].join("\n");

// per-task NON_CANONICAL fixtures (a3, MANDATORY):
// (i) a class with nested features/resources (a feature carrying sub_features +
//     its own resources, plus a top-level resources entry) — the codec and the
//     legacy parser must produce byte-identical nested data; and
// (ii) a class with an unknown top-level key — parseClass's plain z.object strips
//     it identically on both paths (success parity, identical stripped data).
const NESTED_FEATURES = [
  "features_by_level:",
  '  "1":',
  "    - id: rage",
  "      name: Rage",
  '      description: "Enter a rage."',
  "      resources:",
  "        - id: rage-uses",
  "          name: Rage",
  '          max_formula: "2"',
  "          reset: long-rest",
  "      sub_features:",
  "        - name: Reckless Attack",
  '          description: "Attack with reckless abandon."',
  "resources:",
  "  - id: rage-uses",
  "    name: Rage",
  '    max_formula: "2"',
  "    reset: long-rest",
].join("\n");

const NON_CANONICAL: { name: string; body: string }[] = [
  // (a3-i) nested features/resources → deep data-equivalence on both paths.
  { name: "nested features/resources", body: `${VALID_CLASS}\n${NESTED_FEATURES}\n` },
  // (a3-ii) unknown top-level key → plain z.object strips it identically on both paths.
  {
    name: "unknown top-level key (stripped)",
    body: `${VALID_CLASS}\nfeatures_by_level: {}\nresources: []\nunexpected_top_level: should be stripped\n`,
  },
];

function bodyFromMd(md: string): string {
  // entity .md files store a single fenced ```class block; extract its body.
  const m = md.match(/```class\n([\s\S]*?)```/);
  return m ? m[1] : md;
}

beforeAll(() => installObsidianDomHelpers());

describe("class port equivalence", () => {
  const cases: { name: string; body: string }[] = [];
  for (const dir of SRD_DIRS) {
    let files: string[] = [];
    try {
      files = readdirSync(dir).filter((f) => f.endsWith(".md"));
    } catch {
      /* dir may not exist */
    }
    for (const f of files) cases.push({ name: `${dir}/${f}`, body: bodyFromMd(readFileSync(join(dir, f), "utf8")) });
  }

  it("has per-corpus coverage (each SRD edition dir non-empty)", () => {
    for (const dir of SRD_DIRS) {
      let n = 0;
      try { n = readdirSync(dir).filter((f) => f.endsWith(".md")).length; } catch { /* dir may not exist */ }
      expect(n, `empty SRD corpus dir: ${dir}`).toBeGreaterThan(0);
    }
  });
  it("has mandatory non-canonical fixtures", () => {
    expect(NON_CANONICAL.length).toBeGreaterThan(0);
  }); // N3

  // (a1) parse-data equivalence — THE load-bearing check: codec.parse(doc) deep-equals legacy parseClass(body)
  it.each([...cases, ...NON_CANONICAL])("(a1) parse-data equal: $name", ({ body }) => {
    const viaCodec = classCodec.parse({ type: "class", frontmatter: {}, body, raw: body });
    const viaLegacy = parseClass(body);
    expect(viaCodec.success).toBe(viaLegacy.success);
    if (viaCodec.success && viaLegacy.success) expect(viaCodec.data).toEqual(viaLegacy.data);
  });

  // (a2) render smoke via the module's REAL render (B1)
  it.each(cases)("(a2) module render does not throw: $name", ({ body }) => {
    const parsed = classCodec.parse({ type: "class", frontmatter: {}, body, raw: body });
    if (!parsed.success) return;
    const host = document.createElement("div");
    const ctx = { plugin: undefined, ctx: null } as unknown as RenderContext;
    expect(() => classModule.render(host, parsed.data, ctx)).not.toThrow();
  });

  // (d) parse-idempotence: parse(serialize(parse(x))) deep-equals parse(x)
  it.each(cases)("(d) idempotent: $name", ({ body }) => {
    const first = classCodec.parse({ type: "class", frontmatter: {}, body, raw: body });
    if (!first.success) return;
    const round = classCodec.parse({ type: "class", frontmatter: {}, body: classCodec.serialize(first.data), raw: "" });
    expect(round.success).toBe(true);
    if (round.success) expect(round.data).toEqual(first.data);
  });

  // de-list guard: kernel pack declares class with the PACK codec (not the legacy bridge)
  it("dnd5ePack declares class with its pack codec", async () => {
    const { dnd5ePack } = await import("@archivist/dnd5e"); // S2: barrel, no ./pack subpath
    expect(dnd5ePack.entityTypes.some((et) => et.type === "class" && et.doc === classCodec)).toBe(true);
  });
});
