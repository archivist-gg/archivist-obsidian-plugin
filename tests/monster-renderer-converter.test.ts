/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { createArchivist, parseContainer } from "@archivist-gg/core";
import type { StoragePort } from "@archivist-gg/core";
import { dnd5ePack } from "@archivist-gg/dnd5e";
import type { Monster } from "@archivist-gg/dnd5e/monster/monster.types";
import { renderMonsterBlock } from "../packages/obsidian/src/modules/monster/monster.renderer";
import { fillMarkdown } from "../packages/obsidian/src/modules/monster/monster.sections";
import { installObsidianDomHelpers } from "./fixtures/pc/dom-helpers";

/** R4-G6 §12.5 · converter monsters through the production chain (parse → resolve → render). The converter root comes
 *  from G6_CONVERTER_ROOT; an absent root FAILS loudly. Markdown-filled sections render as TEXT under the jsdom mock, so
 *  the zero-`[[` assertion runs on the block MINUS those containers (their strings are pinned in dnd5e). Since Q-11
 *  (R4-G7 spec §7.6) a FEATURE CARD's prose is markdown-rendered the same way, so its entry joins that exclusion:
 *  14 of the 20 samples carry a wikilink inside a feature entry (MEASURED, `g7-t4-owntext-measure-2.txt`). The
 *  exclusion is narrowed to `.archivist-feature:not(.archivist-monster-spellcasting) .archivist-feature-entry`
 *  because `renderSpellcastingEntry` draws its lines with the SAME entry class on a card of its own and still
 *  resolves them through `renderTextWithInlineTags` (13 of the 20 samples carry a link in a spellcasting block), so
 *  those lines stay INSIDE the guard. What the assertion guards is every part of the block the plugin builds itself:
 *  the header, the property lines, the tab strip, the feature NAMES, the attack lines and the spellcasting card's
 *  name AND its entry lines; only the routed feature prose is out. */
const ROOT = process.env.G6_CONVERTER_ROOT ?? "/Users/shinoobi/w/archivist-import-5etools/output";
const N = {
  tiamat: "Fizban's Treasury of Dragons/Monsters/Aspect of Tiamat.md",
  archmage: "Monster Manual (2014)/Monsters/Archmage.md",
  animalLord: "Monster Manual (2025)/Monsters/Animal Lord; Hunter.md",
  neogi: "Boo's Astral Menagerie/Monsters/Neogi Hatchling Swarm.md",
  deepDragon: "Forgotten Realms_ Adventures in Faerûn/Monsters/Adult Deep Dragon.md",
  slurpent: "Adventure with Muk/Monsters/Big Water Slurpent.md",
  tyreus: "Adventures in the Forgotten Realms_ From Cyan Depths/Monsters/Tyreus, Illusionist.md",
  jorasco: "Eberron_ Forge of the Artificer/Monsters/Jorasco Medic.md",
  auspicia: "Acquisitions Incorporated/Monsters/Auspicia Dran.md",
  feonor: "Baldur's Gate_ Descent Into Avernus/Monsters/Feonor.md",
  infernalist: "Astarion's Book of Hungers/Monsters/Vampire Infernalist.md",
  apprentice: "Ravenloft_ The House of Lament/Monsters/Apprentice.md",     // daily {2, 2e}: the 2e entry is hidden, a DATA carrier only
  talavar: "The Wild Beyond the Witchlight/Monsters/Sir Talavar.md",       // daily {1, 1e}: BOTH lines render (Gate 2 B-4)
  gearbox: "Lost Laboratory of Kwalish/Monsters/Gearbox.md",
  burney: "Baldur's Gate_ Descent Into Avernus/Monsters/Burney the Barber.md",
  andir: "Dragonlance_ Shadow of the Dragon Queen/Monsters/Andir Valmakos.md",
  baphomet: "Mordenkainen's Tome of Foes/Monsters/Baphomet.md",
  turtle: "Fizban's Treasury of Dragons/Monsters/Ancient Dragon Turtle.md",
  mangler: "Mordenkainen Presents_ Monsters of the Multiverse/Monsters/Star Spawn Mangler.md",
  skall: "Adventure Atlas_ The Mortuary/Monsters/Factol Skall.md",
};

