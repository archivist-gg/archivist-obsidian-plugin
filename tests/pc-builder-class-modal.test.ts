/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { renderAddClassBody } from "../packages/obsidian/src/modules/pc/components/builder/class-modal";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type { RegisteredEntity } from "../packages/obsidian/src/shared/entities/entity-registry";
import type { ClassData } from "../packages/obsidian/src/modules/pc/components/builder/class-chronicle";

beforeAll(() => installObsidianDomHelpers());

/** A ClassData-shaped data bag per slug. Deliberately spare prose so the
 *  exclude test ("Bard" must not appear anywhere) is honest: no entry's
 *  description names another class. */
function classDataFor(slug: string): ClassData {
  const NAME = slug.split("_").slice(1).join("_");
  const display = NAME.charAt(0).toUpperCase() + NAME.slice(1);
  return {
    hit_die: NAME === "warlock" ? "d8" : "d8",
    primary_abilities: ["cha"],
    saving_throws: ["wis", "cha"],
    description: `A spellcaster who channels arcane power as a ${display}.`,
    source: "SRD 5.2",
    edition: "2024",
    features_by_level: {},
  };
}

function classEntity(slug: string): RegisteredEntity {
  const NAME = slug.split("_").slice(1).join("_");
  const display = NAME.charAt(0).toUpperCase() + NAME.slice(1);
  return {
    slug,
    name: display,
    entityType: "class",
    filePath: `Compendium/Classes/${display}.md`,
    data: classDataFor(slug) as unknown as Record<string, unknown>,
    compendium: "SRD 5.2",
    readonly: true,
    homebrew: false,
  };
}

function mkCtxWithClasses(slugs: string[]): ComponentRenderContext {
  const entities = slugs.map(classEntity);
  return {
    core: {
      plugin: {},
      entities: {
        search: (q: string, type: string) =>
          entities.filter(
            (e) => e.entityType === type && e.name.toLowerCase().includes(q.toLowerCase()),
          ),
        getByTypeAndSlug: (type: string, slug: string) =>
          entities.find((e) => e.entityType === type && e.slug === slug),
      },
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

describe("renderAddClassBody", () => {
  it("Add is disabled until a row is highlighted; row click highlights without writing", () => {
    const c = mountContainer();
    const onAdd = vi.fn();
    renderAddClassBody(c, mkCtxWithClasses(["srd-2024_bard", "srd-2024_warlock"]), { exclude: new Set(), onAdd, close: vi.fn() });
    const add = c.querySelector(".pc-bcm-add") as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    (c.querySelector(".pc-btable-row") as HTMLElement).click();
    const add2 = c.querySelector(".pc-bcm-add") as HTMLButtonElement;
    expect(add2.disabled).toBe(false);
    expect(add2.textContent).toContain("Add Bard");
    expect(onAdd).not.toHaveBeenCalled();                            // read ≠ add
  });

  it("footer Add commits the highlighted class and closes", () => {
    const c = mountContainer();
    const onAdd = vi.fn(); const close = vi.fn();
    renderAddClassBody(c, mkCtxWithClasses(["srd-2024_bard"]), { exclude: new Set(), onAdd, close });
    (c.querySelector(".pc-btable-row") as HTMLElement).click();
    (c.querySelector(".pc-bcm-add") as HTMLElement).click();
    expect(onAdd).toHaveBeenCalledWith("srd-2024_bard");
    expect(close).toHaveBeenCalled();
  });

  it("held classes are excluded from the ledger", () => {
    const c = mountContainer();
    renderAddClassBody(c, mkCtxWithClasses(["srd-2024_bard", "srd-2024_warlock"]), { exclude: new Set(["srd-2024_bard"]), onAdd: vi.fn(), close: vi.fn() });
    expect(c.textContent).not.toContain("Bard");
    expect(c.textContent).toContain("Warlock");
  });

  it("the expanded read carries the in-block claim bar committing the same action", () => {
    const c = mountContainer();
    const onAdd = vi.fn(); const close = vi.fn();
    renderAddClassBody(c, mkCtxWithClasses(["srd-2024_bard"]), { exclude: new Set(), onAdd, close });
    (c.querySelector(".pc-btable-row") as HTMLElement).click();
    (c.querySelector(".pc-bcm-claim") as HTMLElement).click();
    expect(onAdd).toHaveBeenCalledWith("srd-2024_bard");
    expect(close).toHaveBeenCalled();
  });
});
