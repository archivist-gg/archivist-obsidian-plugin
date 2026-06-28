import * as fs from "node:fs";
import * as yaml from "js-yaml";
import { overlaySchema, type Overlay } from "../overlay.schema";

export function loadOverlay(filePath: string): Promise<Overlay> {
  if (!fs.existsSync(filePath)) {
    return Promise.reject(new Error(`Overlay not found: ${filePath}`));
  }
  // `json: true` makes js-yaml error on duplicate map keys instead of silently
  // taking the last one — guards against copy-paste key collisions in overlays.
  const raw = yaml.load(fs.readFileSync(filePath, "utf8"), { json: true });
  const result = overlaySchema.safeParse(raw);
  if (!result.success) {
    return Promise.reject(new Error(`Overlay schema validation failed for ${filePath}:\n${result.error.message}`));
  }
  return Promise.resolve(result.data);
}
