/** @vitest-environment jsdom */
/**
 * R4-G7 T8 RIDER-21 (F-FOLDCAP, inv-1 §3) · one caption line prints an identical caption text once.
 *
 * The T2 fold concatenates a repeated feature's copies' effects onto ONE row, and PHB 2024 authors Action Surge's
 * `extra-action {count: 1}` at level 2 AND at level 17, so the folded row read "+1 Action +1 Action". The effects stay
 * concatenated (an additive fold needs them); only the caption line stops repeating a text it already printed.
 * The obsidian mock's `setTooltip` writes `aria-label`.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { renderEffectCaptions } from "../packages/obsidian/src/modules/pc/components/actions/effect-captions";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type { FeatureEffect } from "@archivist-gg/dnd5e/types/feature-effect";

beforeAll(() => installObsidianDomHelpers());

const ctx = {} as ComponentRenderContext;
const captions = (effects: object[]): Element[] => {
  const host = mountContainer();
  renderEffectCaptions(host, effects as FeatureEffect[], ctx);
  return Array.from(host.querySelectorAll(".pc-feature-effect"));
};

describe("RIDER-21 · an identical caption text is emitted once per line", () => {
  it("the folded Action Surge's two identical extra-action effects print ONE +1 Action", () => {
    const spans = captions([
      { kind: "extra-action", count: 1, action_type: "action" },
      { kind: "extra-action", count: 1, action_type: "action" },
    ]);
    expect(spans.length).toBe(1);
    expect(spans[0].textContent).toBe("+1 Action");
  });

  it("control: two different captions both print, in order", () => {
    const spans = captions([
      { kind: "extra-action", count: 1, action_type: "action" },
      { kind: "extra-action", count: 2, action_type: "action" },
    ]);
    expect(spans.map((s) => s.textContent)).toEqual(["+1 Action", "+2 Action"]);
  });

  it("a repeated text whose copy carries a different qualifier keeps both qualifiers on the one span, one per line", () => {
    const spans = captions([
      { kind: "heal", amount: "1d8", condition: "once per turn" },
      { kind: "heal", amount: "1d8", condition: "while raging" },
    ]);
    expect(spans.length).toBe(1);
    expect(spans[0].getAttribute("aria-label")).toBe("once per turn\nwhile raging");
  });

  // Fix round 1 (review Minor 2, ruled): the kept caption's conditional look (its qualifier tooltip) comes from its OWN copy only. A
  // repeat's different qualifier is a tooltip LINE on a caption that already carries its own; on an unqualified caption it would be
  // the only tooltip and the caption would read as conditional though one copy is not.
  it("an UNqualified kept caption takes no tooltip from a qualified repeat", () => {
    const spans = captions([
      { kind: "heal", amount: "1d8" },
      { kind: "heal", amount: "1d8", condition: "while raging" },
    ]);
    expect(spans[0].getAttribute("aria-label")).toBeNull();
    expect(spans.length).toBe(1);
    expect(spans[0].textContent).toBe("Heals 1d8");
  });

  it("characterisation: a qualified kept caption keeps its own qualifier when an unqualified copy repeats it", () => {
    const spans = captions([
      { kind: "heal", amount: "1d8", condition: "while raging" },
      { kind: "heal", amount: "1d8" },
    ]);
    expect(spans.length).toBe(1);
    expect(spans[0].getAttribute("aria-label")).toBe("while raging");
  });
});
