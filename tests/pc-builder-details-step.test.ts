/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { renderDetailsStep } from "../src/modules/pc/components/builder/details-step";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";

beforeAll(() => installObsidianDomHelpers());

function mkCtx(over: {
  name?: string;
  alignment?: string | null;
  age?: string | null;
  editState?: unknown;
  bag?: Map<string, unknown>;
} = {}): ComponentRenderContext {
  return {
    resolved: {
      definition: {
        name: over.name ?? "T",
        alignment: over.alignment ?? undefined,
        age: over.age ?? undefined,
        class: [],
      },
    },
    derived: {},
    editState: over.editState ?? null,
    builderUiState: over.bag ?? new Map(),
  } as unknown as ComponentRenderContext;
}

describe("renderDetailsStep", () => {
  it("renders Name input prefilled, 3×3 alignment grid, Age input", () => {
    const body = mountContainer();
    renderDetailsStep(body, mkCtx());
    const nameInput = body.querySelector<HTMLInputElement>(".pc-binp");
    expect(nameInput?.value).toBe("T");

    const cells = [...body.querySelectorAll(".pc-bal")];
    expect(cells.length).toBe(9);
    const order = cells.map((c) => c.querySelector(".pc-bal-ab")?.textContent);
    expect(order).toEqual(["LG", "NG", "CG", "LN", "N", "CN", "LE", "NE", "CE"]);

    expect(body.querySelector(".pc-bage input")).not.toBeNull();
  });

  it("name input commits on change via setName", () => {
    const setName = vi.fn();
    const body = mountContainer();
    renderDetailsStep(body, mkCtx({ editState: { setName } }));
    const nameInput = body.querySelector<HTMLInputElement>(".pc-binp")!;
    nameInput.value = "Valeria";
    nameInput.dispatchEvent(new Event("change"));
    expect(setName).toHaveBeenCalledWith("Valeria");
  });

  it("alignment cell click writes the full alignment text; clicking the active cell clears", () => {
    const setAlignment = vi.fn();
    const body = mountContainer();
    renderDetailsStep(body, mkCtx({ editState: { setAlignment } }));
    const cg = [...body.querySelectorAll<HTMLElement>(".pc-bal")].find(
      (c) => c.querySelector(".pc-bal-ab")?.textContent === "CG",
    )!;
    cg.click();
    expect(setAlignment).toHaveBeenCalledWith("Chaotic Good");

    // With alignment already "Chaotic Good", CG carries .on and re-click clears.
    const body2 = mountContainer();
    const setAlignment2 = vi.fn();
    renderDetailsStep(body2, mkCtx({ alignment: "Chaotic Good", editState: { setAlignment: setAlignment2 } }));
    const cg2 = [...body2.querySelectorAll<HTMLElement>(".pc-bal")].find(
      (c) => c.querySelector(".pc-bal-ab")?.textContent === "CG",
    )!;
    expect(cg2.classList.contains("on")).toBe(true);
    cg2.click();
    expect(setAlignment2).toHaveBeenCalledWith(null);
  });

  it("age input commits via setAge; empty commits null", () => {
    const setAge = vi.fn();
    const body = mountContainer();
    renderDetailsStep(body, mkCtx({ editState: { setAge } }));
    const age = body.querySelector<HTMLInputElement>(".pc-bage input")!;
    age.value = "26";
    age.dispatchEvent(new Event("change"));
    expect(setAge).toHaveBeenCalledWith("26");

    age.value = "";
    age.dispatchEvent(new Event("change"));
    expect(setAge).toHaveBeenCalledWith(null);
  });
});

describe("renderDetailsStep — hit points choice (D10)", () => {
  it("renders the Hit Points seg toggle with Average selected by default, no number input", () => {
    const body = mountContainer();
    renderDetailsStep(body, mkCtx());
    const seg = body.querySelector(".pc-bseg");
    expect(seg).not.toBeNull();
    const avg = [...body.querySelectorAll<HTMLElement>(".pc-bseg-opt")].find((o) => o.textContent === "Average");
    expect(avg?.classList.contains("on")).toBe(true);
    expect(body.querySelector(".pc-bhp-input")).toBeNull();
  });

  it("switching to Manual shows a number input and persists the mode in builderUiState", () => {
    const bag = new Map<string, unknown>();
    const body = mountContainer();
    renderDetailsStep(body, mkCtx({ bag }));
    const man = [...body.querySelectorAll<HTMLElement>(".pc-bseg-opt")].find((o) => o.textContent === "Manual")!;
    man.click();
    expect(body.querySelector(".pc-bhp-input")).not.toBeNull();
    expect(bag.get("builder.details.hp")).toEqual({ mode: "manual", value: null });
  });
});
