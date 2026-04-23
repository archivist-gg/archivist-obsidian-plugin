/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { renderPCSheet, renderPCSheetError } from "../src/modules/pc/pc.sheet";
import { ComponentRegistry } from "../src/modules/pc/components/component-registry";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { SheetComponent, ComponentRenderContext } from "../src/modules/pc/components/component.types";
import type { ResolvedCharacter, DerivedStats } from "../src/modules/pc/pc.types";
import type { CoreAPI } from "../src/core/module-api";

beforeAll(() => installObsidianDomHelpers());

class Probe implements SheetComponent {
  constructor(readonly type: string) {}
  render(el: HTMLElement, _ctx?: ComponentRenderContext) { el.createDiv({ cls: `probe-${this.type}`, text: this.type }); }
}

function fullRegistry(): ComponentRegistry {
  const r = new ComponentRegistry();
  for (const t of [
    "header-section", "ability-row", "combat-stats-row",
    "saves-panel", "senses-panel", "skills-panel", "proficiencies-panel",
    "tabs-container",
  ]) r.register(new Probe(t));
  return r;
}

const resolved = { state: {} } as unknown as ResolvedCharacter;
const derived = {} as DerivedStats;
const core = {} as CoreAPI;

describe("renderPCSheet", () => {
  it("empties root then writes the sheet wrapper", () => {
    const root = mountContainer();
    root.createDiv({ cls: "should-be-cleared" });
    renderPCSheet({ root, resolved, derived, registry: fullRegistry(), core, warnings: [] });
    expect(root.querySelector(".should-be-cleared")).toBeNull();
    expect(root.querySelector(".archivist-pc-sheet")).not.toBeNull();
  });

  it("renders top strip, body, and sidebar + content", () => {
    const root = mountContainer();
    renderPCSheet({ root, resolved, derived, registry: fullRegistry(), core, warnings: [] });
    expect(root.querySelector(".pc-header .probe-header-section")).not.toBeNull();
    expect(root.querySelector(".pc-abilities .probe-ability-row")).not.toBeNull();
    expect(root.querySelector(".pc-combat .probe-combat-stats-row")).not.toBeNull();
    expect(root.querySelector(".pc-sidebar .probe-saves-panel")).not.toBeNull();
    expect(root.querySelector(".pc-sidebar .probe-skills-panel")).not.toBeNull();
    expect(root.querySelector(".pc-content .probe-tabs-container")).not.toBeNull();
  });

  it("renders warning banner when warnings non-empty", () => {
    const root = mountContainer();
    renderPCSheet({ root, resolved, derived, registry: fullRegistry(), core, warnings: ["Missing race", "Bad slug"] });
    const items = root.querySelectorAll(".archivist-pc-warnings li");
    expect(items.length).toBe(2);
  });

  it("does not render warning banner when empty", () => {
    const root = mountContainer();
    renderPCSheet({ root, resolved, derived, registry: fullRegistry(), core, warnings: [] });
    expect(root.querySelector(".archivist-pc-warnings")).toBeNull();
  });

  it("shows '(No renderer for X)' for unregistered components", () => {
    const root = mountContainer();
    renderPCSheet({ root, resolved, derived, registry: new ComponentRegistry(), core, warnings: [] });
    const missings = [...root.querySelectorAll(".pc-empty-line")].map((e) => e.textContent);
    expect(missings.some((t) => t?.includes("No renderer for header-section"))).toBe(true);
  });
});

describe("renderPCSheetError", () => {
  it("renders error with H2, message, and fallback button", () => {
    const root = mountContainer();
    let called = false;
    renderPCSheetError(root, "Boom", () => { called = true; });
    expect(root.querySelector(".archivist-pc-error h2")?.textContent).toBe("Cannot render character sheet");
    expect(root.textContent).toContain("Boom");
    (root.querySelector<HTMLButtonElement>("button.mod-cta")!).click();
    expect(called).toBe(true);
  });
});
