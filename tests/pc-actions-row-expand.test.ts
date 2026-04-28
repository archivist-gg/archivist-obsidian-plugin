/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { createExpandState, attachExpandToggle } from "../src/modules/pc/components/actions/row-expand";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";

beforeAll(() => installObsidianDomHelpers());

describe("row-expand helper", () => {
  it("createExpandState exposes is/toggle/keys for a Set<string>", () => {
    const s = createExpandState();
    expect(s.is("a")).toBe(false);
    s.toggle("a");
    expect(s.is("a")).toBe(true);
    s.toggle("a");
    expect(s.is("a")).toBe(false);
  });

  it("attachExpandToggle calls onChange when clicked and adds .open class", () => {
    const root = mountContainer();
    const row = root.createDiv({ cls: "pc-action-row" });
    const onChange = vi.fn();
    attachExpandToggle(row, "row-1", onChange);
    expect(row.querySelector(".pc-action-caret")).toBeTruthy();

    (row as HTMLElement).click();
    expect(onChange).toHaveBeenCalledWith("row-1");
  });
});
