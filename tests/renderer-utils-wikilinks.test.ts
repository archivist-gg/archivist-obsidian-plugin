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
    expect(a.getAttribute("href")).toBe("Player's Handbook (2014)/Conditions/Grappled");
    expect(a.getAttribute("target")).toBe("_blank");
    expect(a.getAttribute("rel")).toBe("noopener nofollow");
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
  it("a trailing-slash target keeps the whole target as the link text", () => {
    const a = render("[[a/b/]]").querySelector("a")!;
    expect(a.textContent).toBe("a/b/");
    expect(a.getAttribute("data-href")).toBe("a/b/");
  });
  it("a URL-scheme target renders as text", () => {
    const host = render("[[javascript:alert(1)|x]]");
    expect(host.textContent).toBe("x");
    expect(host.querySelectorAll("a").length).toBe(0);
  });
  it("a bare URL-scheme target renders as text", () => {
    const host = render("[[javascript:alert(1)]]");
    expect(host.querySelectorAll("a").length).toBe(0);
    expect(host.textContent).toBe("javascript:alert(1)");
  });
  it("a whitespace-obfuscated scheme target renders as text", () => {
    const spaced = render("[[ javascript:alert(1)|x]]");
    expect(spaced.querySelectorAll("a").length).toBe(0);
    expect(spaced.textContent).toBe("x");
    const tabbed = render("[[java\tscript:alert(1)|x]]");
    expect(tabbed.querySelectorAll("a").length).toBe(0);
    expect(tabbed.textContent).toBe("x");
  });
  it("a protocol-relative target renders as text", () => {
    const host = render("[[//evil.example|x]]");
    expect(host.querySelectorAll("a").length).toBe(0);
    expect(host.textContent).toBe("x");
    const unc = render("[[\\\\evil.example|x]]");
    expect(unc.querySelectorAll("a").length).toBe(0);
    expect(unc.textContent).toBe("x");
  });
  it("the mixed slash / backslash permutations render as text: the guard tests the two-character prefix, not two literals", () => {
    const fwdBack = render("[[/\\evil.example|x]]");
    expect(fwdBack.querySelectorAll("a").length).toBe(0);
    expect(fwdBack.textContent).toBe("x");
    const backFwd = render("[[\\/evil.example|x]]");
    expect(backFwd.querySelectorAll("a").length).toBe(0);
    expect(backFwd.textContent).toBe("x");
  });
  it("a markdown link beside a wikilink: both render", () => {
    const host = render("[t](https://e.x) and [[a|b]]");
    expect(host.querySelectorAll("a").length).toBe(2);
  });
  /*
   * The two fixtures below pin the emphasis arms' `(?!\[\[)` lookahead, which lives in this function and arrived with
   * the R4-G6 Task 7a block. They are GREEN at their first run, since they pin SHIPPED behaviour rather than driving
   * it: their kill power is the mutant that reverts the three asterisk arms to `(.+?)`, which reds the anchor count
   * here and the sample renders' zero-wikilink assertion on Tyreus and Feonor. The alternation is leftmost-wins, so
   * without the lookahead a `*` opening before the next `[[` swallows the whole link into an `<em>` as literal text,
   * which is the 5etools footnote shape a monster's spell group prints.
   */
  it("an emphasis run never swallows a wikilink: the footnote shape keeps both links and its markers", () => {
    const host = render("[[a|b]]*, [[c|d]]*");
    const links = Array.from(host.querySelectorAll("a"));
    expect(links.length).toBe(2);
    expect(links[0].getAttribute("data-href")).toBe("a");
    expect(links[0].textContent).toBe("b");
    expect(links[1].getAttribute("data-href")).toBe("c");
    expect(links[1].textContent).toBe("d");
    expect(host.textContent).toBe("b*, d*");
    expect(host.querySelectorAll("em").length).toBe(0);
  });
  it("*[[a|b]]* renders the link with both asterisks as text and no emphasis element", () => {
    const host = render("*[[a|b]]*");
    expect(host.querySelectorAll("a").length).toBe(1);
    expect(host.querySelector("a")!.getAttribute("data-href")).toBe("a");
    expect(host.textContent).toBe("*b*");
    expect(host.querySelectorAll("em").length).toBe(0);
  });
});
