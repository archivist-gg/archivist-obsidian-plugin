/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { renderEntityPicker } from "../src/modules/pc/components/builder/entity-picker";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";
import type { RegisteredEntity } from "../src/shared/entities/entity-registry";

beforeAll(() => installObsidianDomHelpers());

const races: RegisteredEntity[] = [
  { slug: "srd-5e_elf", name: "Elf", entityType: "race", filePath: "elf.md",
    data: { name: "Elf", edition: "2014" }, compendium: "SRD 5e", readonly: true, homebrew: false },
  { slug: "srd-2024_human", name: "Human", entityType: "race", filePath: "human.md",
    data: { name: "Human", edition: "2024" }, compendium: "SRD 2024", readonly: true, homebrew: false },
];

function fakeCtx(bag: Map<string, unknown>): ComponentRenderContext {
  return {
    core: {
      plugin: {},
      entities: {
        search: (q: string, type: string) =>
          races.filter((r) => r.entityType === type && r.name.toLowerCase().includes(q.toLowerCase())),
      },
      compendiums: { getAll: () => [
        { name: "SRD 5e", description: "", readonly: true, homebrew: false, folderPath: "" },
        { name: "SRD 2024", description: "", readonly: true, homebrew: false, folderPath: "" },
      ] },
      modules: { getByEntityType: () => undefined }, // detail pane falls back to the name line
    },
    builderUiState: bag,
  } as unknown as ComponentRenderContext;
}

const baseOpts = (onSelect = vi.fn()) =>
  ({ entityType: "race", stateKey: "p", selectedSlug: null, onSelect });

