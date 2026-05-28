import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { WorkspaceLeaf } from "obsidian";
import { PCModule } from "../src/modules/pc/pc.module";
import { VIEW_TYPE_PC } from "../src/modules/pc/pc.view";
import type { CoreAPI } from "../src/core/module-api";
import { EntityRegistry } from "../src/shared/entities/entity-registry";

// Fake host plugin that satisfies the subset of the interface PCModule exercises.
// `register(cb)` stores the uninstaller so afterEach() can tear the monkey-patch
// down — essential because `around()` mutates WorkspaceLeaf.prototype, and without
// cleanup every subsequent test inherits a stale patch.
function makeHost(frontmatter: Record<string, unknown> | null = { "archivist-type": "pc" }) {
  const uninstallers: Array<() => void> = [];
  const plugin = {
    _loaded: true,
    registerView: () => {},
    register: (cb: () => void) => { uninstallers.push(cb); },
    app: {
      metadataCache: {
        getCache: () => (frontmatter ? { frontmatter } : null),
      },
    },
    settings: { playerCharactersFolder: "PlayerCharacters" },
  };
  return {
    plugin,
    teardown: () => { while (uninstallers.length) uninstallers.pop()!(); },
  };
}

// Track setViewState calls landing at the ORIGINAL prototype method (i.e. what
// Obsidian would have processed). The monkey-patch may rewrite the state before
// forwarding to the original, so reading this tells us what Obsidian "sees."
let originalCalls: Array<{ type: string; state?: unknown; active?: boolean }>;
let originalDetachCalls: number;
const originalSetViewState = WorkspaceLeaf.prototype.setViewState;
const originalDetach = (WorkspaceLeaf.prototype as unknown as { detach?: () => void }).detach;

beforeEach(() => {
  originalCalls = [];
  originalDetachCalls = 0;
  WorkspaceLeaf.prototype.setViewState = async function (state: { type: string; state?: unknown; active?: boolean }) {
    originalCalls.push(state);
  };
  (WorkspaceLeaf.prototype as unknown as { detach: () => void }).detach = function () {
    originalDetachCalls++;
  };
});

