// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { installObsidianDomHelpers } from "../fixtures/pc/dom-helpers"; // S1: real path (used by monster-render-equivalence.test.ts:9)
import type { RenderContext } from "../../packages/obsidian/src/core/module-api";
import { armorCodec } from "@archivist/dnd5e/armor/armor.codec";
import { parseArmor } from "@archivist/dnd5e/armor/armor.parser"; // moved parser (post-move path)
import { armorModule } from "../../packages/obsidian/src/modules/armor/armor.module"; // (a2) uses the module's real render (B1)

const SRD_DIRS = ["SRD 5e", "SRD 2024"].map((d) => join(".compendium-bundle", d, "Armor"));

// A schema-valid armor body whose `ac` omits `flat`/`add_con`/`add_wis` so the
// zod defaults must fire on both paths.
const VALID_ARMOR = [
  "name: Equiv Test Armor",
  "slug: equiv-test-armor",
  "category: medium",
  "ac:",
  "  base: 14",
  "  add_dex: true",
  "  dex_max: 2",
  "source: Homebrew",
].join("\n");

// per-task NON_CANONICAL fixtures (a3, MANDATORY): (i) an unknown top-level key
// (parseArmor captures it into entity.raw identically on both paths); (ii) ac
// omitting flat/add_con/add_wis (the zod schema injects defaults identically);
// (iii) stealth_disadvantage as a quoted string (z.boolean() rejects it — both
// paths fail identically, so the shared schema's edge behavior is proven equal).
const NON_CANONICAL: { name: string; body: string }[] = [
  // (a3-i) unknown top-level key → captured into entity.raw on both paths.
  { name: "unknown top-level key (raw-capture)", body: `${VALID_ARMOR}\nunexpected_top_level: should be captured\n` },
  // (a3-ii) ac omitting flat/add_con/add_wis → schema default-injection parity.
  { name: "ac omits flat/add_con/add_wis (defaults)", body: `${VALID_ARMOR}\n` },
  // (a3-iii) stealth_disadvantage: "true" → string-boolean; z.boolean() rejects,
  // so both paths fail on the shared schema (success parity on the failure).
  { name: "stealth_disadvantage string-boolean", body: `${VALID_ARMOR}\nstealth_disadvantage: "true"\n` },
];

function bodyFromMd(md: string): string {
  // entity .md files store a single fenced ```armor block; extract its body.
  const m = md.match(/```armor\n([\s\S]*?)```/);
  return m ? m[1] : md;
}

beforeAll(() => installObsidianDomHelpers());

describe("armor port equivalence", () => {
  const cases: { name: string; body: string }[] = [];
  for (const dir of SRD_DIRS) {
    let files: string[] = [];
    try { files = readdirSync(dir).filter((f) => f.endsWith(".md")); } catch { /* dir may not exist */ }
    for (const f of files) cases.push({ name: `${dir}/${f}`, body: bodyFromMd(readFileSync(join(dir, f), "utf8")) });
  }

  it("has corpus coverage", () => { expect(cases.length).toBeGreaterThan(0); });
  it("has mandatory non-canonical fixtures", () => { expect(NON_CANONICAL.length).toBeGreaterThan(0); }); // N3

  // (a1) parse-data equivalence — THE load-bearing check: codec.parse(doc) deep-equals legacy parseArmor(body)
  it.each([...cases, ...NON_CANONICAL])("(a1) parse-data equal: $name", ({ body }) => {
    const viaCodec = armorCodec.parse({ type: "armor", frontmatter: {}, body, raw: body });
    const viaLegacy = parseArmor(body);
    expect(viaCodec.success).toBe(viaLegacy.success);
    if (viaCodec.success && viaLegacy.success) expect(viaCodec.data).toEqual(viaLegacy.data);
  });

  // (a2) render smoke via the module's REAL render (B1 — uniform across sync/async/stub renderers;
  // since (a1) proves data identity, this only asserts the moved type doesn't break the renderer's shape access)
  it.each(cases)("(a2) module render does not throw: $name", ({ body }) => {
    const parsed = armorCodec.parse({ type: "armor", frontmatter: {}, body, raw: body });
    if (!parsed.success) return;
    const host = document.createElement("div");
    const ctx = { plugin: undefined, ctx: null } as unknown as RenderContext;
    expect(() => armorModule.render(host, parsed.data, ctx)).not.toThrow();
  });

  // (d) parse-idempotence: parse(serialize(parse(x))) deep-equals parse(x)
  it.each(cases)("(d) idempotent: $name", ({ body }) => {
    const first = armorCodec.parse({ type: "armor", frontmatter: {}, body, raw: body });
    if (!first.success) return;
    const round = armorCodec.parse({ type: "armor", frontmatter: {}, body: armorCodec.serialize(first.data), raw: "" });
    expect(round.success).toBe(true);
    if (round.success) expect(round.data).toEqual(first.data);
  });

  // de-list guard: kernel pack declares armor with the PACK codec (not the legacy bridge)
  it("dnd5ePack declares armor with its pack codec", async () => {
    const { dnd5ePack } = await import("@archivist/dnd5e"); // S2: barrel, no ./pack subpath
    expect(dnd5ePack.entityTypes.some((et) => et.type === "armor" && et.doc === armorCodec)).toBe(true);
  });
});
