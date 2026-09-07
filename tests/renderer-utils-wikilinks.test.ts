/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { appendMarkdownText } from "../packages/obsidian/src/shared/rendering/renderer-utils";
import { installObsidianDomHelpers } from "./fixtures/pc/dom-helpers";

beforeAll(() => installObsidianDomHelpers());

function render(text: string): HTMLElement {
  const host = document.createElement("span");
  appendMarkdownText(text, host);
  return host;
}

/** R4-G6 §7 · the wikilink arm of the shared text renderer. */
describe("appendMarkdownText wikilinks", () => {
  it("[[target|alias]] becomes an internal link with the alias as text", () => {
    const a = render("hit by [[Player's Handbook (2014)/Conditions/Grappled|grappled]] now").querySelector("a")!;
    expect(a.getAttribute("data-href")).toBe("Player's Handbook (2014)/Conditions/Grappled");
    expect(a.textContent).toBe("grappled");
    expect(a.classList.contains("internal-link")).toBe(true);
    expect(render("hit by [[x|y]] now").textContent).toBe("hit by y now");
  });
  it("[[target]] shows the last path segment", () => {
    const a = render("[[SRD 2024/Spells/Fireball]]").querySelector("a")!;
    expect(a.textContent).toBe("Fireball");
    expect(a.getAttribute("data-href")).toBe("SRD 2024/Spells/Fireball");
  });
  it("keeps a heading anchor in the target", () => {
    expect(render("[[Note#Heading|x]]").querySelector("a")!.getAttribute("data-href")).toBe("Note#Heading");
  });
  it("![[embed]] renders the link with the ! consumed", () => {
    const host = render("see ![[img.png]]");
    expect(host.textContent).toBe("see img.png");
    expect(host.querySelectorAll("a").length).toBe(1);
  });
  it("[[a](b)]] keeps today's output (the link arm; an unsafe scheme degrades to text)", () => {
    const host = render("[[a](b)]]");
    expect(host.textContent).toBe("[a]]");
  });
  it("[[a|b|c]] takes the first | as the alias boundary", () => {
    const a = render("[[a|b|c]]").querySelector("a")!;
    expect(a.getAttribute("data-href")).toBe("a");
    expect(a.textContent).toBe("b|c");
  });
  it("a URL-scheme target renders as text", () => {
    const host = render("[[javascript:alert(1)|x]]");
    expect(host.querySelectorAll("a").length).toBe(0);
    expect(host.textContent).toBe("x");
  });
  it("a markdown link beside a wikilink: both render", () => {
    const host = render("[t](https://e.x) and [[a|b]]");
    expect(host.querySelectorAll("a").length).toBe(2);
  });
});
