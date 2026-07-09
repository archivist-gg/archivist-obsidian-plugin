// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { installObsidianDomHelpers } from "../fixtures/pc/dom-helpers"; // S1: real path (used by monster-render-equivalence.test.ts:9)
import type { RenderContext } from "../../packages/obsidian/src/shared/rendering/entity-presenter";
import { raceCodec } from "@archivist-gg/dnd5e/race/race.codec";
import { parseRace } from "@archivist-gg/dnd5e/race/race.parser"; // moved parser (post-move path)
import { raceModule } from "../../packages/obsidian/src/modules/race/race.module"; // (a2) uses the module's real render (B1)

const SRD_DIRS = ["SRD 5e", "SRD 2024"].map((d) => join(".compendium-bundle", d, "Races"));

// per-task NON_CANONICAL fixtures (a3, MANDATORY): minimal name/slug-only (fails
// schema in BOTH paths), an unknown top-level key (zod strips it identically),
// and edition omitted (parseRace defaults it to "2014").
const MINIMAL_VALID = [
  "slug: equiv-test-race",
  "name: Equiv Test Race",
  "source: Homebrew",
  "size: medium",
  "speed:",
  "  walk: 30",
  "vision: {}",
  "description: A test race.",
  "ability_score_increases: []",
  "age: They mature normally.",
  "alignment: Usually neutral.",
  "languages:",
  "  fixed: []",
  "variant_label: base",
  "traits: []",
].join("\n");

const NON_CANONICAL: { name: string; body: string }[] = [
  // (a3-i) only name/slug — passes parseYaml's required-key gate but fails the
  // schema in both paths; equivalence holds on the shared failure.
  { name: "name/slug only", body: "name: Minimal Race\nslug: minimal-race\n" },
  // (a3-ii) an unknown top-level key — zod (non-strict) strips it identically.
  { name: "unknown top-level key", body: `${MINIMAL_VALID}\nunexpected_top_level: should be stripped\n` },
  // (a3-iii) edition omitted — parseRace seeds { edition: "2014", ...raw }.
  { name: "edition omitted (defaults 2014)", body: `${MINIMAL_VALID}\n` },
];

function bodyFromMd(md: string): string {
  // entity .md files store a single fenced ```race block; extract its body.
  const m = md.match(/```race\n([\s\S]*?)```/);
  return m ? m[1] : md;
}

beforeAll(() => installObsidianDomHelpers());

describe("race port equivalence", () => {
  const cases: { name: string; body: string }[] = [];
  for (const dir of SRD_DIRS) {
    let files: string[] = [];
    try { files = readdirSync(dir).filter((f) => f.endsWith(".md")); } catch { /* dir may not exist */ }
    for (const f of files) cases.push({ name: `${dir}/${f}`, body: bodyFromMd(readFileSync(join(dir, f), "utf8")) });
  }

  it("has per-corpus coverage (each SRD edition dir non-empty)", () => {
    for (const dir of SRD_DIRS) {
      let n = 0;
      try { n = readdirSync(dir).filter((f) => f.endsWith(".md")).length; } catch { /* dir may not exist */ }
      expect(n, `empty SRD corpus dir: ${dir}`).toBeGreaterThan(0);
    }
  });
  it("has mandatory non-canonical fixtures", () => { expect(NON_CANONICAL.length).toBeGreaterThan(0); }); // N3

  // (a1) parse-data equivalence — THE load-bearing check: codec.parse(doc) deep-equals legacy parseRace(body)
  it.each([...cases, ...NON_CANONICAL])("(a1) parse-data equal: $name", ({ body }) => {
    const viaCodec = raceCodec.parse({ type: "race", frontmatter: {}, body, raw: body });
    const viaLegacy = parseRace(body);
    expect(viaCodec.success).toBe(viaLegacy.success);
    if (viaCodec.success && viaLegacy.success) expect(viaCodec.data).toEqual(viaLegacy.data);
  });

  // (a2) render smoke via the module's REAL render (B1 — uniform across sync/async/stub renderers;
  // since (a1) proves data identity, this only asserts the moved type doesn't break the renderer's shape access)
  it.each(cases)("(a2) module render does not throw: $name", ({ body }) => {
    const parsed = raceCodec.parse({ type: "race", frontmatter: {}, body, raw: body });
    if (!parsed.success) return;
    const host = document.createElement("div");
    const ctx = { plugin: undefined, ctx: null } as unknown as RenderContext;
    expect(() => raceModule.render(host, parsed.data, ctx)).not.toThrow();
  });

  // (d) parse-idempotence: parse(serialize(parse(x))) deep-equals parse(x)
  it.each(cases)("(d) idempotent: $name", ({ body }) => {
    const first = raceCodec.parse({ type: "race", frontmatter: {}, body, raw: body });
    if (!first.success) return;
    const round = raceCodec.parse({ type: "race", frontmatter: {}, body: raceCodec.serialize(first.data), raw: "" });
    expect(round.success).toBe(true);
    if (round.success) expect(round.data).toEqual(first.data);
  });

  // de-list guard: kernel pack declares race with the PACK codec (not the legacy bridge)
  it("dnd5ePack declares race with its pack codec", async () => {
    const { dnd5ePack } = await import("@archivist-gg/dnd5e"); // S2: barrel, no ./pack subpath
    expect(dnd5ePack.entityTypes.some((et) => et.type === "race" && et.doc === raceCodec)).toBe(true);
  });
});
