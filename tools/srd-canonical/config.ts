import path from "node:path";

export interface CanonicalBuildConfig {
  /** Where to fetch Open5e (HTTP or use cached files). */
  open5eApi: string;
  open5eCacheDir: string;

  /** Path to the local structured-rules data dump root.
   *  Read from STRUCTURED_RULES_PATH env var; no default. */
  structuredRulesPath: string;

  /** Path to overlay YAML files (per edition). */
  overlayDir: string;

  /** Output roots. */
  canonicalOutDir: string;       // committed canonical JSON
  runtimeOutDir: string;         // committed slim runtime JSON
  bundleOutDir: string;          // .compendium-bundle/ — copied to user vault on install

  /** Edition flag — both means run twice in sequence. */
  editions: ("2014" | "2024")[];

  /** When true, ignore Open5e disk cache and refetch. */
  refreshOpen5e: boolean;
}

export function loadConfig(): CanonicalBuildConfig {
  const args = process.argv.slice(2);
  const has = (flag: string) => args.includes(flag);
  const get = (flag: string) => {
    const idx = args.indexOf(flag);
    return idx >= 0 ? args[idx + 1] : undefined;
  };

  const editionArg = get("--edition");
  const editions: ("2014" | "2024")[] =
    editionArg === "2014" ? ["2014"] :
    editionArg === "2024" ? ["2024"] :
    ["2014", "2024"];

  const structuredRulesPath = process.env.STRUCTURED_RULES_PATH;
  if (!structuredRulesPath) {
    throw new Error(
      "STRUCTURED_RULES_PATH env var is required. " +
      "Set it to the external structured-rules data dump root (e.g. /path/to/structured-rules/data)."
    );
  }

  const repoRoot = path.resolve(__dirname, "..", "..");
  return {
    open5eApi: "https://api.open5e.com/v2",
    open5eCacheDir: path.join(__dirname, ".cache", "open5e"),
    structuredRulesPath,
    overlayDir: path.join(__dirname, "overlays"),
    canonicalOutDir: path.join(repoRoot, "src", "srd", "data", "canonical"),
    runtimeOutDir: path.join(repoRoot, "src", "srd", "data", "runtime"),
    bundleOutDir: path.join(repoRoot, ".compendium-bundle"),
    editions,
    refreshOpen5e: has("--refresh-open5e"),
  };
}
