import { describe, it, expect } from "vitest";
import config from "../vitest.config";

describe("vitest budget policy", () => {
  it("pins testTimeout and hookTimeout explicitly rather than inheriting vitest defaults", () => {
    const t = (config as { test?: { testTimeout?: number; hookTimeout?: number } }).test;
    expect(t?.testTimeout).toBe(20000);
    expect(t?.hookTimeout).toBe(20000);
  });
});
