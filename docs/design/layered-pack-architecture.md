# Layered pack architecture

This document describes how Archivist is structured after the layered-pack
refactor (phases 0a–0d). It is a maintainer's guide to the *current* state, not
a roadmap: where the code still carries scaffolding from the migration, that
scaffolding is recorded honestly here so the next person does not mistake it for
the intended end state. The one remaining piece of intended-but-not-yet-done
work — porting `pc` and tearing the strangler down — is called out explicitly
and deferred to phase **0e**.

The short version: content lives in Markdown files, a small framework (`core`)
parses and dispatches those files, a system pack (`dnd5e`) supplies all the D&D
knowledge, a headless generator layer (`generators`) produces new content with
an LLM, and the Obsidian plugin (`obsidian`) wires it all together and draws the
UI. Dependencies only ever point *inward*, and that direction is enforced by
tooling, not by convention alone.

---

## 1. `.md` as a documented convention

The unit of content is a Markdown file. Archivist does **not** invent a new file
format or a sidecar database — an entity is just a `.md` file that a human (or
the generator) can open and edit. Two parts of that file matter:

- **Optional YAML frontmatter** (`--- … ---` at the top). It may be absent
  entirely; when present it is parsed with `js-yaml` into a plain object.
- **A single typed fenced code block** whose *info string* is the entity type
  and whose body carries the entity's data.

Both are handled by `parseContainer` in
[`packages/core/src/container.ts`](../../packages/core/src/container.ts). The
grammar is deliberately tiny:

```
FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?/      // optional
CODE_BLOCK_RE  = /```([A-Za-z0-9_-]+)\n([\s\S]*?)```/
```

`parseContainer` returns an `EntityDoc`:

```ts
interface EntityDoc { type: string; frontmatter: Record<string, unknown>; body: string; raw: string; }
```

Here `type` is the code-block info string (e.g. `monster`, `spell`), `body` is
the code-block content that the pack's codec will parse, `frontmatter` is the
optional YAML object (empty `{}` when there is none), and `raw` is the whole
original file text.

Three properties are load-bearing and worth stating plainly:

- **The `.md` file is the source of truth.** There is no authoritative store
  behind it; the file *is* the entity.
- **The `.md` MAY store computed values.** Nothing forbids a persisted document
  from containing fields that could also be derived (a monster's authored block
  can already carry proficiency bonus / XP, for instance). Persistence and
  derivation are allowed to overlap; see §5 for the one rule about *which*
  derived values may be written back.
- **Round-trip is passthrough-lossless.** Because `EntityDoc.raw` retains the
  entire original text and parsing never rewrites unrelated content, reading and
  re-writing a document does not churn it. There was **no corpus migration** —
  existing vault content parses under this convention unchanged.

---

## 2. The four layers and their dependency arrows

Archivist is an npm workspace of four packages. Confirmed names, from each
`package.json`:

| Package                | Role                                                                                          |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| `@archivist/core`      | Framework: the container format, contracts, the kernel, the entity registry, and the ports.   |
| `@archivist/dnd5e`     | The system pack: schemas, parsers, codecs, rules, and the SRD content.                         |
| `@archivist/generators`| Headless MCP server + AI generation tools.                                                     |
| `@archivist/obsidian`  | The Obsidian plugin: composition root + renderer.                                              |

The dependency arrows point strictly inward:

```
@archivist/core  ←  @archivist/dnd5e  ←  @archivist/generators
        ▲                  ▲                     ▲
        └──────────────────┴─────────────────────┘
                   @archivist/obsidian
```

- `core` depends on nothing else in the workspace. It knows about containers,
  contracts, and ports — never about D&D or Obsidian.
- `dnd5e` depends only on `core`. It is where every piece of system knowledge
  lives. **The 2014 and 2024 rules are editions *within* this single pack** —
  they are not separate packages and not separate layers.
- `generators` depends on `core` and `dnd5e`. It is headless (no Obsidian
  imports): an MCP server that exposes the pack's generatable entity types as AI
  tools.
- `obsidian` is the composition root and the renderer. It is the only package
  permitted to import all of the others, because it is where everything is wired
  together and drawn to the screen.

The one arrow that must never exist:

> **`@archivist/dnd5e` MUST NEVER import `@archivist/obsidian`.**

The system pack has to stay usable outside Obsidian (that is what makes the
headless generator layer possible), so it cannot reach "up" into the plugin.

---

## 3. How the arrows are enforced

The dependency direction is enforced by four independent mechanisms, all bundled
behind a single command:

