/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { renderDecisionPickBody } from "../src/modules/pc/components/builder/decision-modal";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";
import type { RegisteredEntity } from "../src/shared/entities/entity-registry";

beforeAll(() => installObsidianDomHelpers());

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
    core: {
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

describe("renderDecisionPickBody", () => {
  it("renders a search input, a compendium filter, and the selection table rows", () => {
    const c = mountContainer();
    renderDecisionPickBody(c, mkCtx(), {
      title: "Weapon Mastery — choose 3", need: 3, candidates: CANDS,
      initialSelected: [], writeValue: vi.fn(), close: vi.fn(), stateKey: "t",
    });
    expect(c.querySelector(".pc-bpicker-search")).not.toBeNull();
    expect(c.querySelector(".pc-bfilter")).not.toBeNull();
    expect(c.querySelectorAll(".pc-btable-row").length).toBe(CANDS.length);
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
