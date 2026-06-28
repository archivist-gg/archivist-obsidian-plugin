import { describe, it, expect } from "vitest";
import { parseContainer } from "@core/container";

const FILE = `---
entity_type: spell
slug: srd-5e_x
---

\`\`\`spell
name: X
level: 8
\`\`\`
`;

describe("parseContainer", () => {
  it("extracts type, frontmatter, and code-block body", () => {
    const r = parseContainer(FILE);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.type).toBe("spell");
    expect(r.data.frontmatter.slug).toBe("srd-5e_x");
    expect(r.data.body.trim()).toBe("name: X\nlevel: 8");
    expect(r.data.raw).toBe(FILE);
  });

  it("handles a code-block-only file with no frontmatter", () => {
    const r = parseContainer("```monster\nname: Goblin\n```\n");
    expect(r.success && r.data.type).toBe("monster");
    expect(r.success && r.data.frontmatter).toEqual({});
  });

  it("fails when no typed code block is present", () => {
    expect(parseContainer("just prose").success).toBe(false);
  });
});
