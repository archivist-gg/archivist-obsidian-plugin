import { describe, it, expect, beforeEach } from "vitest";
import {
  renderEntityViaModule,
  setCompendiumRefArchivist,
  setCompendiumRefModuleRegistry,
} from "../../packages/obsidian/src/shared/extensions/compendium-ref-extension";
import type { Archivist } from "@archivist/core";
import type { ModuleRegistry } from "../../packages/obsidian/src/core/module-registry";

// ---------------------------------------------------------------------------
// 0c.1a D6 behaviour-neutrality: the shared compendium-ref parse helper routes
// through the kernel codec when the pack owns an EntityType for the entity, and
// falls back to `mod.parseYaml` otherwise. We assert REAL routing by tracking
// which parser's output the renderer actually received — not by spying on a
// mock-of-a-mock.
// ---------------------------------------------------------------------------

// Distinct sentinel objects so identity (not just shape) proves provenance.
const KERNEL_DATA = { from: "kernel-codec" };
const MODULE_DATA = { from: "module-parseYaml" };

/** Fake Archivist: owns "monster" (ported), does NOT own "spell" (un-ported). */
const fakeArchivist = {
  getEntityType(type: string) {
    if (type === "monster") {
      return {
        type,
        doc: {
          parse: () => ({ success: true, data: KERNEL_DATA }),
          serialize: () => "",
        },
      };
    }
    return undefined;
  },
} as unknown as Archivist;

/** Captures the `data` argument the module renderer was handed. */
let renderedData: unknown;

function makeModuleRegistry(): ModuleRegistry {
  const mod = {
    id: "stub",
    parseYaml: () => ({ success: true, data: MODULE_DATA }),
    render: (_el: HTMLElement, data: unknown) => {
      renderedData = data;
      // Return a truthy fake node so renderEntityViaModule short-circuits
      // before touching host.lastElementChild (no DOM in this env).
      return { tag: "rendered" } as unknown as HTMLElement;
    },
  };
  return {
    getByEntityType: () => mod,
  } as unknown as ModuleRegistry;
}

describe("compendium-ref kernel routing (0c.1a D6)", () => {
  beforeEach(() => {
    renderedData = undefined;
    setCompendiumRefArchivist(fakeArchivist);
    setCompendiumRefModuleRegistry(makeModuleRegistry());
  });

  it("routes a ported type (monster) through the kernel codec", () => {
    const host = {} as unknown as HTMLElement;
    renderEntityViaModule({ entityType: "monster", data: { name: "Goblin" } }, host, undefined);
    // Identity check: data came from the kernel codec's parse, not parseYaml.
    expect(renderedData).toBe(KERNEL_DATA);
  });

  it("falls back to mod.parseYaml for an un-ported type (spell)", () => {
    const host = {} as unknown as HTMLElement;
    renderEntityViaModule({ entityType: "spell", data: { name: "Fireball" } }, host, undefined);
    // Identity check: data came from the module's parseYaml fallback.
    expect(renderedData).toBe(MODULE_DATA);
  });
});
