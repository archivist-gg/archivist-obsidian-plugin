/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("obsidian", () => ({
  setIcon: vi.fn(),
  Notice: vi.fn(),
}));

import { appendMarkdownText } from "../packages/obsidian/src/shared/rendering/renderer-utils";

// --- appendMarkdownText (DOM) ---

describe("appendMarkdownText", () => {
  function render(text: string): string {
    const div = document.createElement("div");
    appendMarkdownText(text, div);
    return div.innerHTML;
  }

  it("renders plain text unchanged", () => {
    expect(render("hello world")).toBe("hello world");
  });

  it("renders **bold**", () => {
    expect(render("the **dragon** attacks")).toBe(
      "the <strong>dragon</strong> attacks",
    );
  });

  it("renders *italic*", () => {
    expect(render("cast *fireball*")).toBe("cast <em>fireball</em>");
  });

  it("renders _italic_ (underscore)", () => {
    expect(render("cast _fireball_ now")).toBe("cast <em>fireball</em> now");
  });

  it("renders ***bold italic***", () => {
    expect(render("***legendary***")).toBe(
      "<strong><em>legendary</em></strong>",
    );
  });

  it("renders ~~strikethrough~~", () => {
    expect(render("~~removed~~")).toBe("<del>removed</del>");
  });

  it("renders [text](url) links", () => {
    const html = render("see [PHB](https://example.com) for details");
    expect(html).toContain("<a");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener"');
    expect(html).toContain("PHB</a>");
  });

  it("handles multiple formats in one string", () => {
    const html = render("**Bite.** *Melee Weapon Attack:*");
    expect(html).toBe(
      "<strong>Bite.</strong> <em>Melee Weapon Attack:</em>",
    );
  });

  it("does not match underscores inside words", () => {
    expect(render("some_variable_name")).toBe("some_variable_name");
  });

  it("handles no markdown gracefully", () => {
    const text = "The target takes 10 (3d6) fire damage.";
    expect(render(text)).toBe(text);
  });

  it("handles adjacent bold and italic", () => {
    const html = render("**Action.** _spell name_ here");
    expect(html).toBe(
      "<strong>Action.</strong> <em>spell name</em> here",
    );
  });
});
