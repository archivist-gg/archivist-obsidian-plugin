/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { renderCustomBackgroundRow } from "../src/modules/pc/components/builder/custom-background";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";
import type { RegisteredEntity } from "../src/shared/entities/entity-registry";

beforeAll(() => installObsidianDomHelpers());

const CRIMINAL: RegisteredEntity = {
  slug: "srd-2024_criminal", name: "Criminal", entityType: "background", filePath: "x",
  readonly: true, homebrew: false, compendium: "SRD 2024",
  data: { name: "Criminal", feature: { name: "Criminal Contact", description: "You have a contact." } },
} as unknown as RegisteredEntity;

const ACOLYTE: RegisteredEntity = {
  slug: "srd-2014_acolyte", name: "Acolyte", entityType: "background", filePath: "x",
  readonly: true, homebrew: false, compendium: "SRD 2014",
  data: { name: "Acolyte", feature: { name: "Shelter of the Faithful", description: "You command respect." } },
} as unknown as RegisteredEntity;

const BACKGROUNDS = [CRIMINAL, ACOLYTE];

function flushPromises(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

/** Build a ctx whose compendium manager exposes both getAll() (a homebrew "Me")
 *  and a spy saveEntity resolving a registered entity with a generated slug. */
function mkCtx(over: { saveEntity?: ReturnType<typeof vi.fn>; setBackground?: ReturnType<typeof vi.fn>; edition?: string } = {}): ComponentRenderContext {
  const saveEntity = over.saveEntity ?? vi.fn().mockResolvedValue({ slug: "me_wandering-scholar" });
  const setBackground = over.setBackground ?? vi.fn();
  return {
    resolved: {
      definition: { background: null, origin_choices: {}, class: [], edition: over.edition ?? "2014" },
      race: null, background: null, classes: [], features: [],
    },
    derived: {},
    core: {
      plugin: {},
      entities: {
        search: (_q: string, type: string) => (type === "background" ? BACKGROUNDS : []),
        getByTypeAndSlug: () => undefined,
      },
      compendiums: {
        getAll: () => [
          { name: "SRD 2014", description: "", readonly: true, homebrew: false, folderPath: "" },
          { name: "Me", description: "", readonly: false, homebrew: true, folderPath: "" },
        ],
        saveEntity,
      },
      modules: { getByEntityType: () => undefined },
    },
    editState: { setBackground },
    builderUiState: new Map<string, unknown>(),
  } as unknown as ComponentRenderContext;
}

describe("renderCustomBackgroundRow", () => {
  it("renders the pinned ✦ Custom Background row with the Build tag", () => {
    const container = mountContainer();
    renderCustomBackgroundRow(container, mkCtx());
    const row = container.querySelector(".pc-bcustomrow");
    expect(row).not.toBeNull();
    expect(row!.textContent).toContain("Custom Background");
    expect(container.querySelector(".pc-bctag")?.textContent).toBe("Build");
    // The form is closed until the row is clicked.
    expect(container.querySelector(".pc-bcustom")).toBeNull();
  });

  it("clicking the row toggles the parts-builder form open and closed", () => {
    const container = mountContainer();
    renderCustomBackgroundRow(container, mkCtx());
    const row = container.querySelector<HTMLElement>(".pc-bcustomrow")!;
    row.click();
    expect(container.querySelector(".pc-bcustom")).not.toBeNull();
    container.querySelector<HTMLElement>(".pc-bcustomrow")!.click();
    expect(container.querySelector(".pc-bcustom")).toBeNull();
  });

  it("skills callout: clicking 2 skill chips fills state.skills (choose 2 over 18)", () => {
    const container = mountContainer();
    const ctx = mkCtx();
    renderCustomBackgroundRow(container, ctx);
    container.querySelector<HTMLElement>(".pc-bcustomrow")!.click();
    // The skills callout reuses .pc-bchoice with all 18 skill slugs.
    const calls = [...container.querySelectorAll(".pc-bchoice")];
    const skillCallout = calls.find((c) => c.textContent?.includes("Skills"))!;
    const chips = [...skillCallout.querySelectorAll<HTMLElement>(".pc-bchoice-chip")];
    expect(chips.length).toBe(18);
    chips.find((c) => c.textContent === "History")!.click();
    chips.find((c) => c.textContent === "Insight")!.click();
    const st = ctx.builderUiState!.get("builder.bg-custom") as { skills: string[] };
    expect(st.skills.sort()).toEqual(["history", "insight"]);
  });

  it("extras: typing a value + clicking + tool / + language adds a chip, capped at 2", () => {
    const container = mountContainer();
    const ctx = mkCtx();
    renderCustomBackgroundRow(container, ctx);
    container.querySelector<HTMLElement>(".pc-bcustomrow")!.click();
    const input = () => container.querySelector<HTMLInputElement>(".pc-bextra-input")!;
    const addTool = () => container.querySelector<HTMLElement>(".pc-bextra-add-tool")!;
    const addLang = () => container.querySelector<HTMLElement>(".pc-bextra-add-lang")!;
    input().value = "Thieves' Tools";
    addTool().click();
    let st = ctx.builderUiState!.get("builder.bg-custom") as { extras: Array<{ kind: string; value: string }> };
    expect(st.extras).toEqual([{ kind: "tool", value: "Thieves' Tools" }]);
    input().value = "Elvish";
    addLang().click();
    st = ctx.builderUiState!.get("builder.bg-custom") as { extras: Array<{ kind: string; value: string }> };
    expect(st.extras.length).toBe(2);
    // Cap at 2: a third add is refused.
    input().value = "Smith's Tools";
    addTool().click();
    st = ctx.builderUiState!.get("builder.bg-custom") as { extras: Array<{ kind: string; value: string }> };
    expect(st.extras.length).toBe(2);
  });

  it("feature seg toggle: Borrow shows a select; Write shows name+textarea; ✦ Ask Inquiry is disabled", () => {
    const container = mountContainer();
    const ctx = mkCtx();
    renderCustomBackgroundRow(container, ctx);
    container.querySelector<HTMLElement>(".pc-bcustomrow")!.click();
    const segs = [...container.querySelectorAll<HTMLElement>(".pc-bseg-opt")];
    expect(segs.map((s) => s.textContent)).toContain("Borrow");
    // Default mode = Borrow → a select of existing backgrounds' features.
    expect(container.querySelector("select.pc-bborrow")).not.toBeNull();
    // ✦ Ask Inquiry seg carries the Plan-6 disabled marker + title hint.
    const inquiry = segs.find((s) => s.textContent?.includes("Inquiry"))!;
    expect(inquiry.classList.contains("disabled")).toBe(true);
    expect(inquiry.getAttribute("title")?.length).toBeGreaterThan(0);
    // Switch to Write → name + textarea inputs replace the select.
    segs.find((s) => s.textContent === "Write your own")!.click();
    expect(container.querySelector("select.pc-bborrow")).toBeNull();
    expect(container.querySelector(".pc-bfeat-name")).not.toBeNull();
    expect(container.querySelector("textarea.pc-bfeat-text")).not.toBeNull();
  });

  it("Create & use is disabled until valid, then saves the homebrew entity and selects it", async () => {
    const container = mountContainer();
    const saveEntity = vi.fn().mockResolvedValue({ slug: "me_wandering-scholar" });
    const setBackground = vi.fn();
    const ctx = mkCtx({ saveEntity, setBackground });
    renderCustomBackgroundRow(container, ctx);
    container.querySelector<HTMLElement>(".pc-bcustomrow")!.click();
    const createBtn = () => container.querySelector<HTMLButtonElement>(".pc-bcreate")!;
    // Disabled with no name.
    expect(createBtn().disabled).toBe(true);

    // Type a name (commit on change, not input).
    const nameInput = container.querySelector<HTMLInputElement>(".pc-bcustom-name")!;
    nameInput.value = "Wandering Scholar";
    nameInput.dispatchEvent(new Event("change"));

    // After the redraw the button is enabled (name present, borrow feature defaults).
    expect(createBtn().disabled).toBe(false);
    createBtn().click();

    await vi.waitFor(() => expect(saveEntity).toHaveBeenCalledTimes(1));
    expect(saveEntity).toHaveBeenCalledWith("Me", "background", expect.objectContaining({ name: "Wandering Scholar" }));
    await flushPromises();
    expect(setBackground).toHaveBeenCalledWith("me_wandering-scholar");
  });
});
