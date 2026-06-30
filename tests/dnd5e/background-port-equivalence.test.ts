// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { installObsidianDomHelpers } from "../fixtures/pc/dom-helpers"; // S1: real path (used by monster-render-equivalence.test.ts:9)
import type { RenderContext } from "../../packages/obsidian/src/core/module-api";
import { backgroundCodec } from "@archivist/dnd5e/background/background.codec";
import { parseBackground } from "@archivist/dnd5e/background/background.parser"; // moved parser (post-move path)
import { backgroundModule } from "../../packages/obsidian/src/modules/background/background.module"; // (a2) uses the module's real render (B1)

const SRD_DIRS = ["SRD 5e", "SRD 2024"].map((d) => join(".compendium-bundle", d, "Backgrounds"));

// per-task NON_CANONICAL fixtures (a3, MANDATORY — SRD-5e Backgrounds=1, so the
// hand-authored fixtures carry the coverage). A fully-valid minimal body the
// schema accepts, then three derived variants: name/slug-only (fails schema in
// both paths), an unknown top-level key (zod strips it identically), and a
// legacy entity with no edition (parseBackground seeds { edition: "2014" }).
const MINIMAL_VALID = [
  "slug: equiv-test-bg",
  "name: Equiv Test Background",
  "source: Homebrew",
  "description: A test background.",
  "skill_proficiencies: []",
  "tool_proficiencies: []",
  "language_proficiencies: []",
  "equipment: []",
  "feature:",
  "  name: Test Feature",
  "  description: A test feature description.",
  "ability_score_increases: null",
  "origin_feat: null",
  "suggested_characteristics: null",
].join("\n");

const NON_CANONICAL: { name: string; body: string }[] = [
  // (a3-i) only name/slug — passes parseBackground's required-key gate but fails
  // the schema in both paths; equivalence holds on the shared failure.
  { name: "name/slug only", body: "name: Minimal Background\nslug: minimal-background\n" },
  // (a3-ii) an unknown top-level key — zod (non-strict) strips it identically.
  { name: "unknown top-level key", body: `${MINIMAL_VALID}\nunexpected_top_level: should be stripped\n` },
  // (a3-iii) legacy field variant — no `edition`; parseBackground coerces it by
  // seeding { edition: "2014", ...raw }.
  { name: "legacy: edition omitted (defaults 2014)", body: `${MINIMAL_VALID}\n` },
];

function bodyFromMd(md: string): string {
  // entity .md files store a single fenced ```background block; extract its body.
  const m = md.match(/```background\n([\s\S]*?)```/);
  return m ? m[1] : md;
}

beforeAll(() => installObsidianDomHelpers());

describe("background port equivalence", () => {
  const cases: { name: string; body: string }[] = [];
  for (const dir of SRD_DIRS) {
    let files: string[] = [];
    try { files = readdirSync(dir).filter((f) => f.endsWith(".md")); } catch { /* dir may not exist */ }
    for (const f of files) cases.push({ name: `${dir}/${f}`, body: bodyFromMd(readFileSync(join(dir, f), "utf8")) });
  }

  it("has corpus coverage", () => { expect(cases.length).toBeGreaterThan(0); });
  it("has mandatory non-canonical fixtures", () => { expect(NON_CANONICAL.length).toBeGreaterThan(0); }); // N3

  // (a1) parse-data equivalence — THE load-bearing check: codec.parse(doc) deep-equals legacy parseBackground(body)
  it.each([...cases, ...NON_CANONICAL])("(a1) parse-data equal: $name", ({ body }) => {
    const viaCodec = backgroundCodec.parse({ type: "background", frontmatter: {}, body, raw: body });
    const viaLegacy = parseBackground(body);
    expect(viaCodec.success).toBe(viaLegacy.success);
    if (viaCodec.success && viaLegacy.success) expect(viaCodec.data).toEqual(viaLegacy.data);
  });

  // (a2) render smoke via the module's REAL render (B1 — renderBackgroundBlock is
  // async; the module's render returns a sync wrapper and fills it later. Since
  // (a1) proves data identity, this only asserts the moved type doesn't break the
  // renderer's shape access).
  it.each(cases)("(a2) module render does not throw: $name", ({ body }) => {
    const parsed = backgroundCodec.parse({ type: "background", frontmatter: {}, body, raw: body });
    if (!parsed.success) return;
    const host = document.createElement("div");
    const ctx = { plugin: undefined, ctx: null } as unknown as RenderContext;
    expect(() => backgroundModule.render(host, parsed.data, ctx)).not.toThrow();
  });

  // (d) parse-idempotence: parse(serialize(parse(x))) deep-equals parse(x)
  it.each(cases)("(d) idempotent: $name", ({ body }) => {
    const first = backgroundCodec.parse({ type: "background", frontmatter: {}, body, raw: body });
    if (!first.success) return;
    const round = backgroundCodec.parse({ type: "background", frontmatter: {}, body: backgroundCodec.serialize(first.data), raw: "" });
    expect(round.success).toBe(true);
    if (round.success) expect(round.data).toEqual(first.data);
  });

  // de-list guard: kernel pack declares background with the PACK codec (not the legacy bridge)
  it("dnd5ePack declares background with its pack codec", async () => {
    const { dnd5ePack } = await import("@archivist/dnd5e"); // S2: barrel, no ./pack subpath
    expect(dnd5ePack.entityTypes.some((et) => et.type === "background" && et.doc === backgroundCodec)).toBe(true);
  });
});
