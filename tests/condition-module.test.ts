/** @vitest-environment jsdom */
/**
 * The `condition` presenter (R4-G2 Task 6 · spec §6, floor §11.6).
 *
 * Two contracts: `render` draws a real block for a PARSED condition, and
 * `renderEditMode` produces a NON-EMPTY body — the shipped bug shape here is an
 * `onExit`-only edit renderer, which leaves the Edit button showing a blank
 * pane on a writable note.
 */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { conditionModule } from "../packages/obsidian/src/modules/condition/condition.module";
import { parseCondition } from "@archivist-gg/dnd5e/condition/condition.parser";
import type { EditContext, RenderContext } from "../packages/obsidian/src/shared/rendering/entity-presenter";

beforeAll(() => installObsidianDomHelpers());

/** The description is filled by the async markdown path (the race/feat module
 *  idiom). One macrotask turn drains the promise chain the renderers queue. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Byte-shaped like the shipped bundle doc `SRD 2024/Conditions/Prone.md`. */
const PRONE_SOURCE = [
  "slug: srd-2024_condition_prone",
  "name: Prone",
  "edition: '2024'",
  "source: SRD 5.2",
  "description: |-",
  "  While you have the Prone condition, you experience the following effects.",
  "",
  "  **Restricted Movement.** Your only movement options are to Crawling.",
].join("\n");

function parsed(source = PRONE_SOURCE) {
  const result = parseCondition(source);
  if (!result.success) throw new Error(`fixture does not parse: ${String(result.error)}`);
  return result.data;
}

const renderCtx: RenderContext = { plugin: undefined, ctx: undefined };

function editCtx(over: Partial<EditContext> = {}): EditContext {
  return { plugin: undefined, ctx: undefined, source: PRONE_SOURCE, ...over };
}

describe("conditionModule.render", () => {
  it("declares the `condition` type (the code-block lang / compendium entityType / insert suffix)", () => {
    expect(conditionModule.type).toBe("condition");
  });

  it("renders the name heading, the source badge and the description text", async () => {
    const host = mountContainer();
    conditionModule.render(host, parsed(), renderCtx);
    await flush();

    expect(host.querySelector(".archivist-condition-block")).not.toBeNull();
    expect(host.querySelector("h3")?.textContent).toBe("Prone");
    expect(host.querySelector(".source-badge")?.textContent).toBe("SRD 2024");
    expect(host.textContent).toContain("While you have the Prone condition");
    expect(host.textContent).toContain("Restricted Movement");
  });

  it("returns the appended node, so the host can swap it out", () => {
    const host = mountContainer();
    const node = conditionModule.render(host, parsed(), renderCtx);
    expect(node).toBeInstanceOf(HTMLElement);
    expect(host.contains(node as HTMLElement)).toBe(true);
  });

  it("renders no image element when the entity carries none", async () => {
    const host = mountContainer();
    conditionModule.render(host, parsed(), renderCtx);
    await flush();
    expect(host.querySelector(".archivist-condition-images")).toBeNull();
  });

  it("renders an image block for each entry when `image` is present", async () => {
    const host = mountContainer();
    const withImages = { ...parsed(), has_fluff_images: true, image: ["[[a.png]]", "[[b.png]]"] };
    conditionModule.render(host, withImages, renderCtx);
    await flush();
    const images = host.querySelector(".archivist-condition-images");
    expect(images).not.toBeNull();
    // The obsidian mock's MarkdownRenderer echoes its source, so the embed
    // syntax is what surfaces — the assertion is that BOTH entries were staged
    // as embeds (`![[…]]`), not that jsdom resolved a vault path.
    expect(images?.textContent).toContain("![[a.png]]");
    expect(images?.textContent).toContain("![[b.png]]");
  });

  it("renders a single string `image` too (the one-image emit shape)", async () => {
    const host = mountContainer();
    conditionModule.render(host, { ...parsed(), image: "[[solo.png]]" }, renderCtx);
    await flush();
    expect(host.querySelector(".archivist-condition-images")?.textContent).toContain("![[solo.png]]");
  });
});

describe("conditionModule.renderEditMode", () => {
  it("is defined (without it the Edit button opens a blank pane)", () => {
    expect(typeof conditionModule.renderEditMode).toBe("function");
  });

  it("produces a NON-EMPTY body that re-renders the read content", async () => {
    const host = mountContainer();
    conditionModule.renderEditMode!(host, parsed(), editCtx());
    await flush();
    expect(host.textContent?.length).toBeGreaterThan(0);
    // Kill power beyond the Cancel button's own label: the READ body has to be
    // in there. An `onExit`-only renderer passes a bare length check and fails
    // both of these.
    expect(host.textContent).toContain("Prone");
    expect(host.textContent).toContain("While you have the Prone condition");
  });

  it("Cancel calls `onExit`", async () => {
    const host = mountContainer();
    const onExit = vi.fn();
    conditionModule.renderEditMode!(host, parsed(), editCtx({ onExit }));
    await flush();
    const cancel = host.querySelector<HTMLElement>(".archivist-condition-edit-cancel");
    expect(cancel).not.toBeNull();
    cancel!.click();
    // Asserted through a SPY, never `.not.toThrow()`: under jsdom an exception
    // raised inside a listener does NOT propagate out of `.click()`.
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("a missing `onExit` does not break the Cancel click", async () => {
    const host = mountContainer();
    conditionModule.renderEditMode!(host, parsed(), editCtx());
    await flush();
    const cancel = host.querySelector<HTMLElement>(".archivist-condition-edit-cancel");
    expect(cancel).not.toBeNull();
    // `onExit` is optional on EditContext; the guard is a real branch. jsdom
    // swallows listener throws, so the observable is the DOM afterwards.
    cancel!.click();
    expect(host.textContent).toContain("Prone");
  });
});
