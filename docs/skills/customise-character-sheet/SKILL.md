---
name: customise-character-sheet
description: Use when changing what a D&D character sheet shows in the Archivist Obsidian plugin — adding a feature, resource or homebrew item, changing how a resource is drawn (rendering_hint) or where it appears (surface), giving an item charges, or overriding a derived value. Everything is authored as YAML in vault notes; the plugin is never edited.
---

# Customise a Character Sheet

## The one thing to understand first

**You never edit the plugin.** Everything the sheet shows is read from YAML in the
user's own notes. Adding a resource is not a code change — it is a note. Changing
how a resource is drawn is one key.

If you find yourself wanting to modify the plugin to display something, stop: the
mechanism you want almost certainly already exists as a key, and this document
lists them. If it genuinely does not, say so plainly rather than inventing a key —
an unrecognised key is silently ignored, so a guess looks like a bug to the user.

## Companion skill

`import-character-sheet` is the process for bringing a whole character in from a PDF
or an exported sheet: read every page, resolve every reference against the installed
compendiums before authoring homebrew, wire the builder choices, ask rather than
guess. Use it for a full import; use **this** skill for the YAML itself, and for any
single change to a sheet that already exists.

## The two layers

Almost every change is one or both of these:

1. **A compendium entity note** — the *definition* of a thing (a feature, an item,
   a feat). Lives in a compendium folder, reusable across characters.
2. **The character note** — which things this character *has*, and any per-character
   overrides. One note per PC, holding a ```pc fenced block.

A definition nobody references does nothing. A reference to a definition that does
not exist warns and is skipped. Both halves are needed.

## Where files go

A folder becomes a compendium by containing a `_compendium.md`:

```yaml
---
archivist_compendium: true
name: Me
description: My homebrew
readonly: false
homebrew: true
---
```

Any folder, anywhere in the vault. Put homebrew in the user's own compendium (a
`Me` folder is the convention) — **never** edit a bundled book's notes, because a
re-import overwrites them.

An entity note needs frontmatter *and* a fenced block whose language is the entity
type:

````markdown
---
archivist: true
entity_type: optional-feature
slug: me_optional-feature_hero-points
name: Hero Points
compendium: Me
---

```optional-feature
slug: me_optional-feature_hero-points
name: Hero Points
...
```
````

- `entity_type:` in frontmatter, **not** `archivist-type:` — that one is the PC
  note's key, and using it on a compendium note produces "slug not found" warnings
  that look like a missing file.
- The fenced block language must equal `entity_type`.
- Slug shape: `<compendium>_<entity_type>_<name-in-kebab-case>`.
- The slug appears **twice** — frontmatter and block — and they must match.

Entity types: `monster`, `spell`, `item`, `class`, `race`, `subclass`,
`background`, `feat`, `optional-feature`, `armor`, `weapon`, `condition`.

## Task: give a character a feature or a trackable resource

This is the most common request: hero points, a sanity track, a campaign boon, a
once-per-day ability the DM granted.

Use an **`optional-feature`** note, then list it on the character. This path exists
precisely so a grant can belong to *one character* rather than being welded onto a
race or class that other characters share.

**Step 1 — the definition:**

```yaml
slug: me_optional-feature_hero-points
name: Hero Points
edition: '2014'          # or '2024' — must match the character's edition
source: Homebrew (DM)
feature_type: campaign
description: Points the DM awards for heroics.
prerequisites: []
available_to: []
effects: []
uses:
  max: 999
  recharge: custom
rendering_hint: tally
surface: tab
```

**Step 2 — give it to the character.** In the ```pc block:

```yaml
additional_features:
  - "[[me_optional-feature_hero-points]]"
```

A bare slug works too; a wikilink is clearer. The tracker appears on the Resources
tab with no further work.

### The `uses` block

| key | meaning |
|---|---|
| `max` | a number, or a `max_formula` expression (see below). **Required** when `uses` is present. |
| `recharge` | when a full reset happens — `short-rest`, `long-rest`, `either`, `dawn`, `dusk`, `turn`, `round`, `custom` |
| `recovery` | optional list, for a pool a rest does *not* fully refill |

