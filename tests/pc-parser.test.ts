import { describe, it, expect } from "vitest";
import { parsePC, extractPCCodeBlock } from "../src/modules/pc/pc.parser";

const VALID_YAML = `
name: Grendal
edition: "2014"
race: "[[hill-folk]]"
subrace: null
background: "[[drifter]]"
class:
  - name: "[[bladesworn]]"
    level: 3
    subclass: null
    choices: {}
abilities:
  str: 10
  dex: 14
  con: 12
  int: 10
  wis: 13
  cha: 8
ability_method: manual
state:
  hp: { current: 24, max: 24, temp: 0 }
`;

const FILE_WITH_PC_BLOCK = [
  "---",
  "archivist-type: pc",
  "---",
  "",
  "```pc",
  "name: Grendal",
  "edition: \"2014\"",
  "class:",
  "  - name: \"[[bladesworn]]\"",
  "    level: 1",
  "    subclass: null",
  "    choices: {}",
  "abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }",
  "ability_method: manual",
  "state:",
  "  hp: { current: 8, max: 8, temp: 0 }",
  "```",
  "",
  "## Backstory",
  "",
  "Grendal hails from the hill country.",
].join("\n");

describe("parsePC", () => {
  it("parses a valid minimal character", () => {
    const r = parsePC(VALID_YAML);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.name).toBe("Grendal");
      expect(r.data.class[0].level).toBe(3);
    }
  });

  it("returns a descriptive error for malformed YAML", () => {
    const r = parsePC("name: Grendal\n  bad indent: x");
    expect(r.success).toBe(false);
  });

  it("returns a path-scoped error for schema violations", () => {
    const r = parsePC(`
name: Grendal
edition: "1984"
class: [{ name: "x", level: 1, subclass: null, choices: {} }]
abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }
ability_method: manual
state: { hp: { current: 1, max: 1, temp: 0 } }
`);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.toLowerCase()).toContain("edition");
  });

  it("rejects empty input", () => {
    expect(parsePC("").success).toBe(false);
  });
});

describe("extractPCCodeBlock", () => {
  it("extracts the pc code block body", () => {
    const r = extractPCCodeBlock(FILE_WITH_PC_BLOCK);
    expect(r).not.toBeNull();
    if (r) {
      expect(r.yaml).toContain("name: Grendal");
      expect(r.yaml).toContain("ability_method: manual");
      expect(r.yaml).not.toContain("Backstory");
    }
  });

  it("returns null when no pc block is present", () => {
    const file = "---\narchivist-type: pc\n---\n\nJust prose.\n";
    expect(extractPCCodeBlock(file)).toBeNull();
  });

  it("ignores non-pc fenced blocks", () => {
    const file = "```ts\nconst x = 1;\n```\n";
    expect(extractPCCodeBlock(file)).toBeNull();
  });

  it("records 1-indexed start and end lines", () => {
    const r = extractPCCodeBlock(FILE_WITH_PC_BLOCK);
    expect(r?.startLine).toBe(5);
    expect(r?.endLine).toBeGreaterThan(r?.startLine ?? 0);
  });
});
