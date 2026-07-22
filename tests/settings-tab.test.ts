/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { ArchivistSettingTab } from "../packages/obsidian/src/core/settings-tab";
import type ArchivistPlugin from "../packages/obsidian/src/main";
import { installObsidianDomHelpers } from "./fixtures/pc/dom-helpers";

beforeAll(() => installObsidianDomHelpers());

interface StubComp {
  name: string;
  description: string;
  readonly: boolean;
  homebrew: boolean;
  hidden: boolean;
  hiddenDeclared?: boolean;
  folderPath: string;
}

function makeEnv(opts: { comps?: StubComp[]; hiddenCompendiums?: string[] } = {}) {
  const comps: StubComp[] = opts.comps ?? [
    {
      name: "SRD 5e",
      description: "System Reference Document",
      readonly: true,
      homebrew: false,
      hidden: true,
      hiddenDeclared: true,
      folderPath: "Compendium/SRD 5e",
    },
    {
      name: "Me",
      description: "My homebrew",
      readonly: false,
      homebrew: true,
      hidden: false,
      folderPath: "Compendium/Me",
    },
  ];
  const plugin = {
    settings: {
      compendiumRoot: "Compendium",
      playerCharactersFolder: "PlayerCharacters",
      portraitsFolder: "",
      hiddenCompendiums: opts.hiddenCompendiums ?? ["SRD 5e"],
    },
    saveSettings: vi.fn().mockResolvedValue(undefined),
    compendiumManager: {
      getAll: () => comps,
      setReadonly: vi.fn().mockResolvedValue(undefined),
      setHidden: vi.fn().mockResolvedValue(undefined),
    },
    entityRegistry: { search: () => [] },
  };
  const tab = new ArchivistSettingTab(
    {} as never,
    plugin as unknown as ArchivistPlugin,
  );
  document.body.appendChild(tab.containerEl);
  tab.display();
  return { tab, plugin };
}

/** The settings row whose name cell matches exactly. */
function rowByName(tab: ArchivistSettingTab, name: string): HTMLElement {
  const rows = Array.from(tab.containerEl.querySelectorAll<HTMLElement>(".setting-item"));
  const row = rows.find(
    (r) => r.querySelector(".setting-item-name")?.textContent === name,
  );
  if (!row) throw new Error(`settings row not found: ${name}`);
  return row;
}

