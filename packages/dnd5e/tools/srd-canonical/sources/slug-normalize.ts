export function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Open5e key prefix for a given edition. 2014 entries are keyed `srd_<slug>`,
 * 2024 entries `srd-2024_<slug>`. Used when reconciling structured-rules
 * entries (whose names slugify bare) against Open5e-keyed slug sets.
 */
export function editionPrefix(edition: "2014" | "2024"): string {
  return edition === "2014" ? "srd_" : "srd-2024_";
}
