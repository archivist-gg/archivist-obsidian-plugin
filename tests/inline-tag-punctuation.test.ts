/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { renderTextWithInlineTags } from "../packages/obsidian/src/shared/rendering/renderer-utils";
import { renderMarkdownDescription } from "../packages/obsidian/src/shared/rendering/markdown-description";
import { installObsidianDomHelpers } from "./fixtures/pc/dom-helpers";

/**
 * R4-G7 T8 wave E, B026-D4: a tag widget and the "(" that opens it are one unbreakable unit.
 *
 * The widget's own halves (the icon `<svg>` and the value) are held together by `white-space: nowrap` in
 * `archivist-dnd.css`, which jsdom cannot observe (it does no layout); what IS observable, and what the live defect
 * needs, is the DOM: the opening punctuation belongs to the PROSE, so the nearest common ancestor of "(" and the icon is
 * the paragraph, and only a shared nowrap ancestor can keep them on one line. These tests measure that ancestor on both
 * routes that build widgets: `renderTextWithInlineTags` (the stat block's own property lines and the PC sheet) and
 * `renderMarkdownDescription`'s walker (every markdown-rendered block since R4-G6, and every feature's prose since Q-11).
 */

beforeAll(() => installObsidianDomHelpers());

describe("B026-D4 · a widget binds the punctuation that opens it", () => {
  it("renderTextWithInlineTags: the '(' before a tag joins it in a nowrap wrapper", () => {
    const host = document.createElement("p");
    renderTextWithInlineTags("Hit: 44 (`d:8d10`) psychic damage.", host, true);

    const tag = host.querySelector(".archivist-stat-tag") as HTMLElement;
    const wrapper = tag.parentElement as HTMLElement;
    expect(wrapper.className).toBe("archivist-tag-nobreak");
    expect(wrapper.firstChild?.textContent).toBe("(");
    expect(wrapper.contains(tag)).toBe(true);
    // the closing ")" stays in the prose: UAX #14 forbids a break before it, so it never left its value
    expect(host.textContent).toBe("Hit: 44 (8d10) psychic damage.");
    expect(wrapper.textContent).toBe("(8d10");
  });

  it("renderTextWithInlineTags: a tag with no opening punctuation beside it is NOT wrapped", () => {
    const host = document.createElement("p");
    renderTextWithInlineTags("The lair heaves `d:1d10` days later.", host, true);

    const tag = host.querySelector(".archivist-stat-tag") as HTMLElement;
    expect((tag.parentElement as HTMLElement).tagName).toBe("P");
    expect(host.querySelectorAll(".archivist-tag-nobreak").length).toBe(0);
  });

  it("the walker binds a staged `<code>` tag to its '(' too (the markdown route every block uses)", async () => {
    const host = document.createElement("p");
    host.appendChild(document.createTextNode("takes 44 ("));
    const code = document.createElement("code");
    code.textContent = "d:8d10";
    host.appendChild(code);
    host.appendChild(document.createTextNode(") psychic"));

    // the empty-markdown path still runs the walker (markdown-description.ts), which is what stages this shape
    await renderMarkdownDescription(host, "");

    const tag = host.querySelector(".archivist-stat-tag") as HTMLElement;
    const wrapper = tag.parentElement as HTMLElement;
    expect(wrapper.className).toBe("archivist-tag-nobreak");
    expect(wrapper.textContent).toBe("(8d10");
    expect(host.textContent).toBe("takes 44 (8d10) psychic");
  });

  it("a second pass over the same parent leaves the widgets it already bound alone", () => {
    const host = document.createElement("p");
    renderTextWithInlineTags("Hit: 44 (`d:8d10`)", host, true);
    host.appendChild(document.createTextNode(" plus ("));
    renderTextWithInlineTags("`d:2d6`", host, true);

    expect(host.querySelectorAll(".archivist-tag-nobreak").length).toBe(2);
    expect(host.querySelectorAll(".archivist-tag-nobreak .archivist-tag-nobreak").length).toBe(0);
    expect(host.textContent).toBe("Hit: 44 (8d10) plus (2d6");
  });

  it("the PC sheet's tag family (statBlockMode false) binds the same way", () => {
    const host = document.createElement("div");
    renderTextWithInlineTags("(`damage:2d6 necrotic`)", host, false);

    const tag = host.querySelector(".archivist-tag") as HTMLElement;
    expect((tag.parentElement as HTMLElement).className).toBe("archivist-tag-nobreak");
  });
});
