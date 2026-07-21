import { describe, it, expect } from "vitest";
import {
  readFrontmatterValue,
  spliceFrontmatterKey,
} from "../packages/obsidian/src/modules/pc/pc.frontmatter";

const FM = [
  "---",
  "archivist: true",
  "archivist-type: pc",
  "# a comment obsidian users sometimes add",
  "slug: grendal",
  "---",
  "",
  "```pc",
  "name: Grendal",
  "```",
  "tail",
].join("\n");

describe("readFrontmatterValue", () => {
  it("returns null when key absent / no fence / empty value", () => {
    expect(readFrontmatterValue(FM, "archivist-portrait")).toBeNull();
    expect(readFrontmatterValue("no fence here", "slug")).toBeNull();
    expect(readFrontmatterValue("---\nslug:\n---\n", "slug")).toBeNull();
  });
  it("reads bare, double-quoted (unescaped) and single-quoted scalars", () => {
    expect(readFrontmatterValue(FM, "slug")).toBe("grendal");
    const q = FM.replace("slug: grendal", 'slug: "a \\"b\\" \\\\ c"');
    expect(readFrontmatterValue(q, "slug")).toBe('a "b" \\ c');
    const s = FM.replace("slug: grendal", "slug: 'it''s'");
    expect(readFrontmatterValue(s, "slug")).toBe("it's");
  });
  it("does not read keys outside the fence", () => {
    const trick = FM + "\narchivist-portrait: \"[[x.png]]\"";
    expect(readFrontmatterValue(trick, "archivist-portrait")).toBeNull();
  });
  it("reads the FIRST occurrence of a duplicated key", () => {
    const dup = FM.replace("slug: grendal", "slug: first\nslug: second");
    expect(readFrontmatterValue(dup, "slug")).toBe("first");
  });
});

describe("spliceFrontmatterKey", () => {
  it("returns null for a fenceless file", () => {
    expect(spliceFrontmatterKey("just text", "k", "v")).toBeNull();
  });
  it("ADD inserts immediately before the closing fence, preserving every other byte", () => {
    const out = spliceFrontmatterKey(FM, "archivist-portrait", "[[Art/a.png]]")!;
    const lines = out.split("\n");
    expect(lines[5]).toBe('archivist-portrait: "[[Art/a.png]]"');
    expect(lines[6]).toBe("---");
    // Everything else untouched (comment included).
    expect(out).toContain("# a comment obsidian users sometimes add");
    expect(out.endsWith("tail")).toBe(true);
    expect(readFrontmatterValue(out, "archivist-portrait")).toBe("[[Art/a.png]]");
  });
  it("REPLACE swaps the line in place and keeps key order", () => {
    const once = spliceFrontmatterKey(FM, "archivist-portrait", "[[a.png]]")!;
    const twice = spliceFrontmatterKey(once, "archivist-portrait", "[[b.png]]")!;
    expect(twice.split("\n").length).toBe(once.split("\n").length);
    expect(readFrontmatterValue(twice, "archivist-portrait")).toBe("[[b.png]]");
  });
  it("REMOVE deletes the line entirely; removing an absent key is a no-op", () => {
    const once = spliceFrontmatterKey(FM, "archivist-portrait", "[[a.png]]")!;
    const gone = spliceFrontmatterKey(once, "archivist-portrait", null)!;
    expect(gone).toBe(FM);
    expect(spliceFrontmatterKey(FM, "archivist-portrait", null)).toBe(FM);
  });
  it("escapes quotes and backslashes symmetrically with read", () => {
    const out = spliceFrontmatterKey(FM, "k", 'a "b" \\ c')!;
    expect(out).toContain('k: "a \\"b\\" \\\\ c"');
    expect(readFrontmatterValue(out, "k")).toBe('a "b" \\ c');
  });
  it("replace-first-remove-rest on duplicated keys", () => {
    const dup = FM.replace("slug: grendal", "slug: first\nslug: second");
    const out = spliceFrontmatterKey(dup, "slug", "only")!;
    expect(out.match(/^slug:/gm)!.length).toBe(1);
    expect(readFrontmatterValue(out, "slug")).toBe("only");
  });
  it("replaces a hand-edited block value conservatively (drops continuations)", () => {
    const block = FM.replace("slug: grendal", "slug:\n  nested: 1\n  more: 2");
    const out = spliceFrontmatterKey(block, "slug", "flat")!;
    expect(out).not.toContain("nested: 1");
    expect(readFrontmatterValue(out, "slug")).toBe("flat");
  });
  it("CRLF input round-trips without corruption (LF-normalized like spliceCodeBlock)", () => {
    const crlf = FM.replace(/\n/g, "\r\n");
    const out = spliceFrontmatterKey(crlf, "archivist-portrait", "[[a.png]]")!;
    expect(readFrontmatterValue(out, "archivist-portrait")).toBe("[[a.png]]");
    expect(out).toContain("```pc");
  });
});
