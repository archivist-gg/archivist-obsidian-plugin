import { describe, it, expect } from "vitest";
import { generatableToSdkTool } from "@archivist/generators";
import type { Generatable } from "@archivist/core";

const g: Generatable = {
  type: "demo",
  description: "d",
  inputSchema: {},
  enrich: (i) => ({ ok: (i as { x: number }).x }),
};

describe("generatableToSdkTool", () => {
  it("derives tool name, wraps input under the type key, and envelopes the result", async () => {
    const t = generatableToSdkTool(g);
    expect(t.name).toBe("generate_demo");
    const out = await t.handler({ demo: { x: 1 } }, {});
    const text = (out.content[0] as { text: string }).text;
    expect(JSON.parse(text)).toEqual({ type: "demo", data: { ok: 1 } });
    expect(t.annotations?.readOnlyHint).toBe(true);
  });
});
