/**
 * Pure presentational shell for the builder's Chronicle blocks (Race,
 * Background, and class steps). Renders the identity band, optional flavor
 * paragraph, at-a-glance tiles, and a caller-supplied body. The matching CSS
 * (`.pc-cblock` / `.pc-cb-*`) ships in chronicle.css.
 */

export interface GlanceTile { label: string; value: string; small?: string; }

export interface ChronicleBlockOptions {
  name: string;
  /** Italic sub-line under the name (omit segments with no data — caller's job). */
  sub: string;
  /** Corner badge, e.g. "SRD 5.2 · 2024". */
  badge?: string;
  /** Description paragraph; omitted entirely when falsy/empty. */
  flavor?: string;
  tiles: GlanceTile[];
  /** Renders content above the identity band (edition-mix note). */
  pre?: (host: HTMLElement) => void;
  /** Renders everything after the tiles (strip + body sections). */
  body: (host: HTMLElement) => void;
  /** Owned-card mode (SP2 Plan 5, smoke r6): inline controls on the right of the
   *  identity band (level select / subclass name / remove ghost). Renders into a
   *  `.pc-cb-bh-rgt` flex child laid out after the name+sub. The block has no
   *  separate header strip — this band IS the card header. */
  bandRight?: (host: HTMLElement) => void;
  /** When true the band becomes the collapse handle: clicking it (outside the
   *  controls, which the caller stops-propagation on) fires `onToggleCollapse`,
   *  and a ▾/▸ chevron renders at the band's far right. */
  collapsible?: boolean;
  /** Collapsed state for a collapsible block: flavor, tiles, and body unmount —
   *  only the band (name + sub + controls + chevron) renders. */
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function renderChronicleBlock(parent: HTMLElement, opts: ChronicleBlockOptions): HTMLElement {
  const block = parent.createDiv({ cls: "pc-cblock" });
  opts.pre?.(block);
  if (opts.badge) block.createSpan({ cls: "pc-cb-badge", text: opts.badge });
  const bh = block.createDiv({ cls: "pc-cb-bh" });
  if (opts.collapsible) bh.addClass("collapsible");
  const ident = bh.createDiv({ cls: "pc-cb-bh-ident" });
  ident.createEl("h3", { cls: "pc-cb-name", text: opts.name });
  ident.createDiv({ cls: "pc-cb-sub", text: opts.sub });
  if (opts.bandRight) {
    const rgt = bh.createDiv({ cls: "pc-cb-bh-rgt" });
    opts.bandRight(rgt);
  }
  if (opts.collapsible) {
    bh.createSpan({ cls: "pc-cb-bh-chev", text: opts.collapsed ? "▸" : "▾" });
    bh.addEventListener("click", () => opts.onToggleCollapse?.());
  }
  if (opts.collapsed) return block;
  if (opts.flavor) block.createDiv({ cls: "pc-cb-flavor", text: opts.flavor });
  if (opts.tiles.length) {
    const glance = block.createDiv({ cls: "pc-cb-glance" });
    for (const t of opts.tiles) {
      const tile = glance.createDiv({ cls: "pc-cb-tile" });
      tile.createSpan({ cls: "pc-cb-tl", text: t.label });
      const v = tile.createSpan({ cls: "pc-cb-tv", text: t.value });
      if (t.small) v.createSpan({ cls: "pc-cb-ts", text: t.small });
    }
  }
  opts.body(block);
  return block;
}

export function renderSectionRule(parent: HTMLElement, label: string, right?: string): void {
  const sec = parent.createDiv({ cls: "pc-cb-sec" });
  sec.createSpan({ cls: "pc-cb-sec-l", text: label });
  if (right) sec.createSpan({ cls: "pc-cb-sec-r", text: right });
}

/** First sentence of a description (up to the first sentence-ending punctuation
 *  followed by whitespace or end-of-string). Shared by the Race step and the
 *  class Chronicle so neither depends on the other. */
export function firstSentence(d: string): string {
  const m = d.match(/^[\s\S]*?[.!?](?=\s|$)/);
  return m ? m[0] : d;
}
