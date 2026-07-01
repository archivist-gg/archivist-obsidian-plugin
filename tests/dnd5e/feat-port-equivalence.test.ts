// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { installObsidianDomHelpers } from "../fixtures/pc/dom-helpers"; // S1: real path (used by monster-render-equivalence.test.ts:9)
import type { RenderContext } from "../../packages/obsidian/src/core/module-api";
import { featCodec } from "@archivist/dnd5e/feat/feat.codec";
import { parseFeat } from "@archivist/dnd5e/feat/feat.parser"; // moved parser (post-move path)
import { featModule } from "../../packages/obsidian/src/modules/feat/feat.module"; // (a2) uses the module's real render (B1)

const SRD_DIRS = ["SRD 5e", "SRD 2024"].map((d) => join(".compendium-bundle", d, "Feats"));

// per-task NON_CANONICAL fixtures (a3, MANDATORY — SRD-5e Feats=1, so the
// hand-authored fixtures carry the coverage). A fully-valid minimal body the
// schema accepts, then three derived variants: name/slug-only (fails schema in
// both paths), an unknown top-level key (zod strips it identically), and a
// legacy entity with no edition (parseFeat seeds { edition: "2014" }).
const MINIMAL_VALID = [
  "slug: equiv-test-feat",
  "name: Equiv Test Feat",
  "source: Homebrew",
  "category: general",
  "description: A test feat.",
  "prerequisites: []",
  "benefits: []",
  "effects: []",
  "grants_asi: null",
  "repeatable: false",
  "choices: []",
].join("\n");

const NON_CANONICAL: { name: string; body: string }[] = [
  // (a3-i) only name/slug — passes parseFeat's required-key gate but fails the
  // schema in both paths; equivalence holds on the shared failure.
  { name: "name/slug only", body: "name: Minimal Feat\nslug: minimal-feat\n" },
  // (a3-ii) an unknown top-level key — zod (non-strict) strips it identically.
  { name: "unknown top-level key", body: `${MINIMAL_VALID}\nunexpected_top_level: should be stripped\n` },
  // (a3-iii) legacy field variant — no `edition`; parseFeat coerces it by
  // seeding { edition: "2014", ...raw }.
  { name: "legacy: edition omitted (defaults 2014)", body: `${MINIMAL_VALID}\n` },
];

function bodyFromMd(md: string): string {
  // entity .md files store a single fenced ```feat block; extract its body.
  const m = md.match(/```feat\n([\s\S]*?)```/);
  return m ? m[1] : md;
}

beforeAll(() => installObsidianDomHelpers());

describe("feat port equivalence", () => {
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

  // (a1) parse-data equivalence — THE load-bearing check: codec.parse(doc) deep-equals legacy parseFeat(body)
  it.each([...cases, ...NON_CANONICAL])("(a1) parse-data equal: $name", ({ body }) => {
    const viaCodec = featCodec.parse({ type: "feat", frontmatter: {}, body, raw: body });
    const viaLegacy = parseFeat(body);
    expect(viaCodec.success).toBe(viaLegacy.success);
    if (viaCodec.success && viaLegacy.success) expect(viaCodec.data).toEqual(viaLegacy.data);
  });

  // (a2) render smoke via the module's REAL render (B1 — renderFeatBlock is
  // async; the module's render returns a sync wrapper and fills it later. Since
  // (a1) proves data identity, this only asserts the moved type doesn't break the
  // renderer's shape access).
  it.each(cases)("(a2) module render does not throw: $name", ({ body }) => {
    const parsed = featCodec.parse({ type: "feat", frontmatter: {}, body, raw: body });
    if (!parsed.success) return;
    const host = document.createElement("div");
    const ctx = { plugin: undefined, ctx: null } as unknown as RenderContext;
    expect(() => featModule.render(host, parsed.data, ctx)).not.toThrow();
  });

  // (d) parse-idempotence: parse(serialize(parse(x))) deep-equals parse(x)
  it.each(cases)("(d) idempotent: $name", ({ body }) => {
    const first = featCodec.parse({ type: "feat", frontmatter: {}, body, raw: body });
    if (!first.success) return;
    const round = featCodec.parse({ type: "feat", frontmatter: {}, body: featCodec.serialize(first.data), raw: "" });
    expect(round.success).toBe(true);
    if (round.success) expect(round.data).toEqual(first.data);
  });

  // de-list guard: kernel pack declares feat with the PACK codec (not the legacy bridge)
  it("dnd5ePack declares feat with its pack codec", async () => {
    const { dnd5ePack } = await import("@archivist/dnd5e"); // S2: barrel, no ./pack subpath
    expect(dnd5ePack.entityTypes.some((et) => et.type === "feat" && et.doc === featCodec)).toBe(true);
  });
});
