/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { renderBackgroundStep } from "../packages/obsidian/src/modules/pc/components/builder/background-step";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type { RegisteredEntity } from "@core/entity-registry";

beforeAll(() => installObsidianDomHelpers());

// ── fixtures ──────────────────────────────────────────────────────────────
// ACOLYTE_2014: a 2014 background with fixed skills + a language select-
// proficiency choice and a named feature. ACOLYTE_2024 / CRIMINAL_2024:
// 2024 backgrounds carrying a 2024 ASI pool (for the edition-mix banner), an
// ability-points origin decision, and a fixed origin feat.
const ACOLYTE_2014_DATA = {
  name: "Acolyte",
  skill_proficiencies: ["insight", "religion"],
  language_proficiencies: [{ kind: "choice", count: 2, from: "any" }],
  feature: { name: "Shelter of the Faithful", description: "You command the respect of those who share your faith." },
  choices: [{ kind: "select-proficiency", id: "languages", count: 2, domain: "language" }],
};

const ACOLYTE_2024_DATA = {
  name: "Acolyte",
  skill_proficiencies: ["insight", "religion"],
  tool_proficiencies: [{ kind: "fixed", items: ["calligrapher's-supplies"] }],
  language_proficiencies: [],
  equipment: [
    { kind: "fixed", grants: [{ item: "holy-symbol", qty: 1 }, { item: "parchment", qty: 10 }] },
    { kind: "gold", amount: 8 },
  ],
  feature: { name: "Background Feature", description: "(No description provided.)" },
  ability_score_increases: { pool: ["int", "wis", "cha"] },
  origin_feat: "[[SRD 2024/Feats/Alert]]",
  choices: [{ kind: "ability-points", id: "abilities", points: 3, max_per: 2, pool: ["int", "wis", "cha"] }],
};

// SAGE_2014: a 2014 background carrying FIXED languages (the real normalizer
// shape — { kind: "fixed", languages: [...] }, never bare strings) and NO
// choice entry, so the Languages tile must show the humanized fixed names.
const SAGE_2014_DATA = {
  name: "Sage",
  skill_proficiencies: ["arcana", "history"],
  language_proficiencies: [{ kind: "fixed", languages: ["dwarvish", "giant"] }],
  feature: { name: "Researcher", description: "When you attempt to learn a piece of lore..." },
};

const CRIMINAL_2024_DATA = {
  name: "Criminal",
  skill_proficiencies: ["sleight-of-hand", "stealth"],
  ability_score_increases: { pool: ["dex", "con", "int"] },
  // Canonical 2024 backgrounds use PATH-style wikilinks, not slug-style. See
  // src/srd/data/canonical/backgrounds.2024.json — "[[SRD 2024/Feats/Alert]]".
  origin_feat: "[[SRD 2024/Feats/Alert]]",
  choices: [{ kind: "ability-points", id: "asi", points: 3, max_per: 2, pool: ["dex", "con", "int"] }],
};

const ACOLYTE_2014_ROW: RegisteredEntity = {
  slug: "srd-5e_acolyte", name: "Acolyte", entityType: "background", filePath: "x",
  readonly: true, homebrew: false, compendium: "SRD 2014", data: ACOLYTE_2014_DATA,
} as unknown as RegisteredEntity;

const SAGE_2014_ROW: RegisteredEntity = {
  slug: "srd-5e_sage", name: "Sage", entityType: "background", filePath: "x",
  readonly: true, homebrew: false, compendium: "SRD 2014", data: SAGE_2014_DATA,
} as unknown as RegisteredEntity;

const ACOLYTE_2024_ROW: RegisteredEntity = {
  slug: "srd-2024_acolyte", name: "Acolyte", entityType: "background", filePath: "x",
  readonly: true, homebrew: false, compendium: "SRD 2024", data: ACOLYTE_2024_DATA,
} as unknown as RegisteredEntity;

