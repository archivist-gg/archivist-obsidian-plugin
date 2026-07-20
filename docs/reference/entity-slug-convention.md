# Entity Slug Convention

Every compendium entity (SRD or homebrew) is identified by a **type-namespaced slug**:

```
<compendium-prefix>_<entity_type>_<name-slug>
```

Examples:

| Slug | Prefix | Type | Name |
|------|--------|------|------|
| `srd-2024_armor_shield` | `srd-2024` | `armor` | `shield` |
| `srd-2024_spell_shield` | `srd-2024` | `spell` | `shield` |
| `srd-5e_background_acolyte` | `srd-5e` | `background` | `acolyte` |
| `srd-5e_monster_acolyte` | `srd-5e` | `monster` | `acolyte` |
| `mcdm_class_illrigger` | `mcdm` | `class` | `illrigger` |
| `mcdm_subclass_hellspeaker` | `mcdm` | `subclass` | `hellspeaker` |
| `mcdm_optional-feature_bedevil` | `mcdm` | `optional-feature` | `bedevil` |
| `dmg-2024_item_ring-of-evasion` | `dmg-2024` | `item` | `ring-of-evasion` |
| `me_item_cloak-of-the-stalwart-bulwark` | `me` | `item` | `cloak-of-the-stalwart-bulwark` |

## Why the type token

Without it, two same-named entities of different types collapse to one slug and the
type-agnostic registry (`getBySlug`) silently returns whichever loaded last. The armor
**Shield** and the **Shield** spell both hashed to `srd-2024_shield`, so an equipped
shield rendered as the spell (no AC, spell prose). The type token makes cross-type
collisions impossible.

## The type vocabulary (12 canonical singular tokens)

```
armor  weapon  item  spell  monster  class  subclass  background  race  feat  optional-feature  condition
```

The type token is **exactly** the value written to the entity's `entity_type`
frontmatter — the singular canonical kind. Not the plural generator input
(`classes`/`creatures`/`magicitems`), not `creature`. A build assertion in the
generator enforces `slug-type-token === entity_type` for every emitted entity.

## Delimiter invariant

A slug splits on `_` into **exactly three parts** `[prefix, type, name]`, because:

- no compendium prefix contains `_` (`srd-2024`, `srd-5e`, `mcdm`, `dmg-2024`,
  `eberron-forge-of-the-artificer`, `me` — hyphen/alnum only);
- no type token contains `_` (`optional-feature` uses a hyphen);
- `slugify` maps every non-alphanumeric run to `-` / strips it, so no name-slug
  contains `_`.

Any code that strips the prefix to recover the bare name **must be arity-robust** so it
survives bare (0 `_`), legacy 2-part, and current 3-part slugs:

```ts
const p = slug.split("_");
const bareName = p.length >= 3 ? p.slice(2).join("_") : p[p.length - 1];
```

A 2-part-only strip (`slug.slice(slug.indexOf("_") + 1)`) returns `class_fighter` for
`srd-2024_class_fighter` and silently breaks owner-scoped lookups. This bit the SRD
generator's overlay matcher (`class-merge.ts bareSlug`) — always use the arity-robust
form.

## Collisions fail loud

The core `EntityRegistry.register()` emits a `console.warn` (naming both entities'
type + name + slug) if two **different** entities are ever registered under the same
slug, instead of silently overwriting. Idempotent re-registration of the same entity
(same `filePath`) does not warn. Type-namespaced slugs should never collide; a warning
means the generator or a homebrew author produced a duplicate — investigate, don't
ignore.

## Cross-reference fields are NOT slugs

Fields that point at *other* entities are resolved by **name or vault path**, never by
slug, and must be left exactly as authored (the migration never rewrites them):

- `parent_class` (subclass → its class)
- `available_to` (boon/feature → the classes that can take it)
- `pool_grants[].grants[].feature`
- `base_item` (magic item → its base weapon/armor, a `[[Compendium/Type/Name]]` path)
- `starting_equipment` grants/categories, and body markup like `{@spell ...}`

Only an entity's **own** `slug` (frontmatter + the body code-block `slug:` when present)
carries the type-namespaced form.

## Data is generator-reproducible — never offline-inject

**Do not hand-edit generated data files or the bundle to add or change entities.** All
SRD data must be reproducible by running the generator, so anyone who installs the
package and runs `build:srd-canonical` gets identical output. Content that lives only in
a locally-edited JSON/bundle is invisible to every other install.

- Modify **existing** entities via the overlays (`tools/srd-canonical/overlays/*.yaml`),
  keyed by the bare (or owner-scoped) feature slug.
- Add **synthetic** entities (e.g. the spell-scroll / unidentified-item seeds) via a
  committed source file under `tools/srd-canonical/data/` that the generator reads and
  emits through the normal pipeline (`buildCanonicalSlug` for the slug, `projectToRuntime`
  for the runtime shape, `writeMd` for the bundle) — see `synthetic-item-seeds.2024.json`
  and its emit block in `index.ts` for the pattern.

Then regenerate. The type-namespaced slug is always **computed** by the generator, never
hardcoded in source.

## Migrating existing data after a slug-scheme change

When the slug scheme changes, three data surfaces must be brought forward together in one
delivery (so there is no transition window where a reference dangles):

1. **SRD compendiums** (bundle-managed) — regenerate (`build:srd-canonical`), rebuild the
   plugin (re-inlines the bundle), deploy, then reseed the vault (the reseed re-copies
   every SRD `.md` because the stamped bundle version differs from the plugin manifest;
   deleting `Compendium/{SRD 2024,SRD 5e}/_compendium.md` forces it deterministically).
2. **Homebrew compendiums** (not bundle-managed) — an idempotent, dry-run-first script
   rewrites each entity's own `slug` computed from its frontmatter
   `(compendium, entity_type, name)`, leaving all cross-reference fields untouched.
3. **PlayerCharacter files + `{{type:slug}}` note refs** — a context-typed, lossless,
   idempotent script: resolve each `(prefix, name)` reference against the regenerated
   registry filtered to the field's context type set, requiring a unique same-prefix
   match; rewrite to the matched entity's new slug, or leave-and-warn on a dead/ambiguous
   ref (never guess, never change the prefix). Never touch a character's own identity
   `slug`/`name`/`compendium`, `state.feature_uses` keys, or non-slug values.

Back up mutated vault dirs first; every migration script must be re-runnable as a no-op.
