/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { renderProfsEquipment } from "../src/modules/pc/components/builder/class-chronicle";

beforeAll(() => installObsidianDomHelpers());

describe("class chronicle equipment fold (structured)", () => {
  it("renders each choice option label as a badged eqopt row", () => {
    const c = mountContainer();
    renderProfsEquipment(c, {
      starting_equipment: [{ kind: "choice", options: [
        { label: "Chain Mail, Greatsword", grants: [] },
        { label: "Studded Leather, Longbow", grants: [] },
      ] }],
    } as never);
    const rows = c.querySelectorAll(".pc-cb-eqopt");
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain("Chain Mail");
  });

  it("renders a fixed entry's label (or its grants) as the Equipment prop", () => {
    const c = mountContainer();
    renderProfsEquipment(c, {
      starting_equipment: [
        { kind: "fixed", grants: [{ item: "leather-armor" }, { item: "dagger", qty: 2 }] },
      ],
    } as never);
    const equipProp = [...c.querySelectorAll(".pc-cb-prop")]
      .find((p) => p.querySelector(".pc-cb-prop-l")!.textContent === "Equipment")!;
    expect(equipProp).toBeTruthy();
    expect(equipProp.textContent).toContain("Leather Armor");
    expect(equipProp.textContent).toContain("Dagger ×2");
  });

  it("renders a gold entry as the Gold prop", () => {
    const c = mountContainer();
    renderProfsEquipment(c, {
      starting_equipment: [{ kind: "gold", amount: 90 }],
    } as never);
    const goldProp = [...c.querySelectorAll(".pc-cb-prop")]
      .find((p) => p.querySelector(".pc-cb-prop-l")!.textContent === "Gold")!;
    expect(goldProp).toBeTruthy();
    expect(goldProp.textContent).toContain("90 GP");
  });
});
