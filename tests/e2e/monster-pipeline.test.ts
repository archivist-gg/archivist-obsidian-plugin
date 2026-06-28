import { describe, it, expect } from "vitest";
import { createArchivist } from "@archivist/core";
import type { StoragePort } from "@archivist/core";
import { dnd5ePack, monsterGeneratable, monsterCodec } from "@archivist/dnd5e";
import { generateToFile } from "@archivist/generators";

function memStorage(): StoragePort & { files: Record<string, string> } {
  const files: Record<string, string> = {};
  return { files, listFolder: async () => [], read: async (p) => files[p],
    write: async (p, t) => { files[p] = t; }, ensureFolder: async () => {}, exists: async (p) => p in files };
}

describe("monster pipeline (generate → file → parse → resolve)", () => {
  it("runs end-to-end through core + dnd5e + generators with no Obsidian", async () => {
    const storage = memStorage();
    const archivist = createArchivist({ storage, content: { lookup: () => undefined } });
    archivist.registerPack(dnd5ePack);

    const path = await generateToFile({
      generatable: monsterGeneratable, codec: monsterCodec,
      input: { name: "Goblin", cr: "1/4", size: "Small", type: "humanoid", alignment: "neutral evil" },
      folder: "Monsters", slug: "goblin", storage,
    });

    const doc = archivist.parseContainer(storage.files[path]);
    expect(doc.success).toBe(true);
    if (!doc.success) return;
    const resolved = archivist.resolve(doc.data) as any;
    expect(resolved.success).toBe(true);
    expect(resolved.data.name).toBe("Goblin");
    expect(resolved.data.proficiency_bonus).toBe(2);
  });
});
