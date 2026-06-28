import { describe, it, expect } from "vitest";
import yaml from "js-yaml";
import { generateToFile } from "@archivist/generators";
import { monsterGeneratable, monsterCodec } from "@archivist/dnd5e";
import type { StoragePort } from "@archivist/core";

function memStorage(): StoragePort & { files: Record<string, string> } {
  const files: Record<string, string> = {};
  return { files,
    listFolder: async () => [], read: async (p) => files[p],
    write: async (p, t) => { files[p] = t; }, ensureFolder: async () => {}, exists: async (p) => p in files };
}

describe("generateToFile", () => {
  it("enriches input, serializes via the codec, and writes a typed code block", async () => {
    const s = memStorage();
    const out = await generateToFile({
      generatable: monsterGeneratable, codec: monsterCodec,
      input: { name: "Goblin", cr: "1/4", size: "Small", type: "humanoid", alignment: "neutral evil" },
      folder: "Monsters", slug: "goblin", storage: s,
    });
    expect(out).toBe("Monsters/goblin.md");
    const written = s.files[out];
    expect(written).toContain("```monster");
    const body = written.split("```monster\n")[1].split("```")[0];
    expect((yaml.load(body) as any).name).toBe("Goblin");
  });
});
