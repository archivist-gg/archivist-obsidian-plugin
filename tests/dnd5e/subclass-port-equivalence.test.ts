// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { installObsidianDomHelpers } from "../fixtures/pc/dom-helpers"; // S1: real path (used by monster-render-equivalence.test.ts:9)
import type { RenderContext } from "../../packages/obsidian/src/core/module-api";
import { subclassCodec } from "@archivist/dnd5e/subclass/subclass.codec";
import { parseSubclass } from "@archivist/dnd5e/subclass/subclass.parser"; // moved parser (post-move path)
import { subclassModule } from "../../packages/obsidian/src/modules/subclass/subclass.module"; // (a2) uses the module's real render (B1)

const SRD_DIRS = ["SRD 5e", "SRD 2024"].map((d) => join(".compendium-bundle", d, "Subclasses"));

// A schema-valid subclass body (mirrors tests/subclass-parser.test.ts's known-good minimal subclass).
const VALID_SUBCLASS = [
  "slug: thief",
  "name: Thief",
  'parent_class: "[[rogue]]"',
  'edition: "2014"',
  'source: "SRD 5.1"',
  "description: Burglar.",
  "features_by_level:",
  '  "3":',
  '    - { name: "Fast Hands", description: "Use bonus action." }',
  "resources: []",
].join("\n");

// per-task NON_CANONICAL fixtures (a3, MANDATORY):
// (i) a subclass carrying a full `spellcasting` config (Arcane-Trickster shape) — the
//     codec and the legacy parser must produce byte-identical nested data; and
// (ii) a subclass with an unknown top-level key — parseSubclass's plain z.object strips
//     it identically on both paths (success parity, identical stripped data).
const WITH_SPELLCASTING = [
  "slug: arcane-trickster",
  "name: Arcane Trickster",
  'parent_class: "[[rogue]]"',
  'edition: "2014"',
  'source: "SRD 5.1"',
  "description: A rogue who weaves illusion and enchantment.",
  "spellcasting:",
  "  caster_type: third",
  "  ability: int",
  "  preparation: known",
  "  spell_list: wizard",
  "features_by_level:",
  '  "3":',
  '    - { name: "Spellcasting", description: "You learn to cast spells." }',
  "resources: []",
].join("\n");

const NON_CANONICAL: { name: string; body: string }[] = [
  // (a3-i) full spellcasting config → deep data-equivalence on both paths.
  { name: "subclass with spellcasting config", body: `${WITH_SPELLCASTING}\n` },
  // (a3-ii) unknown top-level key → plain z.object strips it identically on both paths.
  {
    name: "unknown top-level key (stripped)",
    body: `${VALID_SUBCLASS}\nunexpected_top_level: should be stripped\n`,
  },
];

function bodyFromMd(md: string): string {
  // entity .md files store a single fenced ```subclass block; extract its body.
  const m = md.match(/```subclass\n([\s\S]*?)```/);
  return m ? m[1] : md;
}

beforeAll(() => installObsidianDomHelpers());

describe("subclass port equivalence", () => {
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

  // (a1) parse-data equivalence — THE load-bearing check: codec.parse(doc) deep-equals legacy parseSubclass(body)
  it.each([...cases, ...NON_CANONICAL])("(a1) parse-data equal: $name", ({ body }) => {
    const viaCodec = subclassCodec.parse({ type: "subclass", frontmatter: {}, body, raw: body });
    const viaLegacy = parseSubclass(body);
    expect(viaCodec.success).toBe(viaLegacy.success);
    if (viaCodec.success && viaLegacy.success) expect(viaCodec.data).toEqual(viaLegacy.data);
  });

  // (a2) render smoke via the module's REAL render (B1)
  it.each(cases)("(a2) module render does not throw: $name", ({ body }) => {
    const parsed = subclassCodec.parse({ type: "subclass", frontmatter: {}, body, raw: body });
    if (!parsed.success) return;
    const host = document.createElement("div");
    const ctx = { plugin: undefined, ctx: null } as unknown as RenderContext;
    expect(() => subclassModule.render(host, parsed.data, ctx)).not.toThrow();
  });

  // (d) parse-idempotence: parse(serialize(parse(x))) deep-equals parse(x)
  it.each(cases)("(d) idempotent: $name", ({ body }) => {
    const first = subclassCodec.parse({ type: "subclass", frontmatter: {}, body, raw: body });
    if (!first.success) return;
    const round = subclassCodec.parse({ type: "subclass", frontmatter: {}, body: subclassCodec.serialize(first.data), raw: "" });
    expect(round.success).toBe(true);
    if (round.success) expect(round.data).toEqual(first.data);
  });

  // de-list guard: kernel pack declares subclass with the PACK codec (not the legacy bridge)
  it("dnd5ePack declares subclass with its pack codec", async () => {
    const { dnd5ePack } = await import("@archivist/dnd5e"); // S2: barrel, no ./pack subpath
    expect(dnd5ePack.entityTypes.some((et) => et.type === "subclass" && et.doc === subclassCodec)).toBe(true);
  });
});
