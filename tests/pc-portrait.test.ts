import { describe, it, expect } from "vitest";
import {
  PORTRAIT_KEY,
  PORTRAIT_IMAGE_EXTENSIONS,
  normalizeLinkValue,
  wikiLinkFor,
} from "../packages/obsidian/src/modules/pc/pc.portrait";

describe("pc.portrait", () => {
  it("constants", () => {
    expect(PORTRAIT_KEY).toBe("archivist-portrait");
    for (const ext of ["png", "jpg", "jpeg", "webp", "gif", "svg", "avif", "bmp"])
      expect(PORTRAIT_IMAGE_EXTENSIONS.has(ext)).toBe(true);
    expect(PORTRAIT_IMAGE_EXTENSIONS.has("heic")).toBe(false);
  });
  it("normalizes wiki links incl. alias and embed marker", () => {
    expect(normalizeLinkValue("[[Art/a.png]]")).toBe("Art/a.png");
    expect(normalizeLinkValue("[[Art/a.png|portrait]]")).toBe("Art/a.png");
    expect(normalizeLinkValue("![[Art/a.png]]")).toBe("Art/a.png");
  });
  it("normalizes markdown links with URL decoding, rejects remote URLs", () => {
    expect(normalizeLinkValue("[a](Art/my%20face.png)")).toBe("Art/my face.png");
    expect(normalizeLinkValue("![a](Art/a.png)")).toBe("Art/a.png");
    expect(normalizeLinkValue("[a](https://example.com/a.png)")).toBeNull();
  });
  it("passes bare paths through trimmed; empty is null", () => {
    expect(normalizeLinkValue("  Art/a.png  ")).toBe("Art/a.png");
    expect(normalizeLinkValue("")).toBeNull();
    expect(normalizeLinkValue("   ")).toBeNull();
  });
  it("wikiLinkFor wraps linktext verbatim", () => {
    expect(wikiLinkFor("Art/a.png")).toBe("[[Art/a.png]]");
  });
});
