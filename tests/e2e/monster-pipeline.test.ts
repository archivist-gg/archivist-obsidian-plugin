import { describe, it, expect } from "vitest";
import { createArchivist } from "@archivist-gg/core";
import type { StoragePort } from "@archivist-gg/core";
import { dnd5ePack, monsterGeneratable, monsterCodec } from "@archivist-gg/dnd5e";

function memStorage(): StoragePort & { files: Record<string, string> } {
  const files: Record<string, string> = {};
  return { files, listFolder: async () => [], read: async (p) => files[p],
    write: async (p, t) => { files[p] = t; }, ensureFolder: async () => {}, exists: async (p) => p in files };
}

describe("monster pipeline (generate → file → parse → resolve)", () => {
  it("runs end-to-end through core + dnd5e with no Obsidian", async () => {
    const storage = memStorage();
    const archivist = createArchivist({ storage, content: { lookup: () => undefined } });
    archivist.registerPack(dnd5ePack);

    const input = { name: "Goblin", cr: "1/4", size: "Small", type: "humanoid", alignment: "neutral evil" };
    const body = monsterCodec.serialize(monsterGeneratable.enrich(input));
    const path = "Monsters/goblin.md";
    await storage.ensureFolder("Monsters");
    await storage.write(path, "```monster\n" + body + "```\n");

    const doc = archivist.parseContainer(storage.files[path]);
    expect(doc.success).toBe(true);
    if (!doc.success) return;
    const resolved = archivist.resolve(doc.data) as { success: boolean; data: { name: string; proficiency_bonus: number } };
    expect(resolved.success).toBe(true);
    expect(resolved.data.name).toBe("Goblin");
    expect(resolved.data.proficiency_bonus).toBe(2);
  });
});