const CRIMINAL_ROW: RegisteredEntity = {
  slug: "srd-2024_criminal", name: "Criminal", entityType: "background", filePath: "x",
  readonly: true, homebrew: false, compendium: "SRD 2024", data: CRIMINAL_2024_DATA,
} as unknown as RegisteredEntity;

const ALERT_FEAT: RegisteredEntity = {
  slug: "srd-2024_alert", name: "Alert", entityType: "feat", filePath: "x",
  readonly: true, homebrew: false, compendium: "SRD 2024", data: { name: "Alert" },
} as unknown as RegisteredEntity;

const BACKGROUNDS = [ACOLYTE_2014_ROW, SAGE_2014_ROW, ACOLYTE_2024_ROW, CRIMINAL_ROW];

/** Build a ctx for the background step. `chosen` marks definition.background +
 *  shapes `resolved.background` (the resolver-shaped entity the engine reads
 *  for origin decisions); `race` is the resolver-shaped species the banner reads
 *  for its ability-increase grant. When `chosen` is set we seed the picker
 *  table's expanded set so its row restores open at render. */
function mkCtx(over: {
  background?: string | null;
  resolvedBackground?: unknown;
  race?: unknown;
  editState?: unknown;
} = {}): ComponentRenderContext {
  const builderUiState = new Map<string, unknown>();
  const chosenSlug = over.background ? over.background.replace(/\[\[|\]\]/g, "") : null;
  if (chosenSlug) {
    builderUiState.set("builder.background-picker.table", {
      sortKey: "name", sortDir: "asc", expanded: new Set([chosenSlug]),
    });
  }
  return {
    resolved: {
      definition: { background: over.background ?? null, origin_choices: {}, class: [] },
      race: (over.race as never) ?? null,
      background: (over.resolvedBackground as never) ?? null,
      classes: [], features: [],
    },
    derived: {},
    services: {
      plugin: {},
      entities: {
        search: (_q: string, type: string) =>
          type === "background" ? BACKGROUNDS : type === "feat" ? [ALERT_FEAT] : [],
        getByTypeAndSlug: () => undefined,
      },
      compendiums: {
        getAll: () => [
          { name: "SRD 2014", description: "", readonly: true, homebrew: false, folderPath: "" },
          { name: "SRD 2024", description: "", readonly: true, homebrew: false, folderPath: "" },
        ],
      },
      modules: { getByEntityType: () => undefined },
    },
    editState: over.editState ?? null,
    builderUiState,
  } as unknown as ComponentRenderContext;
}

/** Resolver-shaped backgrounds the engine reads for origin decisions. */
const resolvedCriminal = {
  slug: "srd-2024_criminal", name: "Criminal", choices: CRIMINAL_2024_DATA.choices,
};
const resolvedAcolyte2024 = {
  slug: "srd-2024_acolyte", name: "Acolyte", choices: ACOLYTE_2024_DATA.choices,
};
const resolvedAcolyte2014 = {
  slug: "srd-5e_acolyte", name: "Acolyte", choices: ACOLYTE_2014_DATA.choices,
};
const resolvedSage2014 = {
  slug: "srd-5e_sage", name: "Sage", choices: undefined,
};

// Chosen-background factories used by the Task-7 composition tests.
const mkCtxWithChosenAcolyte2024 = (): ComponentRenderContext =>
  mkCtx({ background: "[[srd-2024_acolyte]]", resolvedBackground: resolvedAcolyte2024 });
const mkCtxAcolyte2024WithAsiRace = (): ComponentRenderContext =>
  mkCtx({
    background: "[[srd-2024_acolyte]]",
    resolvedBackground: resolvedAcolyte2024,
    race: { slug: "srd-5e_half-elf", name: "Half-Elf", ability_score_increases: [{ ability: "cha", amount: 2 }] },
  });
