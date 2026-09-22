/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import type { App } from "obsidian";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { renderDecisionPickBody, DecisionPickModal } from "../packages/obsidian/src/modules/pc/components/builder/decision-modal";
import { closeCompendiumFilterPopover } from "../packages/obsidian/src/modules/pc/components/builder/compendium-filter";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type { RegisteredEntity } from "@core/entity-registry";

beforeAll(() => installObsidianDomHelpers());

afterEach(() => {
  closeCompendiumFilterPopover();
  while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
});

const pop = (): HTMLElement | null => document.body.querySelector<HTMLElement>(".pc-bfilter-pop");

function weaponEntity(slug: string): RegisteredEntity {
  const name = slug.charAt(0).toUpperCase() + slug.slice(1);
  return {
    slug, name, entityType: "weapon", filePath: `Compendium/Weapons/${name}.md`,
    data: { edition: "2024" } as unknown as Record<string, unknown>,
    compendium: "SRD 5.2", readonly: true, homebrew: false,
  } as RegisteredEntity;
}

function mkCtx(): ComponentRenderContext {
  return {
    services: {
      compendiums: {
        getAll: () => [
          { name: "SRD 5.2", description: "", readonly: true, homebrew: false, folderPath: "" },
        ],
      },
      modules: { getByEntityType: () => undefined },
    },
    builderUiState: new Map(),
  } as unknown as ComponentRenderContext;
}

const CANDS = ["longsword", "shortsword", "greataxe", "dagger", "rapier"].map(weaponEntity);

function compEntity(slug: string, name: string, compendium: string): RegisteredEntity {
  return {
    slug, name, entityType: "weapon", filePath: `Compendium/Weapons/${name}.md`,
    data: { edition: compendium === "SRD 2024" ? "2024" : "2014" } as unknown as Record<string, unknown>,
    compendium, readonly: true, homebrew: false,
  } as RegisteredEntity;
}

// ctx variant that carries hidden-compendium settings + a two-compendium roster.
function mkVisCtx(): ComponentRenderContext {
  return {
    services: {
      plugin: { settings: { hiddenCompendiums: ["SRD 5e"] } },
      compendiums: {
        getAll: () => [
          { name: "SRD 5e", description: "", readonly: true, homebrew: false, folderPath: "" },
          { name: "SRD 2024", description: "", readonly: true, homebrew: false, folderPath: "" },
          { name: "Me", description: "", readonly: false, homebrew: true, folderPath: "" },
        ],
      },
      modules: { getByEntityType: () => undefined },
    },
    builderUiState: new Map(),
  } as unknown as ComponentRenderContext;
}

