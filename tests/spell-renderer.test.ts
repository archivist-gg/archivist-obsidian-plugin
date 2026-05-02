/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { installObsidianDomHelpers } from "./fixtures/pc/dom-helpers";

beforeAll(() => installObsidianDomHelpers());

vi.mock("obsidian", () => ({
  MarkdownRenderer: {
    render: async (_app: unknown, md: string, parent: HTMLElement) => {
      const doc = parent.ownerDocument;
      for (const para of md.split("\n\n")) {
        const lines = para.split("\n").filter((l: string) => l.trim().length > 0);
        const isPipeTable = lines.length >= 2 && lines[0].includes("|") && /^\s*\|?\s*-+/.test(lines[1]);
        if (isPipeTable) {
          const headCells = lines[0].split("|").slice(1, -1).map((s: string) => s.trim());
          const bodyRows = lines.slice(2).map((l: string) => l.split("|").slice(1, -1).map((s: string) => s.trim()));
          const t = doc.createElement("table");
          const thead = doc.createElement("thead");
          const tr = doc.createElement("tr");
          for (const h of headCells) {
            const th = doc.createElement("th");
            th.textContent = h;
            tr.appendChild(th);
          }
          thead.appendChild(tr);
          t.appendChild(thead);
          const tb = doc.createElement("tbody");
          for (const r of bodyRows) {
            const row = doc.createElement("tr");
            for (const c of r) {
              const td = doc.createElement("td");
              td.textContent = c;
              row.appendChild(td);
            }
            tb.appendChild(row);
          }
          t.appendChild(tb);
          parent.appendChild(t);
        } else {
          const p = doc.createElement("p");
          p.textContent = para;
          parent.appendChild(p);
        }
      }
    },
  },
  setIcon: vi.fn(),
  Component: class {},
}));

import { renderSpellBlock } from "../src/modules/spell/spell.renderer";
import type { Spell } from "../src/modules/spell/spell.types";

const fireball: Spell = {
  name: "Fireball",
  level: 3,
  school: "evocation",
  casting_time: "action",
  range: "150 feet",
  components: "V, S, M (a tiny ball of bat guano)",
  duration: "instantaneous",
  concentration: false,
  ritual: false,
  description: "A bright streak flashes from your pointing finger.",
  at_higher_levels: ["When you cast this spell using a spell slot of 4th level or higher, the damage increases by 1d6 for each slot level above 3rd."],
  classes: ["sorcerer", "wizard"],
  damage: { types: ["fire"] },
  saving_throw: { ability: "dexterity" },
  casting_options: [{ type: "slot_level_4", damage_roll: "9d6" }],
};

describe("renderSpellBlock", () => {
  it("renders the spell name and school header (title case)", async () => {
    const w = await renderSpellBlock(fireball);
    expect(w.querySelector(".spell-name")?.textContent).toBe("Fireball");
    expect(w.querySelector(".spell-school")?.textContent).toBe("3rd-level Evocation");
  });

  it("renders description body via markdown", async () => {
    const w = await renderSpellBlock(fireball);
    expect(w.querySelector(".spell-description")?.textContent ?? "").toContain("bright streak");
  });

  it("always renders at_higher_levels prose; never as a table", async () => {
    const w = await renderSpellBlock(fireball);
    const higher = w.querySelector(".spell-higher-levels");
    expect(higher?.textContent ?? "").toContain("damage increases by 1d6");
    expect(w.querySelector(".spell-slot-scaling-table")).toBeNull();
  });

  it("renders damage type and saving throw as inline icon properties", async () => {
    const w = await renderSpellBlock(fireball);
    const props = Array.from(w.querySelectorAll(".spell-properties .archivist-property-line-icon"));
    expect(props.some(p => p.textContent?.includes("Damage Type") && p.textContent?.toLowerCase().includes("fire"))).toBe(true);
    expect(props.some(p => p.textContent?.includes("Save") && p.textContent?.includes("Dexterity"))).toBe(true);
  });

  it("renders class list with sorcerer and wizard", async () => {
    const w = await renderSpellBlock(fireball);
    const classes = w.querySelector(".spell-classes")?.textContent ?? "";
    expect(classes.toLowerCase()).toMatch(/sorcerer.*wizard|wizard.*sorcerer/);
  });

  it("cantrip header reads 'Evocation cantrip' (title case)", async () => {
    const cantrip: Spell = { ...fireball, level: 0 };
    const w = await renderSpellBlock(cantrip);
    expect(w.querySelector(".spell-school")?.textContent).toBe("Evocation cantrip");
  });
});
