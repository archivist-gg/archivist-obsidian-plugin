import type { EntityType } from "@archivist/core";
import type { ArchivistModule } from "../core/module-api";

/**
 * Bridge 1 (kernel): expose a legacy module's `parseYaml` as a core
 * `EntityType.doc`. The codec's `parse` runs the module's existing YAML
 * parser over the document body, so kernel parsing is behavior-identical to
 * the pre-migration `mod.parseYaml(source)` call. Serialization is not yet
 * migrated and throws if invoked.
 */
export function moduleToEntityType(mod: ArchivistModule): EntityType {
  return {
    type: mod.codeBlockType!,
    doc: mod.parseYaml
      ? {
          parse: (doc) => mod.parseYaml!(doc.body),
          serialize: () => {
            throw new Error(`serialize via legacy adapter not supported for ${mod.id}`);
          },
        }
      : undefined,
  };
}
