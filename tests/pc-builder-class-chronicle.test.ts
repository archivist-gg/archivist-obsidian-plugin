/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type { RegisteredEntity } from "@core/entity-registry";
import {
  renderClassChronicle,
  collectBrowseDecisions,
  mergedFeaturesByLevel,
  tableColumns,
  type ClassData,
  type SubclassData,
} from "../packages/obsidian/src/modules/pc/components/builder/class-chronicle";
import type { DecisionLedger } from "@archivist-gg/dnd5e/pc/pc.decision-engine";

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
      { kind: "choice", options: [
        { label: "Leather Armor, two Daggers, a Musical Instrument, an Entertainer's Pack, 19 GP", grants: [] },
        { label: "90 GP", grants: [] },
      ] },
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
      // Mirrors the real Bard L3 subclass feature, but carries NO authored
      // select-entity (the 2024 Bard gap) so the synthesized "Bard Subclass"
      // browse row is preserved. Present so the timeline locks at show-all.
      3: [
        { id: "bard-subclass", name: "Bard Subclass", description: "You gain a Bard subclass of your choice." },
      ],
      5: [
        { id: "font-of-inspiration", name: "Font of Inspiration", description: "You regain Bardic Inspiration on a short or long rest." },
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

/** Bard with the L3 subclass feature now carrying the authored select-entity
 *  pick — mirrors the FIXED 2024 runtime data (canonical pipeline backfills the
 *  feature level + the overlay attaches the choice). The walker must NOT
 *  synthesize a second subclass row off subclass_level, the same dedupe the
 *  Cleric test pins. Here the feature name ("Bard Subclass") happens to equal
 *  subclass_feature_name, so authored-choice detection (not name) is what
 *  suppresses the duplicate. */
function authoredBardData(): ClassData {
  const d = bardData();
  d.features_by_level![3] = [
    {
      id: "bard-subclass",
      name: "Bard Subclass",
      description: "You gain a Bard subclass of your choice.",
      choices: [{ kind: "select-entity", id: "subclass", count: 1, entity_type: "subclass", where: { parent_class: "self" } }],
    },
  ];
  return d;
}

const mkCtx = (): ComponentRenderContext =>
  ({
    resolved: { definition: {} },
    derived: {},
    services: { entities: {} },
    editState: null,
    builderUiState: new Map(),
  }) as unknown as ComponentRenderContext;

/** College-of-Lore-shaped subclass data: features at the Bard subclass levels
 *  (3, 6, 14). Used for the Fix-A merge tests. */
function loreSubclassData(): SubclassData {
  return {
    name: "College of Lore",
    features_by_level: {
      3: [{ id: "bonus-proficiencies", name: "Bonus Proficiencies", description: "You gain proficiency with three skills." },
        { id: "cutting-words", name: "Cutting Words", description: "You can use your wit to distract." }],
      6: [{ id: "magical-discoveries", name: "Magical Discoveries", description: "You learn two spells." }],
      14: [{ id: "peerless-skill", name: "Peerless Skill", description: "You can expend a use of Bardic Inspiration." }],
    },
  };
}

function loreSubclassEntity(): RegisteredEntity {
  return {
    slug: "srd-2024_college-of-lore",
    name: "College of Lore",
    entityType: "subclass",
    filePath: "Compendium/Subclasses/College of Lore.md",
    data: loreSubclassData() as unknown as Record<string, unknown>,
    compendium: "SRD 5.2",
    readonly: true,
    homebrew: false,
  };
}

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

  it("suppresses synthesis once Bard L3 carries the authored subclass choice (data-fix regression)", () => {
    const rows = collectBrowseDecisions(authoredBardData());
    const l3 = rows.filter((r) => r.level === 3);
    expect(l3).toEqual([{ level: 3, name: "Bard Subclass" }]); // single authored row, no synthesized duplicate
  });
});