describe("renderDecisionPickBody", () => {
  it("renders the search row and the selection table rows; one compendium leaves nothing to filter", () => {
    const c = mountContainer();
    renderDecisionPickBody(c, mkCtx(), {
      title: "Weapon Mastery — choose 3", need: 3, candidates: CANDS,
      initialSelected: [], writeValue: vi.fn(), close: vi.fn(), stateKey: "t",
    });
    expect(c.querySelector(".pc-bpicker-bar .pc-bpicker-search")).not.toBeNull();
    expect(c.querySelector(".pc-bfilter-btn")).toBeNull();
    expect(c.querySelectorAll(".pc-btable-row").length).toBe(CANDS.length);
  });

  it("the filter button sits on the search row and unticking a compendium hides its rows", () => {
    const c = mountContainer();
    renderDecisionPickBody(c, mkVisCtx(), {
      title: "Pick: choose 1", need: 1,
      candidates: [compEntity("halberd", "Halberd", "SRD 2024"), compEntity("club", "Club", "Me")],
      initialSelected: [], writeValue: vi.fn(), close: vi.fn(), stateKey: "t",
    });
    c.querySelector<HTMLElement>(".pc-bpicker-bar .pc-bfilter-btn")!.click();
    const meRow = [...pop()!.querySelectorAll<HTMLElement>(".pc-bfilter-row")]
      .find((r) => r.querySelector(".pc-bfilter-name")?.textContent === "Me")!;
    meRow.querySelector<HTMLInputElement>("input")!.click();
    expect([...c.querySelectorAll(".pc-btable-name")].map((n) => n.textContent)).toEqual(["Halberd"]);
  });

  it("the popover's scope sits on the modal's own scope, so global hotkeys stay off over the modal", () => {
    const stack: unknown[] = [];
    const app = {
      scope: { keys: [] },
      keymap: { pushScope: (s: unknown) => { stack.push(s); }, popScope: () => { stack.pop(); } },
    } as unknown as App;
    const modal = new DecisionPickModal(app, { ...mkVisCtx(), app } as ComponentRenderContext, {
      title: "Pick: choose 1", need: 1,
      candidates: [compEntity("halberd", "Halberd", "SRD 2024"), compEntity("club", "Club", "Me")],
      initialSelected: [], writeValue: vi.fn(), stateKey: "t",
    });
    modal.open();
    modal.contentEl.querySelector<HTMLElement>(".pc-bfilter-btn")!.click();
    expect((stack[0] as { parent?: unknown }).parent).toBe(modal.scope);
    modal.close();
  });

  it("closing the modal takes an open filter popover with it", () => {
    const app = {} as App;
    const modal = new DecisionPickModal(app, mkVisCtx(), {
      title: "Pick: choose 1", need: 1,
      candidates: [compEntity("halberd", "Halberd", "SRD 2024"), compEntity("club", "Club", "Me")],
      initialSelected: [], writeValue: vi.fn(), stateKey: "t",
    });
    modal.open();
    modal.contentEl.querySelector<HTMLElement>(".pc-bfilter-btn")!.click();
    expect(pop()).not.toBeNull();
    modal.close();
    expect(pop()).toBeNull();
  });

  it("a row toggle writes immediately and updates the live count", () => {
    const c = mountContainer();
    const writeValue = vi.fn();
    renderDecisionPickBody(c, mkCtx(), {
      title: "Weapon Mastery — choose 3", need: 3, candidates: CANDS,
      initialSelected: [], writeValue, close: vi.fn(), stateKey: "t",
    });
    (c.querySelector(".pc-btable-row .pc-btoggle") as HTMLElement).click();
    expect(writeValue).toHaveBeenCalledTimes(1);
    expect(writeValue.mock.calls[0][0]).toHaveLength(1);                 // wrote a 1-element array
    expect(c.querySelector(".pc-bdecide-count")!.textContent).toContain("1 of 3");
  });

  it("enforces the choose-N cap (refuses past need)", () => {
    const c = mountContainer();
    const writeValue = vi.fn();
    renderDecisionPickBody(c, mkCtx(), {
      title: "Pick — choose 2", need: 2, candidates: CANDS,
      initialSelected: ["longsword", "shortsword"], writeValue, close: vi.fn(), stateKey: "t",
    });
    // greataxe is the 3rd alphabetical row → clicking it is refused at the cap.
    const rows = [...c.querySelectorAll(".pc-btable-row")] as HTMLElement[];
    const greataxe = rows.find((r) => r.textContent?.includes("Greataxe"))!;
    (greataxe.querySelector(".pc-btoggle") as HTMLElement).click();
    expect(writeValue).not.toHaveBeenCalled();
    expect(c.querySelector(".pc-bdecide-count")!.textContent).toContain("2 of 2");
  });

  it("the Done button just closes (selection already persisted live)", () => {
    const c = mountContainer();
    const close = vi.fn();
    renderDecisionPickBody(c, mkCtx(), {
      title: "Pick — choose 3", need: 3, candidates: CANDS,
      initialSelected: [], writeValue: vi.fn(), close, stateKey: "t",
    });
    (c.querySelector(".pc-bdecide-done") as HTMLElement).click();
    expect(close).toHaveBeenCalled();
  });
});

describe("compendium visibility (F7)", () => {
  it("the filter popover omits hidden compendiums, even one holding a candidate", () => {
    const c = mountContainer();
    renderDecisionPickBody(c, mkVisCtx(), {
      title: "Pick: choose 2", need: 2,
      candidates: [
        compEntity("halberd", "Halberd", "SRD 2024"),
        compEntity("club", "Club", "Me"),
        compEntity("flail", "Flail", "SRD 5e"), // hidden compendium
      ],
      initialSelected: [], writeValue: vi.fn(), close: vi.fn(), stateKey: "t",
    });
    c.querySelector<HTMLElement>(".pc-bfilter-btn")!.click();
    const names = [...pop()!.querySelectorAll(".pc-bfilter-name")].map((el) => el.textContent);
    expect(names).toEqual(["Me", "SRD 2024"]);
  });

  it("self-protecting predicate: an unfiltered hidden candidate is dropped; a selected one is kept", () => {
    const c = mountContainer();
    // Deliberately unfiltered: a future caller passing raw candidates. The
    // predicate must drop the hidden-and-unselected row on its own, yet keep
    // the hidden row that seeded initialSelected (selected-exemption).
    const candidates = [
      compEntity("flail", "Flail", "SRD 5e"),        // hidden, unselected → dropped
      compEntity("rapier", "Rapier", "SRD 5e"),      // hidden, selected   → kept
      compEntity("halberd", "Halberd", "SRD 2024"),  // visible            → kept
    ];
    renderDecisionPickBody(c, mkVisCtx(), {
      title: "Pick: choose 3", need: 3, candidates,
      initialSelected: ["rapier"], writeValue: vi.fn(), close: vi.fn(), stateKey: "t",
    });
    const names = [...c.querySelectorAll(".pc-btable-name")].map((n) => n.textContent);
    expect(names).not.toContain("Flail");
    expect(names).toContain("Rapier");
    expect(names).toContain("Halberd");
  });
});