`either` means "short **or** long rest". `custom` means no rest returns it — use it
for anything the table hands out and takes away by hand.

A **partial** recovery (a sanity track that regains 1 per long rest):

```yaml
uses:
  max: 65
  recharge: custom
  recovery:
    - id: campaign:sanity-long-rest
      name: Long Rest
      amount: 1
      reset: long-rest
      restores: uses      # or spell-slots
```

### Grouping on the Resources tab

Rows are grouped by **what gives them back**, and the group is derived from
`recharge` — you do not choose it:

- `short-rest`, `either` → **Short Rest**
- `long-rest` → **Long Rest**
- `dawn`, `dusk`, `turn`, `round`, `custom` → **Doesn't reset**

A resource with a partial `recovery` still files under its own `recharge` group and
prints its recovery as a caption on the row.

## Task: change how a resource is drawn

`rendering_hint` picks the control. This is the whole point of the design: the note
decides, the plugin never hardcodes anything about a particular resource.

| `rendering_hint` | draws | use it for |
|---|---|---|
| `counter` | stacked `+` / `−` with a big `current / total` | anything with a real maximum |
| `tally` | a bare count, `+` / `−`, **no** total | a count with no ceiling — hero points, table currency |
| `die` | the counter with the die face inline | a resource that *is* a die (psychic die, bardic inspiration die) |
| `pips` | a row of tick boxes | a handful of uses |
| `charge-bar` | a bar with a spend range | many charges — a 100-charge shield |
| `point-pool` | a numeric pool with a spend stepper | sorcery points and similar |

Omit it and the sheet picks by magnitude: small maximums draw pips, larger ones a
counter.

**`tally` needs `max: 999`.** That is the "no ceiling" sentinel and it is
load-bearing, not a placeholder: the engine clamps a stored count to its maximum on
every recalc, so `max: 0` would reset the tally to zero, and every increment would
be refused. At 999 neither clamp can ever be reached by a real count.

**For `die`, declare the die** on the resource:

```yaml
die:
  base: d6
  scaling:
    '5': d8
    '11': d10
```

The face is resolved from the owner's level automatically. It is a readout, not a
picker — there is no field to record a chosen face, so nothing about it is clickable.

## Task: move a resource into the header band

```yaml
surface: band     # or: tab  (the default)
```

`band` puts it in the strip beside HP, **in addition to** the Resources tab — the
tab is always the complete inventory, so nothing is ever moved *out* of it.

The band deliberately shows current and total and nothing else — no "/ Long Rest",
no recovery caption. Keep it for the two or three things the player touches every
round; a crowded band defeats its purpose. Hit dice are always there and need no key.

To take something *out* of the band, set `surface: tab` or delete the key. That is
the entire change — no plugin edit.

## The `max_formula` mini-language

`uses.max` and `recovery[].amount` accept an expression, not just a number:

```
expr   := term (('+' | '-') term)*
term   := factor (('*' | '/') factor)*
factor := number | ident | '{' ident '}' | ceil(expr) | floor(expr)
        | max(expr, expr, …) | min(expr, expr, …) | column('Name') | ( expr )
ident  := level | class_level | prof | str_mod | dex_mod | con_mod
        | int_mod | wis_mod | cha_mod
```

- `*` and `/` bind tighter than `+` and `-`.
- `/` is **real division** — wrap in `ceil()` / `floor()` for a whole number:
  `ceil({class_level}/2)`.
- `max(1, {cha_mod})` is how the data says "a minimum of once".
- `{level}` is total character level; `{class_level}` is the level in the class that
  granted the resource.
- `column('Seals')` reads a numeric column from the owning class's level table.
- `999` means at will.

Quote expressions in YAML: `max_formula: 'ceil({class_level}/2)'`.

## Task: give an item charges

Charges live on the **character's equipment entry**, not the item definition —
they are this copy's current state:

```yaml
equipment:
  - item: "[[me_item_ring-of-snake]]"
    equipped: true
    attuned: true
    state:
      charges:
        current: 3
        max: 3
      recovery:
        amount: '1d3'
        reset: dawn        # dawn | short | long | special
```

