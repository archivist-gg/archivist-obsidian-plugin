import { describe, it, expect, beforeEach } from "vitest";
import { JSDOM } from "jsdom";
import { appendMarkdownText } from "../../src/renderers/renderer-utils";

describe("appendMarkdownText URL scheme allowlist", () => {
  let parent: HTMLElement;

  beforeEach(() => {
    const dom = new JSDOM("<!DOCTYPE html><div id='root'></div>");
    (globalThis as any).document = dom.window.document;
    parent = dom.window.document.getElementById("root")!;
  });

  const render = (md: string) => {
    parent.replaceChildren();
    appendMarkdownText(md, parent);
    return parent;
  };

  it("renders https links as anchors with rel=noopener", () => {
    const p = render("[ok](https://example.com)");
    const a = p.querySelector("a")!;
    expect(a.getAttribute("href")).toBe("https://example.com");
    expect(a.getAttribute("rel")).toBe("noopener");
    expect(a.getAttribute("target")).toBe("_blank");
    expect(a.textContent).toBe("ok");
  });

  it("renders mailto links", () => {
    const a = render("[me](mailto:a@b.test)").querySelector("a")!;
    expect(a.getAttribute("href")).toBe("mailto:a@b.test");
  });

  it("renders in-doc anchors", () => {
    const a = render("[top](#anchor)").querySelector("a")!;
    expect(a.getAttribute("href")).toBe("#anchor");
  });

  it("degrades javascript: URLs to plain text", () => {
    // Fixture deliberately avoids nested parens so it doesn't collide with
    // the upstream link regex's non-greedy URL capture. The security goal is
    // that no <a> element is produced for a javascript: scheme, which holds
    // regardless of the payload body.
    const p = render("[x](javascript:alert)");
    expect(p.querySelector("a")).toBeNull();
    expect(p.textContent).toBe("x");
  });

  it("degrades data: URLs to plain text", () => {
    const p = render("[x](data:text/html,<script>)");
    expect(p.querySelector("a")).toBeNull();
    expect(p.textContent).toBe("x");
  });

  it("degrades vbscript: URLs to plain text", () => {
    const p = render("[x](vbscript:msgbox)");
    expect(p.querySelector("a")).toBeNull();
    expect(p.textContent).toBe("x");
  });

  it("degrades obsidian: URLs to plain text (cross-vault vector)", () => {
    const p = render("[x](obsidian://open?vault=Evil)");
    expect(p.querySelector("a")).toBeNull();
    expect(p.textContent).toBe("x");
  });
});
