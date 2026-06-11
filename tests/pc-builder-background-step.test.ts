/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { renderBackgroundStep } from "../src/modules/pc/components/builder/background-step";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";
import type { RegisteredEntity } from "../src/shared/entities/entity-registry";

beforeAll(() => installObsidianDomHelpers());

// ── fixtures ──────────────────────────────────────────────────────────────
// ACOLYTE: a 2014 background with fixed skills + a language select-proficiency
// choice. CRIMINAL_2024: a 2024 background carrying a 2024 ASI pool (for the
// edition-mix banner) and an ability-points origin decision + an origin feat.
const ACOLYTE_DATA = {
  name: "Acolyte",
  skill_proficiencies: ["insight", "religion"],
  choices: [{
    kind: "select-proficiency", id: "lang", label: "Languages", count: 2,
    domain: "language", from: ["celestial", "abyssal"],
  }],
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

const ACOLYTE_ROW: RegisteredEntity = {
  slug: "srd-2014_acolyte", name: "Acolyte", entityType: "background", filePath: "x",
  readonly: true, homebrew: false, compendium: "SRD 2014", data: ACOLYTE_DATA,
} as unknown as RegisteredEntity;

const CRIMINAL_ROW: RegisteredEntity = {
  slug: "srd-2024_criminal", name: "Criminal", entityType: "background", filePath: "x",
  readonly: true, homebrew: false, compendium: "SRD 2024", data: CRIMINAL_2024_DATA,
} as unknown as RegisteredEntity;

const ALERT_FEAT: RegisteredEntity = {
  slug: "srd-2024_alert", name: "Alert", entityType: "feat", filePath: "x",
  readonly: true, homebrew: false, compendium: "SRD 2024", data: { name: "Alert" },
} as unknown as RegisteredEntity;

const BACKGROUNDS = [ACOLYTE_ROW, CRIMINAL_ROW];

/** Build a ctx for the background step. `chosen` marks definition.background +
 *  shapes `resolved.background` (the resolver-shaped entity the engine reads
 *  for origin decisions); `race` is the resolver-shaped species the banner reads
 *  for its ability-increase grant. When `chosen` is the criminal slug we seed
 *  the picker table's expanded set so its row restores open at render. */
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
    core: {
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

/** Resolver-shaped background the engine reads for origin decisions. */
const resolvedCriminal = {
  slug: "srd-2024_criminal", name: "Criminal", choices: CRIMINAL_2024_DATA.choices,
};

describe("renderBackgroundStep", () => {
  it("renders the ledger with Skills column and no toggle column", () => {
    const container = mountContainer();
    renderBackgroundStep(container, mkCtx());
    expect(container.querySelectorAll(".pc-btable-row").length).toBe(2);
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
      .find((r) => r.querySelector(".pc-btable-name")?.textContent === "Acolyte")!;
    row.click();
    expect(setBackground).toHaveBeenCalledWith("srd-2014_acolyte");
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

  it("origin feat resolves a PATH-style wikilink and renders an expandable info row", () => {
    const container = mountContainer();
    const ctx = mkCtx({ background: "[[srd-2024_criminal]]", resolvedBackground: resolvedCriminal });
    renderBackgroundStep(container, ctx);
    const row = container.querySelector(".pc-bofeat");
    expect(row).not.toBeNull();
    expect(row!.textContent).toContain("Origin Feat");
    // The value span must hold the resolved feat NAME, never the raw path. If the
    // path-style "[[SRD 2024/Feats/Alert]]" link fails to resolve, the value falls
    // back to the raw "SRD 2024/Feats/Alert" slug — which a `.toContain("Alert")`
    // would pass vacuously. Assert the exact name + that the feat block expands.
    expect(row!.querySelector(".pc-bofeat-v")?.textContent).toBe("Alert");
    expect(row!.querySelector(".pc-bofeat-x")).not.toBeNull();
  });

  it("origin feat resolves a parenthesized variant to its base feat, showing the variant name", () => {
    // Canonical 2024 Acolyte/Sage carry parenthesized origin-feat refs like
    // "[[SRD 2024/Feats/Magic Initiate (Cleric)]]" whose tail slugifies to
    // "magic-initiate-cleric" — but the only real feat is "srd-2024_magic-initiate"
    // ("Magic Initiate"). The row must resolve to the BASE feat while still
    // displaying the VARIANT name (honest about which variant the bg grants).
    const MAGIC_INITIATE_FEAT = {
      slug: "srd-2024_magic-initiate", name: "Magic Initiate", entityType: "feat",
      filePath: "x", readonly: true, homebrew: false, compendium: "SRD 2024",
      data: { name: "Magic Initiate" },
    } as unknown as RegisteredEntity;
    const container = mountContainer();
    const ctx = mkCtx({ background: "[[srd-2024_criminal]]", resolvedBackground: resolvedCriminal });
    (ctx.core.entities as { search: unknown }).search = (_q: string, type: string) =>
      type === "background" ? BACKGROUNDS : type === "feat" ? [MAGIC_INITIATE_FEAT] : [];
    const bgRow = BACKGROUNDS.find((b) => b.slug === "srd-2024_criminal")!;
    const prev = (bgRow.data as { origin_feat?: string }).origin_feat;
    (bgRow.data as { origin_feat?: string }).origin_feat = "[[SRD 2024/Feats/Magic Initiate (Cleric)]]";
    try {
      renderBackgroundStep(container, ctx);
      const row = container.querySelector<HTMLElement>(".pc-bofeat")!;
      // Variant display name (NOT the base "Magic Initiate", NOT the degraded slug).
      expect(row.querySelector(".pc-bofeat-v")?.textContent).toBe("Magic Initiate (Cleric)");
      // Chevron renders (the row is expandable).
      expect(row.querySelector(".pc-bofeat-x")).not.toBeNull();
      // Clicking expands the BASE feat's block (fallback name line = "Magic Initiate").
      row.click();
      const expand = container.querySelector(".pc-bofeat-expand");
      expect(expand).not.toBeNull();
      expect(expand!.textContent).toContain("Magic Initiate");
    } finally {
      (bgRow.data as { origin_feat?: string }).origin_feat = prev;
    }
  });

  it("origin feat resolves a bare-slug homebrew ref via exact-match", () => {
    const HOMEBREW_FEAT = {
      slug: "my-feat", name: "My Feat", entityType: "feat", filePath: "x",
      readonly: false, homebrew: true, compendium: "Homebrew", data: { name: "My Feat" },
    } as unknown as RegisteredEntity;
    const container = mountContainer();
    const ctx = mkCtx({ background: "[[srd-2024_criminal]]", resolvedBackground: resolvedCriminal });
    // Override the feat search to return ONLY the bare-slug homebrew feat, and point
    // the origin_feat at a bare-slug wikilink "[[my-feat]]".
    (ctx.core.entities as { search: unknown }).search = (_q: string, type: string) =>
      type === "background" ? BACKGROUNDS : type === "feat" ? [HOMEBREW_FEAT] : [];
    (resolvedCriminal as { name: string }).name; // keep ref shape stable
    const bgRow = BACKGROUNDS.find((b) => b.slug === "srd-2024_criminal")!;
    const prev = (bgRow.data as { origin_feat?: string }).origin_feat;
    (bgRow.data as { origin_feat?: string }).origin_feat = "[[my-feat]]";
    try {
      renderBackgroundStep(container, ctx);
      const row = container.querySelector(".pc-bofeat");
      expect(row!.querySelector(".pc-bofeat-v")?.textContent).toBe("My Feat");
    } finally {
      (bgRow.data as { origin_feat?: string }).origin_feat = prev;
    }
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
