import { describe, it, expect } from "vitest";
import { PCModule } from "../src/modules/pc/pc.module";
import { VIEW_TYPE_PC } from "../src/modules/pc/pc.view";
import type { CoreAPI } from "../src/core/module-api";
import { EntityRegistry } from "../src/shared/entities/entity-registry";

// Minimal host-plugin stand-in that records setViewState calls and lets tests
// fire synthetic file-open events at the handler PCModule registers.
interface FakeLeaf {
  view?: { file?: { path: string }; getViewType?: () => string };
  setViewState: (state: { type: string; state?: unknown; active?: boolean }) => Promise<void>;
  lastSetViewState: { type: string; state?: unknown; active?: boolean } | null;
}

function makeLeaf(path?: string, viewType = "markdown"): FakeLeaf {
  const leaf: FakeLeaf = {
    view: path ? { file: { path }, getViewType: () => viewType } : undefined,
    lastSetViewState: null,
    async setViewState(state) { leaf.lastSetViewState = state; },
  };
  return leaf;
}

function makeHost(leaves: FakeLeaf[], frontmatter: Record<string, unknown> = { "archivist-type": "pc" }) {
  let fileOpenCb: ((file: unknown) => void) | null = null;
  const plugin = {
    registerView: () => {},
    registerEvent: () => {},
    app: {
      workspace: {
        on: (name: string, cb: (file: unknown) => void) => { if (name === "file-open") fileOpenCb = cb; return {}; },
        iterateAllLeaves: (cb: (leaf: FakeLeaf) => void) => { for (const l of leaves) cb(l); },
      },
      metadataCache: {
        getFileCache: () => ({ frontmatter }),
      },
    },
    settings: { playerCharactersFolder: "PlayerCharacters" },
  };
  return {
    plugin,
    fire: (file: { path: string; extension: string }) => fileOpenCb?.(file),
  };
}

describe("PCModule", () => {
  it("has the correct identity", () => {
    const m = new PCModule();
    expect(m.id).toBe("pc");
    expect(m.codeBlockType).toBe("pc");
    expect(m.entityType).toBe("pc");
  });

  it("register() assigns core, resolver; component registry exists", () => {
    const m = new PCModule();
    const core = { entities: new EntityRegistry() } as unknown as CoreAPI;
    m.register(core);
    expect(m.core).toBe(core);
    expect(m.resolver).not.toBeNull();
    expect(m.registry.size()).toBeGreaterThan(0);
  });

  it("parseYaml delegates to parsePC", () => {
    const m = new PCModule();
    const r = m.parseYaml("name: Grendal\nedition: '2014'\nclass: [{ name: x, level: 1, subclass: null, choices: {} }]\nabilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }\nability_method: manual\nstate: { hp: { current: 1, max: 1, temp: 0 } }");
    expect(r.success).toBe(true);
  });

  it("wireComponents registers all 19 components", () => {
    const m = new PCModule();
    const core = { entities: new EntityRegistry() } as unknown as CoreAPI;
    m.register(core);
    expect(m.registry.size()).toBe(19);
    for (const type of [
      "header-section", "ability-row", "combat-stats-row",
      "saves-panel", "senses-panel", "skills-panel", "proficiencies-panel",
      "class-block", "subclass-block", "race-block", "background-block", "feat-block",
      "actions-tab", "spells-tab", "inventory-tab",
      "features-tab", "background-tab", "notes-tab",
      "tabs-container",
    ]) {
      expect(m.registry.has(type)).toBe(true);
    }
  });

  it("isInPCFolder matches files under the configured folder (and its default)", () => {
    const m = new PCModule();
    expect(m.isInPCFolder("PlayerCharacters/Grendal.md", undefined)).toBe(true);
    expect(m.isInPCFolder("PlayerCharacters/Notes/Session-1.md", undefined)).toBe(true);
    expect(m.isInPCFolder("Compendium/SRD/Rogue.md", undefined)).toBe(false);
    expect(m.isInPCFolder("party/valeria.md", "party")).toBe(true);
    expect(m.isInPCFolder("other/thing.md", "party")).toBe(false);
  });

  it("empty playerCharactersFolder means match anything (degenerate but valid)", () => {
    const m = new PCModule();
    expect(m.isInPCFolder("anywhere.md", "")).toBe(true);
  });

  it("file-open listener swaps the leaf that is actually showing the file, not a fresh one", async () => {
    const m = new PCModule();
    const grendalLeaf = makeLeaf("PlayerCharacters/Grendal.md", "markdown");
    const otherLeaf = makeLeaf("Daily/2026-04-23.md", "markdown");
    const ghost = makeLeaf(undefined, "markdown");
    const host = makeHost([otherLeaf, ghost, grendalLeaf]);
    m.register({ entities: new EntityRegistry(), plugin: host.plugin } as unknown as CoreAPI);

    host.fire({ path: "PlayerCharacters/Grendal.md", extension: "md" });
    await Promise.resolve(); await Promise.resolve();

    expect(grendalLeaf.lastSetViewState?.type).toBe(VIEW_TYPE_PC);
    expect(otherLeaf.lastSetViewState).toBeNull();
    expect(ghost.lastSetViewState).toBeNull();
  });

  it("file-open listener no-ops when the target leaf is already PC view (no re-swap loop)", async () => {
    const m = new PCModule();
    const leaf = makeLeaf("PlayerCharacters/Grendal.md", VIEW_TYPE_PC);
    const host = makeHost([leaf]);
    m.register({ entities: new EntityRegistry(), plugin: host.plugin } as unknown as CoreAPI);

    host.fire({ path: "PlayerCharacters/Grendal.md", extension: "md" });
    await Promise.resolve();

    expect(leaf.lastSetViewState).toBeNull();
  });

  it("file-open listener skips files outside the PC folder", async () => {
    const m = new PCModule();
    const leaf = makeLeaf("Daily/Note.md", "markdown");
    const host = makeHost([leaf]);
    m.register({ entities: new EntityRegistry(), plugin: host.plugin } as unknown as CoreAPI);

    host.fire({ path: "Daily/Note.md", extension: "md" });
    await Promise.resolve();

    expect(leaf.lastSetViewState).toBeNull();
  });

  it("file-open listener skips when no leaf is currently showing the file (ghost path)", async () => {
    const m = new PCModule();
    const unrelated = makeLeaf("PlayerCharacters/Someone.md", "markdown");
    const host = makeHost([unrelated]);
    m.register({ entities: new EntityRegistry(), plugin: host.plugin } as unknown as CoreAPI);

    host.fire({ path: "PlayerCharacters/Grendal.md", extension: "md" });
    await Promise.resolve();

    expect(unrelated.lastSetViewState).toBeNull();
  });
});
