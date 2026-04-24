# Credits

## Condition icons

The PC character sheet's conditions popover uses icons from
[game-icons.net](https://game-icons.net/), licensed under
[CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/).

Six of the fifteen condition/exhaustion icons are currently sourced from
**Lorc** on game-icons.net. The remaining nine are simple geometric
placeholders pending a design pass — the originally-specified slugs either
do not exist on game-icons.net, or the matching artwork is by a different
author than the SP4 spec required (Lorc-only). Those placeholders remain
flagged with `TODO(SP4 icons)` in `src/modules/pc/assets/condition-icons.ts`.

Individual attributions for the shipped icons:

- frightened → [lorc/screaming](https://game-icons.net/1x1/lorc/screaming.html)
- grappled → [lorc/manacles](https://game-icons.net/1x1/lorc/manacles.html)
- invisible → [lorc/ghost-ally](https://game-icons.net/1x1/lorc/ghost-ally.html)
- paralyzed → [lorc/lightning-tear](https://game-icons.net/1x1/lorc/lightning-tear.html)
- petrified → [lorc/stone-block](https://game-icons.net/1x1/lorc/stone-block.html)
- unconscious → [lorc/sleepy](https://game-icons.net/1x1/lorc/sleepy.html)

Still a placeholder (no matching Lorc slug on game-icons.net at this time):

- blinded (spec: `lorc/blindfold` — blindfold exists but is by Delapouite)
- charmed (spec: `lorc/hearts` — hearts exists but is by Skoll)
- deafened (spec: `lorc/ear-plugs` — no such slug on game-icons.net)
- incapacitated (spec: `lorc/knocked-out` — closest is `delapouite/knocked-out-stars` or `skoll/knockout`)
- poisoned (spec: `lorc/death-juice` — death-juice exists but is by Darkzaitzev)
- prone (spec: `lorc/prostration` — no such slug on game-icons.net)
- restrained (spec: `lorc/ball-shackle` — no such slug on game-icons.net)
- stunned (spec: `lorc/dizzy` — no such slug on game-icons.net)
- exhaustion (spec: `lorc/tired-eye` — tired-eye exists but is by Delapouite)

If any icon reverts to a placeholder (due to licensing audit, image quality,
or slug rename), this file should be updated to reflect the current state.