describe("renderClassChronicle (browse)", () => {
  it("renders identity band, tiles, and the level-pill browse strip without controls", () => {
    const c = mountContainer();
    renderClassChronicle(c, mkCtx(), { entity: bardEntity(), level: 1, mode: "browse", stateKey: "t" });
    expect(c.querySelector(".pc-cb-name")!.textContent).toBe("Bard");
    const labels = [...c.querySelectorAll(".pc-cb-tl")].map((n) => n.textContent);
    // smoke r4: Skills + Subclass tiles dropped — the same facts live in the
    // decision strip below, so the block-top glance is the static identity set only.
    expect(labels).toEqual(["Hit Die", "Saves", "Primary", "Spellcasting"]);
    expect(labels).not.toContain("Skills");
    expect(labels).not.toContain("Subclass");
    expect(c.querySelector(".pc-dstrip-row .pc-dstrip-pill")!.textContent).toBe("L2");
    expect(c.querySelectorAll(".pc-bchoice-chip").length).toBe(0);   // browse = no controls
  });

  it("browse keeps the 'Level N of 20' sub-line segment and passes no band controls", () => {
    const c = mountContainer();
    renderClassChronicle(c, mkCtx(), { entity: bardEntity(), level: 3, mode: "browse", stateKey: "t" });
    expect(c.querySelector(".pc-cb-sub")!.textContent).toContain("Level 3 of 20");
    // Browse blocks are never collapsible and carry no inline band controls.
    expect(c.querySelector(".pc-cb-bh.collapsible")).toBeNull();
    expect(c.querySelector(".pc-cb-bh-rgt")).toBeNull();
    expect(c.querySelector(".pc-cb-bh-chev")).toBeNull();
  });
});

