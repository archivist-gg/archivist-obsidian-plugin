import { describe, it, expect } from "vitest";
import {
  PORTRAIT_KEY,
  PORTRAIT_IMAGE_EXTENSIONS,
  normalizeLinkValue,
  wikiLinkFor,
  PORTRAIT_CROP_KEY,
  CROP_EPSILON,
  getPortraitsFolder,
  parseCropValue,
  formatCropValue,
  coverCrop,
  marqueeToCrop,
  isCoverCrop,
  cropCssProps,
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

describe("getPortraitsFolder", () => {
  it("derives the default under the PC folder", () => {
    expect(getPortraitsFolder(undefined)).toBe("PlayerCharacters/Portraits");
    expect(getPortraitsFolder({})).toBe("PlayerCharacters/Portraits");
    expect(getPortraitsFolder({ playerCharactersFolder: "Party" })).toBe("Party/Portraits");
  });
  it("strips slashes BEFORE the empty check", () => {
    expect(getPortraitsFolder({ portraitsFolder: "/" })).toBe("PlayerCharacters/Portraits");
    expect(getPortraitsFolder({ portraitsFolder: "/Art/Faces/" })).toBe("Art/Faces");
  });
});

describe("crop value parse/format", () => {
  it("round-trips at 4 decimals", () => {
    const c = { x: 0.32, y: 0.41, size: 0.55 };
    expect(formatCropValue(c)).toBe("0.3200,0.4100,0.5500");
    expect(parseCropValue(formatCropValue(c))).toEqual({ x: 0.32, y: 0.41, size: 0.55 });
  });
  it("accepts y > 1 (tall images), rejects garbage and out-of-range x+size", () => {
    expect(parseCropValue("0.1,1.4,0.2")).toEqual({ x: 0.1, y: 1.4, size: 0.2 });
    expect(parseCropValue("")).toBeNull();
    expect(parseCropValue("a,b,c")).toBeNull();
    expect(parseCropValue("0.5,0,0.6")).toBeNull();      // x+size=1.1 > 1+eps
    expect(parseCropValue("0,0,0")).toBeNull();          // size must be > 0
    expect(parseCropValue("-0.1,0,0.5")).toBeNull();
    expect(parseCropValue(" 0.9950 , 0 , 0.0100 ")).not.toBeNull(); // lenient + within eps
  });
});

describe("crop math (width-referenced, Gate-1a worked example)", () => {
  it("portrait 500x800 shown 200x320: marquee (40,60,120) -> (0.2,0.3,0.6) -> vars", () => {
    const c = marqueeToCrop(40, 60, 120, 200);
    expect(c).toEqual({ x: 0.2, y: 0.3, size: 0.6 });
    expect(cropCssProps(c)).toEqual({
      "--pc-crop-w": String(1 / 0.6), "--pc-crop-x": String(0.2 / 0.6), "--pc-crop-y": String(0.3 / 0.6),
    });
  });
  it("coverCrop is orientation-correct", () => {
    expect(coverCrop(200, 320)).toEqual({ x: 0, y: 0.3, size: 1 });          // portrait
    expect(coverCrop(320, 200)).toEqual({ x: 0.1875, y: 0, size: 0.625 });   // landscape
    expect(coverCrop(200, 200)).toEqual({ x: 0, y: 0, size: 1 });            // square
  });
  it("isCoverCrop matches within epsilon per component", () => {
    expect(isCoverCrop({ x: 0.001, y: 0.299, size: 0.999 }, 200, 320)).toBe(true);
    expect(isCoverCrop({ x: 0.05, y: 0.3, size: 1 }, 200, 320)).toBe(false);
    expect(CROP_EPSILON).toBe(0.005);
  });
});
