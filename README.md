# Archivist

A fifth edition toolkit for [Obsidian](https://obsidian.md), for both the 2014 and 2024 rules: parchment stat blocks written as YAML code blocks, inline dice tags that roll on click, the full System Reference Document as a compendium in your vault, your own homebrew compendiums, and player-character sheets with a character builder.

## Features

- **Stat blocks** for monsters, spells, items, weapons, armor, classes, subclasses, species, backgrounds, feats and conditions, written as YAML code blocks in any note or pulled in by reference. They look the same under any Obsidian theme.
- **Dice and formula tags** inside your notes that roll when you click them.
- **The SRD, in your vault.** The System Reference Document 5.1 and 5.2 install as two read-only compendiums (every SRD spell, monster, item, class and species), kept up to date by the plugin.
- **Homebrew compendiums.** Your own monsters, spells, items and classes, in the same format, next to the SRD.
- **Character sheets.** A builder for new characters, then a sheet that works out every number from the rules: attacks, spells, saves, skills, resources and rests, an inventory with containers, and items whose benefits follow equip and attune.

## Install with BRAT

1. In Obsidian, open **Settings → Community plugins**, turn on community plugins if asked, then browse for **BRAT** (Obsidian42 BRAT), install it and enable it.
2. Open BRAT's settings and choose **Add beta plugin**.
3. Enter `archivist-gg/archivist-obsidian-plugin` and confirm.
4. Enable **Archivist** under **Settings → Community plugins**.

BRAT checks this repository for new releases and keeps Archivist up to date.

### Manual install

Download `main.js`, `manifest.json` and `styles.css` from the [latest release](https://github.com/archivist-gg/archivist-obsidian-plugin/releases/latest), put them in a folder named `archivist-gg` inside your vault's `.obsidian/plugins` folder, restart Obsidian and enable Archivist.

Archivist needs Obsidian 1.7.2 or later, on desktop.

## Licence

From version 0.10.0 on, Archivist is free closed-source software: free to download and use, but you may not modify, sell or redistribute it. See [LICENSE](LICENSE). The source code is not public.

Versions up to 0.9.0 were released under the GNU Affero General Public License, version 3, and stay under it.

## Credits

- **System Reference Document.** This work includes material taken from the System Reference Document 5.1 ("SRD 5.1") by Wizards of the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode. This work includes material from the System Reference Document 5.2 ("SRD 5.2") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode. How the material was changed is in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
- **Icons** by Noun Project creators, under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/): see [CREDITS.md](CREDITS.md).
- **Fonts:** Libre Baskerville and Noto Sans, under the SIL Open Font License 1.1.
- **Libraries:** js-yaml and zod (MIT), monkey-around (ISC).

Every notice is in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

Archivist is unofficial. It is not affiliated with or endorsed by Wizards of the Coast.

## Feedback

Bug reports and ideas are welcome in this repository's [Issues](https://github.com/archivist-gg/archivist-obsidian-plugin/issues).
