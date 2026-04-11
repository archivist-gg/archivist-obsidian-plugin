/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("obsidian", () => ({
  setIcon: vi.fn(),
  Notice: vi.fn(),
}));

import { appendMarkdownText, convert5eToolsTags } from "../src/renderers/renderer-utils";

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

// --- convert5eToolsTags (pure string) ---

describe("convert5eToolsTags", () => {
  it("converts {@bold} to **bold**", () => {
    expect(convert5eToolsTags("{@bold dragon}")).toBe("**dragon**");
  });

  it("converts {@italic} to _italic_", () => {
    expect(convert5eToolsTags("{@italic fireball}")).toBe("_fireball_");
  });

  it("converts {@strike} to ~~strike~~", () => {
    expect(convert5eToolsTags("{@strike removed}")).toBe("~~removed~~");
  });

  it("converts {@hit N} to atk tag", () => {
    expect(convert5eToolsTags("{@hit 7}")).toBe("`atk:+7`");
  });

  it("converts {@damage} to damage tag", () => {
    expect(convert5eToolsTags("{@damage 2d6+3}")).toBe("`damage:2d6+3`");
  });

  it("converts {@dc N} to dc tag", () => {
    expect(convert5eToolsTags("{@dc 15}")).toBe("`dc:15`");
  });

  it("converts {@dice} to roll tag", () => {
    expect(convert5eToolsTags("{@dice 4d6}")).toBe("`roll:4d6`");
  });

  it("converts {@recharge N}", () => {
    expect(convert5eToolsTags("{@recharge 5}")).toBe("(Recharge 5-6)");
  });

  it("converts {@spell name} to italic", () => {
    expect(convert5eToolsTags("{@spell fireball}")).toBe("_fireball_");
  });

  it("converts {@action name} to bold", () => {
    expect(convert5eToolsTags("{@action Dodge}")).toBe("**Dodge**");
  });

  it("strips display name from entity refs with pipes", () => {
    expect(convert5eToolsTags("{@spell fireball|PHB}")).toBe("_fireball_");
  });

  it("handles multiple tags in one string", () => {
    const input = "{@atk mw} {@hit 7} to hit, {@h} {@damage 2d6+3} slashing damage.";
    const result = convert5eToolsTags(input);
    expect(result).toBe("Melee Weapon Attack: `atk:+7` to hit, Hit: `damage:2d6+3` slashing damage.");
  });
});

describe("convert5eToolsTags bare-dice decoration", () => {
  it("wraps bare dice remaining after 5etools rewrites", () => {
    const input = "takes 2d6 fire damage";
    const result = convert5eToolsTags(input);
    expect(result).toBe("takes `dice:2d6` fire damage");
  });

  it("does not re-wrap dice inside a tag it just created", () => {
    // {@damage 2d6+4} -> `damage:2d6+4` -- the backtick-span alternation branch must protect it
    const input = "{@damage 2d6+4} slashing damage";
    const result = convert5eToolsTags(input);
    expect(result).toBe("`damage:2d6+4` slashing damage");
  });

  it("leaves tagless non-dice text unchanged", () => {
    expect(convert5eToolsTags("plain prose")).toBe("plain prose");
  });
});
