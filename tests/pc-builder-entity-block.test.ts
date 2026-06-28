/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { renderEntityBlock } from "../packages/obsidian/src/modules/pc/components/builder/entity-block";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { CoreAPI } from "../packages/obsidian/src/core/module-api";
import type { RegisteredEntity } from "../packages/obsidian/src/shared/entities/entity-registry";

beforeAll(() => installObsidianDomHelpers());

const entity: RegisteredEntity = {
  slug: "srd-5e_test-feat", name: "Test Feat", entityType: "feat", filePath: "f.md",
  data: { name: "Test Feat" }, compendium: "SRD 5e", readonly: true, homebrew: false,
};

function coreWith(mod: unknown): CoreAPI {
  return { plugin: {}, modules: { getByEntityType: () => mod } } as unknown as CoreAPI;
}

describe("renderEntityBlock", () => {
  it("dispatches to the owning module's render", () => {
    const root = mountContainer();
    const mod = {
      parseYaml: (src: string) => ({ success: true, data: { src } }),
      render: (el: HTMLElement) => el.createDiv({ cls: "fake-block", text: "rendered" }),
    };
    renderEntityBlock(root, entity, coreWith(mod));
    expect(root.querySelector(".fake-block")?.textContent).toBe("rendered");
  });

  it("falls back to a plain name line when no module is registered", () => {
    const root = mountContainer();
    renderEntityBlock(root, entity, coreWith(undefined));
    expect(root.querySelector(".pc-bblock-fallback")?.textContent).toBe("Test Feat");
  });

  it("falls back when the module's parse fails", () => {
    const root = mountContainer();
    const mod = {
      parseYaml: () => ({ success: false, error: "nope" }),
      render: () => { throw new Error("must not be called"); },
    };
    renderEntityBlock(root, entity, coreWith(mod));
    expect(root.querySelector(".pc-bblock-fallback")?.textContent).toBe("Test Feat");
  });
});