`charges` alone is enough to get a tracker; `recovery` is optional. Both
`current` and `max` are required when `charges` is present.

**Three things that surprise people here:**

1. **`recovery.amount` does not restore that amount — it is a caption.** A rest
   sets `current = max` outright. A wand written `amount: '1d6+1'` refills to
   *full* on a rest, not by 1d6+1. Roll it yourself and set `current` by hand if
   the partial refill matters.
2. **`amount` is only ever displayed for `reset: dawn`**, and only when it is not
   `"1"`. On short/long/special it is stored and never shown.
3. **`reset: special` is never restored by any rest** — it means "by some other
   rule", and you adjust it by hand. Long rest restores `short`, `long` and
   `dawn`; short rest restores `short` only.

Item charge rows appear on the Resources tab under **Doesn't reset**, and **only
while the item is equipped** — the tab answers "what can I spend right now?", and
a wand in the pack is not spendable without taking it out. Unequipping hides the
row; it never touches the charges, and equipping brings it straight back. (A rest
still recharges an unequipped item, so nothing is lost by stowing it.)

Per-entry overrides let one copy differ from the definition:

```yaml
    overrides:
      name: Scroll of Control Weather
      spell: "[[srd-2024_spell_control-weather]]"
```

Available per entry: `name`, `bonus`, `damage_bonus`, `extra_damage`, `ac_bonus`,
`action`, `range`, `resist`, `immune`, `vulnerable`, `condition_immune`, `spell`,
`spell_ability`.

> ⚠️ **`equipment[].overrides` and `equipment[].state` are strict.** They are the
> only two places in a character note where an unknown key **fails the whole
> file's parse** rather than being ignored — the entire sheet stops rendering.
> Note especially the singular spelling here (`resist`, `immune`, `vulnerable`,
> `condition_immune`); the character-level block uses the plural forms, and using
> a plural here breaks the note.

## Task: override a derived value

`overrides:` in the ```pc block hand-sets things the engine would otherwise
compute. **An override replaces the derived value; it is not added to it.**

```yaml
overrides:
  ac: 18
  speed: 40
  attunement_limit: 5
  hp:
    max: 198
  saves:
    con: { proficient: true }
  skills:
    stealth: { bonus: 7, proficiency: expertise }
  passives:
    perception: 19
```

| key | shape | effect |
|---|---|---|
| `scores` | `{ <ability>: int }` | replaces the final ability score |
| `saves` | `{ <ability>: { bonus?, proficient? } }` | `bonus` replaces the save total; `proficient` wins over every grant |
| `skills` | `{ <skill>: { bonus, proficiency? } }` | **`bonus` is required** — see below |
| `passives` | `{ perception?, investigation?, insight? }` | replaces the computed passive |
| `hp` | `{ max?, rolled?, modifier? }` | `max` replaces; `rolled` replaces the average-dice total; `modifier` is *additive* |
| `ac` | int | replaces derived AC |
| `speed` | int | replaces derived walk speed |
| `initiative` | int | replaces the initiative bonus |
| `attunement_limit` | int | replaces the cap outright |
| `spell_slots` | `{ <level>: int }` | replaces the slot total at that level |
| `spellcasting_ability` | ability | fallback for spells with no ability of their own |
| `spellcasting_ability_by_class` | `{ <class slug>: ability }` | per-class casting ability |
| `languages` | `{ add?: [], remove?: [] }` | add or suppress |
| `tools` | `{ add?, remove?, proficiency?: { <tool>: none\|proficient\|expertise } }` | add, suppress, or set a tri |
| `defenses` | `{ resistances?: {remove: []}, … }` | **suppression only** |

Two traps:

- **`skills.<skill>.bonus` is required.** `stealth: { proficiency: expertise }`
  alone fails the parse. Give the bonus too.
- **`overrides.defenses` can only REMOVE.** To *add* a resistance, use the
  top-level `defenses:` block on the character, which takes plain string lists:
  `defenses: { resistances: [fire] }`.

Abilities are `str dex con int wis cha`; skills are the 18 kebab-case slugs
(`sleight-of-hand`, `animal-handling`, …).

## Task: give something a mechanical effect

`effects:` is a list, authored on a feature, feat or optional-feature note (**not**
on the character). On feats and optional-features the key is required — write
`effects: []` if there are none.

Each entry has a `kind` and its own fields:

```yaml
effects:
  - kind: proficiency
    proficiency_type: weapon
    value: rapier
  - kind: ability-bonus      # ← WRONG: no such kind. See the list below.
