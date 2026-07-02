/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { renderEntityBlock } from "../packages/obsidian/src/modules/pc/components/builder/entity-block";
import { renderEntityPicker } from "../packages/obsidian/src/modules/pc/components/builder/entity-picker";
import { raceModule } from "../packages/obsidian/src/modules/race/race.module";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type { RegisteredEntity } from "@core/entity-registry";
import { dnd5ePack } from "@archivist/dnd5e";
import { setEntityPresenters, setEntityPresenterKernel } from "../packages/obsidian/src/shared/rendering/entity-presenter-dispatch";
import type { EntityPresenter } from "../packages/obsidian/src/shared/rendering/entity-presenter";
import type { Archivist } from "@archivist/core";

beforeAll(() => installObsidianDomHelpers());

/** Flush queued microtasks/macrotasks so the async block renderer's
 *  `.then`/`.catch` has run before assertions. */
const flush = () => new Promise((r) => setTimeout(r, 0));

/** A realistic SRD race entry mirroring the vault Gnome code block — the
 *  `data` round-trips through raceModule.parseYaml (yaml.dump → parseRace). */
const gnome: RegisteredEntity = {
  slug: "srd-5e_gnome",
  name: "Gnome",
  entityType: "race",
  filePath: "Races/Gnome.md",
  compendium: "SRD 5e",
  readonly: true,
  homebrew: false,
  data: {
    slug: "srd-5e_gnome",
    name: "Gnome",
    edition: "2014",
    source: "SRD 5.1",
    size: "small",
    speed: { walk: 25 },
    vision: { darkvision: 60 },
    description: "Your gnome character has certain characteristics in common with all other gnomes.",
    ability_score_increases: [],
    age: "Gnomes mature at the same rate humans do.",
    alignment: "Gnomes are most often good.",
    languages: { fixed: [] },
    variant_label: "base",
    traits: [
      { name: "Ability Score Increase", description: "Your Intelligence score increases by 2." },
      { name: "Darkvision", description: "You have superior vision in dark and dim conditions within 60 feet." },
      { name: "Gnome Cunning", description: "You have advantage on Intelligence, Wisdom, and Charisma saving throws against magic." },
    ],
  },
};

const packKernel = {
  getEntityType: (t: string) => dnd5ePack.entityTypes.find((e) => e.type === t),
} as unknown as Archivist;
// T1 wrapper (raceModule is still an ArchivistModule until T2):
const racePresenter: EntityPresenter = {
  type: "race",
  render: (el, d, c) => raceModule.render!(el, d, c),
};
beforeEach(() => {
  setEntityPresenterKernel(packKernel);
  setEntityPresenters(new Map([["race", racePresenter]]));
});
afterEach(() => {
  setEntityPresenters(new Map());
  setEntityPresenterKernel(null as unknown as Archivist);
});

function pickerCtx(bag: Map<string, unknown>): ComponentRenderContext {
  return {
    core: {
      plugin: { app: {} },
      entities: { search: (_q: string, type: string) => (type === "race" ? [gnome] : []) },
      compendiums: { getAll: () => [
        { name: "SRD 5e", description: "", readonly: true, homebrew: false, folderPath: "" },
      ] },
    },
    builderUiState: bag,
  } as unknown as ComponentRenderContext;
}

describe("renderEntityBlock + real race module (integration)", () => {
  it("(a) fills the host with the real race block after a microtask flush", async () => {
    const root = mountContainer();
    renderEntityBlock(root, gnome);
    await flush();
    expect(root.querySelector(".archivist-race-block")).not.toBeNull();
    expect(root.querySelector(".archivist-race-block .spell-name")?.textContent).toBe("Gnome");
  });

  it("(d) surfaces .archivist-block-error when the async block render rejects", async () => {
    const root = mountContainer();
    const failingMod = {
      parseYaml: () => ({ success: true, data: { name: "Gnome" } }),
      // Shaped like the real modules: a stable wrapper plus an async renderer
      // that rejects; the module's own .catch must paint a visible diagnostic.
      render: raceModule.render,
    };
    // Drive the real race.module.render with a data shape that makes
    // renderRaceBlock reject (traits is not an array → .map throws inside the
    // async renderer, surfacing through the module's .catch).
    const badData = { name: "Gnome", traits: null } as unknown;
    failingMod.render!(root, badData, { plugin: { app: {} }, ctx: null });
    await flush();
    expect(root.querySelector(".archivist-block-error")).not.toBeNull();
    expect(root.querySelector(".archivist-block-error")?.textContent).toContain("Gnome");
  });
});

describe("renderEntityPicker + real race module (integration)", () => {
  it("(b) clicking the row unfolds the real race block inline", async () => {
    const root = mountContainer();
    renderEntityPicker(root, pickerCtx(new Map()), {
      entityType: "race", stateKey: "race", selectedSlug: null, onSelect: vi.fn(),
    });
    root.querySelector<HTMLElement>(".pc-btable-row")!.click();
    await flush();
    const expand = root.querySelector(".pc-btable-expand")!;
    expect(expand.querySelector(".archivist-race-block")).not.toBeNull();
    expect(expand.querySelector(".archivist-race-block .spell-name")?.textContent).toBe("Gnome");
  });
});
