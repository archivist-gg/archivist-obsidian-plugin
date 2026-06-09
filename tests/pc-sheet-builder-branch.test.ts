/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { renderPCSheet } from "../src/modules/pc/pc.sheet";
import { ComponentRegistry } from "../src/modules/pc/components/component-registry";
import { BuilderView } from "../src/modules/pc/components/builder-view";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";

beforeAll(() => installObsidianDomHelpers());

function opts(classLen: number, warnings: string[] = []) {
  const reg = new ComponentRegistry();
  reg.register(new BuilderView());
  return {
    root: mountContainer(),
    resolved: { definition: { name: "Valeria", class: new Array(classLen).fill({}) } },
    derived: { totalLevel: 0, proficiencyBonus: 2, hp: { max: 0 } },
    registry: reg,
    editState: null,
    core: {
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
});