const mkCtxWithChosenAcolyte2014 = (): ComponentRenderContext =>
  mkCtx({ background: "[[srd-5e_acolyte]]", resolvedBackground: resolvedAcolyte2014 });
const mkCtxWithChosenSage2014 = (): ComponentRenderContext =>
  mkCtx({ background: "[[srd-5e_sage]]", resolvedBackground: resolvedSage2014 });

describe("renderBackgroundStep", () => {
  it("renders the ledger with Skills column and no toggle column", () => {
    const container = mountContainer();
    renderBackgroundStep(container, mkCtx());
    expect(container.querySelectorAll(".pc-btable-row").length).toBe(4);
    expect(container.querySelectorAll(".pc-btoggle").length).toBe(0);
    const cells = [...container.querySelectorAll(".col-skills")];
    const acolyteCell = cells.find((c) => c.textContent?.includes("Insight"));
    expect(acolyteCell?.textContent).toBe("Insight, Religion");
  });

  it("row click selects via setBackground and expands", () => {
    const container = mountContainer();
    const setBackground = vi.fn();
    renderBackgroundStep(container, mkCtx({ editState: { setBackground } }));
    const row = [...container.querySelectorAll<HTMLElement>(".pc-btable-row")]
      .find((r) => r.querySelector(".pc-btable-name")?.textContent === "Criminal")!;
    row.click();
    expect(setBackground).toHaveBeenCalledWith("srd-2024_criminal");
    expect(container.querySelectorAll(".pc-btable-expand-row").length).toBe(1);
  });

  it("chosen background's expanded row shows its origin decisions", () => {
    const container = mountContainer();
    const ctx = mkCtx({ background: "[[srd-2024_criminal]]", resolvedBackground: resolvedCriminal });
    renderBackgroundStep(container, ctx);
    // The CRIMINAL_2024 ability-points decision renders as the −/+ stepper.
    expect(container.querySelectorAll(".pc-bpoints-cell").length).toBe(3);
    expect(container.textContent).toContain("DEX");
  });

  it("edition-mix banner appears when race grants ASI and background has a 2024 pool", () => {
    const container = mountContainer();
    const ctx = mkCtx({
      background: "[[srd-2024_criminal]]",
      resolvedBackground: resolvedCriminal,
      race: { slug: "srd-5e_half-elf", name: "Half-Elf", ability_score_increases: [{ ability: "cha", amount: 2 }] },
    });
    renderBackgroundStep(container, ctx);
    const warn = container.querySelector(".pc-bwarn");
    expect(warn).not.toBeNull();
    expect(warn!.textContent).toContain("Keep both");
  });

  it("no banner when the race grants no ASI", () => {
    const container = mountContainer();
    const ctx = mkCtx({
      background: "[[srd-2024_criminal]]",
      resolvedBackground: resolvedCriminal,
      race: null,
    });
    renderBackgroundStep(container, ctx);
    expect(container.querySelector(".pc-bwarn")).toBeNull();
  });
});

// ── Task 7: Chronicle-block composition (tiles, in-block strip, origin feat) ──

