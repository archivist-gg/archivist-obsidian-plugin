/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";
import type { RegisteredEntity } from "../src/shared/entities/entity-registry";
import {
  renderClassChronicle,
  collectBrowseDecisions,
  tableColumns,
  type ClassData,
} from "../src/modules/pc/components/builder/class-chronicle";
import type { DecisionLedger } from "../src/modules/pc/pc.decision-engine";

const emptyLedger = (): DecisionLedger => ({ classes: [], origin: [] });

beforeAll(() => installObsidianDomHelpers());

const BARD_SKILLS = [
  "acrobatics", "animal-handling", "arcana", "athletics", "deception", "history",
  "insight", "intimidation", "investigation", "medicine", "nature", "perception",
  "performance", "persuasion", "religion", "sleight-of-hand", "stealth", "survival",
];

/** Minimal Bard-shaped runtime class entity (mirrors the 2024 class JSON).
 *  Dense `table` rows for levels 1–5 (prof_bonus + columns + feature_ids);
 *  sparse `features_by_level` at levels 1 and 2 only — an authored Expertise
 *  choice at 2, plain features at 1. No authored select-entity subclass (the
 *  2024 Bard gap), so the subclass row must be synthesized off subclass_level. */
function bardData(): ClassData {
  return {
    hit_die: "d8",
    primary_abilities: ["cha"],
    saving_throws: ["cha", "dex"],
    skill_choices: { count: 3, from: BARD_SKILLS },
    proficiencies: {
      armor: ["light"],
      weapons: { fixed: ["dagger"], categories: ["simple"] },
    },
    spellcasting: { ability: "cha", preparation: "known", spell_list: "Bard" },
    subclass_level: 3,
    subclass_feature_name: "Bard Subclass",
    starting_equipment: [
      { kind: "choice", options: ["a rapier", "any simple weapon"] },
      { kind: "gold", amount: 90 },
    ],
    table: {
      1: { prof_bonus: 2, columns: { "Bardic Die": "d6", Cantrips: 2, "Prepared Spells": 4, "1st": 2 }, feature_ids: ["bardic-inspiration", "spellcasting"] },
      2: { prof_bonus: 2, columns: { "Bardic Die": "d6", Cantrips: 2, "Prepared Spells": 5, "1st": 3 }, feature_ids: ["expertise", "jack-of-all-trades"] },
      3: { prof_bonus: 2, columns: { "Bardic Die": "d6", Cantrips: 2, "Prepared Spells": 6, "1st": 4, "2nd": 2 }, feature_ids: ["bard-subclass"] },
      4: { prof_bonus: 2, columns: { "Bardic Die": "d6", Cantrips: 3, "Prepared Spells": 7, "1st": 4, "2nd": 3 }, feature_ids: ["ability-score-improvement"] },
      5: { prof_bonus: 3, columns: { "Bardic Die": "d8", Cantrips: 3, "Prepared Spells": 9, "1st": 4, "2nd": 3 }, feature_ids: ["font-of-inspiration"] },
    },
    features_by_level: {
      1: [
        { id: "bardic-inspiration", name: "Bardic Inspiration", description: "You can supernaturally inspire others." },
        { id: "spellcasting", name: "Spellcasting", description: "You have learned to cast spells." },
      ],
      2: [
        {
          id: "expertise",
          name: "Expertise",
          description: "Choose two of your skill proficiencies.",
          choices: [{ kind: "select-proficiency", id: "expertise", count: 2, domain: "skill", expertise: true }],
        },
        { id: "jack-of-all-trades", name: "Jack of All Trades", description: "You add half your proficiency bonus." },
      ],
    },
    description: "An inspiring magician whose power echoes the music of creation. Bards are masters of song.",
    source: "SRD 5.2",
    edition: "2024",
  };
}

function bardEntity(): RegisteredEntity {
  return {
    slug: "srd-2024_bard",
    name: "Bard",
    entityType: "class",
    filePath: "Compendium/Classes/Bard.md",
    data: bardData() as unknown as Record<string, unknown>,
    compendium: "SRD 5.2",
    readonly: true,
    homebrew: false,
  };
}

const mkCtx = (): ComponentRenderContext =>
  ({
    resolved: { definition: {} },
    derived: {},
    core: { entities: {} },
    editState: null,
    builderUiState: new Map(),
  }) as unknown as ComponentRenderContext;

/** Minimal Cleric-shaped runtime class entity (mirrors the 2024 class JSON).
 *  Here `subclass_feature_name` ("Cleric Subclass", singular) differs from the
 *  authored L3 feature's own name ("Cleric Subclasses", plural) — they come
 *  from different source fields. The L3 feature carries the authored
 *  select-entity subclass pick, so the walker must NOT synthesize a second row
 *  off subclass_level (a name-based dedupe would, since the strings differ). */
