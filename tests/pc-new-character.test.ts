import { describe, it, expect, vi } from "vitest";
import { PCModule } from "../src/modules/pc/pc.module";
import { VIEW_TYPE_PC } from "../src/modules/pc/pc.view";

// createNewCharacter is private; cast to reach it directly. This is the lightest
// way to exercise the real method without standing up a full CoreAPI just to
// drive it through the registered command callback.
type CreateNew = { createNewCharacter: (plugin: unknown) => Promise<void> };

// A fake host plugin. NOTE: `metadataCache` is omitted entirely — if
// createNewCharacter ever regresses to a cache-dependent open path (consulting
// shouldRenderAsPC / getCache for the brand-new file), this fake would throw and
// the test would surface it. The metadata-cache race is exactly the bug here.
function makeFakeHost(opts: {
  // paths the vault reports as already existing
  existingPaths?: string[];
} = {}) {
  const existing = new Set(opts.existingPaths ?? []);
  const leaf = {
    setViewState: vi.fn(async () => undefined),
    openFile: vi.fn(async () => undefined),
  };
  const vault = {
    getAbstractFileByPath: vi.fn((p: string) => (existing.has(p) ? ({ path: p } as unknown) : null)),
    createFolder: vi.fn(async () => undefined),
    create: vi.fn(async (path: string, _body: string) => ({ path })),
  };
  const plugin = {
    settings: { playerCharactersFolder: "PlayerCharacters" },
    app: {
      vault,
      workspace: {
        getLeaf: vi.fn(() => leaf),
      },
    },
  };
  return { plugin, leaf, vault };
}

describe("PCModule.createNewCharacter", () => {
  it("creates the draft and opens it directly as the PC view (no metadata-cache dependency)", async () => {
    const mod = new PCModule();
    const { plugin, leaf, vault } = makeFakeHost();

    await (mod as unknown as CreateNew).createNewCharacter(plugin);

    // 1. The draft file is created once at the expected path with pc frontmatter.
    expect(vault.create).toHaveBeenCalledTimes(1);
    const [createdPath, createdBody] = vault.create.mock.calls[0];
    expect(createdPath).toBe("PlayerCharacters/Untitled Character.md");
    expect(createdBody).toContain("archivist-type: pc");

    // 2. The leaf is put into the PC view directly — independent of the cache.
    expect(leaf.setViewState).toHaveBeenCalledTimes(1);
    expect(leaf.setViewState).toHaveBeenCalledWith(
      expect.objectContaining({
        type: VIEW_TYPE_PC,
        state: expect.objectContaining({ file: "PlayerCharacters/Untitled Character.md" }),
      }),
    );

    // 3. openFile is NOT used (it would route through the cache-dependent interceptor).
    expect(leaf.openFile).not.toHaveBeenCalled();
  });

  it("picks the next unique name when the default path is taken", async () => {
    const mod = new PCModule();
    // Folder exists and the default file exists; the " 2" variant is free.
    const { plugin, vault } = makeFakeHost({
      existingPaths: ["PlayerCharacters", "PlayerCharacters/Untitled Character.md"],
    });

    await (mod as unknown as CreateNew).createNewCharacter(plugin);

    expect(vault.create).toHaveBeenCalledTimes(1);
    expect(vault.create.mock.calls[0][0]).toBe("PlayerCharacters/Untitled Character 2.md");
  });
});
