/** R4-G6b §10 (Q-8): a caption of parts whose separator is hidden when its part would START a wrapped line. Each part
 *  is a UNIT (`span.pc-cap-unit`, position: relative, nowrap) holding an out-of-flow separator (`span.pc-cap-sep`,
 *  absolutely positioned to the unit's left, no horizontal advance) and the bare segment (`span.pc-cap-seg`). Parts
 *  are separated by what does NOT exist at a line start: a collapsible space (inline hosts, `spaces` true, which
 *  also sets `pc-cap-spaced` for the host's `word-spacing`) or the host's flex `gap` (`spaces: false`). The host
 *  clips horizontally (`pc-cap-host`), so a separator at a line start sits at negative x and is clipped away.
 *  `textContent` composes byte-identically to the old joined strings (the separator carries its trailing space).
 *  Returns the units in order so a caller can set a `title` on the element it owns. */
export function renderSeparated(host: HTMLElement, parts: string[], opts: { sep: "·" | "/"; leading?: boolean; spaces?: boolean; unitCls?: string; segCls?: string }): HTMLElement[] {
  const spaces = opts.spaces !== false;
  host.addClass("pc-cap-host");
  if (spaces) host.addClass("pc-cap-spaced");
  const units: HTMLElement[] = [];
  parts.forEach((part, i) => {
    const hasSep = i > 0 || !!opts.leading;
    if (spaces && (i > 0 || (opts.leading && host.childNodes.length > 0))) host.appendText(" ");
    const unit = host.createSpan({ cls: opts.unitCls ? `pc-cap-unit ${opts.unitCls}` : "pc-cap-unit" });
    if (hasSep) unit.createSpan({ cls: "pc-cap-sep", text: `${opts.sep} `, attr: { "aria-hidden": "true" } });
    unit.createSpan({ cls: opts.segCls ? `pc-cap-seg ${opts.segCls}` : "pc-cap-seg", text: part });
    units.push(unit);
  });
  return units;
}
