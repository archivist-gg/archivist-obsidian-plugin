/**
 * Archivist D&D settings.
 *
 * Chat/inquiry settings are owned by InquiryModule (ClaudianSettings)
 * and surfaced through its own settings tab.
 */
export interface ArchivistSettings {
  compendiumRoot: string;
  userEntityFolder: string;
  srdImported: boolean;
  ttrpgRootDir: string;
  externalContextPaths: string[];
  defaultMultiColumn: boolean;
  multiColumnThreshold: number;
}

export const DEFAULT_SETTINGS: ArchivistSettings = {
  compendiumRoot: "Compendium",
  userEntityFolder: "me",
  srdImported: false,
  ttrpgRootDir: "/",
  externalContextPaths: [],
  defaultMultiColumn: false,
  multiColumnThreshold: 20,
};
