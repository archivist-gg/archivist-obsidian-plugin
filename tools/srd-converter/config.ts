import path from "node:path";
import os from "node:os";

export interface ConverterConfig {
  sourceDir: string;
  outputDir: string;
  edition: "2014" | "2024";
  includeDocumentSlugs: Set<string>;
}

export function loadConfig(): ConverterConfig {
  const args = process.argv.slice(2);
  const getArg = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx >= 0 ? args[idx + 1] : undefined;
  };

  const edition = (getArg("--edition") ?? "2014") as "2014" | "2024";
  const sourceDir = getArg("--source-dir") ?? path.join(os.homedir(), "w", "archivist", "server", "data", "srd");
  const outputDir = getArg("--output-dir") ?? path.resolve(__dirname, "..", "..", "src", "data", "srd");

  return {
    sourceDir,
    outputDir,
    edition,
    includeDocumentSlugs: new Set(["wotc-srd"]),
  };
}
