import { describe, it, expect } from "vitest";
import { TFile, TFolder } from "obsidian";
import { makeHarness } from "./harness";

describe("harness · index lag model", () => {
  it("an adapter write is on disk and readable, but reaches neither the index nor the cachedRead cache until reindex()", async () => {
    const h = makeHarness({ "Compendium/SRD 5e/_compendium.md": "---\na: 1\n---\n" });
    await h.vault.adapter.write("Compendium/SRD 5e/Races/Dwarf.md", "new");
    expect(h.files.get("Compendium/SRD 5e/Races/Dwarf.md")).toBe("new");
    expect(await h.vault.adapter.read("Compendium/SRD 5e/Races/Dwarf.md")).toBe("new");
    expect(h.vault.getAbstractFileByPath("Compendium/SRD 5e/Races/Dwarf.md")).toBeNull();
    // The cache half: an unindexed path has no TFile handle at all, so cachedRead cannot be
    // called on it. fileOf() returning null IS the cache miss, and the reindexed handle's
    // cachedRead is what proves the cache was filled from the disk.
    expect(h.fileOf("Compendium/SRD 5e/Races/Dwarf.md")).toBeNull();
    h.reindex();
    expect(h.vault.getAbstractFileByPath("Compendium/SRD 5e/Races/Dwarf.md")).toBeInstanceOf(TFile);
    expect(h.fileOf("Compendium/SRD 5e/Races/Dwarf.md")).not.toBeNull();
    expect(await h.vault.cachedRead(h.fileOf("Compendium/SRD 5e/Races/Dwarf.md")!)).toBe("new");
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

  it("vault.process updates the cachedRead cache immediately and logs a process event", async () => {
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

  it("vault.process writes the new content to the DISK, not only to the cache", async () => {
    const h = makeHarness({ "Compendium/SRD 5e/_compendium.md": "old" });
    const f = h.fileOf("Compendium/SRD 5e/_compendium.md")!;
    await h.vault.process(f, (d) => d + "+");
    expect(h.files.get(f.path)).toBe("old+");
    expect(await h.vault.read(f)).toBe("old+");
    expect(await h.vault.adapter.read(f.path)).toBe("old+");
  });

  it("adapter.exists is true for the vault root, an initial file, an ancestor folder and a folder a write created, and false for a path with nothing at it", async () => {
    const h = makeHarness({ "Compendium/SRD 5e/Races/Dwarf.md": "x" });
    expect(await h.vault.adapter.exists("")).toBe(true);
    expect(await h.vault.adapter.exists("Compendium/SRD 5e/Races/Dwarf.md")).toBe(true);
    expect(await h.vault.adapter.exists("Compendium/SRD 5e/Races")).toBe(true);
    expect(await h.vault.adapter.exists("Compendium/SRD 5e/Classes")).toBe(false);
    await h.vault.adapter.write("Compendium/SRD 5e/Classes/Bard.md", "y");
    expect(await h.vault.adapter.exists("Compendium/SRD 5e/Classes")).toBe(true);
    expect(await h.vault.adapter.exists("Compendium/SRD 5e/Races/Elf.md")).toBe(false);
  });

  it("adapter.mkdir makes exactly that path exist", async () => {
    const h = makeHarness({ "Compendium/SRD 5e/Races/Dwarf.md": "x" });
    expect(await h.vault.adapter.exists("Compendium/SRD 5e/Feats")).toBe(false);
    await h.vault.adapter.mkdir("Compendium/SRD 5e/Feats");
    expect(await h.vault.adapter.exists("Compendium/SRD 5e/Feats")).toBe(true);
    expect(h.folders.has("Compendium/SRD 5e/Feats")).toBe(true);
  });

  it("adapter.list returns the DIRECT child files and folders of a path, never a deeper descendant or the path itself, and does the same for the root", async () => {
    const h = makeHarness({
      "Compendium/SRD 5e/_compendium.md": "i",
      "Compendium/SRD 5e/Races/Dwarf.md": "x",
      "Compendium/SRD 5e/Races/Subraces/Hill Dwarf.md": "d",
      "Loose/Orphan.md": "o",
    });
    const listed = await h.vault.adapter.list("Compendium/SRD 5e");
    expect(listed.files).toEqual(["Compendium/SRD 5e/_compendium.md"]);
    expect(listed.folders).toEqual(["Compendium/SRD 5e/Races"]);
    const races = await h.vault.adapter.list("Compendium/SRD 5e/Races");
    expect(races.files).toEqual(["Compendium/SRD 5e/Races/Dwarf.md"]);
    expect(races.folders).toEqual(["Compendium/SRD 5e/Races/Subraces"]);
    const root = await h.vault.adapter.list("");
    expect(root.files).toEqual([]);
    expect([...root.folders].sort()).toEqual(["Compendium", "Loose"]);
  });

  it("the action log is ONE chronological log across kinds: a write, a process, a trash and a second write land in the order they happened", async () => {
    const h = makeHarness({
      "Compendium/SRD 5e/_compendium.md": "index",
      "Compendium/SRD 5e/Races/Dwarf.md": "x",
      "Compendium/SRD 5e/Races/Orphan.md": "o",
    });
    await h.vault.adapter.write("Compendium/SRD 5e/Races/Elf.md", "e");
    await h.vault.process(h.fileOf("Compendium/SRD 5e/_compendium.md")!, (d) => d + "!");
    await h.fileManager.trashFile(h.fileOf("Compendium/SRD 5e/Races/Orphan.md")!);
    await h.vault.adapter.write("Compendium/SRD 5e/Races/Halfling.md", "hf");
    expect(h.log).toEqual([
      { kind: "write", path: "Compendium/SRD 5e/Races/Elf.md" },
      { kind: "process", path: "Compendium/SRD 5e/_compendium.md" },
      { kind: "trash", path: "Compendium/SRD 5e/Races/Orphan.md" },
      { kind: "write", path: "Compendium/SRD 5e/Races/Halfling.md" },
    ]);
  });
});
