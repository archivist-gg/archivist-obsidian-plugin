// tests/srd-canonical/sources/foundry-effects.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  translateFoundryChanges,
  type FoundryChange,
} from "../../../tools/srd-canonical/sources/foundry-effects";

describe("translateFoundryChanges", () => {
  let stderr: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    stderr = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => {
    stderr.mockRestore();
  });

  it("maps rwak.damage to weapon_damage on_attack_type:ranged", () => {
    const changes: FoundryChange[] = [
      { key: "system.bonuses.rwak.damage", mode: "ADD", value: "+ 2" },
    ];
    expect(translateFoundryChanges(changes, "Bracers of Archery")).toEqual([
      {
        tag: "bonus",
        field: "weapon_damage",
        value: 2,
        when: [{ kind: "on_attack_type", value: "ranged" }],
      },
    ]);
  });

  it("maps mwak.attack to weapon_attack on_attack_type:melee", () => {
    const changes: FoundryChange[] = [
      { key: "system.bonuses.mwak.attack", mode: "ADD", value: "+ 1" },
    ];
    expect(translateFoundryChanges(changes, "Test")).toEqual([
      {
        tag: "bonus",
        field: "weapon_attack",
        value: 1,
        when: [{ kind: "on_attack_type", value: "melee" }],
      },
    ]);
  });

  it("maps rwak.attack and mwak.damage variants too", () => {
    const changes: FoundryChange[] = [
      { key: "system.bonuses.rwak.attack", mode: "ADD", value: 3 },
      { key: "system.bonuses.mwak.damage", mode: "ADD", value: -1 },
    ];
    const out = translateFoundryChanges(changes, "Test");
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      tag: "bonus",
      field: "weapon_attack",
      value: 3,
      when: [{ kind: "on_attack_type", value: "ranged" }],
    });
    expect(out[1]).toMatchObject({
      tag: "bonus",
      field: "weapon_damage",
      value: -1,
      when: [{ kind: "on_attack_type", value: "melee" }],
    });
  });

  it("maps rsak.attack and msak.attack to spell_attack", () => {
    expect(
      translateFoundryChanges(
        [{ key: "system.bonuses.rsak.attack", mode: "ADD", value: "+1" }],
        "Test",
      ),
    ).toEqual([
      {
        tag: "bonus",
        field: "spell_attack",
        value: 1,
        when: [{ kind: "on_attack_type", value: "ranged" }],
      },
    ]);
    expect(
      translateFoundryChanges(
        [{ key: "system.bonuses.msak.attack", mode: "ADD", value: 1 }],
        "Test",
      ),
    ).toEqual([
      {
        tag: "bonus",
        field: "spell_attack",
        value: 1,
        when: [{ kind: "on_attack_type", value: "melee" }],
      },
    ]);
  });

  it("skips msak.damage and rsak.damage (no spell_damage field) with warning", () => {
    expect(
      translateFoundryChanges(
        [{ key: "system.bonuses.msak.damage", mode: "ADD", value: "+1" }],
        "Test",
      ),
    ).toEqual([]);
    expect(stderr).toHaveBeenCalled();
    stderr.mockClear();
    expect(
      translateFoundryChanges(
        [{ key: "system.bonuses.rsak.damage", mode: "ADD", value: "+1" }],
        "Test",
      ),
    ).toEqual([]);
    expect(stderr).toHaveBeenCalled();
  });

  it("maps movement keys to speed.<x> with empty when[]", () => {
    expect(
      translateFoundryChanges(
        [{ key: "system.attributes.movement.swim", mode: "ADD", value: 60 }],
        "Cloak of the Manta Ray",
      ),
    ).toEqual([
      { tag: "bonus", field: "speed.swim", value: 60, when: [] },
    ]);
    expect(
      translateFoundryChanges(
        [{ key: "system.attributes.movement.fly", mode: "ADD", value: 30 }],
        "Test",
      ),
    ).toEqual([
      { tag: "bonus", field: "speed.fly", value: 30, when: [] },
    ]);
  });

  it("maps abilities.<ab>.value as static contribution (no when)", () => {
    expect(
      translateFoundryChanges(
        [{ key: "system.abilities.con.value", mode: "ADD", value: 19 }],
        "Amulet of Health",
      ),
    ).toEqual([
      { tag: "static", ability: "con", value: 19 },
    ]);
    expect(
      translateFoundryChanges(
        [{ key: "system.abilities.str.value", mode: "ADD", value: 21 }],
        "Belt of Hill Giant Strength",
      ),
    ).toEqual([
      { tag: "static", ability: "str", value: 21 },
    ]);
  });

  it("maps senses keys to side-channel sense", () => {
    expect(
      translateFoundryChanges(
        [{ key: "system.attributes.senses.darkvision", mode: "ADD", value: 60 }],
        "Test",
      ),
    ).toEqual([
      { tag: "side-channel", kind: "sense", sense: "darkvision", value: 60 },
    ]);
  });

  it("maps trait keys to immune/resist/vulnerable side-channels", () => {
    expect(
      translateFoundryChanges(
        [{ key: "system.traits.di.value", mode: "ADD", value: "poison" }],
        "Test",
      ),
    ).toEqual([{ tag: "side-channel", kind: "immune", value: "poison" }]);
    expect(
      translateFoundryChanges(
        [{ key: "system.traits.dr.value", mode: "ADD", value: "fire" }],
        "Test",
      ),
    ).toEqual([{ tag: "side-channel", kind: "resist", value: "fire" }]);
    expect(
      translateFoundryChanges(
        [{ key: "system.traits.dv.value", mode: "ADD", value: "radiant" }],
        "Test",
      ),
    ).toEqual([{ tag: "side-channel", kind: "vulnerable", value: "radiant" }]);
  });

  it("maps weaponProf to grants_proficiency side-channel", () => {
    expect(
      translateFoundryChanges(
        [{ key: "system.traits.weaponProf.value", mode: "ADD", value: "longbow" }],
        "Bracers of Archery",
      ),
    ).toEqual([
      { tag: "side-channel", kind: "grants_proficiency", value: "longbow" },
    ]);
  });

  it("logs and skips unknown keys", () => {
    expect(
      translateFoundryChanges(
        [{ key: "system.tools.brewer", mode: "ADD", value: 1 }],
        "Axe of the Dwarvish Lords",
      ),
    ).toEqual([]);
    expect(stderr).toHaveBeenCalled();
  });

  it("logs and skips non-ADD modes", () => {
    expect(
      translateFoundryChanges(
        [{ key: "system.bonuses.rwak.damage", mode: "OVERRIDE", value: "+ 2" }],
        "Test",
      ),
    ).toEqual([]);
    expect(stderr).toHaveBeenCalled();
  });

  it("logs and skips non-numeric values where number expected", () => {
    expect(
      translateFoundryChanges(
        [{ key: "system.bonuses.rwak.damage", mode: "ADD", value: "rolltable" }],
        "Test",
      ),
    ).toEqual([]);
    expect(stderr).toHaveBeenCalled();
  });

  it("processes multiple changes in one call", () => {
    const out = translateFoundryChanges(
      [
        { key: "system.bonuses.rwak.damage", mode: "ADD", value: "+ 2" },
        { key: "system.traits.weaponProf.value", mode: "ADD", value: "shortbow" },
        { key: "system.traits.weaponProf.value", mode: "ADD", value: "longbow" },
      ],
      "Bracers of Archery",
    );
    expect(out).toHaveLength(3);
    expect(out[0].tag).toBe("bonus");
    expect(out[1].tag).toBe("side-channel");
    expect(out[2].tag).toBe("side-channel");
  });
});
