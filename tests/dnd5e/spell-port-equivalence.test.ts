// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { installObsidianDomHelpers } from "../fixtures/pc/dom-helpers"; // S1: real path (used by monster-render-equivalence.test.ts:9)
import type { RenderContext } from "../../packages/obsidian/src/core/module-api";
import { spellCodec } from "@archivist/dnd5e/spell/spell.codec";
import { parseSpell } from "@archivist/dnd5e/spell/spell.parser"; // moved parser (post-move path)
import { spellModule } from "../../packages/obsidian/src/modules/spell/spell.module"; // (a2) uses the module's real render (B1)
import { enrichSpell } from "@archivist/dnd5e/spell/spell.enrichment";

const SRD_DIRS = ["SRD 5e", "SRD 2024"].map((d) => join(".compendium-bundle", d, "Spells"));

// per-task NON_CANONICAL fixtures (a3, MANDATORY): exercise the parser's
// present-field-only coercion (no enrich-style defaulting of classes/concentration).
const NON_CANONICAL: { name: string; body: string }[] = [
  { name: "minimal", body: "name: Light\nlevel: 0" },
  { name: "no-classes-no-conc", body: "name: Mending\nlevel: 0\nschool: Transmutation\nduration: 1 minute" },
  { name: "body-meta", body: "name: Bless\nlevel: 1\nslug: bless\nedition: \"2014\"\nsource: SRD" }, // slug stripped, edition/source preserved
  { name: "unknown-field", body: "name: Bad\nlevel: 1\nbogus_key: 1" }, // parseSpell returns success:false
];

function bodyFromMd(md: string): string {
  // entity .md files store a single fenced ```spell block; extract its body.
  const m = md.match(/```spell\n([\s\S]*?)```/);
  return m ? m[1] : md;
}

beforeAll(() => installObsidianDomHelpers());

describe("spell port equivalence", () => {
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

  // (a1) parse-data equivalence — THE load-bearing check: codec.parse(doc) deep-equals legacy parseSpell(body)
  it.each([...cases, ...NON_CANONICAL])("(a1) parse-data equal: $name", ({ body }) => {
    const viaCodec = spellCodec.parse({ type: "spell", frontmatter: {}, body, raw: body });
    const viaLegacy = parseSpell(body);
    expect(viaCodec.success).toBe(viaLegacy.success);
    if (viaCodec.success && viaLegacy.success) expect(viaCodec.data).toEqual(viaLegacy.data);
  });

  // (a2) render smoke via the module's REAL render (B1 — uniform across sync/async/stub renderers;
  // since (a1) proves data identity, this only asserts the moved type doesn't break the renderer's shape access)
  it.each(cases)("(a2) module render does not throw: $name", ({ body }) => {
    const parsed = spellCodec.parse({ type: "spell", frontmatter: {}, body, raw: body });
    if (!parsed.success) return;
    const host = document.createElement("div");
    const ctx = { plugin: undefined, ctx: null } as unknown as RenderContext;
    expect(() => spellModule.render(host, parsed.data, ctx)).not.toThrow();
  });

  // (d) parse-idempotence: parse(serialize(parse(x))) deep-equals parse(x)
  it.each(cases)("(d) idempotent: $name", ({ body }) => {
    const first = spellCodec.parse({ type: "spell", frontmatter: {}, body, raw: body });
    if (!first.success) return;
    const round = spellCodec.parse({ type: "spell", frontmatter: {}, body: spellCodec.serialize(first.data), raw: "" });
    expect(round.success).toBe(true);
    if (round.success) expect(round.data).toEqual(first.data);
  });

  // (c) edit/save derived-absent: the codec output feeds renderEditMode (main.ts:572) + openCompendiumSave (:586).
  // enrichSpell guesses classes=["Wizard","Sorcerer"] + concentration-from-duration; the codec MUST NOT —
  // else edit→save would persist a guess into the authored .md (the corruption hazard).
  it("(c) spell codec omits enrich-derived classes/concentration when absent", () => {
    const parsed = spellCodec.parse({ type: "spell", frontmatter: {}, body: "name: Light\nlevel: 0\nschool: Evocation", raw: "" });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const data = parsed.data as Record<string, unknown>;
    expect(data.classes).toBeUndefined();
    expect(data.concentration).toBeUndefined();
  });

  it("(c) spellCodec.parse is NOT enrichSpell (proves no derived injection on the codec path)", () => {
    const parsed = spellCodec.parse({ type: "spell", frontmatter: {}, body: "name: Light\nlevel: 0", raw: "" });
    const enriched = enrichSpell({ name: "Light", level: 0 });
    expect(enriched.classes).toEqual(["Wizard", "Sorcerer"]); // enrich injects
    expect(enriched.concentration).toBe(false);                // enrich derives
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect((parsed.data as Record<string, unknown>).classes).toBeUndefined();       // codec does not
    expect((parsed.data as Record<string, unknown>).concentration).toBeUndefined();
  });

  // de-list guard: kernel pack declares spell with the PACK codec (not the legacy bridge)
  it("dnd5ePack declares spell with its pack codec", async () => {
    const { dnd5ePack } = await import("@archivist/dnd5e"); // S2: barrel, no ./pack subpath
    expect(dnd5ePack.entityTypes.some((et) => et.type === "spell" && et.doc === spellCodec)).toBe(true);
  });
});