function toggles(row: HTMLElement): HTMLElement[] {
  return Array.from(row.querySelectorAll<HTMLElement>(".checkbox-container"));
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("ArchivistSettingTab compendium rows", () => {
  it("renders visibility toggle first and read-only toggle last per row", () => {
    const { tab } = makeEnv();

    const srd = toggles(rowByName(tab, "SRD 5e"));
    expect(srd).toHaveLength(2);
    // SRD 5e is hidden -> visibility toggle off; readonly -> on
    expect(srd[0].classList.contains("is-enabled")).toBe(false);
    expect(srd[1].classList.contains("is-enabled")).toBe(true);

    const me = toggles(rowByName(tab, "Me"));
    expect(me).toHaveLength(2);
    expect(me[0].classList.contains("is-enabled")).toBe(true);
    expect(me[1].classList.contains("is-enabled")).toBe(false);
  });

  it("visibility toggle dual-writes: settings list AND _compendium.md stay in sync", async () => {
    const { tab, plugin } = makeEnv();

    // Unhide SRD 5e
    toggles(rowByName(tab, "SRD 5e"))[0].click();
    await flush();
    expect(plugin.settings.hiddenCompendiums).toEqual([]);
    expect(plugin.saveSettings).toHaveBeenCalled();
    expect(plugin.compendiumManager.setHidden).toHaveBeenCalledWith("SRD 5e", false);

    // Hide Me
    toggles(rowByName(tab, "Me"))[0].click();
    await flush();
    expect(plugin.settings.hiddenCompendiums).toEqual(["Me"]);
    expect(plugin.compendiumManager.setHidden).toHaveBeenCalledWith("Me", true);
  });

  it("visibility toggle reassigns a fresh settings array (never mutates)", async () => {
    const { tab, plugin } = makeEnv();
    const before = plugin.settings.hiddenCompendiums;

    toggles(rowByName(tab, "Me"))[0].click();
    await flush();
    expect(plugin.settings.hiddenCompendiums).not.toBe(before);
    expect(before).toEqual(["SRD 5e"]);
  });

  it("a failing file write does not break the settings toggle", async () => {
    const { tab, plugin } = makeEnv();
    (plugin.compendiumManager.setHidden as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("file missing"),
    );
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    toggles(rowByName(tab, "SRD 5e"))[0].click();
    await flush();
    // Settings still updated and saved despite the file failure
    expect(plugin.settings.hiddenCompendiums).toEqual([]);
    expect(plugin.saveSettings).toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("read-only toggle routes through setReadonly and leaves settings alone", async () => {
    const { tab, plugin } = makeEnv();

    toggles(rowByName(tab, "Me"))[1].click();
    await flush();
    expect(plugin.compendiumManager.setReadonly).toHaveBeenCalledWith("Me", true);
    expect(plugin.settings.hiddenCompendiums).toEqual(["SRD 5e"]);
    expect(plugin.compendiumManager.setHidden).not.toHaveBeenCalled();
  });

  it("orphan hidden names render a single settings-only toggle (no file write)", async () => {
    const { tab, plugin } = makeEnv({ hiddenCompendiums: ["SRD 5e", "Ghost"] });

    const ghost = rowByName(tab, "Ghost");
    const ghostToggles = toggles(ghost);
    expect(ghostToggles).toHaveLength(1);

    ghostToggles[0].click();
    await flush();
    expect(plugin.settings.hiddenCompendiums).toEqual(["SRD 5e"]);
    expect(plugin.compendiumManager.setHidden).not.toHaveBeenCalledWith("Ghost", false);
  });
});

describe("ArchivistSettingTab toggle captions (R3-P7 F5)", () => {
  function captions(row: HTMLElement): string[] {
    return Array.from(row.querySelectorAll<HTMLElement>(".archivist-toggle-caption"))
      .map((el) => el.textContent ?? "");
  }

  it("every compendium row shows always-visible Visible and Read-only captions, in toggle order", () => {
    const { tab } = makeEnv();
    expect(captions(rowByName(tab, "SRD 5e"))).toEqual(["Visible", "Read-only"]);
    expect(captions(rowByName(tab, "Me"))).toEqual(["Visible", "Read-only"]);
  });

  it("captions are grouped with their own toggle (caption + toggle share a wrapper)", () => {
    const { tab } = makeEnv();
    const row = rowByName(tab, "SRD 5e");
    const wraps = Array.from(row.querySelectorAll<HTMLElement>(".archivist-labeled-toggle"));
    expect(wraps).toHaveLength(2);
    for (const wrap of wraps) {
      const caption = wrap.querySelector(".archivist-toggle-caption");
      const toggle = wrap.querySelector(".checkbox-container");
      expect(caption).not.toBeNull();
      expect(toggle).not.toBeNull();
      // Caption reads before its toggle
      expect(
        caption!.compareDocumentPosition(toggle!) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });

  it("existing hover tooltips are kept alongside the captions", () => {
    const { tab } = makeEnv();
    const row = rowByName(tab, "Me");
    const [visible, readonly] = toggles(row);
    expect(visible.getAttribute("aria-label")).toBe("Visible in pickers");
    expect(readonly.getAttribute("aria-label")).toBe("Read-only");
  });

  it("orphan rows also caption their single visibility toggle", () => {
    const { tab } = makeEnv({ hiddenCompendiums: ["SRD 5e", "Ghost"] });
    expect(captions(rowByName(tab, "Ghost"))).toEqual(["Visible"]);
  });

  it("wired toggles still work inside the caption wrapper (dual write intact)", async () => {
    const { tab, plugin } = makeEnv();
    toggles(rowByName(tab, "SRD 5e"))[0].click();
    await flush();
    expect(plugin.settings.hiddenCompendiums).toEqual([]);
    expect(plugin.compendiumManager.setHidden).toHaveBeenCalledWith("SRD 5e", false);
  });
});