```

**Two shared fields, on every kind:**

- `condition:` — free prose ("While raging"). **It is displayed, never evaluated.**
  An effect with a `condition` is *always on*. If a bonus must actually switch off,
  the engine cannot express it: say so and leave it in the description.
- `subject:` — **omit it, or write exactly `self`.** Any other value parses, warns
  in the console, and the effect is silently discarded.

### The complete list of kinds

| `kind` | required fields | optional |
|---|---|---|
| `ac-bonus` | `value` int | `requires_armor` bool |
| `initiative-bonus` | `value` int | |
| `hp-per-level-bonus` | `value` int | |
| `speed-bonus` | `mode` (`walk`/`fly`/`swim`/`climb`/`burrow`), `value` int | `set` bool (absolute floor), `scales_at` |
| `sense` | `type` (`darkvision`/`blindsight`/`tremorsense`/`truesight`), `range` int | |
| `proficiency` | `proficiency_type` (`skill`/`tool`/`language`/`saving-throw`/`armor`/`weapon`), `value` string | `expertise` bool |
| `resistance` | `damage_type` string | |
| `immunity` | `damage_type` string | |
| `vulnerability` | `damage_type` string | |
| `immune-condition` | `condition` = the condition NAME | `while` string |
| `apply-condition` | `condition` = the condition NAME | `duration`, `ends_on[]`, `save_repeat {ability, timing}` |
| `damage-bonus` | `damage_type` string, `amount` string (`"2d6"`, `"5"`) | `applies_to` (`weapon`/`spell`/`all`) |
| `attunement-limit` | `value` positive int (an absolute cap) | `scales_at` |
| `unarmored-ac` | `abilities[]` | `base` int, `allow_shield` bool |
| `unarmed-strike` | — | `dice` (`"1d6"` form), `abilities[]` |
| `weapon-ability` | `ability` (an ability, or `spellcasting`) | `weapons` |
| `roll-modifier` | `mode` (`advantage`/`disadvantage`/`reroll`/`add-d4`), `roll` (`ability-check`/`saving-throw`/`attack`/`any`) | `scope` |
| `extra-attack` | `count` positive int (**extra** attacks) | `scales_at` (uses `count`) |
| `extra-action` | `count` int, `action_type` (`action`/`bonus-action`/`reaction`) | |
| `crit-range` | `min_roll` int 2–20 | `applies_to` |
| `reroll-damage` | `max_reroll` positive int | `applies_to`, `once_per_die` |
| `attack-rule` | `flag: no-ranged-in-melee-disadvantage` | |
| `save-outcome` | `ability`, `on_success`, `on_failure` (`none`/`half`/`full`), `applies_to` | |
| `ability-score-increase` | `abilities`, `amount`, `choose`, `max` | |
| `temp-hp` | `amount` string | |
| `heal` | `amount` string | |

There is **no** `ability-bonus`, no `save-bonus`, no `attack-bonus` and no
`skill-bonus`. A flat bonus to an ability *score* is `ability-score-increase`; a
bonus to a save or an attack **roll** cannot be expressed — model what you can and
say the rest is prose.

**`ability-score-increase` has two keys that must be written even when empty:**
`choose` and `max` are required-with-null. Write `choose: null` and `max: null`
literally — omitting them fails the effect. Use `choose: 2` only when
`abilities: chosen`; a fixed list takes `choose: null`.

**`scales_at`** exists on three kinds only — `speed-bonus`, `attunement-limit`
(both `{level, value}`) and `extra-attack` (`{level, count}`). The whole
progression goes in one effect:

```yaml
  - kind: attunement-limit
    value: 4
    scales_at:
      - { level: 14, value: 5 }
      - { level: 18, value: 6 }
