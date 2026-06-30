// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { installObsidianDomHelpers } from "../fixtures/pc/dom-helpers"; // S1: real path (used by monster-render-equivalence.test.ts:9)
import type { RenderContext } from "../../packages/obsidian/src/core/module-api";
import { itemCodec } from "@archivist/dnd5e/item/item.codec";
import { parseItem } from "@archivist/dnd5e/item/item.parser"; // moved parser (post-move path)
import { itemModule } from "../../packages/obsidian/src/modules/item/item.module"; // (a2) uses the module's real render (B1)
import { enrichItem } from "../../packages/obsidian/src/modules/item/item.enrichment";

const SRD_DIRS = ["SRD 5e", "SRD 2024"].map((d) => join(".compendium-bundle", d, "Magic Items"));

// per-task NON_CANONICAL fixtures (a3, MANDATORY): exercise the parser's
// attunement SHAPE canonicalization (legacy boolean/string → {required[, restriction]})
// and unknown-key→raw bucketing, WITHOUT enrich-style defaulting of source/attunement/curse.
const NON_CANONICAL: { name: string; body: string }[] = [
  { name: "minimal", body: "name: Cloak\ntype: wondrous" },
  { name: "legacy-attunement-bool", body: "name: Ring\nattunement: true" },        // → {required:true} (canonicalize, not default)
  { name: "legacy-attunement-string", body: "name: Staff\nattunement: by a druid" }, // → {required:true, restriction:"by a druid"}
  { name: "requires-attunement-promote", body: "name: Wand\nrequires_attunement: true" }, // legacy top-level promotes to {required:true}
  { name: "unknown-key-to-raw", body: "name: Orb\ntype: wondrous\nbogus_key: keep" },     // unknown key → entity.raw bucket
];

function bodyFromMd(md: string): string {
  // entity .md files store a single fenced ```item block; extract its body.
  const m = md.match(/```item\n([\s\S]*?)```/);
  return m ? m[1] : md;
}

beforeAll(() => installObsidianDomHelpers());

describe("item port equivalence", () => {
  const cases: { name: string; body: string }[] = [];
  for (const dir of SRD_DIRS) {
    let files: string[] = [];
    try { files = readdirSync(dir).filter((f) => f.endsWith(".md")); } catch { /* dir may not exist */ }
    for (const f of files) cases.push({ name: `${dir}/${f}`, body: bodyFromMd(readFileSync(join(dir, f), "utf8")) });
  }

  it("has corpus coverage", () => { expect(cases.length).toBeGreaterThan(0); });
  it("has mandatory non-canonical fixtures", () => { expect(NON_CANONICAL.length).toBeGreaterThan(0); }); // N3

  // (a1) parse-data equivalence — THE load-bearing check: codec.parse(doc) deep-equals legacy parseItem(body)
  it.each([...cases, ...NON_CANONICAL])("(a1) parse-data equal: $name", ({ body }) => {
    const viaCodec = itemCodec.parse({ type: "item", frontmatter: {}, body, raw: body });
    const viaLegacy = parseItem(body);
    expect(viaCodec.success).toBe(viaLegacy.success);
    if (viaCodec.success && viaLegacy.success) expect(viaCodec.data).toEqual(viaLegacy.data);
  });

  // (a2) render smoke via the module's REAL render (B1 — uniform across sync/async/stub renderers;
  // since (a1) proves data identity, this only asserts the moved type doesn't break the renderer's shape access)
  it.each(cases)("(a2) module render does not throw: $name", ({ body }) => {
    const parsed = itemCodec.parse({ type: "item", frontmatter: {}, body, raw: body });
    if (!parsed.success) return;
    const host = document.createElement("div");
    const ctx = { plugin: undefined, ctx: null } as unknown as RenderContext;
    expect(() => itemModule.render(host, parsed.data, ctx)).not.toThrow();
  });

  // (d) parse-idempotence: parse(serialize(parse(x))) deep-equals parse(x)
  it.each(cases)("(d) idempotent: $name", ({ body }) => {
    const first = itemCodec.parse({ type: "item", frontmatter: {}, body, raw: body });
    if (!first.success) return;
    const round = itemCodec.parse({ type: "item", frontmatter: {}, body: itemCodec.serialize(first.data), raw: "" });
    expect(round.success).toBe(true);
    if (round.success) expect(round.data).toEqual(first.data);
  });

  // (c) edit/save derived-absent: enrichItem defaults source:"Homebrew" + attunement??false + curse:false;
  // the codec (parseItem) canonicalizes attunement SHAPE but must NOT default any of those.
  it("(c) item codec omits enrich-derived source/attunement/curse when absent", () => {
    const parsed = itemCodec.parse({ type: "item", frontmatter: {}, body: "name: Cloak\ntype: wondrous", raw: "" });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const data = parsed.data as Record<string, unknown>;
    expect(data.attunement).toBeUndefined();
    expect(data.source).toBeUndefined();
    expect(data.curse).toBeUndefined();
  });

  it("(c) item codec canonicalizes legacy attunement shape WITHOUT defaulting (intended normalization)", () => {
    const parsed = itemCodec.parse({ type: "item", frontmatter: {}, body: "name: Ring\nattunement: true", raw: "" });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect((parsed.data as Record<string, unknown>).attunement).toEqual({ required: true });
  });

  it("(c) itemCodec.parse is NOT enrichItem (proves no derived defaults on the codec path)", () => {
    const parsed = itemCodec.parse({ type: "item", frontmatter: {}, body: "name: Cloak", raw: "" });
    const enriched = enrichItem({ name: "Cloak" });
    expect(enriched.attunement).toBe(false);    // enrich defaults
    expect(enriched.source).toBe("Homebrew");
    expect(enriched.curse).toBe(false);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const data = parsed.data as Record<string, unknown>;
    expect(data.attunement).toBeUndefined();
    expect(data.source).toBeUndefined();
    expect(data.curse).toBeUndefined();
  });

  // de-list guard: kernel pack declares item with the PACK codec (not the legacy bridge)
  it("dnd5ePack declares item with its pack codec", async () => {
    const { dnd5ePack } = await import("@archivist/dnd5e"); // S2: barrel, no ./pack subpath
    expect(dnd5ePack.entityTypes.some((et) => et.type === "item" && et.doc === itemCodec)).toBe(true);
  });
});
