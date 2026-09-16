Object.defineProperty(globalThis, "activeDocument", {
  configurable: true,
  get: () => (globalThis as { document?: Document }).document,
});

Object.defineProperty(globalThis, "activeWindow", {
  configurable: true,
  get: () => (globalThis as { window?: Window }).window ?? globalThis,
});

// jsdom ships no ResizeObserver. `pane-centered-modal.ts` constructs one
// unguarded, so any test that mounts a modal throws without this. `??=` leaves
// the two local per-file stubs (tests/pane-centered-modal.test.ts,
// tests/pc-builder-selection-table.test.ts) in charge where they exist.
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
};
