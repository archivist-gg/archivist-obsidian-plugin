/** @vitest-environment jsdom */

import { describe, it, expect, beforeEach } from "vitest";
import { parseItem } from "../src/modules/item/item.parser";
import { renderItemMechanicalSummary } from "../src/modules/item/item.renderer";

beforeEach(() => {
  document.body.replaceChildren();
});

describe("renderItemMechanicalSummary", () => {
  it("returns null for prose-only items (no mechanical fields)", () => {
    const r = parseItem(`name: Plain Item\nentries: [some text]`);
    if (!r.success) throw new Error(r.error);
    expect(renderItemMechanicalSummary(r.data)).toBeNull();
  });

  it("renders Cloak of Protection bonuses", () => {
    const r = parseItem(`
name: Cloak of Protection
bonuses: { ac: 1, saving_throws: 1 }
`);
    if (!r.success) throw new Error(r.error);
    const el = renderItemMechanicalSummary(r.data);
    expect(el).not.toBeNull();
    expect(el!.textContent).toContain("AC +1");
    expect(el!.textContent).toContain("Saves +1");
  });

  it("renders Wand of Magic Missiles charges + spells", () => {
    const r = parseItem(`
name: Wand of Magic Missiles
charges: { max: 7, recharge: dawn, recharge_amount: "1d6+1" }
attached_spells: { charges: { "1": [magic-missile] } }
`);
    if (!r.success) throw new Error(r.error);
    const el = renderItemMechanicalSummary(r.data)!;
    expect(el.textContent).toContain("7 charges");
    expect(el.textContent).toContain("recharge dawn");
    expect(el.textContent).toContain("1 ch: magic-missile");
  });

  it("renders Hat of Disguise at-will spell", () => {
    const r = parseItem(`
name: Hat of Disguise
attached_spells: { will: [disguise-self] }
`);
    if (!r.success) throw new Error(r.error);
    const el = renderItemMechanicalSummary(r.data)!;
    expect(el.textContent).toContain("At will: disguise-self");
  });

  it("renders Efreeti Chain immune + grants", () => {
    const r = parseItem(`
name: Efreeti Chain
immune: [fire]
grants: { languages: [primordial] }
`);
    if (!r.success) throw new Error(r.error);
    const el = renderItemMechanicalSummary(r.data)!;
    expect(el.textContent).toContain("fire");
    expect(el.textContent).toContain("primordial");
  });

  it("sorts spell charge keys numerically (1, 3, 4)", () => {
    const r = parseItem(`
name: Staff of Fire
attached_spells:
  charges:
    "4": [wall-of-fire]
    "1": [burning-hands]
    "3": [fireball]
`);
    if (!r.success) throw new Error(r.error);
    const el = renderItemMechanicalSummary(r.data)!;
    const text = el.textContent ?? "";
    const idx1 = text.indexOf("1 ch:");
    const idx3 = text.indexOf("3 ch:");
    const idx4 = text.indexOf("4 ch:");
    expect(idx1).toBeGreaterThan(-1);
    expect(idx3).toBeGreaterThan(idx1);
    expect(idx4).toBeGreaterThan(idx3);
  });
});
