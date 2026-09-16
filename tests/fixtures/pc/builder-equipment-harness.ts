import { vi } from "vitest";
import { CharacterEditState } from "../../../packages/obsidian/src/modules/pc/pc.edit-state";
import { renderEquipmentStep } from "../../../packages/obsidian/src/modules/pc/components/builder/equipment-step";
import { mountContainer, installObsidianDomHelpers } from "./dom-helpers";
import type { Character, EquipmentEntry } from "@archivist-gg/dnd5e/pc/pc.types";
import type { ComponentRenderContext } from "../../../packages/obsidian/src/modules/pc/components/component.types";
import type { RegisteredEntity } from "@core/entity-registry";

export function entity(slug: string, name: string, entityType: string, data: Record<string, unknown> = {}): RegisteredEntity {
  return { slug, name, entityType, filePath: "", data, compendium: "SRD", readonly: true, homebrew: false };
}

function makeRegistry(pool: RegisteredEntity[]) {
  return {
    search: (q: string, type: string, _n: number) =>
      pool.filter((e) => e.entityType === type && e.name.toLowerCase().includes(q.toLowerCase())),
    getBySlug: (slug: string) => pool.find((e) => e.slug === slug),
    getByTypeAndSlug: (type: string, slug: string) =>
      pool.find((e) => e.entityType === type && e.slug === slug),
  };
}

export interface StepHarnessOptions {
  /** `undefined` (the default) omits the `currency` key entirely · the fresh-draft shape. */
  gp?: number;
  /** `undefined` (the default) omits `builder_equipment_mode` · the FINISHED-character shape. */
  mode?: "starting" | "gold" | "empty";
  equipment?: EquipmentEntry[];
  /** Class-level choices, keyed by level as the real file is: `{ 1: { "equipment-0": "option-1" } }`. */
  choices?: Record<number, Record<string, unknown>>;
  startingEquipment?: unknown[];
  startingGold?: unknown;
  pool?: RegisteredEntity[];
  /** `false` omits `builderUiState` from the ctx entirely (I3). */
  bag?: boolean;
  /** `true` makes onChange re-invoke the render, as production does. */
  reRenderOnChange?: boolean;
  /** Depth cap for the re-render loop; exceeding it throws (G1's observable control). */
  maxDepth?: number;
}

export function mountStep(opts: StepHarnessOptions = {}) {
  installObsidianDomHelpers();   // idempotent; the harness must not rely on a caller's beforeAll
  const pool = opts.pool ?? [
    entity("srd-5e_armor_leather", "Leather", "armor", { category: "light" }),
    entity("srd-5e_weapon_dagger", "Dagger", "weapon", { category: "simple-melee" }),
    entity("srd-2024_armor_chain-mail", "Chain Mail", "armor", { category: "heavy" }),
  ];
  const choices = opts.choices ?? { 1: {} };
  const classEntity = {
    slug: "srd-5e_class_rogue", name: "Rogue",
    starting_equipment: opts.startingEquipment ?? [],
    starting_gold: opts.startingGold,
  };
  // ⚠️ `choices` is LEVEL-KEYED and the SAME object is aliased into both the
  // character and the resolved class. `readClassChoice` reads it off the
  // CHARACTER (`definition.class[0].choices[1][key]`) and never off
  // `resolved.classes`; flattening the level away, or dropping the character-side
  // alias, makes every selection invisible and silently zeroes G for every guard
  // that picks.
  const character = {
    name: "T", edition: "2014", race: null, subrace: null, background: null,
    class: [{ name: "[[srd-5e_class_rogue]]", level: 1, subclass: null, choices }],
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    ability_method: "manual",
    skills: { proficient: [], expertise: [] },
    spells: { known: [], overrides: [] },
    equipment: opts.equipment ?? [],
    overrides: {}, origin_choices: {},
    state: { hp: { current: 10, max: 10, temp: 0 }, hit_dice: {}, spell_slots: {},
      concentration: null, conditions: [], inspiration: 0, exhaustion: 0 },
  } as unknown as Character;
  if (opts.gp !== undefined) {
    (character as { currency?: unknown }).currency = { cp: 0, sp: 0, ep: 0, gp: opts.gp, pp: 0 };
  }
  if (opts.mode !== undefined) {
    (character as { builder_equipment_mode?: string }).builder_equipment_mode = opts.mode;
  }

  const bag = opts.bag === false ? undefined : new Map<string, unknown>();
  const counts = { onChange: 0, render: 0 };
  const maxDepth = opts.maxDepth ?? 12;

  const es = new CharacterEditState(
    character,
    () => ({
      resolved: { definition: character, race: null, classes: [], background: null, feats: [],
        totalLevel: 1, features: [], spells: [], state: character.state },
      derived: {} as never,
    }),
    () => {
      counts.onChange += 1;
      if (opts.reRenderOnChange) {
        if (counts.render >= maxDepth) {
          throw new Error(`RE-ENTRANCY CAP: renderEquipmentStep re-entered ${counts.render} times`);
        }
        render();
      }
    },
    makeRegistry(pool) as never,
  );

  const ctx = {
    resolved: {
      definition: character,
      classes: [{ entity: classEntity, level: 1, subclass: null, choices }],
      background: null, race: null, feats: [], totalLevel: 1, features: [], spells: [],
      pools: [], state: {} as never,
    },
    derived: {} as never,
    app: {} as never,
    services: { entities: makeRegistry(pool) },
    editState: es,
    builderUiState: bag,
  } as unknown as ComponentRenderContext;

  let container = mountContainer();
  function render() {
    counts.render += 1;
    container = mountContainer();
    renderEquipmentStep(container, ctx);
    return container;
  }

  const adjustSpy = vi.spyOn(es, "adjustCurrency");
  const setCurrencySpy = vi.spyOn(es, "setCurrency");
  const syncSpy = vi.spyOn(es, "syncStartingEquipment");

  return { character, es, ctx, bag, render, counts, adjustSpy, setCurrencySpy, syncSpy,
    get container() { return container; } };
}
