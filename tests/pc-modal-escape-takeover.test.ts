/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { PaneCenteredModal } from "@/shared/modals/pane-centered-modal";

type ScopeEntry = { key: string; func: () => unknown };

class Probe extends PaneCenteredModal {
  public fired = 0;
  onOpen(): void {
    this.takeOverEscape(() => {
      this.fired += 1;
    });
  }
}

describe("PaneCenteredModal.takeOverEscape", () => {
  it("leaves exactly one Escape handler registered", () => {
    const modal = new Probe({} as never);
    modal.onOpen();
    const keys = (modal.scope as unknown as { keys: ScopeEntry[] }).keys;
    // The ONLY assertion that catches a forgotten unregister of the built-in.
    expect(keys.filter((k) => k.key === "Escape")).toHaveLength(1);
  });

  it("is idempotent: a second onOpen does not leak a duplicate handler", () => {
    // 16 downstream modal tasks call this, and a modal whose onOpen runs twice
    // must not end up with two Escape entries: the unregister sweep is what
    // makes the re-registration safe.
    const modal = new Probe({} as never);
    modal.onOpen();
    modal.onOpen();
    const keys = (modal.scope as unknown as { keys: ScopeEntry[] }).keys;
    expect(keys.filter((k) => k.key === "Escape")).toHaveLength(1);
    expect(keys.find((k) => k.key === "Escape")!.func()).toBe(false);
    expect(modal.fired).toBe(1);
  });

  it("invokes the handler and returns a strict false", () => {
    const modal = new Probe({} as never);
    modal.onOpen();
    const keys = (modal.scope as unknown as { keys: ScopeEntry[] }).keys;
    const entry = keys.find((k) => k.key === "Escape")!;
    // A strict `false` is the ONLY return value that makes Keymap preventDefault + stopPropagation.
    expect(entry.func()).toBe(false);
    expect(modal.fired).toBe(1);
  });
});
