import type {
  Archivist, EntityDoc, EntityType, ParseResult, SystemPack,
  StoragePort, ContentLookupPort, NotificationSink,
} from "./contracts";
import { parseContainer } from "./container";

export function createArchivist(opts: {
  storage: StoragePort;
  content: ContentLookupPort;
  notify?: NotificationSink;
}): Archivist {
  const types = new Map<string, EntityType>();
  return {
    registerPack(p: SystemPack) {
      for (const et of p.entityTypes) types.set(et.type, et);
    },
    getEntityType(type) { return types.get(type); },
    parseContainer,
    resolve(doc: EntityDoc): ParseResult<unknown> {
      const et = types.get(doc.type);
      if (!et) return { success: false, error: `No entity type registered for "${doc.type}"` };
      if (!et.doc) return { success: false, error: `Entity type "${doc.type}" has no codec` };
      const parsed = et.doc.parse(doc);
      if (!parsed.success) return parsed;
      if (!et.resolve) return { success: true, data: parsed.data };
      try {
        return { success: true, data: et.resolve(parsed.data, opts.content) };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    },
    lookup(type, slug) { return opts.content.lookup(type, slug); },
  };
}