function memStorage(): StoragePort {
  return { listFolder: async () => [], read: async () => "", write: async () => {}, ensureFolder: async () => {}, exists: async () => false };
}
const archivist = createArchivist({ storage: memStorage(), content: { lookup: () => undefined } });
archivist.registerPack(dnd5ePack);

function render(rel: string, columns = 1): HTMLElement {
  const doc = parseContainer(readFileSync(`${ROOT}/${rel}`, "utf8"));
  if (!doc.success) throw new Error(`container: ${rel}`);
  const resolved = archivist.resolve(doc.data);
  if (!resolved.success) throw new Error(`resolve: ${rel}`);
  return renderMonsterBlock(resolved.data as Monster, columns).el;
}
const typeLine = (b: HTMLElement) => b.querySelector(".monster-type")?.textContent ?? "";
const prop = (b: HTMLElement, label: string) => Array.from(b.querySelectorAll(".property-line")).find((l) => l.querySelector("h4")?.textContent === label)?.querySelector("p")?.textContent ?? "";
const tabs = (b: HTMLElement) => Array.from(b.querySelectorAll(".original-tab-button")).map((t) => t.textContent);
const ownText = (b: HTMLElement) => { const c = b.cloneNode(true) as HTMLElement; c.querySelectorAll('[data-fill="markdown"], .archivist-feature:not(.archivist-monster-spellcasting) .archivist-feature-entry').forEach((n) => n.remove()); return c.textContent ?? ""; };
const entriesIn = (b: HTMLElement, tab: string) => { const i = tabs(b).indexOf(tab); return Array.from(b.querySelectorAll(".original-tab-content"))[i]?.textContent ?? ""; };

beforeAll(() => installObsidianDomHelpers());

