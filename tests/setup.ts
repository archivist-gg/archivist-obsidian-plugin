Object.defineProperty(globalThis, "activeDocument", {
  configurable: true,
  get: () => (globalThis as { document?: Document }).document,
});

Object.defineProperty(globalThis, "activeWindow", {
  configurable: true,
  get: () => (globalThis as { window?: Window }).window ?? globalThis,
});
