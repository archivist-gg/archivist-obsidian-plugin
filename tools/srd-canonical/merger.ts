import type { Open5eEntry } from "./sources/open-srd";
import type { StructuredEntry } from "./sources/structured-rules";
import type { ActivationEntry } from "./sources/activation";
import type { Overlay } from "./overlay.schema";

export interface CanonicalEntry {
  slug: string;
  edition: "2014" | "2024";
  kind: string;
  /** Base layer (Open5e). */
  base: Open5eEntry;
  /** Enrichment layer (structured rules). */
  structured: StructuredEntry | null;
  /** Activation layer (foundry). */
  activation: ActivationEntry | null;
  /** Overlay layer (per-kind specific subset). May be null when overlay has no entry for this slug. */
  overlay: unknown;
}

export interface MergeInputs {
  edition: "2014" | "2024";
  kind: string;
  open5e: Open5eEntry[];
  structured: StructuredEntry[];
  activation: Map<string, ActivationEntry>;
  overlay: Overlay;
}

export interface MergeRule {
  kind: string;
  /** Pluck overlay subset for this kind. Returns null when no overlay applies. */
  pickOverlay(overlay: Overlay, slug: string): unknown;
}

export function mergeKind(rule: MergeRule, inputs: MergeInputs): CanonicalEntry[] {
  const structuredBySlug = new Map<string, StructuredEntry>();
  for (const e of inputs.structured) {
    const slug = (e as { slug?: string; name: string }).slug
      ?? e.name.toLowerCase().replace(/\s+/g, "-");
    structuredBySlug.set(slug, e);
  }
  return inputs.open5e.map((base): CanonicalEntry => ({
    slug: base.key,
    edition: inputs.edition,
    kind: inputs.kind,
    base,
    structured: structuredBySlug.get(base.key) ?? null,
    activation: inputs.activation.get(base.key) ?? null,
    overlay: rule.pickOverlay(inputs.overlay, base.key),
  }));
}
