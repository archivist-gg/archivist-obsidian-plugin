import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readOpen5eKind, deriveSlugSet } from "../../../tools/srd-canonical/sources/open-srd";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

describe("open-srd reader", () => {
  let tmpdir: string;
  beforeEach(() => {
    tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), "open-srd-"));
  });
  afterEach(() => { fs.rmSync(tmpdir, { recursive: true, force: true }); });

  it("uses cached file when present and refresh=false", async () => {
    const cachePath = path.join(tmpdir, "classes.2014.json");
    fs.writeFileSync(cachePath, JSON.stringify({ count: 1, results: [{ key: "fighter", name: "Fighter" }] }));
    const fetchSpy = vi.spyOn(global, "fetch");
    const result = await readOpen5eKind({
      kind: "classes",
      edition: "2014",
      apiBase: "https://api.open5e.com/v2",
      cacheDir: tmpdir,
      refresh: false,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.length).toBe(1);
    expect(result[0].key).toBe("fighter");
    fetchSpy.mockRestore();
  });

  it("derives slug set from result list", () => {
    const slugs = deriveSlugSet([{ key: "fighter" }, { key: "wizard" }]);
    expect(slugs.has("fighter")).toBe(true);
    expect(slugs.has("wizard")).toBe(true);
    expect(slugs.size).toBe(2);
  });
});
