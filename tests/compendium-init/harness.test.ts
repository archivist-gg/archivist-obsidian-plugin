import { describe, it, expect } from "vitest";
import { TFile, TFolder } from "obsidian";
import { makeHarness } from "./harness";

describe("harness · index lag model", () => {
  it("an adapter write is on disk but NOT in the index or the cache until reindex()", async () => {
    const h = makeHarness({ "Compendium/SRD 5e/_compendium.md": "---\na: 1\n---\n" });
    await h.vault.adapter.write("Compendium/SRD 5e/Races/Dwarf.md", "new");
    expect(h.files.get("Compendium/SRD 5e/Races/Dwarf.md")).toBe("new");
    expect(h.vault.getAbstractFileByPath("Compendium/SRD 5e/Races/Dwarf.md")).toBeNull();
    h.reindex();
    expect(h.vault.getAbstractFileByPath("Compendium/SRD 5e/Races/Dwarf.md")).toBeInstanceOf(TFile);
  });

  it("an adapter overwrite of an indexed file leaves cachedRead STALE until reindex(), while read() sees the disk", async () => {
    const h = makeHarness({ "Compendium/SRD 5e/_compendium.md": "old" });
    const f = h.fileOf("Compendium/SRD 5e/_compendium.md")!;
    await h.vault.adapter.write(f.path, "new");
    expect(await h.vault.cachedRead(f)).toBe("old");
    expect(await h.vault.read(f)).toBe("new");
    h.reindex();
    expect(await h.vault.cachedRead(h.fileOf(f.path)!)).toBe("new");
  });

  it("vault.process updates disk AND cache immediately and logs a process event", async () => {
    const h = makeHarness({ "Compendium/SRD 5e/_compendium.md": "old" });
    const f = h.fileOf("Compendium/SRD 5e/_compendium.md")!;
    await h.vault.process(f, (d) => d + "+");
    expect(await h.vault.cachedRead(f)).toBe("old+");
    expect(h.log).toEqual([{ kind: "process", path: f.path }]);
  });

  it("trashFile removes the file from disk, cache, index and its parent's children, logs a trash event, and can be told to throw", async () => {
    const h = makeHarness({ "Compendium/SRD 5e/Races/Dwarf.md": "x", "Compendium/SRD 5e/Races/Elf.md": "y" });
    const dwarf = h.fileOf("Compendium/SRD 5e/Races/Dwarf.md")!;
    await h.fileManager.trashFile(dwarf);
    expect(h.files.has(dwarf.path)).toBe(false);
    expect(h.vault.getAbstractFileByPath(dwarf.path)).toBeNull();
    const races = h.vault.getAbstractFileByPath("Compendium/SRD 5e/Races");
    expect(races).toBeInstanceOf(TFolder);
    expect((races as TFolder).children.map((c) => c.name)).toEqual(["Elf.md"]);
    expect(h.log).toEqual([{ kind: "trash", path: dwarf.path }]);
    h.trashThrowsFor("Compendium/SRD 5e/Races/Elf.md");
    await expect(h.fileManager.trashFile(h.fileOf("Compendium/SRD 5e/Races/Elf.md")!)).rejects.toThrow("trash refused");
  });

  it("the index tree carries names, extensions and parents", () => {
    const h = makeHarness({ "Compendium/SRD 5e/Races/Dwarf.md": "x" });
    const f = h.fileOf("Compendium/SRD 5e/Races/Dwarf.md")!;
    expect(f.name).toBe("Dwarf.md");
    expect(f.extension).toBe("md");
    expect(f.basename).toBe("Dwarf");
    expect(f.parent?.path).toBe("Compendium/SRD 5e/Races");
    expect(f.parent?.parent?.path).toBe("Compendium/SRD 5e");
  });

  it("adapterThrowsFor makes exactly that path's read or write reject, and null clears it", async () => {
    const h = makeHarness({ "Compendium/SRD 5e/_compendium.md": "x", "Compendium/SRD 5e/Races/Dwarf.md": "y" });
    h.adapterThrowsFor("read", "Compendium/SRD 5e/_compendium.md");
    await expect(h.vault.adapter.read("Compendium/SRD 5e/_compendium.md")).rejects.toThrow("EACCES");
    expect(await h.vault.adapter.read("Compendium/SRD 5e/Races/Dwarf.md")).toBe("y");
    h.adapterThrowsFor("read", null);
    expect(await h.vault.adapter.read("Compendium/SRD 5e/_compendium.md")).toBe("x");
    h.adapterThrowsFor("write", "Compendium/SRD 5e/Races/Elf.md");
    await expect(h.vault.adapter.write("Compendium/SRD 5e/Races/Elf.md", "z")).rejects.toThrow("disk full");
    expect(h.files.has("Compendium/SRD 5e/Races/Elf.md")).toBe(false);
    expect(h.log).toEqual([]);   // a refused write is not logged
  });
});
