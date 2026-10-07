# Third-party notices

Archivist (main.js and styles.css) contains material made by others. Each item below stays under
its own licence, and nothing in Archivist's own licence (LICENSE) limits the rights that licence
gives you.

## System Reference Document 5.1 and 5.2 (CC-BY-4.0)

Archivist bundles content from the System Reference Document 5.1 (2014) and 5.2 (2024), both
licensed under the Creative Commons Attribution 4.0 International License (CC-BY-4.0). The plugin
copies it into your vault as the read-only SRD 5e and SRD 2024 compendiums.

### Required attribution

This work includes material taken from the System Reference Document 5.1 ("SRD 5.1") by Wizards of the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode.

This work includes material from the System Reference Document 5.2 ("SRD 5.2") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.

This project is unofficial and not affiliated with or endorsed by Wizards of the Coast.

### Changes made

This material is modified, and it is a merge. Apart from a few SRD 5.2 equipment descriptions
transcribed verbatim from the SRD 5.2 document (SRD_CC_v5.2.pdf,
https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.pdf, CC-BY-4.0), it was not
taken from the SRD PDFs. It is assembled from: the Open5e v2 API (https://open5e.com), queried
with the official SRD document filters (srd-2014, srd-2024), which is the immediate
redistribution source of the SRD text and itself a CC-BY-4.0 redistribution; a structured-rules
data dump, used to enrich mechanical fields, to expand the SRD's generic magic-item variants
into one entry per base item and, for the conditions, as the text source; virtual-tabletop
activation data, used to derive typed item effects; and a hand-curated overlay written for
Archivist.

The content is reformatted into Archivist's YAML and Markdown format: class features and species
traits become structured fields, prose is kept as description text, cross-references become
vault links, and dice and save expressions become inline roll tags. Narrative prose is preserved
and no mechanics are invented. A few entries with no SRD counterpart (the base Shield entry, an
Ability Score Improvement entry, spell scrolls and unidentified-item placeholders) are written
for Archivist and marked as such. Every entry's source is SRD 5.1 or SRD 5.2; no content from
any other publication is bundled.

Credit to Open5e (https://open5e.com) as the immediate SRD redistribution source.

## Open-source libraries in main.js

main.js bundles these libraries. Archivist's own packages, @archivist-gg/dnd5e and @archivist-
gg/core, are also bundled; they are the author's own work under Archivist's licence.

### js-yaml 4.1.1 (MIT)

https://github.com/nodeca/js-yaml

```
(The MIT License)

Copyright (C) 2011-2015 by Vitaly Puzrin

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

### zod 4.3.6 (MIT)

https://zod.dev

```
MIT License

Copyright (c) 2025 Colin McDonnell

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### monkey-around 3.0.0 (ISC)

https://github.com/pjeby/monkey-around (the package declares the ISC licence and ships no licence file; the standard ISC text follows)

```
ISC License

Copyright (c) PJ Eby

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```

## Fonts in styles.css (SIL Open Font License 1.1)

styles.css embeds these fonts in WOFF2 form, under the CSS family names "Archivist Libre
Baskerville" and "Archivist Noto Sans" (aliases in the style sheet; the font files keep their
own names). The fonts are not sold on their own; they stay under the SIL Open Font License 1.1,
whose text follows.

- Libre Baskerville, version 2.005 (Regular, Italic, Bold): Copyright 2012 The Libre Baskerville Project Authors (https://github.com/impallari/Libre-Baskerville)
- Noto Sans, version 2.015 (Regular, Bold): Copyright 2022 The Noto Project Authors (https://github.com/notofonts/latin-greek-cyrillic)

```
-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded, 
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.
```

## Icons (CC BY 3.0)

The character sheet's item, condition, spell effect and rest button icons are icons from Noun Project
(https://thenounproject.com/) creators, each licensed under the Creative Commons Attribution 3.0
License (CC BY 3.0, https://creativecommons.org/licenses/by/3.0/). They are embedded in main.js
with the attribution text removed, and credited here in the form "Title by Creator from Noun
Project (CC BY 3.0)". 136 icons (138 keys), 32 creators. An icon credited as "adapted" was changed:
the short rest button's Flame by Doodle Icons is redrawn in brush strokes to match the long rest
button's Moon.

### 4urbrand

- traumatized by 4urbrand from Noun Project (CC BY 3.0) https://thenounproject.com/icon/8429040/ (key `frightened`)

### ahmadwil

- Brain Damage by ahmadwil from Noun Project (CC BY 3.0) https://thenounproject.com/icon/7372631/ (key `paralyzed`)

### Amethyst Studio

- necklace by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5097791/ (key `amulet`)
- Laser Gun by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5367256/ (a firearm icon)
- Gun by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5098383/ (a firearm icon)
- Backpack by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/4839405/ (key `backpack`)
- Barrel by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/4947752/ (key `barrel`)
- Axe by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5043208/ (key `battleaxe`)
- Sleeping Bag by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5368469/ (key `bedroll`)
- belt by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5099667/ (key `belt`)
- Blind by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5166835/ (key `blinded`)
- Book by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/4947759/ (key `book`)
- military boots by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5098399/ (key `boots`)
- Tarot cards by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5465175/ (key `cards`)
- Treasure Chest by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/4283875/ (key `chest`)
- tiara by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5099666/ (key `circlet`)
- boxer robe by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5216960/ (key `cloak`)
- coin by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/4947760/ (key `coins`)
- Compass by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5097437/ (key `compass`)
- Crowbar by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5873617/ (key `crowbar`)
- Crown by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/4283857/ (key `crown`)
- dagger by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5099505/ (key `dagger`)
- Dice by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5097444/ (key `dice`)
- fatigue by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5048457/ (key `exhaustion`)
- Flail by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5043221/ (key `flail`)
- Bottle by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5097434/ (key `flask`)
- Diamond by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5097796/ (key `gem`)
- glove by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/4839409/ (key `gloves`)
- Hand by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5218434/ (key `grappled`)
- Axe by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5099503/ (key `greataxe`)
- Sword by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/4944637/ (key `greatsword`)
- Grenade by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5098394/ (key `grenade`)
- Axe by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/4947753/ (key `handaxe`)
- first aid kit by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5098375/ (key `healer-kit`)
- armour by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5099529/ (key `heavy-armor`)
- Crossbow by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/4283853/ (key `heavy-crossbow`)
- Helmet by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5043227/ (key `helmet`)
- aromatic herbs by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5465176/ (key `herbs`)
- Cross by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5166470/ (key `holy-symbol`)
- hourglass sand by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5465185/ (key `hourglass`)
- confuse by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5174510/ (key `incapacitated`)
- Lute by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5217205/ (key `instrument`)
- Ghost by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5218449/ (key `invisible`)
- spears by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5099521/ (key `javelin`)
- Key by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5098616/ (key `key`)
- lance by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5043207/ (key `lance`)
- Lantern by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5098626/ (key `lantern`)
- futuristic gun by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5367273/ (a firearm icon)
- armor by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/4947755/ (key `light-armor`)
- Crossbow by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5043212/ (key `light-crossbow`)
- Hammer by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/4944623/ (key `light-hammer`)
- bow by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5099507/ (key `longbow`)
- Sword by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/4283862/ (key `longsword`)
- Mace by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/4283860/ (key `mace`)
- Handcuffs by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5048129/ (key `manacles`)
- Parchment by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5098620/ (key `map`)
- Hammer by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5367248/ (key `maul`)
- armor by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/4283387/ (key `medium-armor`)
- Mace by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/4944622/ (key `morningstar`)
- blunderbuss by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5097439/ (key `musket`)
- Gun by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5369017/ (key `pistol`)
- Vomiting by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5048447/ (key `poisoned`)
- Cooking Pot by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/4947761/ (key `pot`)
- potion by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/4944634/ (key `potion`)
- Money Bag by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5043206/ (key `pouch`)
- paraplegic by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/4666609/ (key `prone`)
- staff by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5042672/ (key `quarterstaff`)
- Inkwell by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5368579/ (key `quill`)
- Quiver by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5043202/ (key `quiver`)
- rapier by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5043228/ (key `rapier`)
- rations by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5464928/ (key `rations`)
- Magic Wand by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/4283868/ (key `rod`)
- Rope by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/6267263/ (key `rope`)
- Money Bag by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/4947754/ (key `sack`)
- cutlass by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5097433/ (key `scimitar`)
- Scroll by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5043214/ (key `scroll`)
- Pistol by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5098386/ (a firearm icon)
- Shield by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/4283854/ (key `shield`)
- bow by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5043201/ (key `shortbow`)
- Sword by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5099501/ (key `shortsword`)
- Shotgun by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5367272/ (key `shotgun`)
- spears by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/4944635/ (key `spear`)
- spell book by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5043216/ (key `spellbook`)
- spyglass by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5098623/ (key `spyglass`)
- staff by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5042672/ (key `staff`)
- clay pebbles by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5683400/ (key `stone`)
- Dizzy by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5048458/ (key `stunned`)
- Tent by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/4944625/ (key `tent`)
- Hammer by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/4944623/ (key `tools`)
- Torch by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5043203/ (key `torch`)
- Trident by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5099504/ (key `trident`)
- faint by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5047869/ (key `unconscious`)
- wand by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5465177/ (key `wand`)
- Water Bottle by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5366899/ (key `waterskin`)
- whip by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/4900748/ (key `whip`)
- Crystal Ball by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5042316/ (key `wondrous`)
- Snowflake by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/4944118/ (spell effect `cold`)
- Health by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5218531/ (spell effect `healing`)
- Package by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5368565/ (generic item)
- Skull by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/4136173/ (spell effect `necrotic`)
- Brain by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/4284644/ (spell effect `psychic`)
- sun by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5042666/ (spell effect `radiant`)
- Swords by Amethyst Studio from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5043215/ (generic weapon)

### Andrejs Kirma

- explosion by Andrejs Kirma from Noun Project (CC BY 3.0) https://thenounproject.com/icon/2181796/ (spell effect `physical`)

### Arkinasi

- Bomb by Arkinasi from Noun Project (CC BY 3.0) https://thenounproject.com/icon/8404843/ (key `bomb`)

### Art Isnakafa

- Spear by Art Isnakafa from Noun Project (CC BY 3.0) https://thenounproject.com/icon/8417234/ (key `pike`)
- Pickaxe by Art Isnakafa from Noun Project (CC BY 3.0) https://thenounproject.com/icon/8194020/ (key `war-pick`)

### arte ador

- Moon by arte ador from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5989475/ (sheet button `long-rest`)

### Azam Ishaq

- Moai by Azam Ishaq from Noun Project (CC BY 3.0) https://thenounproject.com/icon/4945433/ (key `petrified`)

### Circlon Tech

- Love by Circlon Tech from Noun Project (CC BY 3.0) https://thenounproject.com/icon/8214933/ (key `charmed`)

### Doodle Icons

- Flame by Doodle Icons from Noun Project (CC BY 3.0), adapted https://thenounproject.com/icon/3883894/ (sheet button `short-rest`)

### Elena Babushkina

- Deafness by Elena Babushkina from Noun Project (CC BY 3.0) https://thenounproject.com/icon/7430308/ (key `deafened`)

### Eskak

- Candle by Eskak from Noun Project (CC BY 3.0) https://thenounproject.com/icon/8470516/ (key `candle`)
- Crossbow by Eskak from Noun Project (CC BY 3.0) https://thenounproject.com/icon/8168203/ (key `hand-crossbow`)
- hand mirror by Eskak from Noun Project (CC BY 3.0) https://thenounproject.com/icon/8173775/ (key `mirror`)

### Fahrul Oktaviana

- mini sickle by Fahrul Oktaviana from Noun Project (CC BY 3.0) https://thenounproject.com/icon/4952366/ (key `sickle`)

### Fath Yusuf Iskhaqy

- sling by Fath Yusuf Iskhaqy from Noun Project (CC BY 3.0) https://thenounproject.com/icon/6792251/ (key `sling`)

### Gregor Cresnar

- whirlpool by Gregor Cresnar from Noun Project (CC BY 3.0) https://thenounproject.com/icon/3548551/ (spell effect `force`)

### Hey Rabbit

- war club by Hey Rabbit from Noun Project (CC BY 3.0) https://thenounproject.com/icon/3571405/ (key `club`)
- Rifle by Hey Rabbit from Noun Project (CC BY 3.0) https://thenounproject.com/icon/4932468/ (a firearm icon)
- Ring by Hey Rabbit from Noun Project (CC BY 3.0) https://thenounproject.com/icon/4151845/ (key `ring`)

### Icon Designer

- dynamite by Icon Designer from Noun Project (CC BY 3.0) https://thenounproject.com/icon/8102696/ (key `dynamite`)

### Kalaakarini

- fishing net by Kalaakarini from Noun Project (CC BY 3.0) https://thenounproject.com/icon/6374838/ (key `net`)

### kenzi mebius

- revolver by kenzi mebius from Noun Project (CC BY 3.0) https://thenounproject.com/icon/7897846/ (key `revolver`)

### Lucid Formation

- Sound Wave by Lucid Formation from Noun Project (CC BY 3.0) https://thenounproject.com/icon/209688/ (spell effect `thunder`)

### Maan Icons

- dart by Maan Icons from Noun Project (CC BY 3.0) https://thenounproject.com/icon/8364772/ (key `dart`)

### N.Style

- Mehndi by N.Style from Noun Project (CC BY 3.0) https://thenounproject.com/icon/2554803/ (key `tattoo`)

### Natalia

- Club by Natalia from Noun Project (CC BY 3.0) https://thenounproject.com/icon/2763751/ (key `greatclub`)

### Nurfajri Aldi

- Lightning by Nurfajri Aldi from Noun Project (CC BY 3.0) https://thenounproject.com/icon/8153141/ (spell effect `lightning`)

### Olifernes Tejeros

- War Hammer by Olifernes Tejeros from Noun Project (CC BY 3.0) https://thenounproject.com/icon/5860783/ (key `warhammer`)

### Rikas Dzihab

- Poison by Rikas Dzihab from Noun Project (CC BY 3.0) https://thenounproject.com/icon/8350403/ (spell effect `poison`)

### Shayan Lee

- Spear by Shayan Lee from Noun Project (CC BY 3.0) https://thenounproject.com/icon/7759022/ (key `glaive`)
- Halberd by Shayan Lee from Noun Project (CC BY 3.0) https://thenounproject.com/icon/7759029/ (key `halberd`)

### Symbolon

- Machine Gun by Symbolon from Noun Project (CC BY 3.0) https://thenounproject.com/icon/648131/ (a firearm icon)

### Teewara soontorn

- Arrest by Teewara soontorn from Noun Project (CC BY 3.0) https://thenounproject.com/icon/4019984/ (key `restrained`)

### Yosua Bungaran

- Flame by Yosua Bungaran from Noun Project (CC BY 3.0) https://thenounproject.com/icon/8388501/ (spell effect `fire`)

### yus

- acid by yus from Noun Project (CC BY 3.0) https://thenounproject.com/icon/8133995/ (spell effect `acid`)

### Zpoliariumz Zydanez

- fukiya by Zpoliariumz Zydanez from Noun Project (CC BY 3.0) https://thenounproject.com/icon/8423697/ (key `blowgun`)

### Dice

The resource controls draw die faces (d4, d6, d8, d10, d12, d20) as CSS masks in styles.css,
from the "Polyhedral Dice" set by Lonnie Tapscott
(https://thenounproject.com/creator/lonniusmax/) via Noun Project, licensed under CC BY 3.0:

- **d4** → [icon 2453696](https://thenounproject.com/icon/2453696/) (Lonnie Tapscott, CC-BY 3.0)
- **d6** → [icon 2453695](https://thenounproject.com/icon/2453695/) (Lonnie Tapscott, CC-BY 3.0)
- **d8** → [icon 2453699](https://thenounproject.com/icon/2453699/) (Lonnie Tapscott, CC-BY 3.0)
- **d10** → [icon 2453698](https://thenounproject.com/icon/2453698/) (Lonnie Tapscott, CC-BY 3.0)
- **d12** → [icon 2453697](https://thenounproject.com/icon/2453697/) (Lonnie Tapscott, CC-BY 3.0)
- **d20** → [icon 2453700](https://thenounproject.com/icon/2453700/) (Lonnie Tapscott, CC-BY 3.0)

The banked-roll faces (d4, d6, d8, d10, d12, d20) come from the "Role Playing Game UI - RPG DnD
MTG" set by Michelle Lukezic (https://thenounproject.com/creator/michellelukezic/) via Noun
Project, licensed under CC BY 3.0: d4 https://thenounproject.com/icon/d4-dice-5336702/, d6
https://thenounproject.com/icon/d6-dice-5336704/, d8
https://thenounproject.com/icon/d8-dice-5336699/, d10
https://thenounproject.com/icon/d10-dice-5336703/, d12
https://thenounproject.com/icon/d12-dice-5336706/, d20
https://thenounproject.com/icon/d20-dice-5336700/.
