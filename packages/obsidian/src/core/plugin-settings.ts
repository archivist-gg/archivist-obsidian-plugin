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
}

export const DEFAULT_SETTINGS: ArchivistSettings = {
  compendiumRoot: "Compendium",
  srdImported: false,
  defaultMultiColumn: false,
  multiColumnThreshold: 20,
  playerCharactersFolder: "PlayerCharacters",
  portraitsFolder: "",
};
