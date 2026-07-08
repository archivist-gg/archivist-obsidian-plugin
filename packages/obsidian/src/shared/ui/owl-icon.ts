interface OwlPath {
  tag: string;
  attrs: Record<string, string>;
}

export function createOwlIcon(size = 18): SVGElement {
  const ns = "http://www.w3.org/2000/svg";
  const svg = activeDocument.createElementNS(ns, "svg");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");

  const paths: OwlPath[] = [
    { tag: "ellipse", attrs: { cx: "12", cy: "9", rx: "8", ry: "7" } },
    { tag: "path", attrs: { d: "M12 9a4 4 0 1 1 8 0v12h-4C9.4 21 4 15.6 4 9a4 4 0 1 1 8 0v1" } },
    { tag: "path", attrs: { d: "M8 9h.01" } },
    { tag: "path", attrs: { d: "M16 9h.01" } },
    { tag: "path", attrs: { d: "M20 21a3.9 3.9 0 1 1 0-7.8" } },
    { tag: "path", attrs: { d: "M10 19.4V22" } },
    { tag: "path", attrs: { d: "M14 20.85V22" } },
  ];

  for (const { tag, attrs } of paths) {
    const el = activeDocument.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    svg.appendChild(el);
  }

  return svg;
}