1. **eslint `import/no-restricted-paths`** —
   [`eslint.config.mjs:117`](../../eslint.config.mjs) declares one zone per
   package. `core` may import only itself; `dnd5e` may import only `core`;
   `generators` may import only `core` and `dnd5e`. A forbidden import is an
   `error`, not a warning.
2. **`eslint-import-resolver-typescript`** — configured in the same block's
   `settings["import/resolver"]`, it teaches eslint to follow the `@archivist/*`
   package exports/subpaths, so `import/no-restricted-paths` correctly attributes
   an import like `@archivist/dnd5e/monster/monster.parser` to the `dnd5e`
   package rather than treating it as an opaque module.
3. **The planted architecture test** —
   [`tests/arch/dependency-arrows.test.ts`](../../tests/arch/dependency-arrows.test.ts)
   writes a probe file into `packages/core/src` that imports from
   `@archivist/dnd5e`, runs eslint over it programmatically, and asserts the
   `import/no-restricted-paths` rule fires. This guards the *guard*: if the eslint
   zone or resolver ever silently stops working, this test goes red.
4. **Cross-package `tsc -b`** — the `typecheck` script runs a composite,
   project-referenced build across all packages, so an illegal or missing
   cross-package dependency also fails the type checker.

All four run under the single local gate:

```
npm run check   ==   npm run typecheck && npm run lint && npm run test
```

There is deliberately **no CI *validation* workflow**. This branch is unmerged
and unpushed by design, so a GitHub Actions gate would have nothing to run
against. (The one Actions workflow that does exist, `.github/workflows/release.yml`,
is a tag-triggered release/CD job that only builds the plugin artifacts — it runs
`npm run build`, never `typecheck`/`lint`/`test`/`check`.) `npm run check` is
*the* gate — run it before every commit; it must exit 0 end to end.

---

## 4. The three entity archetypes

Not every entity is shaped the same way. There are three archetypes, and knowing
which one a type belongs to tells you which fields of its `EntityType` are
populated.

- **Authored stat block** — a document you read and write, parsed by a pack
  codec, optionally resolvable and/or generatable. These are the **11 ported
  types**: `monster`, `spell`, `item`, `armor`, `weapon`, `race`, `background`,
  `feat`, `optional-feature`, `class`, `subclass`. Each has a `doc` codec on its
  pack `EntityType`; `monster` additionally has a `resolve`; the generatable ones
  additionally have a `generatable`.
- **Stateful app** — `pc` (the player character). It is an interactive,
  stateful surface rather than a static authored block, and it has **not** been
  ported to a pack codec yet. It is still served by the legacy module system (see
  §6). This is the single largest remaining strangler user.
- **Generate-only** — `npc` and `encounter`. These exist purely to be generated:
  their pack `EntityType` carries a `generatable` and **no `doc`**. There is no
  authored/edited on-disk form to parse, so there is no codec.

The generatable set is therefore **five** types across two archetypes: `monster`,
`spell`, `item` (authored + generatable) and `npc`, `encounter` (generate-only).

---

## 5. The pack EntityType recipe

Everything the pack contributes about a type is one `EntityType` object.
From [`packages/core/src/contracts.ts`](../../packages/core/src/contracts.ts):

```ts
interface EntityType {
  type: string;
  doc?: DocCodec;
  resolve?: (raw: unknown, ctx: ResolveContext) => unknown;
  generatable?: Generatable;
}
```

Each optional slot has a precise job:

- **`type`** — the code-block info string this `EntityType` owns (matches
  `EntityDoc.type`).

- **`doc: DocCodec`** — the on-disk contract. It is present for authored types
  and absent for generate-only types.

  ```ts
  interface DocCodec<Raw = unknown> {
    schema?: unknown;
    parse(doc: EntityDoc): ParseResult<Raw>;   // EntityDoc → parsed entity, or an error
    serialize(raw: Raw): string;               // parsed entity → document text
  }
  ```

  `parse` takes the whole `EntityDoc` and returns a `ParseResult<T>` (a tagged
  union: `{ success: true; data }` or `{ success: false; error }`). `serialize`
  goes the other way for writing generated/edited content back out.

- **`resolve`** — *optional*, light view-derived fields computed at read time.
  Only **`monster`** has one today. It is deliberately narrow: `resolveMonster`
  in
  [`packages/dnd5e/src/monster/monster.resolve.ts`](../../packages/dnd5e/src/monster/monster.resolve.ts)
  computes proficiency bonus and XP from the challenge rating, returns a *new*
  object, and does not mutate its input. `resolve` is for values a view wants but
  the file need not necessarily store.

