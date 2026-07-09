import { describe, it, expect } from "vitest";
import { createArchivist } from "@archivist-gg/core";
import { dnd5ePack } from "@archivist-gg/dnd5e";

// 0e regression pin: pc is a stateful-app, not a pack entity type. It has no
// `doc` codec and is not a member of dnd5ePack, so the kernel exposes no "pc"
// EntityType. This guards against a future re-introduction of a pc pack/legacy
// bridge. (It does NOT prove Bridge 1 was removed from main.ts — that is the
// job of the composition-root grep asserts; this pins the forward invariant.)
describe("0e: pc has no kernel/pack parse identity", () => {
  const a = createArchivist({
    storage: {} as never,
    content: { lookup: () => undefined },
  });
  a.registerPack(dnd5ePack);

  it("dnd5ePack declares no 'pc' entity type", () => {
    expect(dnd5ePack.entityTypes.some((et) => et.type === "pc")).toBe(false);
  });

  it("the kernel resolves no EntityType for 'pc'", () => {
    expect(a.getEntityType("pc")).toBeUndefined();
  });
});