describe("renderEntityPicker", () => {
  it("lists candidates with source tags and leaves the detail pane empty", () => {
    const root = mountContainer();
    renderEntityPicker(root, fakeCtx(new Map()), baseOpts());
    expect(root.querySelectorAll(".pc-bpicker-row").length).toBe(2);
    expect(root.querySelector(".pc-bpicker-row .pc-bsrc")?.textContent).toBe("SRD 5e");
    expect(root.querySelector(".pc-bpicker-detail")!.childElementCount).toBe(0);
  });

  it("typing filters the list without rebuilding the search input (focus-safe)", () => {
    const root = mountContainer();
    renderEntityPicker(root, fakeCtx(new Map()), baseOpts());
    const input = root.querySelector<HTMLInputElement>(".pc-bpicker-search")!;
    input.value = "hum";
    input.dispatchEvent(new Event("input"));
    expect(root.querySelectorAll(".pc-bpicker-row").length).toBe(1);
    expect(root.querySelector<HTMLInputElement>(".pc-bpicker-search")).toBe(input);
  });

  it("unticking a compendium hides its rows", () => {
    const root = mountContainer();
    renderEntityPicker(root, fakeCtx(new Map()), baseOpts());
    const chip = [...root.querySelectorAll<HTMLElement>(".pc-bfilter-chip")]
      .find((c) => c.textContent === "SRD 2024")!;
    chip.click();
    const names = [...root.querySelectorAll(".pc-bpicker-name")].map((n) => n.textContent);
    expect(names).toEqual(["Elf"]);
  });

  it("row click focuses (detail pane) without selecting; the radio toggle selects", () => {
    const root = mountContainer();
    const onSelect = vi.fn();
    renderEntityPicker(root, fakeCtx(new Map()), baseOpts(onSelect));
    root.querySelector<HTMLElement>(".pc-bpicker-row")!.click();
    expect(root.querySelector(".pc-bpicker-detail .pc-bblock-fallback")?.textContent).toBe("Elf");
    expect(onSelect).not.toHaveBeenCalled();
    const toggle = root.querySelector<HTMLElement>(".pc-bpicker-row .pc-btoggle")!;
    expect(toggle.textContent).toBe(""); // hollow radio, not ＋
    toggle.click();
    expect(onSelect).toHaveBeenCalledWith("srd-5e_elf");
  });

  it("the row matching selectedSlug shows ✓, the sel class, and its block when nothing is focused", () => {
    const root = mountContainer();
    renderEntityPicker(root, fakeCtx(new Map()), { ...baseOpts(), selectedSlug: "srd-2024_human" });
    const human = [...root.querySelectorAll<HTMLElement>(".pc-bpicker-row")]
      .find((r) => r.querySelector(".pc-bpicker-name")?.textContent === "Human")!;
    expect(human.querySelector(".pc-btoggle")?.textContent).toBe("✓");
    expect(human.classList.contains("sel")).toBe(true);
    const elf = [...root.querySelectorAll<HTMLElement>(".pc-bpicker-row")]
      .find((r) => r.querySelector(".pc-bpicker-name")?.textContent === "Elf")!;
    expect(elf.classList.contains("sel")).toBe(false);
    expect(root.querySelector(".pc-bpicker-detail .pc-bblock-fallback")?.textContent).toBe("Human");
  });

  it("query + focus survive a full rebuild via the lifted bag", () => {
    const bag = new Map<string, unknown>();
    const root = mountContainer();
    renderEntityPicker(root, fakeCtx(bag), baseOpts());
    const input = root.querySelector<HTMLInputElement>(".pc-bpicker-search")!;
    input.value = "elf";
    input.dispatchEvent(new Event("input"));
    root.querySelector<HTMLElement>(".pc-bpicker-row")!.click();
    // simulate the editState-mutation full re-render
    const root2 = mountContainer();
    renderEntityPicker(root2, fakeCtx(bag), baseOpts());
    expect(root2.querySelector<HTMLInputElement>(".pc-bpicker-search")!.value).toBe("elf");
    expect(root2.querySelectorAll(".pc-bpicker-row").length).toBe(1);
    expect(root2.querySelector(".pc-bpicker-detail .pc-bblock-fallback")?.textContent).toBe("Elf");
  });

  it("shows the No-matches list hint and an empty detail pane when the query matches nothing", () => {
    const root = mountContainer();
    renderEntityPicker(root, fakeCtx(new Map()), baseOpts());
    const input = root.querySelector<HTMLInputElement>(".pc-bpicker-search")!;
    input.value = "zzz";
    input.dispatchEvent(new Event("input"));
    expect(root.querySelectorAll(".pc-bpicker-row").length).toBe(0);
    expect(root.querySelector(".pc-bpicker-list .pc-bpicker-empty")?.textContent).toBe("No matches.");
    expect(root.querySelector(".pc-bpicker-detail")!.childElementCount).toBe(0);
  });

  it("stale focus survives a transient filter exclusion", () => {
    const root = mountContainer();
    renderEntityPicker(root, fakeCtx(new Map()), baseOpts());
    root.querySelector<HTMLElement>(".pc-bpicker-row")!.click();
    expect(root.querySelector(".pc-bpicker-detail .pc-bblock-fallback")?.textContent).toBe("Elf");
    const input = root.querySelector<HTMLInputElement>(".pc-bpicker-search")!;
    input.value = "hum";
    input.dispatchEvent(new Event("input"));
    expect(root.querySelector(".pc-bpicker-detail")!.childElementCount).toBe(0);
    input.value = "";
    input.dispatchEvent(new Event("input"));
    expect(root.querySelector(".pc-bpicker-detail .pc-bblock-fallback")?.textContent).toBe("Elf");
  });

  it("clicking the toggle on an already-selected row is a no-op", () => {
    const root = mountContainer();
    const onSelect = vi.fn();
    renderEntityPicker(root, fakeCtx(new Map()), { ...baseOpts(onSelect), selectedSlug: "srd-5e_elf" });
    const elf = [...root.querySelectorAll<HTMLElement>(".pc-bpicker-row")]
      .find((r) => r.querySelector(".pc-bpicker-name")?.textContent === "Elf")!;
    elf.querySelector<HTMLElement>(".pc-btoggle")!.click();
    expect(onSelect).not.toHaveBeenCalled();
  });
});
