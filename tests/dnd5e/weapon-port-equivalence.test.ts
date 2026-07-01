// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { installObsidianDomHelpers } from "../fixtures/pc/dom-helpers"; // S1: real path (used by monster-render-equivalence.test.ts:9)
import type { RenderContext } from "../../packages/obsidian/src/core/module-api";
import { weaponCodec } from "@archivist/dnd5e/weapon/weapon.codec";
import { parseWeapon } from "@archivist/dnd5e/weapon/weapon.parser"; // moved parser (post-move path)
import { weaponModule } from "../../packages/obsidian/src/modules/weapon/weapon.module"; // (a2) uses the module's real render (B1)

const SRD_DIRS = ["SRD 5e", "SRD 2024"].map((d) => join(".compendium-bundle", d, "Weapons"));

// A schema-valid weapon body with only the required fields. NON_CANONICAL
// fixtures extend it to exercise the parser's special cases.
const VALID_WEAPON = [
  "name: Equiv Test Weapon",
  "slug: equiv-test-weapon",
  "edition: '2014'",
  "category: martial-melee",
  "damage:",
  "  dice: 1d8",
  "  type: slashing",
].join("\n");

// (a3-i) a weapon whose `properties[]` holds embedded-data strings the parser
// LIFTS into structured fields (weapon.parser.ts:43-95): `versatile (1d10)` →
// property "versatile" + damage.versatile_dice; `thrown (range 20/60)` →
// property "thrown" + range{normal,long}; bare flags pass through.
const LIFTING_FIXTURE = [
  VALID_WEAPON,
  "properties:",
  "  - finesse",
  "  - light",
  "  - versatile (1d10)",
  "  - thrown (range 20/60)",
].join("\n");

// per-task NON_CANONICAL fixtures (a3, MANDATORY): (i) embedded-string
// properties the parser lifts (idempotence proven by the focused test below);
// (ii) an unknown top-level key captured into entity.raw identically on both
// paths; (iii) `properties` omitted → the zod schema injects the `[]` default
// identically on both paths.
const NON_CANONICAL: { name: string; body: string }[] = [
  // (a3-i) embedded-string properties → lifted into structured fields.
  { name: "embedded-string properties (lifted)", body: LIFTING_FIXTURE },
  // (a3-ii) unknown top-level key → captured into entity.raw on both paths.
  { name: "unknown top-level key (raw-capture)", body: `${VALID_WEAPON}\nunexpected_top_level: should be captured\n` },
  // (a3-iii) properties omitted → schema default `[]` injected on both paths.
  { name: "properties omitted (default [])", body: `${VALID_WEAPON}\n` },
];

function bodyFromMd(md: string): string {
  // entity .md files store a single fenced ```weapon block; extract its body.
  const m = md.match(/```weapon\n([\s\S]*?)```/);
  return m ? m[1] : md;
}

beforeAll(() => installObsidianDomHelpers());

describe("weapon port equivalence", () => {
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

  // (a1) parse-data equivalence — THE load-bearing check: codec.parse(doc) deep-equals legacy parseWeapon(body)
  it.each([...cases, ...NON_CANONICAL])("(a1) parse-data equal: $name", ({ body }) => {
    const viaCodec = weaponCodec.parse({ type: "weapon", frontmatter: {}, body, raw: body });
    const viaLegacy = parseWeapon(body);
    expect(viaCodec.success).toBe(viaLegacy.success);
    if (viaCodec.success && viaLegacy.success) expect(viaCodec.data).toEqual(viaLegacy.data);
  });

  // (a2) render smoke via the module's REAL render (B1 — uniform across sync/async/stub renderers;
  // since (a1) proves data identity, this only asserts the moved type doesn't break the renderer's shape access)
  it.each(cases)("(a2) module render does not throw: $name", ({ body }) => {
    const parsed = weaponCodec.parse({ type: "weapon", frontmatter: {}, body, raw: body });
    if (!parsed.success) return;
    const host = document.createElement("div");
    const ctx = { plugin: undefined, ctx: null } as unknown as RenderContext;
    expect(() => weaponModule.render(host, parsed.data, ctx)).not.toThrow();
  });

  // (d) parse-idempotence: parse(serialize(parse(x))) deep-equals parse(x)
  it.each(cases)("(d) idempotent: $name", ({ body }) => {
    const first = weaponCodec.parse({ type: "weapon", frontmatter: {}, body, raw: body });
    if (!first.success) return;
    const round = weaponCodec.parse({ type: "weapon", frontmatter: {}, body: weaponCodec.serialize(first.data), raw: "" });
    expect(round.success).toBe(true);
    if (round.success) expect(round.data).toEqual(first.data);
  });

  // (a3-i focus) embedded-string property lifting is idempotent (brief Task 9):
  // the first parse lifts "versatile (1d10)"/"thrown (range 20/60)" into
  // structured fields, leaving plain flags in `properties`; re-parsing the
  // serialized form (now plain flags) yields identical data.
  it("(a3-i) embedded-string property lifting is idempotent", () => {
    const first = weaponCodec.parse({ type: "weapon", frontmatter: {}, body: LIFTING_FIXTURE, raw: LIFTING_FIXTURE });
    expect(first.success).toBe(true);
    if (!first.success) return;
    expect(first.data.properties).toEqual(["finesse", "light", "versatile", "thrown"]);
    expect(first.data.damage.versatile_dice).toBe("1d10");
    expect(first.data.range).toEqual({ normal: 20, long: 60 });
    const round = weaponCodec.parse({ type: "weapon", frontmatter: {}, body: weaponCodec.serialize(first.data), raw: "" });
    expect(round.success).toBe(true);
    if (round.success) expect(round.data).toEqual(first.data);
  });

  // de-list guard: kernel pack declares weapon with the PACK codec (not the legacy bridge)
  it("dnd5ePack declares weapon with its pack codec", async () => {
    const { dnd5ePack } = await import("@archivist/dnd5e"); // S2: barrel, no ./pack subpath
    expect(dnd5ePack.entityTypes.some((et) => et.type === "weapon" && et.doc === weaponCodec)).toBe(true);
  });
});
