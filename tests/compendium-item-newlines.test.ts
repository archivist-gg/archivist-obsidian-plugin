import { describe, it, expect } from "vitest";
import yaml from "js-yaml";
import bundle from "../.compendium-bundle/index.json";

const items = Object.entries(bundle as Record<string, string>).filter(([k]) =>
  k.startsWith("SRD 5e/Magic Items/"),
);

describe("compendium bundle 2014 item descriptions", () => {
  it("no loaded item description contains a literal backslash-n", () => {
    for (const [key, md] of items) {
      const m = md.match(/```item\n([\s\S]*?)\n```/);
      if (!m) continue;
      const data = yaml.load(m[1]) as { description?: unknown };
      if (typeof data.description === "string") {
        expect(data.description, key).not.toContain("\\n");
      }
    }
  });
  it("previously-correct double-quoted items still load to real newlines", () => {
    const holding = items.find(([k]) => k === "SRD 5e/Magic Items/Bag of Holding.md");
    expect(holding).toBeDefined();
    const data = yaml.load(holding![1].match(/```item\n([\s\S]*?)\n```/)![1]) as { description: string };
    expect(data.description).toContain("\n");
    expect(data.description).not.toContain("\\n");
  });
});
