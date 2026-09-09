/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import ArchivistPlugin from "../packages/obsidian/src/main";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";

beforeAll(() => installObsidianDomHelpers());

type BlockCallback = (src: string, el: HTMLElement, ctx: unknown) => void;

/** The cold start: the manager is constructed in `onload` and its compendiums are discovered from
 *  `onLayoutReady`, so `getByPath` answers `undefined` until `discover()` flips it. */
function setup() {
  const plugin = new ArchivistPlugin({} as never, { id: "archivist-gg", version: "0.0.0" } as never);
  let discovered = false;
  plugin.compendiumManager = {
    getByPath: (p: string) => (discovered && p.startsWith("Compendium/RO/") ? { readonly: true } : undefined),
    getWritable: () => [],
  } as never;

  let captured: BlockCallback | undefined;
  (plugin as never as Record<string, unknown>).registerMarkdownCodeBlockProcessor = (_t: string, cb: BlockCallback) => { captured = cb; };

  // The callback reads `this.archivist` first and returns through `createErrorBlock` before any bar exists otherwise.
  const kernel = { getEntityType: () => ({ doc: { parse: () => ({ success: true, data: { name: "x" } }) } }), resolve: () => ({ success: true, data: { name: "x" } }) };
  (plugin as never as { archivist: unknown }).archivist = kernel;

  let lastCtx: { hostReadonly?: boolean } | undefined;
  const presenter = {
    type: "monster",
    render: (el: HTMLElement) => el.createDiv(),
    // The marker is a CHILD ELEMENT: a class or an attribute would survive `container.empty()`.
    renderEditMode: vi.fn((el: HTMLElement, _d: unknown, ctx: { hostReadonly?: boolean }) => {
      lastCtx = ctx;
      el.querySelector(".archivist-side-btns")!.createSpan({ cls: "marker" });
    }),
  };
  (plugin as never as { registerEntityCodeBlock: (p: unknown) => void }).registerEntityCodeBlock(presenter);

  const el = mountContainer();
  const dispatch = () => captured!("name: x", el, { sourcePath: "Compendium/RO/x.md", getSectionInfo: () => null });
  const discover = () => { discovered = true; };
  const ready = () => (plugin as never as { resolveCompendiumsReady: () => void }).resolveCompendiumsReady();
  return { plugin, el, dispatch, discover, ready, getLastCtx: () => lastCtx };
}

describe("the entity code-block seam on a readonly host (R4-G6b §3.3)", () => {
  it("main.ts loads under the obsidian mock and the plugin constructs", () => {
    expect(() => new ArchivistPlugin({} as never, { id: "archivist-gg", version: "0.0.0" } as never)).not.toThrow();
  });

  it("a block painted in the cold-start window re-renders its bar once the compendiums are known", async () => {
    const { el, dispatch, discover, ready } = setup();
    dispatch();
    expect(el.querySelector('[aria-label="Delete"]')).not.toBeNull();
    discover();
    ready();
    await Promise.resolve(); await Promise.resolve();
    expect(el.querySelector('[aria-label="Delete"]')).toBeNull();
  });

  it("the re-render is skipped while the block is in edit mode (the editors reuse the bar)", async () => {
    const { el, dispatch, discover, ready } = setup();
    discover();
    dispatch();
    (el.querySelector('[aria-label="Edit"]') as HTMLElement).click();
    ready();
    await Promise.resolve(); await Promise.resolve();
    // The FIRST expect is the kill row: the spy's marker was stamped into the bar at edit entry (the leg below pins
    // that independently) and a re-render would have emptied it away.
    expect(el.querySelector(".marker")).not.toBeNull();
  });

  it("enterEditMode passes hostReadonly in the EditContext", () => {
    const { el, dispatch, discover, getLastCtx } = setup();
    discover();
    dispatch();
    (el.querySelector('[aria-label="Edit"]') as HTMLElement).click();
    expect(getLastCtx()?.hostReadonly).toBe(true);
    expect(el.querySelector(".marker")).not.toBeNull();
  });
});
