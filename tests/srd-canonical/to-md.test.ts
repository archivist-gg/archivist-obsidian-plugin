import { describe, it, expect, afterEach } from "vitest";
import { writeMd, writeCompendiumIndex } from "../../tools/srd-canonical/to-md";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

let tmpdir: string;

describe("writeMd", () => {
  afterEach(() => {
    if (tmpdir) fs.rmSync(tmpdir, { recursive: true, force: true });
  });

  it("writes a complete MD file with frontmatter + body", () => {
    tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), "to-md-"));
    writeMd(tmpdir, {
      kind: "feat",
      edition: "2014",
      compendium: "SRD 5e",
      data: {
        slug: "alert",
        name: "Alert",
        edition: "2014",
        source: "SRD 5.1",
        category: "general",
        description: "Always on watch.",
        prerequisites: [],
        benefits: ["+5 to initiative"],
        repeatable: false,
      },
    });
    const expected = path.join(tmpdir, "Feats", "Alert.md");
    expect(fs.existsSync(expected)).toBe(true);
    const content = fs.readFileSync(expected, "utf8");
    expect(content).toContain("---\n");
    expect(content).toContain("compendium: SRD 5e");
    expect(content).toContain("```feat\n");
    expect(content).toContain("slug: alert");
  });

  it("rewrites cross-refs in string fields", () => {
    tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), "to-md-"));
    writeMd(tmpdir, {
      kind: "spell",
      edition: "2014",
      compendium: "SRD 5e",
      data: {
        slug: "magic-missile",
        name: "Magic Missile",
        description: "Deals {@damage 1d4+1} force damage.",
      },
    });
    const content = fs.readFileSync(path.join(tmpdir, "Spells", "Magic Missile.md"), "utf8");
    expect(content).toContain("`d:1d4+1`");
  });

  it("sanitizes filenames containing path separators", () => {
    tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), "to-md-"));
    writeMd(tmpdir, {
      kind: "item",
      edition: "2014",
      compendium: "SRD 5e",
      data: { slug: "weird", name: "A/B?" },
    });
    expect(fs.existsSync(path.join(tmpdir, "Magic Items", "A_B_.md"))).toBe(true);
  });

  it("writeCompendiumIndex emits a valid index file", () => {
    tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), "compendium-index-"));
    writeCompendiumIndex(tmpdir, "SRD 5e", "2014", "1.2.3");
    const content = fs.readFileSync(path.join(tmpdir, "_compendium.md"), "utf8");
    expect(content).toContain("name: SRD 5e");
    expect(content).toContain("edition: '2014'");
    expect(content).toContain("archivist_compendium_version: 1.2.3");
    expect(content).toContain("# SRD 5e");
  });
});