describe("renderBackgroundStep — Chronicle composition", () => {
  it("chosen Acolyte 2024 renders tiles, the in-block strip, and the origin-feat reference row (F13 guard)", () => {
    const c = mountContainer();
    renderBackgroundStep(c, mkCtxWithChosenAcolyte2024());
    const block = c.querySelector(".pc-btable-expand .pc-cblock")!;
    // F13 guard: for the CHOSEN background the resolver pipeline now owns the
    // origin feat (real Feats row + the strip reference below name it), so the
    // redundant "Origin Feat" glance TILE is suppressed — no double-render.
    expect([...block.querySelectorAll(".pc-cb-tl")].map((n) => n.textContent)).toEqual(
      ["Skills", "Tool", "Ability Points"]);
    expect(block.querySelector(".pc-dstrip")).not.toBeNull();
    const info = block.querySelector(".pc-dstrip-row.info")!;
    // The row is a lightweight NAME reference — the feat name, no "▸" expand affordance.
    expect(info.querySelector(".pc-dstrip-val")!.textContent).toContain("Alert");
    expect(info.querySelector(".pc-dstrip-val")!.textContent).not.toContain("▸");
    expect(c.querySelector(".pc-bledger")).toBeNull();
    expect(c.querySelector(".pc-bofeat")).toBeNull();                  // old below-block row gone
  });

  it("F13 guard: the origin-feat reference row is plain — NOT expandable, spawns no feat block", () => {
    const c = mountContainer();
    renderBackgroundStep(c, mkCtxWithChosenAcolyte2024());
    const row = c.querySelector(".pc-dstrip-row.info") as HTMLElement;
    expect(row).not.toBeNull();
    // The pipeline now renders the full feat card (as a Feats row on the sheet);
    // the builder must NOT re-render it. The row carries no `.expandable` affordance
    // and clicking it (or its value) spawns no `.pc-bofeat-expand` block.
    expect(row.classList.contains("expandable")).toBe(false);
    row.click();
    (row.querySelector(".pc-dstrip-val") as HTMLElement | null)?.click();
    expect(c.querySelector(".pc-bofeat-expand")).toBeNull();
  });

  it("edition-mix note renders INSIDE the block, above the identity band", () => {
    const c = mountContainer();
    renderBackgroundStep(c, mkCtxAcolyte2024WithAsiRace());            // race grants ASI → banner fires
    const block = c.querySelector(".pc-cblock")!;
    const kids = [...block.children].map((k) => k.className.split(" ")[0]);
    expect(kids.indexOf("pc-bwarn")).toBeGreaterThanOrEqual(0);
    expect(kids.indexOf("pc-bwarn")).toBeLessThan(kids.indexOf("pc-cb-bh"));
  });

  it("2014 background tiles show Languages choose-count and Feature name", () => {
    const c = mountContainer();
    renderBackgroundStep(c, mkCtxWithChosenAcolyte2014());
    const labels = [...c.querySelectorAll(".pc-cb-tl")].map((n) => n.textContent);
    expect(labels).toContain("Languages");
    expect(labels).toContain("Feature");
    const lang = [...c.querySelectorAll(".pc-cb-tile")].find((t) => t.querySelector(".pc-cb-tl")!.textContent === "Languages")!;
    expect(lang.querySelector(".pc-cb-tv")!.textContent).toContain("choose 2");
  });

  it("2014 fixed languages: Languages tile + gear-props row show the humanized fixed names", () => {
    const c = mountContainer();
    renderBackgroundStep(c, mkCtxWithChosenSage2014());
    // The Languages glance tile prefers the fixed entry's names over `choose <n>`.
    const langTile = [...c.querySelectorAll(".pc-cb-tile")].find(
      (t) => t.querySelector(".pc-cb-tl")!.textContent === "Languages")!;
    expect(langTile.querySelector(".pc-cb-tv")!.textContent).toBe("Dwarvish, Giant");
    // The "Proficiencies & starting gear" section's Languages prop renders them too.
    const langProp = [...c.querySelectorAll(".pc-cb-prop")].find(
      (p) => p.querySelector(".pc-cb-prop-l")!.textContent === "Languages")!;
    expect(langProp).not.toBeUndefined();
    expect(langProp.textContent).toContain("Dwarvish, Giant");
  });

  it("origin feat resolves a parenthesized variant to its base feat, showing the variant name", () => {
    const MAGIC_INITIATE_FEAT = {
      slug: "srd-2024_magic-initiate", name: "Magic Initiate", entityType: "feat",
      filePath: "x", readonly: true, homebrew: false, compendium: "SRD 2024",
      data: { name: "Magic Initiate" },
    } as unknown as RegisteredEntity;
    const c = mountContainer();
    const ctx = mkCtxWithChosenAcolyte2024();
    (ctx.services.entities as { search: unknown }).search = (_q: string, type: string) =>
      type === "background" ? BACKGROUNDS : type === "feat" ? [MAGIC_INITIATE_FEAT] : [];
    const prev = (ACOLYTE_2024_ROW.data as { origin_feat?: string }).origin_feat;
    (ACOLYTE_2024_ROW.data as { origin_feat?: string }).origin_feat = "[[SRD 2024/Feats/Magic Initiate (Cleric)]]";
    try {
      renderBackgroundStep(c, ctx);
      const info = c.querySelector(".pc-dstrip-row.info")!;
      // The lifted resolver keeps the VARIANT display name (NOT the base "Magic
      // Initiate", NOT the degraded slug) — resolving to the base feat is proven by
      // the resolver's own unit test; here we assert the builder surfaces the variant.
      expect(info.querySelector(".pc-dstrip-val")!.textContent).toContain("Magic Initiate (Cleric)");
    } finally {
      (ACOLYTE_2024_ROW.data as { origin_feat?: string }).origin_feat = prev;
    }
  });

  it("the chosen background's block ALWAYS shows: its row defaults open with nothing expanded (smoke r6)", () => {
    const c = mountContainer();
    const ctx = mkCtx({ background: "[[srd-2024_criminal]]", resolvedBackground: resolvedCriminal });
    // No row explicitly expanded — the resting default must open the chosen row.
    ctx.builderUiState!.delete("builder.background-picker.table");
    renderBackgroundStep(c, ctx);
    expect(c.querySelectorAll(".pc-btable-expand-row").length).toBe(1);
    const block = c.querySelector(".pc-btable-expand .pc-cblock")!;
    expect(block.querySelector(".pc-cb-name")!.textContent).toBe("Criminal");
    expect(block.querySelector(".pc-dstrip")).not.toBeNull();
  });

  it("re-clicking the chosen background's resting-default row is a no-op — the block stays shown (smoke r6)", () => {
    const c = mountContainer();
    const ctx = mkCtx({ background: "[[srd-2024_criminal]]", resolvedBackground: resolvedCriminal });
    ctx.builderUiState!.delete("builder.background-picker.table");
    renderBackgroundStep(c, ctx);
    const chosenRow = [...c.querySelectorAll<HTMLElement>(".pc-btable-row")]
      .find((r) => r.querySelector(".pc-btable-name")?.textContent === "Criminal")!;
    chosenRow.click();
    expect(c.querySelectorAll(".pc-btable-expand-row").length).toBe(1);
    expect(c.querySelector(".pc-btable-expand .pc-cb-name")!.textContent).toBe("Criminal");
  });

  it("origin feat resolves a bare-slug homebrew ref via exact-match", () => {
    const HOMEBREW_FEAT = {
      slug: "my-feat", name: "My Feat", entityType: "feat", filePath: "x",
      readonly: false, homebrew: true, compendium: "Homebrew", data: { name: "My Feat" },
    } as unknown as RegisteredEntity;
    const c = mountContainer();
    const ctx = mkCtxWithChosenAcolyte2024();
    (ctx.services.entities as { search: unknown }).search = (_q: string, type: string) =>
      type === "background" ? BACKGROUNDS : type === "feat" ? [HOMEBREW_FEAT] : [];
    const prev = (ACOLYTE_2024_ROW.data as { origin_feat?: string }).origin_feat;
    (ACOLYTE_2024_ROW.data as { origin_feat?: string }).origin_feat = "[[my-feat]]";
    try {
      renderBackgroundStep(c, ctx);
      const info = c.querySelector(".pc-dstrip-row.info")!;
      expect(info.querySelector(".pc-dstrip-val")!.textContent).toContain("My Feat");
    } finally {
      (ACOLYTE_2024_ROW.data as { origin_feat?: string }).origin_feat = prev;
    }
  });
});
