import bundleJson from "../../../.compendium-bundle/index.json";

/**
 * Bundle of vault MD files emitted by `tools/srd-canonical/`. esbuild inlines
 * this JSON at build time, so it ships embedded inside `main.js`.
 *
 * Keys are paths like `"SRD 5e/Spells/Fireball.md"` — they include the
 * compendium folder prefix.
 */
export const embeddedBundle: Record<string, string> = bundleJson;

/**
 * Split the flat bundle into one sub-bundle per top-level compendium folder.
 * Each sub-bundle's keys retain the compendium prefix so they can be passed
 * to `copyBundle(vault, rootFolder, ...)` and land at the right path.
 */
export function splitBundleByCompendium(bundle: Record<string, string>): Map<string, Record<string, string>> {
  const out = new Map<string, Record<string, string>>();
  for (const [filePath, content] of Object.entries(bundle)) {
    const sepIdx = filePath.indexOf("/");
    if (sepIdx === -1) continue;
    const compendium = filePath.slice(0, sepIdx);
    let sub = out.get(compendium);
    if (!sub) {
      sub = {};
      out.set(compendium, sub);
    }
    sub[filePath] = content;
  }
  return out;
}
