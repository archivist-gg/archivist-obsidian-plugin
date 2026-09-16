import { describe, it, expect } from "vitest";
import {
  parseCompendiumVersion,
  readInstalledCompendiumVersion,
  readBundleVersion,
  planAction,
} from "../../packages/obsidian/src/shared/compendium-init/compendium-version";
import { makeHarness } from "./harness";

const index = (version: string) => `---\narchivist_compendium: true\nname: SRD 5e\narchivist_compendium_version: ${version}\n---\n\n# SRD 5e\n`;

describe("parseCompendiumVersion", () => {
  it("returns the string stamp", () => {
    expect(parseCompendiumVersion(index("1.2.3"))).toBe("1.2.3");
  });
  it("returns null for no frontmatter, a YAML throw, a non-string stamp (1.0 parses as a float), and an absent key", () => {
    expect(parseCompendiumVersion("# no frontmatter")).toBeNull();
    expect(parseCompendiumVersion("---\n: : :\n  - [\n---\n")).toBeNull();
    expect(parseCompendiumVersion(index("1.0"))).toBeNull();
    expect(parseCompendiumVersion("---\nname: SRD 5e\n---\n")).toBeNull();
  });
});

describe("readInstalledCompendiumVersion · reads the disk through the adapter, never the index", () => {
  it("absent when the index file does not exist", async () => {
    const h = makeHarness({});
    expect(await readInstalledCompendiumVersion(h.vault, "Compendium/SRD 5e")).toEqual({ state: "absent" });
  });
  it("ok with the stamp when readable", async () => {
    const h = makeHarness({ "Compendium/SRD 5e/_compendium.md": index("0.3.2") });
    expect(await readInstalledCompendiumVersion(h.vault, "Compendium/SRD 5e")).toEqual({ state: "ok", version: "0.3.2" });
  });
  it("unreadable (not absent) when the file exists but the stamp is a float or the frontmatter is missing", async () => {
    const h = makeHarness({ "Compendium/SRD 5e/_compendium.md": index("1.0"), "Compendium/SRD 2024/_compendium.md": "# bare" });
    expect(await readInstalledCompendiumVersion(h.vault, "Compendium/SRD 5e")).toEqual({ state: "unreadable" });
    expect(await readInstalledCompendiumVersion(h.vault, "Compendium/SRD 2024")).toEqual({ state: "unreadable" });
  });
  it("sees a file written through the adapter that the vault index has NOT picked up yet", async () => {
    const h = makeHarness({});
    await h.vault.adapter.write("Compendium/SRD 5e/_compendium.md", index("0.3.2"));
    expect(h.vault.getAbstractFileByPath("Compendium/SRD 5e/_compendium.md")).toBeNull();
    expect(await readInstalledCompendiumVersion(h.vault, "Compendium/SRD 5e")).toEqual({ state: "ok", version: "0.3.2" });
  });
});

describe("readBundleVersion · the sub-bundle's OWN _compendium.md, keyed by compendium name", () => {
  it("reads the named compendium's stamp, not the first entry's", () => {
    const bundle = {
      "SRD 2024/_compendium.md": index("5.5.5"),
      "SRD 5e/_compendium.md": index("7.7.7"),
    };
    expect(readBundleVersion(bundle, "SRD 5e")).toBe("7.7.7");
    expect(readBundleVersion(bundle, "SRD 2024")).toBe("5.5.5");
  });
  it("returns null when the sub-bundle has no index entry or an unreadable stamp", () => {
    expect(readBundleVersion({ "SRD 5e/Races/Dwarf.md": "x" }, "SRD 5e")).toBeNull();
    expect(readBundleVersion({ "SRD 5e/_compendium.md": index("1.0") }, "SRD 5e")).toBeNull();
  });
});

describe("planAction · the five rows of spec §5.1", () => {
  it("error whenever the bundle version is null, regardless of the installed state", () => {
    expect(planAction({ state: "absent" }, null)).toBe("error");
    expect(planAction({ state: "ok", version: "1" }, null)).toBe("error");
  });
  it("fresh only when the index file is absent", () => {
    expect(planAction({ state: "absent" }, "1.0.0")).toBe("fresh");
  });
  it("upgrade-available when unreadable", () => {
    expect(planAction({ state: "unreadable" }, "1.0.0")).toBe("upgrade-available");
  });
  it("up-to-date on an exact match, upgrade-available on any difference (including a downgrade)", () => {
    expect(planAction({ state: "ok", version: "1.0.0" }, "1.0.0")).toBe("up-to-date");
    expect(planAction({ state: "ok", version: "1.0.0" }, "1.1.0")).toBe("upgrade-available");
    expect(planAction({ state: "ok", version: "1.1.0" }, "1.0.0")).toBe("upgrade-available");
  });
});
