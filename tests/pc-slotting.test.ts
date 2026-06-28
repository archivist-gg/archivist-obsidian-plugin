import { describe, it, expect } from "vitest";
import {
  resolveEntityForEntry, isShieldArmor, effectiveArmor, defaultSlotForType,
  isArmorEntity, isWeaponEntity, isItemEntity,
} from "../src/modules/pc/pc.slotting";
import { buildEquipmentRegistry, SHIELD, PLATE, SUN_BLADE } from "./fixtures/pc/equipment-fixtures";

const reg = buildEquipmentRegistry();

describe("pc.slotting read-path helpers", () => {
  it("routes a plain weapon to mainhand", () => {
    const { entity, entityType } = resolveEntityForEntry("[[longsword]]", reg);
    expect(entityType).toBe("weapon");
    expect(defaultSlotForType(entityType, entity, reg)).toBe("mainhand");
  });

  it("routes plain heavy armor to the armor slot", () => {
    const { entity, entityType } = resolveEntityForEntry("[[plate]]", reg);
    expect(defaultSlotForType(entityType, entity, reg)).toBe("armor");
  });

  it("routes a category:'shield' armor to the shield slot", () => {
    const { entity, entityType } = resolveEntityForEntry("[[shield]]", reg);
    expect(defaultSlotForType(entityType, entity, reg)).toBe("shield");
  });

  it("routes a magic weapon (base_item) to mainhand via its base", () => {
    const { entity, entityType } = resolveEntityForEntry("[[sun-blade]]", reg);
    expect(entityType).toBe("item");
    expect(defaultSlotForType(entityType, entity, reg)).toBe("mainhand");
  });

  it("isShieldArmor / effectiveArmor / guards behave", () => {
    expect(isShieldArmor(SHIELD)).toBe(true);
    expect(isShieldArmor(PLATE)).toBe(false);
    expect(isArmorEntity(PLATE)).toBe(true);
    expect(isWeaponEntity(SUN_BLADE)).toBe(false); // it's an item
    expect(isItemEntity(SUN_BLADE)).toBe(true);
    expect(effectiveArmor(PLATE, reg)?.name).toBe("Plate");
  });
});