afterEach(() => {
  WorkspaceLeaf.prototype.setViewState = originalSetViewState;
  if (originalDetach) {
    (WorkspaceLeaf.prototype as unknown as { detach: () => void }).detach = originalDetach;
  } else {
    delete (WorkspaceLeaf.prototype as unknown as { detach?: () => void }).detach;
  }
});

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

  it("wireComponents registers all 28 components", () => {
    const m = new PCModule();
    const core = { entities: new EntityRegistry() } as unknown as CoreAPI;
    m.register(core);
    expect(m.registry.size()).toBe(28);
    for (const type of [
      "header-section", "ac-shield", "hp-widget", "hit-dice-widget",
      "save-chip-str", "save-chip-dex", "save-chip-con",
      "save-chip-int", "save-chip-wis", "save-chip-cha",
      "ability-row", "stats-tiles", "defenses-conditions-panel",
      "senses-panel", "skills-panel", "proficiencies-panel",
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

  it("interceptor rewrites setViewState markdown → pc when frontmatter matches", async () => {
    const m = new PCModule();
    const host = makeHost();
    m.register({ entities: new EntityRegistry(), plugin: host.plugin } as unknown as CoreAPI);

    const leaf = new WorkspaceLeaf();
    await leaf.setViewState({ type: "markdown", state: { file: "PlayerCharacters/Grendal.md" }, active: true });

    expect(originalCalls).toHaveLength(1);
    expect(originalCalls[0].type).toBe(VIEW_TYPE_PC);
    expect((originalCalls[0].state as { file: string }).file).toBe("PlayerCharacters/Grendal.md");

    host.teardown();
  });

  it("interceptor passes through files without archivist-type: pc frontmatter", async () => {
    const m = new PCModule();
    const host = makeHost({ "archivist-type": "monster" });
    m.register({ entities: new EntityRegistry(), plugin: host.plugin } as unknown as CoreAPI);

    const leaf = new WorkspaceLeaf();
    await leaf.setViewState({ type: "markdown", state: { file: "PlayerCharacters/not-a-pc.md" } });

    expect(originalCalls).toHaveLength(1);
    expect(originalCalls[0].type).toBe("markdown");

    host.teardown();
  });

  it("interceptor passes through files outside the PC folder", async () => {
    const m = new PCModule();
    const host = makeHost();
    m.register({ entities: new EntityRegistry(), plugin: host.plugin } as unknown as CoreAPI);

    const leaf = new WorkspaceLeaf();
    await leaf.setViewState({ type: "markdown", state: { file: "Daily/Note.md" } });

    expect(originalCalls).toHaveLength(1);
    expect(originalCalls[0].type).toBe("markdown");

    host.teardown();
  });

  it("interceptor passes through non-markdown view types unchanged", async () => {
    const m = new PCModule();
    const host = makeHost();
    m.register({ entities: new EntityRegistry(), plugin: host.plugin } as unknown as CoreAPI);

    const leaf = new WorkspaceLeaf();
    await leaf.setViewState({ type: "canvas", state: { file: "PlayerCharacters/Grendal.md" } });

    expect(originalCalls).toHaveLength(1);
    expect(originalCalls[0].type).toBe("canvas");

    host.teardown();
  });

  it("interceptor respects an explicit 'markdown' override (no re-swap loop)", async () => {
    // Simulates the PC view's "Edit as Markdown" action: before calling
    // setViewState({ type: "markdown" }) it sets fileModes[leafId] = "markdown"
    // so the interceptor passes the call through instead of re-swapping.
    const m = new PCModule();
    const host = makeHost();
    m.register({ entities: new EntityRegistry(), plugin: host.plugin } as unknown as CoreAPI);

    const leaf = new WorkspaceLeaf();
    (leaf as unknown as { id: string }).id = "leaf-1";

    await leaf.setViewState({ type: "markdown", state: { file: "PlayerCharacters/Grendal.md" }, active: true });
    expect(originalCalls[0].type).toBe(VIEW_TYPE_PC);

    // PC view's switchToMarkdown() sets the override before calling setViewState.
    m.fileModes["leaf-1"] = "markdown";
    await leaf.setViewState({ type: "markdown", state: { file: "PlayerCharacters/Grendal.md" }, active: true });
    expect(originalCalls[1].type).toBe("markdown");

    // Further markdown calls for the same leaf keep passing through.
    await leaf.setViewState({ type: "markdown", state: { file: "PlayerCharacters/Grendal.md" } });
    expect(originalCalls[2].type).toBe("markdown");

    host.teardown();
  });

  it("detach patch clears the fileModes entry so a reopened leaf re-swaps", async () => {
    const m = new PCModule();
    const host = makeHost();
    m.register({ entities: new EntityRegistry(), plugin: host.plugin } as unknown as CoreAPI);

    const leaf = new WorkspaceLeaf();
    (leaf as unknown as { id: string }).id = "leaf-1";
    (leaf as unknown as { view: { getState: () => { file: string } } }).view = {
      getState: () => ({ file: "PlayerCharacters/Grendal.md" }),
    };

    await leaf.setViewState({ type: "markdown", state: { file: "PlayerCharacters/Grendal.md" } });
    expect(m.fileModes["leaf-1"]).toBe(VIEW_TYPE_PC);

    (leaf as unknown as { detach: () => void }).detach();
    expect(m.fileModes["leaf-1"]).toBeUndefined();
    expect(originalDetachCalls).toBe(1);

    host.teardown();
  });

  it("interceptor uninstalls cleanly on plugin teardown", async () => {
    const m = new PCModule();
    const host = makeHost();
    m.register({ entities: new EntityRegistry(), plugin: host.plugin } as unknown as CoreAPI);

    host.teardown();

    // After uninstall, the prototype method should behave as the original mock again.
    const leaf = new WorkspaceLeaf();
    await leaf.setViewState({ type: "markdown", state: { file: "PlayerCharacters/Grendal.md" } });

    expect(originalCalls).toHaveLength(1);
    expect(originalCalls[0].type).toBe("markdown");
  });
});
