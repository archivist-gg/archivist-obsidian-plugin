import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  renderRegisteredEntity,
  setEntityPresenterKernel,
  setEntityPresenters,
} from "../../packages/obsidian/src/shared/rendering/entity-presenter-dispatch";
import type { EntityPresenter } from "../../packages/obsidian/src/shared/rendering/entity-presenter";
import type { Archivist } from "@archivist/core";

// ---------------------------------------------------------------------------
// 0f D2 behaviour pins: dispatch is presenter-lookup-first and kernel-only.
// (a) a ported type routes through the kernel codec (identity-checked);
// (b) a codec-less type returns null WITHOUT throwing even when a presenter
//     exists (the doc null-guard — npc/encounter shape);
// (c) an unknown type with no presenter returns null (lookup-first).
// The 0c.1a "falls back to mod.parseYaml" assertion is retired by spec D8.3:
// that path was deleted (all 11 authored types own codecs since 0c.1b).
// ---------------------------------------------------------------------------

const KERNEL_DATA = { from: "kernel-codec" };

/** Fake kernel: owns "monster" (codec) and "npc" (generatable-only, NO doc). */
const fakeArchivist = {
  getEntityType(type: string) {
    if (type === "monster") {
      return {
        type,
        doc: { parse: () => ({ success: true, data: KERNEL_DATA }), serialize: () => "" },
      };
    }
    if (type === "npc") return { type }; // no doc — generate-only shape
    return undefined;
  },
} as unknown as Archivist;

let renderedData: unknown;

function makePresenters(): Map<string, EntityPresenter> {
  const monster: EntityPresenter = {
    type: "monster",
    render: (_el, data) => {
      renderedData = data;
      return { tag: "rendered" } as unknown as HTMLElement;
    },
  };
  // npc gets a presenter TOO, so the codec-less case exercises the doc
  // null-guard rather than the presenter-lookup miss.
  const npc: EntityPresenter = { type: "npc", render: () => undefined };
  return new Map([
    ["monster", monster],
    ["npc", npc],
  ]);
}

describe("presenter dispatch routing (0f D2)", () => {
  beforeEach(() => {
    renderedData = undefined;
    setEntityPresenterKernel(fakeArchivist);
    setEntityPresenters(makePresenters());
  });

  afterEach(() => {
    setEntityPresenterKernel(null as unknown as Archivist);
    setEntityPresenters(new Map());
  });

  it("routes a ported type (monster) through the kernel codec", () => {
    const host = {} as unknown as HTMLElement;
    renderRegisteredEntity({ entityType: "monster", data: { name: "Goblin" } }, host, undefined);
    expect(renderedData).toBe(KERNEL_DATA);
  });

  it("returns null (no throw) for a codec-less type even with a presenter (npc)", () => {
    const host = {} as unknown as HTMLElement;
    const out = renderRegisteredEntity({ entityType: "npc", data: { name: "Bandit" } }, host, undefined);
    expect(out).toBeNull();
  });

  it("returns null (no throw) for an unknown type with no presenter", () => {
    const host = {} as unknown as HTMLElement;
    const out = renderRegisteredEntity({ entityType: "mystery", data: {} }, host, undefined);
    expect(out).toBeNull();
  });
});
