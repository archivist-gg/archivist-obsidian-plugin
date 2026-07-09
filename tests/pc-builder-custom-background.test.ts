import { describe, it, expect } from "vitest";
import {
  buildCustomBackgroundData,
  emptyCustomBackgroundState,
} from "../packages/obsidian/src/modules/pc/components/builder/custom-background";
import { backgroundEntitySchema } from "@archivist-gg/dnd5e/background/background.schema";

describe("buildCustomBackgroundData", () => {
  it("assembles a valid background entity from the form state", () => {
    const st = emptyCustomBackgroundState();
    st.name = "Wandering Scholar";
    st.skills = ["history", "insight"];
    st.extras = [
      { kind: "tool", value: "Cartographer's tools" },
      { kind: "language", value: "Elvish" },
    ];
    st.featureMode = "write";
    st.featureName = "Field Notes";
    st.featureText = "You keep meticulous notes.";
    const data = buildCustomBackgroundData(st, "2014");
    expect(data).not.toBeNull();
    expect(data!.name).toBe("Wandering Scholar");
    expect(data!.edition).toBe("2014");
    expect(data!.source).toBe("Homebrew");
    expect(data!.skill_proficiencies).toEqual(["history", "insight"]);
    // REAL union shapes (background.types.ts): fixed tool = { kind, items[] },
    // fixed language = { kind, languages[] } — NOT { kind, value }.
    expect(data!.tool_proficiencies).toEqual([
      { kind: "fixed", items: ["Cartographer's tools"] },
    ]);
    expect(data!.language_proficiencies).toEqual([
      { kind: "fixed", languages: ["Elvish"] },
    ]);
    expect(data!.feature).toEqual({ name: "Field Notes", description: "You keep meticulous notes." });
    expect(data!.ability_score_increases).toBeNull();
    expect(data!.origin_feat).toBeNull();
  });

  it("borrowed feature carries the source background's feature", () => {
    const st = emptyCustomBackgroundState();
    st.name = "X";
    st.featureMode = "borrow";
    st.borrowedFeature = { name: "Criminal Contact", description: "You have a contact." };
    const data = buildCustomBackgroundData(st, "2014");
    expect(data!.feature).toEqual({ name: "Criminal Contact", description: "You have a contact." });
  });

  it("2024-style extras attach the pool and origin feat + the matching ability-points choice", () => {
    const st = emptyCustomBackgroundState();
    st.name = "X";
    st.extras2024 = { pool: ["dex", "con", "int"], originFeat: "srd-2024_alert" };
    const data = buildCustomBackgroundData(st, "2024");
    expect(data!.ability_score_increases).toEqual({ pool: ["dex", "con", "int"] });
    expect(data!.origin_feat).toBe("[[srd-2024_alert]]");
    expect(data!.choices).toEqual([
      { kind: "ability-points", id: "asi", label: "Ability Scores", points: 3, max_per: 2, pool: ["dex", "con", "int"] },
    ]);
  });

  it("2024 drawer with an incomplete pool omits ASI/origin-feat/choices (valid 2014-shaped record)", () => {
    // Reproduces the reviewer-found MEDIUM bug: opening the 2024 drawer seeds
    // `extras2024 = { pool: [], originFeat: null }`. While the pool is not yet
    // exactly 3 abilities the assembler must NOT carry the degenerate
    // ability_score_increases/origin_feat/choices — "omit while incomplete" —
    // so Create & use never persists an entity the real schema rejects.
    const st = emptyCustomBackgroundState();
    st.name = "Half-built";
    st.extras2024 = { pool: [], originFeat: null };
    const data = buildCustomBackgroundData(st, "2024")!;
    expect(data).not.toBeNull();
    expect(data.ability_score_increases).toBeNull();
    expect(data.origin_feat).toBeNull();
    expect(data.choices).toBeUndefined();
    // The incomplete-drawer record is a valid 2014-shaped entity.
    const parsed = backgroundEntitySchema.safeParse({ slug: "me_half-built", ...data });
    expect(parsed.success).toBe(true);
  });

  it("2024 drawer with a partial (1- or 2-ability) pool still omits the benefits", () => {
    const st = emptyCustomBackgroundState();
    st.name = "Two-of-three";
    st.extras2024 = { pool: ["dex", "con"], originFeat: "srd-2024_alert" };
    const data = buildCustomBackgroundData(st, "2024")!;
    expect(data.ability_score_increases).toBeNull();
    expect(data.origin_feat).toBeNull();
    expect(data.choices).toBeUndefined();
    const parsed = backgroundEntitySchema.safeParse({ slug: "me_two-of-three", ...data });
    expect(parsed.success).toBe(true);
  });

  it("validation: requires a name and exactly 2 skills + 2 extras when provided", () => {
    const st = emptyCustomBackgroundState();
    expect(buildCustomBackgroundData(st, "2014")).toBeNull(); // no name
    st.name = "X";
    st.skills = ["history"]; // 1 of 2
    expect(buildCustomBackgroundData(st, "2014")).toBeNull();
  });

  it("the assembled record parses under the real background schema (synthetic slug)", () => {
    // saveEntity GENERATES the slug from the name; the schema requires one to
    // parse a stored entity. We graft a synthetic slug to prove the rest of the
    // shape (feature.description min(1), pool length(3), fixed-entry unions,
    // origin_feat wikilink) is schema-valid as authored.
    const st = emptyCustomBackgroundState();
    st.name = "Wandering Scholar";
    st.skills = ["history", "insight"];
    st.extras = [
      { kind: "tool", value: "cartographers-tools" },
      { kind: "language", value: "elvish" },
    ];
    st.featureMode = "write";
    st.featureName = "Field Notes";
    st.featureText = "You keep meticulous notes.";
    st.extras2024 = { pool: ["dex", "con", "int"], originFeat: "srd-2024_alert" };
    const data = buildCustomBackgroundData(st, "2024")!;
    const parsed = backgroundEntitySchema.safeParse({ slug: "me_wandering-scholar", ...data });
    expect(parsed.success).toBe(true);
  });

  it("write-mode with empty text still yields a schema-valid (min(1)) feature description", () => {
    // feature.description is z.string().min(1); an empty textarea must not produce
    // an unparseable entity — the assembler substitutes a placeholder line.
    const st = emptyCustomBackgroundState();
    st.name = "X";
    st.featureMode = "write";
    st.featureName = "Bare Feature";
    st.featureText = "";
    const data = buildCustomBackgroundData(st, "2014")!;
    const feature = data.feature as { name: string; description: string };
    expect(feature.name).toBe("Bare Feature");
    expect(feature.description.length).toBeGreaterThan(0);
    const parsed = backgroundEntitySchema.safeParse({ slug: "me_x", ...data });
    expect(parsed.success).toBe(true);
  });
});