describe("converter monsters render every modelled key (R4-G6 §12.5)", () => {
  it("the converter root exists (set G6_CONVERTER_ROOT)", () => {
    expect(existsSync(ROOT), `converter root absent: ${ROOT}`).toBe(true);
    for (const rel of Object.values(N)) expect(existsSync(`${ROOT}/${rel}`), rel).toBe(true);
  });
  it("Aspect of Tiamat: header, Challenge, tabs, qualifiers", () => {
    const b = render(N.tiamat);
    expect(typeLine(b)).toBe("Gargantuan Dragon (Chromatic), Chaotic Evil");
    expect(prop(b, "Challenge")).toBe("30 (155,000 XP; PB +9)");
    expect(tabs(b)).toEqual(["Traits", "Actions", "Legendary Actions", "Mythic Actions"]);
    expect(prop(b, "Damage Immunities")).toBe("Acid, Cold, Fire, Lightning, Poison, Bludgeoning, Piercing, Slashing from nonmagical attacks");
    expect(prop(b, "Armor Class")).toBe("23 (Natural Armor)");
  });
  it("Neogi Hatchling Swarm: the swarm header", () => {
    expect(typeLine(render(N.neogi))).toBe("Medium Swarm of Tiny Aberrations, Typically Lawful Evil");   // alignment_prefix: 'typically ' (Gate 2 B-3)
  });
  it("Andir Valmakos: the sidekick header with its level; a Variants tab", () => {
    const b = render(N.andir);
    expect(typeLine(b)).toBe("Medium Humanoid (Human), Spellcaster Sidekick (Mage) (level 1), Chaotic Good");
    expect(tabs(b)).toContain("Variants");
  });
  it("Adult Deep Dragon: the {cr, xp_lair} Challenge", () => {
    expect(prop(render(N.deepDragon), "Challenge")).toBe("11 (7,200 XP, or 8,400 XP in its lair; PB +4)");
  });
  it("Big Water Slurpent: hp.special", () => {
    expect(prop(render(N.slurpent), "Hit Points")).toBe("58");
  });
  it("Star Spawn Mangler: pb_note WITH cr, and an advantage initiative", () => {
    const b = render(N.mangler);
    expect(prop(b, "Challenge")).toBe("5 (1,800 XP; PB +3)");
    expect(prop(b, "Initiative")).toBe("+4 (14) (advantage)");
  });
  it("a pb_note WITHOUT cr renders a standalone Proficiency Bonus line (a directly built fixture)", () => {
    const m = { name: "Summoned", pb_note: "equals your Proficiency Bonus", abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } } as unknown as Monster;
    const { el: b } = renderMonsterBlock(m, 1);
    expect(prop(b, "Proficiency Bonus")).toBe("equals your Proficiency Bonus");
    expect(prop(b, "Challenge")).toBe("");
  });
  it("Auspicia Dran: the AC link and a Traits tab holding only the spellcasting entry", () => {
    const b = render(N.auspicia);
    const a = Array.from(b.querySelectorAll(".property-line")).find((l) => l.querySelector("h4")?.textContent === "Armor Class")!.querySelector("a")!;
    expect(a.getAttribute("data-href")).toBe("Player's Handbook (2014)/Magic Items/Chain Shirt");
    expect(a.textContent).toBe("Chain Shirt");
    expect(tabs(b)[0]).toBe("Traits");
    expect(entriesIn(b, "Traits")).toMatch(/Spellcasting/);
  });
  it("Jorasco Medic: Initiative, Gear, a Bonus Actions tab holding only the spellcasting entry", () => {
    const b = render(N.jorasco);
    expect(prop(b, "Initiative")).toBe("+4 (14)");
    expect(prop(b, "Gear")).toBe("Breastplate");
    expect(tabs(b)).toContain("Bonus Actions");
    // §12.5 asks for "the spellcasting entry inside it": this block's NAME is `Mark of Healing (2/Day)`, and §8.2
    // renders `block.name`, never a literal "Spellcasting", so the placed entry is pinned by its own whole text
    // (its `daily` group is `hidden`, so the header prose with its two links is the entire body).
    expect(entriesIn(b, "Bonus Actions")).toBe("Mark of Healing (2/Day).The medic casts Cure Wounds or Lesser Restoration, using Wisdom as the spellcasting ability.");
  });
  it("Feonor: hidden will → no At Will line; Gearbox: hidden spells → no Cantrips line", () => {
    // The positive halves keep the two negatives from passing vacuously: §12.5 asks for the entry WITH its header
    // prose and WITHOUT the omitted group, so each note pins the prose it does render as well.
    const f = entriesIn(render(N.feonor), "Traits");
    expect(f).toMatch(/Spellcasting\.Feonor is an 18th-level spellcaster\./);   // after the native traits (§8.2)
    expect(f).not.toMatch(/At Will:/);
    const g = render(N.gearbox);
    expect(entriesIn(g, "Traits")).toMatch(/Spellcasting\.Gearbox can cast the light cantrip at will\.$/);   // the LAST entry of the pane
    expect(tabs(g).some((t) => entriesIn(g, t!).includes("Cantrips"))).toBe(false);
  });
  it("Vampire Infernalist (plain keys): 2/Day before 1/Day; Sir Talavar: 1/Day before 1/Day Each (Apprentice renders no Each line); Factol Skall's reactions header", () => {
    const v = render(N.infernalist).textContent ?? "";
    expect(v.indexOf("2/Day:")).toBeGreaterThan(-1);
    expect(v.indexOf("2/Day:")).toBeLessThan(v.indexOf("1/Day:"));
    const sk = render(N.skall);
    expect(entriesIn(sk, "Reactions")).toMatch(/^Skall can take up to three reactions per round but only one per turn\./);
    const skt = sk.textContent ?? "";
    expect(skt.indexOf("2/Day Each:")).toBeGreaterThan(-1);
    expect(skt.indexOf("2/Day Each:")).toBeLessThan(skt.indexOf("1/Day Each:"));
    const a = render(N.apprentice).textContent ?? "";
    expect(a.indexOf("2/Day:")).toBeGreaterThan(-1);
    expect(a.indexOf("2/Day Each:")).toBe(-1);                                  // its only 2e entry is hidden (Gate 2 B-4)
    const t = render(N.talavar).textContent ?? "";
    expect(t.indexOf("1/Day:")).toBeGreaterThan(-1);
    expect(t.indexOf("1/Day:")).toBeLessThan(t.indexOf("1/Day Each:"));       // the plain-before-e tie-break, RENDERED
  });
  it("Burney the Barber / Baphomet / Ancient Dragon Turtle: the Lair, Regional, Variants and Mythic tabs exist", () => {
    expect(tabs(render(N.burney))).toEqual(expect.arrayContaining(["Lair Actions", "Regional Effects", "Variants"]));
    expect(tabs(render(N.baphomet))).toEqual(expect.arrayContaining(["Lair Actions", "Regional Effects"]));
    expect(tabs(render(N.turtle))).toEqual(expect.arrayContaining(["Mythic Actions", "Lair Actions", "Regional Effects", "Variants"]));
  });
  /* GREEN at its first run: `action_note` / `reaction_note` shipped with the Task 7a block and no sample note carries
   * either key (4 and 1 carriers corpus-wide, all outside the twenty). Its kill power is the mutant that drops
   * `def.note = monster.action_note`, which reds this test's FIRST expect. */
  it("action_note and reaction_note render as their section's paragraph (spec §8.1, a directly built fixture)", () => {
    const m = {
      name: "Noted", abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      actions: [{ name: "Slam", entries: ["It slams."] }], action_note: "x",
      reactions: [{ name: "Parry", entries: ["It parries."] }], reaction_note: "y",
    } as unknown as Monster;
    const panes = Array.from(renderMonsterBlock(m, 1).el.querySelectorAll(".original-tab-content"));
    expect(panes[0].querySelector(".archivist-legendary-intro")?.textContent).toBe("x");
    expect(panes[1].querySelector(".archivist-legendary-intro")?.textContent).toBe("y");
    expect(tabs(renderMonsterBlock(m, 1).el)).toEqual(["Actions", "Reactions"]);
  });
  it("the container contract in BOTH modes: a markdown pane carries both additions, a native pane neither (spec §8.1)", () => {
    const c1 = render(N.burney, 1);
    const md1 = Array.from(c1.querySelectorAll('[data-fill="markdown"]'));
    expect(md1.length).toBe(3);                                                     // Lair Actions, Regional Effects, Variants
    for (const n of md1) {
      expect(n.classList.contains("original-tab-content")).toBe(true);              // it IS a tab pane like the others
      expect(n.classList.contains("archivist-monster-section")).toBe(true);
    }
    const native1 = Array.from(c1.querySelectorAll(".original-tab-content")).filter((n) => !(n as HTMLElement).dataset.fill);
    expect(native1.length).toBe(3);                                                 // Traits, Actions, Legendary Actions
    for (const n of native1) expect(n.className).toBe("original-tab-content");      // a NATIVE pane gains no class
    const c2 = render(N.burney, 2);
    const md2 = Array.from(c2.querySelectorAll('[data-fill="markdown"]'));
    expect(md2.length).toBe(3);
    for (const n of md2) expect(n.className).toBe("archivist-monster-section");
  });
  it("a rejected markdown fill leaves an .archivist-block-error in the pane (spec §8.3, row 39)", async () => {
    const host = document.createElement("div");
    fillMarkdown(host, "x", undefined, () => Promise.reject(new Error("boom")));   // the injectable renderer (Gate 2 I-11)
    await new Promise((r) => setTimeout(r, 0));                                  // the fill is async (Gate 2 B-5)
    expect(host.dataset.fill).toBe("markdown");
    expect(host.querySelector(".archivist-block-error")).not.toBeNull();
  });
  it("every sample: zero literal [[ in the DOM the plugin builds itself; both column modes render", () => {
    for (const rel of Object.values(N)) {
      expect(ownText(render(rel, 1)), rel).not.toContain("[[");
      expect(render(rel, 2).querySelector(".archivist-monster-two-col-flow"), rel).not.toBeNull();
    }
  });
  it("thumbnail and image render as markdown-filled embeds (spec §8.1 images, row 40)", async () => {
    const m = { name: "X", image: "[[a.png]]", thumbnail: "b.png", abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } } as unknown as Monster;
    const { el: b } = renderMonsterBlock(m, 1);
    await new Promise((r) => setTimeout(r, 0));                                  // the fills are async (Gate 2 B-5)
    const portrait = b.querySelector('[data-fill="markdown"].archivist-monster-portrait');
    expect(portrait?.textContent).toContain("![[a.png]]");                       // the jsdom mock renders markdown as TEXT
    const token = b.querySelector('[data-fill="markdown"].archivist-monster-token');
    expect(token?.textContent).toContain("![[b.png]]");
  });
});
