/**
 * D&D-content settings for the Archivist plugin.
 */
export interface ArchivistSettings {
  compendiumRoot: string;
  srdImported: boolean;
  defaultMultiColumn: boolean;
  multiColumnThreshold: number;
  playerCharactersFolder: string;
  /** Vault folder the portrait picker shows and imports into. Empty = `<playerCharactersFolder>/Portraits`. */
  portraitsFolder: string;
  /** Compendium NAMES hidden from pickers and the {{...}} suggest (a per-vault
   *  view preference; resolution of already-referenced entities is never
   *  filtered). Writers must REASSIGN a fresh array, never mutate in place:
   *  when the saved key is absent, loadSettings' Object.assign aliases this
   *  field to DEFAULT_SETTINGS' own array. */
  hiddenCompendiums: string[];
}

export const DEFAULT_SETTINGS: ArchivistSettings = {
  compendiumRoot: "Compendium",
  srdImported: false,
  defaultMultiColumn: false,
  multiColumnThreshold: 20,
  playerCharactersFolder: "PlayerCharacters",
  portraitsFolder: "",
  hiddenCompendiums: ["SRD 5e"],
};