- **`generatable: Generatable`** — *optional*, AI generation for the five
  generate types.

  ```ts
  interface Generatable {
    type: string;
    toolName?: string;
    description: string;
    instructions?: string;
    inputSchema: unknown;
    enrich(input: unknown): unknown;
  }
  ```

  This is what the generator layer turns into an AI tool (see §2), and `enrich`
  is where a raw LLM payload is filled out into a complete entity.

**The one persistence rule:** the codec normalizes on save, but it must **never
persist enrich-derived fields.** A `serialize` writes the authored/normalized
shape of the entity; it does not bake in values that `resolve`/`enrich` would
recompute. The monster codec is explicit about this — resolve-derived PB/XP are
not added by `serialize`; they are computed on read by `resolve`. Keeping
enrich-derived values out of the persisted file is what keeps round-trips clean
and derivation authoritative.

---

## 6. Current strangler state (honest record)

The plugin has been migrated onto the pack/kernel model incrementally, using the
strangler-fig pattern: new machinery grows around the old, and the old is removed
type by type. That migration is **not finished**, and the plugin still ships
three bridges. They are intentional, minimized, and slated for teardown in
**phase 0e (PC port + strangler teardown)**. Do not remove or "clean up" any of
them casually — `pc` still depends on them.

- **Bridge 1 — kernel parse.**
  [`adapter/legacy-adapter.ts`](../../packages/obsidian/src/adapter/legacy-adapter.ts)'s
  `moduleToEntityType` wraps a legacy module's `parseYaml` as a core
  `EntityType.doc.parse`, and `main.ts` registers those wrapped types as a pack
  with id `"legacy"`. Because the 11 ported types are de-listed from this pack
  (their real `dnd5e` `EntityType` carries a `doc`, so `packParsedTypes` excludes
  them), and because `npc`/`encounter` have no `parseYaml` at all, **Bridge 1
  serves exactly one type's parse today: `pc`.** Its `serialize` is intentionally
  unimplemented and throws — the legacy adapter is a read-only bridge.

- **Bridge 2 — presentation.**
  [`adapter/presentation-registry.ts`](../../packages/obsidian/src/adapter/presentation-registry.ts)'s
  `PresentationRegistry` holds each module's DOM-facing callbacks (`render`,
  `renderEditMode`, `getInsertModal`) keyed by code-block type. Parsing was moved
  into the kernel, but **rendering, edit mode, and the insert modal for ALL
  code-block types — the ported types included — still flow through this
  registry.** The pack owns *what an entity is*; obsidian still owns *how it is
  drawn*.

- **Bridge 3 — the module system.**
  [`core/module-api.ts`](../../packages/obsidian/src/core/module-api.ts)'s
  `CoreAPI` + `ArchivistModule.register` is the original plugin module system,
  and **all 13 modules still register through it** on load (`monster`, `spell`,
  `item`, `inquiry`, `class`, `race`, `subclass`, `background`, `feat`,
  `optional-feature`, `armor`, `weapon`, `pc`). The kernel and the legacy
  `CoreAPI` currently run side by side.

### Accepted inquiry divergence

One deliberate shortcut is recorded here so it is not "discovered" later as a
bug.
[`DndEntityRenderer`](../../packages/obsidian/src/modules/inquiry/features/chat/rendering/DndEntityRenderer.ts)
(the chat renderer for generated entities) calls `parseMonster`, `parseSpell`,
and `parseItem` from `@archivist/dnd5e` **directly**, bypassing the kernel and
`resolve`. This is harmless in practice: the only type with a `resolve` is
`monster`, and its `resolve` only derives proficiency bonus / XP — values that
are already baked into the authored or generated `.md` the renderer is showing.
So skipping `resolve` changes nothing visible here. Routing this renderer through
proper registry dispatch is deferred to an inquiry un-defer; the direct-parse
path is an accepted divergence, not an oversight.

---

## Summary for the next maintainer

- Content is `.md`; `parseContainer` reads optional frontmatter + one typed code
  block into an `EntityDoc`.
- Four packages, arrows inward, `dnd5e` never imports `obsidian`; the arrows are
  enforced by eslint + TS resolver + a planted arch test + `tsc -b`, all behind
  `npm run check` (the single local gate — no CI, by design).
- A pack contributes one `EntityType` per type: `{ type, doc?, resolve?,
  generatable? }`. Codecs normalize but never persist enrich-derived fields.
- Three archetypes: authored stat blocks (11 ported, on codecs), the stateful
  `pc` app (still module-based), and generate-only `npc`/`encounter`.
- The strangler is real and minimized: Bridge 1 (parse) now serves only `pc`,
  Bridge 2 (presentation) serves everything, Bridge 3 (modules) hosts all 13.
  Full teardown — starting with the `pc` port — is phase **0e**.
