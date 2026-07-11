/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { renderEntityBlock } from "../packages/obsidian/src/modules/pc/components/builder/entity-block";
import {
  setEntityPresenters,
  setEntityPresenterKernel,
} from "../packages/obsidian/src/shared/rendering/entity-presenter-dispatch";
import type { EntityPresenter } from "../packages/obsidian/src/shared/rendering/entity-presenter";
import type { Archivist } from "@archivist-gg/core";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { RegisteredEntity } from "@core/entity-registry";

beforeAll(() => installObsidianDomHelpers());

const entity: RegisteredEntity = {
  slug: "srd-5e_test-feat", name: "Test Feat", entityType: "feat", filePath: "f.md",
  data: { name: "Test Feat" }, compendium: "SRD 5e", readonly: true, homebrew: false,
};

const okKernel = {
  getEntityType: (type: string) => ({
    type,
    doc: { parse: () => ({ success: true, data: {} }), serialize: () => "" },
  }),
} as unknown as Archivist;

const failKernel = {
  getEntityType: (type: string) => ({
    type,
    doc: { parse: () => ({ success: false, error: "nope" }), serialize: () => "" },
  }),
} as unknown as Archivist;

function presenterMap(render: EntityPresenter["render"]): Map<string, EntityPresenter> {
  return new Map([["feat", { type: "feat", render }]]);
}

afterEach(() => {
  setEntityPresenters(new Map());
  setEntityPresenterKernel(null as unknown as Archivist);
});

describe("renderEntityBlock", () => {
  it("dispatches to the owning presenter's render", () => {
    setEntityPresenterKernel(okKernel);
    setEntityPresenters(presenterMap((el) => el.createDiv({ cls: "fake-block", text: "rendered" })));
    const root = mountContainer();
    renderEntityBlock(root, entity);
    expect(root.querySelector(".fake-block")?.textContent).toBe("rendered");
  });

  it("falls back to a plain name line when no presenter is registered", () => {
    setEntityPresenterKernel(okKernel);
    setEntityPresenters(new Map());
    const root = mountContainer();
    renderEntityBlock(root, entity);
    expect(root.querySelector(".pc-bblock-fallback")?.textContent).toBe("Test Feat");
  });

  it("falls back when the codec parse fails", () => {
    setEntityPresenterKernel(failKernel);
    setEntityPresenters(presenterMap(() => { throw new Error("must not be called"); }));
    const root = mountContainer();
    renderEntityBlock(root, entity);
    expect(root.querySelector(".pc-bblock-fallback")?.textContent).toBe("Test Feat");
  });

  it("falls back to the name line when the presenter's render throws synchronously", () => {
    setEntityPresenterKernel(okKernel);
    setEntityPresenters(presenterMap(() => { throw new Error("boom"); }));
    const root = mountContainer();
    renderEntityBlock(root, entity);
    expect(root.querySelector(".pc-bblock-fallback")?.textContent).toBe("Test Feat");
  });
});
