# Layered pack architecture

This document describes how Archivist is structured after the layered-pack
refactor (phases 0a–0f). It is a maintainer's guide to the *current* state, not
a roadmap. The incremental strangler migration that carried the plugin onto the
pack/kernel model is **complete**: all three bridges are torn down (the
kernel-parse bridge in **0e**, and the presentation registry and the module
system in **0f**), and no migration scaffolding remains. What *does* remain is a
small set of deliberate, permanent design compromises — accepted states, not
deferred work — recorded honestly in §6 so the next person does not mistake them
for an unfinished migration.

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
  stateful `TextFileView` app rather than a static authored block, and it has
  **not** been ported to a pack codec (no pack membership, no `doc` codec — an
  accepted state, see §6). It is **directly wired** in the composition root: the
  root calls `pcModule.init(services)` with a typed
  `PCServices { plugin, entities, compendiums }` bundle, so `pc` depends only on
  the concrete registries it needs — no `CoreAPI` (that service facade was
  deleted in **0f**), no module system, no pack.
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

## 6. Strangler teardown record (history)

The plugin was migrated onto the pack/kernel model incrementally, using the
strangler-fig pattern: new machinery grew around the old, and the old was removed
type by type. That migration is now **finished** — all three bridges have been
torn down. This section is a history of that teardown, kept so the shape of the
current wiring is legible.

- **Bridge 1 — kernel parse (removed in 0e).** A kernel-parse adapter once
  wrapped the old per-module YAML parse path. It was deleted when parsing moved
  wholesale into the kernel; `pc` was de-registered from the module system in the
  same phase.
- **Bridge 2 — presentation registry (removed in 0f).** The old
  `PresentationRegistry` held each module's DOM callbacks keyed by code-block
  type. It is gone: each authored type now ships a native `EntityPresenter`
  (defined by
  [`shared/rendering/entity-presenter.ts`](../../packages/obsidian/src/shared/rendering/entity-presenter.ts))
  — a `{ type, render, renderEditMode?, getInsertModal? }` contract. The 11
  presenters are collected into a plain `Map<type, EntityPresenter>` in the
  composition root and injected into one shared dispatch
  ([`shared/rendering/entity-presenter-dispatch.ts`](../../packages/obsidian/src/shared/rendering/entity-presenter-dispatch.ts)).
  Three callers consume that dispatch: the CM6 compendium-ref widget, the
  reading-mode post-processor helper (`renderCompendiumRefReadingMode`), and the
  `pc` builder's entity-block. The code-block processor instead consumes the
  presenter contract directly, so it keeps the kernel-parse + `resolve()`
  pipeline (codec output feeds edit-mode/save, resolved output feeds the view).
- **Bridge 3 — the module system (removed in 0f).** The original
  `CoreAPI` + `ArchivistModule.register` module system is deleted. Nothing
  registers through a module registry any more: the 11 authored types are wired
  as presenters (above), `pc` is composed directly via a typed `PCServices`
  bundle (§4), the inquiry chat engine is constructed directly
  (`new InquiryModule(...)`), and the AI generate-tools are registered by a
  generic pack-driven loop in the composition root rather than per module. A grep
  for `ArchivistModule`, `PresentationRegistry`, or `CoreAPI` across
  `packages/*/src` returns zero, and a planted arch test
  ([`tests/arch/no-module-system.test.ts`](../../tests/arch/no-module-system.test.ts))
  pins the three deleted bridge files (and asserts no source references their
  import paths).

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
the shared presenter dispatch belongs to a separate inquiry un-defer effort (its
own future project, not a numbered phase of this arc); the direct-parse path is
an accepted divergence, not an oversight.

### Accepted permanent states

These are settled design decisions, not migration debt. They are listed so a
future reader does not "fix" them by mistake:

- **`RenderContext.plugin` is typed `unknown`.** The presenter contract
  ([`shared/rendering/entity-presenter.ts`](../../packages/obsidian/src/shared/rendering/entity-presenter.ts))
  keeps the host-plugin handle deliberately untyped rather than exposing a
  structural host-plugin interface that would balloon as modules reach for more
  of the plugin. The seven module-side edit/presenter files that need the
  concrete class recover it with a type-only
  `import type ArchivistPlugin from ".../main"` (a compile-time-only edge, erased
  from the emitted JS). This is a deliberate compromise, not deferred work.
- **`pc` has no pack codec.** The player character is a stateful `TextFileView`
  app, not an authored stat block; it stays off the pack/codec model by decision
  (0e). See §4.
- **`ConfirmModal` lives under `modules/inquiry/shared/modals/`** and is imported
  cross-module (by `main.ts`, `pc`'s unequip flow, and the monster actions
  editor). Promoting it to a top-level `shared/modals/` tree is ordinary
  housekeeping, not part of this arc's scope; its current home is an accepted
  state.

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
  `pc` app (directly wired via a typed `PCServices` bundle — no pack codec, no
  `CoreAPI`), and generate-only `npc`/`encounter`.
- The strangler migration is complete: all three bridges are torn down — the
  kernel-parse bridge in 0e, the presentation registry and the module system in
  0f. Rendering now flows through the native `EntityPresenter` contract plus one
  shared dispatch; a few permanent accepted states are recorded in §6.