describe("renderClassChronicle (owned band)", () => {
  it("drops the 'Level N of 20' segment (the inline LV control replaces it)", () => {
    const c = mountContainer();
    renderClassChronicle(c, mkCtx(), { entity: bardEntity(), level: 5, mode: "owned", classIndex: 0, ledger: emptyLedger(), stateKey: "t" });
    expect(c.querySelector(".pc-cb-sub")!.textContent).not.toContain("Level 5 of 20");
    expect(c.querySelector(".pc-cb-sub")!.textContent).toContain("Class");
  });

  it("renders the bandRight hook into the band's right-side controls and the prereq `pre` into the body", () => {
    const c = mountContainer();
    renderClassChronicle(c, mkCtx(), {
      entity: bardEntity(), level: 5, mode: "owned", classIndex: 0, ledger: emptyLedger(), stateKey: "t",
      collapsible: true, collapsed: false,
      bandRight: (rgt) => rgt.createSpan({ cls: "test-control", text: "LV" }),
      pre: (host) => host.createDiv({ cls: "test-pre", text: "prereq" }),
    });
    expect(c.querySelector(".pc-cb-bh.collapsible .pc-cb-bh-rgt .test-control")).not.toBeNull();
    expect(c.querySelector(".pc-cb-bh-chev")!.textContent).toBe("▾");
    // `pre` content lives inside the block body (unmounts on collapse).
    expect(c.querySelector(".pc-cblock .test-pre")).not.toBeNull();
  });

  it("collapsed band unmounts tiles/strip/folds and the prereq `pre`; chevron reads closed", () => {
    const c = mountContainer();
    let toggled = false;
    renderClassChronicle(c, mkCtx(), {
      entity: bardEntity(), level: 5, mode: "owned", classIndex: 0, ledger: emptyLedger(), stateKey: "t",
      collapsible: true, collapsed: true,
      onToggleCollapse: () => { toggled = true; },
      bandRight: (rgt) => rgt.createSpan({ cls: "test-control", text: "LV" }),
      pre: (host) => host.createDiv({ cls: "test-pre", text: "prereq" }),
    });
    expect(c.querySelector(".pc-cb-glance")).toBeNull();
    expect(c.querySelector(".pc-cb-fold")).toBeNull();
    expect(c.querySelector(".test-pre")).toBeNull();
    // Controls stay rendered while collapsed; chevron closed; band click fires toggle.
    expect(c.querySelector(".pc-cb-bh-rgt .test-control")).not.toBeNull();
    expect(c.querySelector(".pc-cb-bh-chev")!.textContent).toBe("▸");
    (c.querySelector(".pc-cb-bh.collapsible") as HTMLElement).click();
    expect(toggled).toBe(true);
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

describe("feature timeline", () => {
  it("defaults to all 20 levels (hollow ahead); the ghost scopes down to the current level", () => {
    const c = mountContainer();
    renderClassChronicle(c, mkCtx(), { entity: bardEntity(), level: 2, mode: "browse", stateKey: "t" });
    // features fold is open by default in browse; ahead levels render locked (hollow)
    expect(c.querySelectorAll(".pc-cb-tle.locked").length).toBeGreaterThan(0);
    expect(c.querySelector(".pc-cb-tle.cur .pc-cb-med")?.textContent).toBe("2");
    const ghost = c.querySelector(".pc-cb-ghost") as HTMLElement;
    expect(ghost.textContent).toBe("scope to level 2");
    ghost.click();
    expect([...c.querySelectorAll(".pc-cb-tle")].every((e) => !e.classList.contains("locked"))).toBe(true);
  });

  it("marks decision-bearing features with the crimson meta", () => {
    const c = mountContainer();
    renderClassChronicle(c, mkCtx(), { entity: bardEntity(), level: 2, mode: "browse", stateKey: "t" });
    const expertise = [...c.querySelectorAll(".pc-cb-tle")].find((e) => e.textContent!.includes("Expertise"))!;
    expect(expertise.querySelector(".pc-cb-fmeta")).not.toBeNull();
  });

  it("Read full expands a multi-sentence feature description (mirrors race-step)", () => {
    const data = bardData();
    data.features_by_level = {
      1: [{
        id: "long-feature",
        name: "Long Feature",
        description: "First sentence is the headline. Second sentence adds detail that is hidden until expanded. Third sentence completes the prose.",
      }],
    };
    const entity = { ...bardEntity(), data: data as unknown as Record<string, unknown> };
    const c = mountContainer();
    renderClassChronicle(c, mkCtx(), { entity, level: 1, mode: "browse", stateKey: "t" });
    const tle = [...c.querySelectorAll(".pc-cb-tle")].find((e) => e.textContent!.includes("Long Feature"))!;
    const more = tle.querySelector(".pc-cb-more") as HTMLElement;
    const before = tle.querySelector(".pc-cb-fd")!.textContent!.length;
    more.click();
    expect(tle.querySelector(".pc-cb-fd")!.textContent!.length).toBeGreaterThan(before);
  });
});

describe("equipment & proficiencies fold", () => {
  const openEquipment = (c: HTMLElement) => {
    const fold = [...c.querySelectorAll(".pc-cb-fold-h")].find((h) => h.textContent!.includes("Equipment"))!;
    (fold as HTMLElement).click();
  };

  it("renders saves/skills props and lettered equipment option rows", () => {
    const c = mountContainer();
    renderClassChronicle(c, mkCtx(), { entity: bardEntity(), level: 1, mode: "browse", stateKey: "t" });
    openEquipment(c);
    expect(c.querySelector(".pc-cb-prop")).not.toBeNull();
    const opts = c.querySelectorAll(".pc-cb-eqopt");
    expect(opts.length).toBe(2);                                   // Bard: (A)…/(B) 90 GP
    expect(opts[0].querySelector(".pc-cb-eqltr")!.textContent).toBe("a");
  });

  it("badges each structured choice option a, b, c… and renders a fixed entry as the Equipment prop", () => {
    // Structured equipment: each choice carries an option array with display
    // labels; the renderer letters them per index (a/b) and the fixed entry's
    // grants humanize into the Equipment prop.
    const data = bardData();
    data.starting_equipment = [
      { kind: "choice", options: [
        { label: "a rapier", grants: [{ item: "rapier" }] },
        { label: "a longsword", grants: [{ item: "longsword" }] },
        { label: "any simple weapon", grants: [{ category: "simple-weapon" }] },
      ] },
      { kind: "fixed", grants: [{ item: "leather-armor" }, { item: "dagger" }] },
    ];
    const entity = { ...bardEntity(), data: data as unknown as Record<string, unknown> };
    const c = mountContainer();
    renderClassChronicle(c, mkCtx(), { entity, level: 1, mode: "browse", stateKey: "t" });
    openEquipment(c);
    const opts = [...c.querySelectorAll(".pc-cb-eqopt")];
    expect(opts.length).toBe(3);                                   // one row per option
    // each option is lettered a, b, c by index
    expect(opts[0].querySelector(".pc-cb-eqltr")!.textContent).toBe("a");
    expect(opts[1].querySelector(".pc-cb-eqltr")!.textContent).toBe("b");
    expect(opts[2].querySelector(".pc-cb-eqltr")!.textContent).toBe("c");
    expect(opts[0].querySelector(".pc-cb-eqtext")!.textContent).toBe("a rapier");
    expect(opts[2].querySelector(".pc-cb-eqtext")!.textContent).toBe("any simple weapon");
    // the fixed entry renders as the Equipment prop, not an eqopt row, with
    // grants humanized via grantLabel
    const equipProp = [...c.querySelectorAll(".pc-cb-prop")]
      .find((p) => p.querySelector(".pc-cb-prop-l")!.textContent === "Equipment")!;
    expect(equipProp.textContent).toContain("Leather Armor");
    expect(equipProp.textContent).toContain("Dagger");
  });
});

// ── Fix A: subclass granted features in the class card ────────────────────────

describe("mergedFeaturesByLevel", () => {
  it("unions class + subclass features ungated, tagging subclass entries", () => {
    const merged = mergedFeaturesByLevel(bardData(), loreSubclassData());
    // L3 carries the class "Bard Subclass" placeholder + the two Lore L3 features.
    const l3 = merged[3];
    expect(l3.map((m) => m.f.name)).toEqual(
      expect.arrayContaining(["Bard Subclass", "Bonus Proficiencies", "Cutting Words"]));
    expect(l3.find((m) => m.f.name === "Bard Subclass")!.fromSubclass).toBe(false);
    expect(l3.find((m) => m.f.name === "Cutting Words")!.fromSubclass).toBe(true);
    // L14 has no class feature but a subclass one — ungated, so it's present.
    expect(merged[14].map((m) => m.f.name)).toEqual(["Peerless Skill"]);
    expect(merged[14][0].fromSubclass).toBe(true);
  });

  it("returns class-only features when no subclass is supplied", () => {
    const merged = mergedFeaturesByLevel(bardData(), undefined);
    expect(Object.values(merged).flat().every((m) => !m.fromSubclass)).toBe(true);
    expect(merged[14]).toBeUndefined(); // class has no L14 feature
  });
});

describe("feature timeline — subclass features (owned)", () => {
  const openFeatures = (c: HTMLElement) => {
    const fold = [...c.querySelectorAll(".pc-cb-fold-h")].find((h) => h.textContent!.includes("Features by level"))!;
    (fold as HTMLElement).click();
  };

  it("folds picked-subclass features into the timeline with a crimson attribution", () => {
    const c = mountContainer();
    renderClassChronicle(c, mkCtx(), {
      entity: bardEntity(), level: 5, mode: "owned", classIndex: 0, ledger: emptyLedger(),
      subclassEntity: loreSubclassEntity(), stateKey: "t",
    });
    openFeatures(c);
    const tles = [...c.querySelectorAll(".pc-cb-tle")];
    // Cutting Words (subclass, L3 ≤ 5) is present and wears the .sub attribution.
    const cutting = tles.find((e) => e.textContent!.includes("Cutting Words"))!;
    expect(cutting).toBeDefined();
    const sub = cutting.querySelector(".pc-cb-fn .sub")!;
    expect(sub.textContent).toContain("College of Lore");
  });

  it("merged set defaults to all levels: future subclass features render locked; the ghost scopes them away", () => {
    const c = mountContainer();
    renderClassChronicle(c, mkCtx(), {
      entity: bardEntity(), level: 5, mode: "owned", classIndex: 0, ledger: emptyLedger(),
      subclassEntity: loreSubclassEntity(), stateKey: "t",
    });
    openFeatures(c);
    // Peerless Skill (subclass, L14 > 5) is visible immediately, locked…
    const peerless = [...c.querySelectorAll(".pc-cb-tle")].find((e) => e.textContent!.includes("Peerless Skill"))!;
    expect(peerless).toBeDefined();
    expect(peerless.classList.contains("locked")).toBe(true);
    // …and hidden once the ghost scopes to the current level.
    (c.querySelector(".pc-cb-ghost") as HTMLElement).click();
    expect([...c.querySelectorAll(".pc-cb-tle")].some((e) => e.textContent!.includes("Peerless Skill"))).toBe(false);
  });

  it("browse mode never injects subclass features (no subclassEntity threaded)", () => {
    const c = mountContainer();
    renderClassChronicle(c, mkCtx(), { entity: bardEntity(), level: 3, mode: "browse", stateKey: "t" });
    // features fold is open by default in browse
    expect([...c.querySelectorAll(".pc-cb-tle")].some((e) => e.textContent!.includes("Cutting Words"))).toBe(false);
    expect(c.querySelector(".pc-cb-fn .sub")).toBeNull();
  });
});

describe("progression — subclass features (owned)", () => {
  const openProgression = (c: HTMLElement) => {
    const fold = [...c.querySelectorAll(".pc-cb-fold-h")].find((h) => h.textContent!.includes("Progression"))!;
    (fold as HTMLElement).click();
  };

  it("appends subclass feature names into the per-level Features cell with the .sub dress", () => {
    const c = mountContainer();
    renderClassChronicle(c, mkCtx(), {
      entity: bardEntity(), level: 5, mode: "owned", classIndex: 0, ledger: emptyLedger(),
      subclassEntity: loreSubclassEntity(), stateKey: "t",
    });
    openProgression(c);
    const l3row = [...c.querySelectorAll(".pc-cb-pt-r")]
      .find((r) => r.querySelector(".pc-cb-pt-lvl")!.textContent === "3")!;
    const feat = l3row.querySelector(".pc-cb-pt-feat")!;
    expect(feat.textContent).toContain("Cutting Words");
    const subSpans = [...feat.querySelectorAll(".sub")].map((s) => s.textContent);
    expect(subSpans.some((t) => t!.includes("Cutting Words"))).toBe(true);
  });
});
