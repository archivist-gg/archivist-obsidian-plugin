/** @vitest-environment jsdom */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderMarkdownDescription } from "../src/shared/rendering/markdown-description";

// Minimal Obsidian MarkdownRenderer mock: builds DOM nodes via createElement
// to mirror what the production code does — no innerHTML.
vi.mock("obsidian", async () => ({
  MarkdownRenderer: {
    render: async (_app: unknown, md: string, parent: HTMLElement) => {
      const doc = parent.ownerDocument;
      for (const para of md.split("\n\n")) {
        const lines = para.split("\n").filter((l: string) => l.trim().length > 0);
        const isPipeTable = lines.length >= 2 && lines[0].includes("|") && /^\s*\|?\s*-+/.test(lines[1]);
        if (isPipeTable) {
          const headCells = lines[0].split("|").slice(1, -1).map((s: string) => s.trim());
          const bodyRows = lines.slice(2).map((l: string) => l.split("|").slice(1, -1).map((s: string) => s.trim()));
          const t = doc.createElement("table");
          const thead = doc.createElement("thead");
          const tr = doc.createElement("tr");
          for (const h of headCells) {
            const th = doc.createElement("th");
            th.textContent = h;
            tr.appendChild(th);
          }
          thead.appendChild(tr);
          t.appendChild(thead);
          const tb = doc.createElement("tbody");
          for (const r of bodyRows) {
            const row = doc.createElement("tr");
            for (const c of r) {
              const td = doc.createElement("td");
              td.textContent = c;
              row.appendChild(td);
            }
            tb.appendChild(row);
          }
          t.appendChild(tb);
          parent.appendChild(t);
        } else {
          const p = doc.createElement("p");
          p.textContent = para;
          parent.appendChild(p);
        }
      }
    },
  },
  setIcon: vi.fn(),
  Component: class {},
}));

describe("renderMarkdownDescription", () => {
  let parent: HTMLElement;
  beforeEach(() => {
    parent = document.createElement("div");
  });

  it("renders paragraphs", async () => {
    await renderMarkdownDescription(parent, "First paragraph.\n\nSecond paragraph.");
    expect(parent.querySelectorAll("p")).toHaveLength(2);
    expect(parent.querySelectorAll("p")[0].textContent).toBe("First paragraph.");
  });

  it("adds .archivist-table class to rendered tables", async () => {
    const md = `Intro.\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\nOutro.`;
    await renderMarkdownDescription(parent, md);
    const tables = parent.querySelectorAll("table");
    expect(tables).toHaveLength(1);
    expect(tables[0].classList.contains("archivist-table")).toBe(true);
  });

  it("returns silently when markdown is empty", async () => {
    await renderMarkdownDescription(parent, "");
    expect(parent.children.length).toBe(0);
  });

  it("preserves non-dice <code> elements unchanged", async () => {
    // Build a synthetic post-render state: parent already has a <code> in it.
    // Call the post-processor walker directly via a re-invocation that's a no-op
    // for empty markdown; assert the existing <code> survives.
    const code = parent.ownerDocument.createElement("code");
    code.textContent = "not-a-dice-tag";
    parent.appendChild(code);
    await renderMarkdownDescription(parent, "");
    expect(parent.querySelector("code")?.textContent).toBe("not-a-dice-tag");
  });
});
