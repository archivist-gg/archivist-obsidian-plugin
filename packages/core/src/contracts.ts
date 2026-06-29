export const CONVENTION_VERSION = "1.0";

export interface EntityDoc { type: string; frontmatter: Record<string, unknown>; body: string; raw: string; }
export type ParseResult<T> = { success: true; data: T } | { success: false; error: string };

export interface ContentLookupPort { lookup(type: string, slug: string): unknown; }
export type ResolveContext = ContentLookupPort;
export interface ContentSource { list(): EntityDoc[] | Promise<EntityDoc[]>; }

export interface DocCodec<Raw = unknown> {
  schema?: unknown;
  parse(doc: EntityDoc): ParseResult<Raw>;
  serialize(raw: Raw): string;
}

export interface Generatable {
  type: string;
  toolName?: string;
  description: string;
  instructions?: string;
  inputSchema: unknown;
  enrich(input: unknown): unknown;
}

export interface EntityType {
  type: string;
  doc?: DocCodec;
  resolve?: (raw: unknown, ctx: ResolveContext) => unknown;
  generatable?: Generatable;
}

export interface SystemPack {
  id: string;
  version: string;
  conventionVersion: string;
  entityTypes: EntityType[];
  content?: ContentSource;
}

export interface EntryRef { kind: "file" | "folder"; path: string; name: string; }
export interface StoragePort {
  listFolder(folder: string): Promise<EntryRef[]>;
  read(path: string): Promise<string>;
  write(path: string, text: string): Promise<void>;
  ensureFolder(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}
export interface NotificationSink { info(m: string): void; error(m: string): void; }

export interface Archivist {
  registerPack(p: SystemPack): void;
  getEntityType(type: string): EntityType | undefined;
  parseContainer(text: string): ParseResult<EntityDoc>;
  resolve(doc: EntityDoc): ParseResult<unknown>;
  lookup(type: string, slug: string): unknown;
}
