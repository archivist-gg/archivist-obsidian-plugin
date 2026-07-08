/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { renderPCSheet } from "../packages/obsidian/src/modules/pc/pc.sheet";
import { ComponentRegistry } from "../packages/obsidian/src/modules/pc/components/component-registry";
import { BuilderView } from "../packages/obsidian/src/modules/pc/components/builder-view";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";

beforeAll(() => installObsidianDomHelpers());

function opts(classLen: number, warnings: string[] = [], builder?: boolean) {
  const reg = new ComponentRegistry();
  reg.register(new BuilderView());
  const definition: Record<string, unknown> = {
    name: "Valeria",
    class: new Array(classLen).fill({}),
  };
  if (builder !== undefined) definition.builder = builder;
  return {
    root: mountContainer(),
    resolved: { definition },
    derived: { totalLevel: 0, proficiencyBonus: 2, hp: { max: 0 } },
    registry: reg,
    editState: null,
    services: {
      plugin: {},
      entities: { search: () => [] },
      compendiums: { getAll: () => [] },
      modules: { getByEntityType: () => undefined },
    } as never,
    app: {} as never,
    warnings,
  } as never;
}

describe("renderPCSheet — builder branch", () => {
  it("renders the builder shell when the character has no class", () => {
    const o = opts(0) as { root: HTMLElement };
    renderPCSheet(o as never);
    expect(o.root.querySelector(".pc-builder")).not.toBeNull();
    expect(o.root.querySelector(".pc-stats-band")).toBeNull();
  });

  it("suppresses the warnings banner in Builder mode", () => {
    const o = opts(0, ["No race resolved; speed defaulted to 30."]) as { root: HTMLElement };
    renderPCSheet(o as never);
    expect(o.root.querySelector(".pc-builder")).not.toBeNull();
    expect(o.root.querySelector(".archivist-pc-warnings")).toBeNull();
  });

  it("stays in the Builder when builder:true even though a class is present", () => {
    // The defect: picking a class used to dump the user onto the full sheet.
    const o = opts(1, [], true) as { root: HTMLElement };
    renderPCSheet(o as never);
    expect(o.root.querySelector(".pc-builder")).not.toBeNull();
    expect(o.root.querySelector(".pc-stats-band")).toBeNull();
  });

  it("renders the full sheet for a classed character with no builder flag", () => {
    const o = opts(1, [], undefined) as { root: HTMLElement };
    renderPCSheet(o as never);
    expect(o.root.querySelector(".pc-builder")).toBeNull();
    expect(o.root.querySelector(".pc-stats-band")).not.toBeNull();
  });

  it("renders the full sheet once the builder flag is cleared (Finish), class present", () => {
    const o = opts(1, [], false) as { root: HTMLElement };
    renderPCSheet(o as never);
    expect(o.root.querySelector(".pc-builder")).toBeNull();
    expect(o.root.querySelector(".pc-stats-band")).not.toBeNull();
  });
});
