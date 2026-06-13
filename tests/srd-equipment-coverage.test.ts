import { describe, it, expect } from "vitest";
import cls24 from "../src/srd/data/runtime/class.2024.json";
import cls14 from "../src/srd/data/runtime/class.2014.json";
import items24 from "../src/srd/data/runtime/item.2024.json";
import weap24 from "../src/srd/data/runtime/weapon.2024.json";
import arm24 from "../src/srd/data/runtime/armor.2024.json";
import items14 from "../src/srd/data/runtime/item.2014.json";
import weap14 from "../src/srd/data/runtime/weapon.2014.json";
import arm14 from "../src/srd/data/runtime/armor.2014.json";

// Runtime slugs are edition-prefixed (e.g. `srd-2024_chain-mail`, `srd-5e_battleaxe`).
// Authored {item} grants reference the BARE slug (`chain-mail`), so we compare on
// the bare form: everything after the first underscore.
const bare = (s: string) => (s.includes("_") ? s.slice(s.indexOf("_") + 1) : s);
const slugSet = (arrs: any[][]) =>
  new Set(arrs.flat().map((e) => bare(e.slug)));

/** Collect every authored {item} grant slug that does NOT resolve to a known
 *  bare slug. ROBUST to old-shape (string options) data: guards every access so
 *  pre-regen runtime JSON yields [] (no {item} grants found) rather than crashing. */
function unresolved(classes: any[], known: Set<string>): string[] {
  const miss: string[] = [];
  for (const c of classes ?? []) {
    for (const eq of c?.starting_equipment ?? []) {
      const grantLists =
        eq?.kind === "choice"
          ? (eq.options ?? []).flatMap((o: any) => o?.grants ?? [])
          : eq?.kind === "fixed"
            ? (eq.grants ?? [])
            : [];
      for (const g of grantLists) {
        if (g && g.item && !known.has(g.item)) miss.push(`${c.slug}: ${g.item}`);
      }
    }
  }
  return miss;
}

describe("SRD equipment coverage", () => {
  it("every authored 2024 class {item} grant resolves to a known slug", () => {
    const miss = unresolved(
      cls24 as any[],
      slugSet([items24 as any[], weap24 as any[], arm24 as any[]]),
    );
    expect(miss, `unresolved 2024 item grants:\n${miss.join("\n")}`).toEqual([]);
  });

  it("every authored 2014 class {item} grant resolves to a known slug", () => {
    const miss = unresolved(
      cls14 as any[],
      slugSet([items14 as any[], weap14 as any[], arm14 as any[]]),
    );
    expect(miss, `unresolved 2014 item grants:\n${miss.join("\n")}`).toEqual([]);
  });
});