```

Note this is a *different* `scales_at` from a resource's, which is
`{level, max}` with a formula string.

## Task: a homebrew item, feat, or other entity

Same pattern: an entity note of the right `entity_type`, referenced from the
character. A feat is referenced from the class level that took it:

```yaml
class:
  - name: "[[...class...]]"
    level: 14
    choices:
      '12':
        asi-or-feat: feat
        feat: me_feat_focus-shot
```

**Feats resolve from exactly two places**: a class level's `choices[<level>].feat`,
and a background's `origin_feat`. A feat parked anywhere else — notably on a race —
renders its name while **none of its effects apply**. If a user reports "it shows
but doesn't work", check this first.

## Verifying a change

Ask the user to reopen the character note (or reload the plugin). Then check, in
this order:

1. **Does the row appear at all?** If not, the reference did not resolve — check
   the slug matches in all three places (frontmatter, block, reference).
2. **Does it have a counter?** A feature with no `uses` renders as a card with no
   tracker. A `uses.max` written as prose ("as the DM decides") is rejected as a
   tracker on purpose and warns.
3. **Does it sit in the right group?** If not, `recharge` is the key to change.
4. **Do the mechanics apply?** Rendering and effect are separate: a feature can show
   correctly and still apply nothing, if its `effects` are empty or it sits in a slot
   the engine does not read.

Obsidian's developer console shows the plugin's warnings, which name the slug that
failed. That is usually faster than guessing.

## Why a typo is usually invisible

**Almost every schema here is non-strict: an unrecognised key is dropped in
silence.** Nothing warns, nothing breaks, the sheet just does not change. This is
the single most common reason a change "doesn't work", and it is why guessing at a
key name is worse than saying you don't know one.

The two exceptions are strict, and fail loudly and totally:

| Where | Unknown key does |
|---|---|
| `equipment[].overrides` | **fails the whole character parse** |
| `equipment[].state` | **fails the whole character parse** |
| everything else | silently ignored |

So: a blank sheet means you touched one of those two. A sheet that renders but
ignores you means a key name is wrong somewhere else.

A wrong `kind` on an effect *is* loud (the discriminator misses). A wrong *field*
inside a correct `kind` is silent.

### Three different vocabularies are all called `reset`

Mixing them up parses and does nothing:

| Context | Allowed values |
|---|---|
| a feature's `uses.recharge`, a resource's `reset` | `short-rest` `long-rest` `either` `dawn` `dusk` `turn` `round` `custom` |
| an item's `state.recovery.reset` | `dawn` `short` `long` `special` |

## Failure modes, and what they look like

| Symptom | Cause |
|---|---|
| Nothing appears | slug mismatch, or the reference was never added to the character |
| Appears with no `+`/`−` | no `uses` block, or a prose `uses.max` |
| "slug not found" warning | `archivist-type:` used instead of `entity_type:` on a compendium note |
| Name shows, effects do nothing | a feat in a slot the engine does not resolve (see above) |
| A key you added does nothing at all | the key is not in the vocabulary — unrecognised keys are silently ignored |
| An effect does nothing, console warns about a subject | `subject:` is set to something other than `self` |
| An effect applies when it shouldn't | `condition:` is prose; it never gates anything |
| A tally resets to 0 | `max` is not 999 |
| **The whole sheet stops rendering** | an unknown key under `equipment[].overrides` or `equipment[].state` |
| A charged item refills to full instead of by its amount | that is the behaviour — `recovery.amount` is a caption |
| Edits vanish on reimport | the note is in a bundled book compendium, not the user's own |

## Rules for working on someone's vault

- **Ask before guessing at homebrew.** Ambiguity in a character's notes is usually
  where the DM's own rules live, which is exactly what must not be invented. If a
  note says "+2 DEX", ask whether that is the score, the attack roll, or the damage.
- **Never edit a bundled compendium's notes.** Homebrew goes in the user's own.
- **Say when something is prose-only.** If a mechanic cannot be expressed in the
  data model, model what you can, say plainly which half is missing, and leave the
  rest in the description so the player applies it by hand. Do not quietly drop it.
- **One change at a time when debugging.** Several YAML edits at once and a sheet
  that still looks wrong tells you nothing about which edit was the problem.