function clericData(): ClassData {
  return {
    hit_die: "d8",
    primary_abilities: ["wis"],
    saving_throws: ["wis", "cha"],
    subclass_level: 3,
    subclass_feature_name: "Cleric Subclass",
    features_by_level: {
      1: [
        { id: "spellcasting", name: "Spellcasting", description: "You can cast cleric spells." },
        { id: "divine-order", name: "Divine Order", description: "You have dedicated yourself." },
      ],
      3: [
        {
          id: "cleric-subclasses",
          name: "Cleric Subclasses",
          description: "You gain a Cleric subclass of your choice.",
          choices: [{ kind: "select-entity", id: "subclass", count: 1, entity_type: "subclass", where: { parent_class: "self" } }],
        },
      ],
    },
    description: "A priestly champion who wields divine magic in service of a higher power.",
    source: "SRD 5.2",
    edition: "2024",
  };
}

describe("collectBrowseDecisions", () => {
  it("collects authored choices and guarantees the subclass row even when unauthored", () => {
    const rows = collectBrowseDecisions(bardData());          // bardData: no select-entity subclass authored (the 2024 Bard gap)
    expect(rows).toContainEqual({ level: 2, name: "Expertise" });
    expect(rows).toContainEqual({ level: 3, name: "Bard Subclass" });
    expect(rows.map((r) => r.level)).toEqual([...rows.map((r) => r.level)].sort((a, b) => a - b));
  });

  it("dedupes the subclass row by authored choice, not name (Cleric: 'Cleric Subclass' vs 'Cleric Subclasses')", () => {
    const rows = collectBrowseDecisions(clericData());
    const l3 = rows.filter((r) => r.level === 3);
    expect(l3).toEqual([{ level: 3, name: "Cleric Subclasses" }]); // exactly the authored row, no synthesized duplicate
  });
});

describe("renderClassChronicle (browse)", () => {
  it("renders identity band, tiles, and the level-pill browse strip without controls", () => {
    const c = mountContainer();
    renderClassChronicle(c, mkCtx(), { entity: bardEntity(), level: 1, mode: "browse", stateKey: "t" });
    expect(c.querySelector(".pc-cb-name")!.textContent).toBe("Bard");
    const labels = [...c.querySelectorAll(".pc-cb-tl")].map((n) => n.textContent);
    expect(labels).toEqual(expect.arrayContaining(["Hit Die", "Saves", "Primary", "Skills", "Subclass", "Spellcasting"]));
    expect(c.querySelector(".pc-dstrip-row .pc-dstrip-pill")!.textContent).toBe("L2");
    expect(c.querySelectorAll(".pc-bchoice-chip").length).toBe(0);   // browse = no controls
  });
});

describe("tableColumns", () => {
  it("splits scalars (first-seen order) from ordinal slots (numeric sort)", () => {
    const { scalars, slots } = tableColumns(bardData().table!);
    expect(scalars).toEqual(["Bardic Die", "Cantrips", "Prepared Spells"]);
    expect(slots).toEqual(["1st", "2nd"]);
  });
});

describe("progression table", () => {
  const openProgression = (c: HTMLElement) => {
    const fold = [...c.querySelectorAll(".pc-cb-fold-h")].find((h) => h.textContent!.includes("Progression"))!;
    (fold as HTMLElement).click();
  };

  it("renders a row per table level with prof bonus and feature names", () => {
    const c = mountContainer();
    renderClassChronicle(c, mkCtx(), { entity: bardEntity(), level: 3, mode: "browse", stateKey: "t" });
    openProgression(c);
    const rows = c.querySelectorAll(".pc-cb-pt-r");
    expect(rows.length).toBe(Object.keys(bardData().table!).length);
    expect(rows[0].textContent).toContain("+2");
    expect(rows[0].textContent).toContain("Bardic Inspiration");
  });

  it("splits scalar columns from ordinal slot columns and highlights the current level", () => {
    const c = mountContainer();
    renderClassChronicle(c, mkCtx(), { entity: bardEntity(), level: 3, mode: "owned", classIndex: 0, ledger: emptyLedger(), stateKey: "t" });
    openProgression(c);
    const head = c.querySelector(".pc-cb-pt-h")!;
    expect(head.textContent).toContain("Bardic Die");
    expect(head.textContent).toContain("Spell Slots");
    const cur = c.querySelector(".pc-cb-pt-r.cur")!;
    expect(cur.querySelector(".pc-cb-pt-lvl")!.textContent).toBe("3");
  });

  it("renders – for missing slot cells", () => {
    const c = mountContainer();
    renderClassChronicle(c, mkCtx(), { entity: bardEntity(), level: 1, mode: "browse", stateKey: "t" });
    openProgression(c);
    expect(c.querySelectorAll(".pc-cb-pt-s.z").length).toBeGreaterThan(0);
  });
});
