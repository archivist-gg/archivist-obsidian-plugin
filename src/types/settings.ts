export interface ArchivistSettings {
  ttrpgRootDir: string;
  permissionMode: "auto" | "safe";
  defaultModel: string;
  thinkingBudget: string;
  maxConversations: number;
  externalContextPaths: string[];
  compendiumRoot: string;
  userEntityFolder: string;
  srdImported: boolean;
}

export const DEFAULT_SETTINGS: ArchivistSettings = {
  ttrpgRootDir: "/",
  permissionMode: "safe",
  defaultModel: "claude-sonnet-4-6",
  thinkingBudget: "medium",
  maxConversations: 50,
  externalContextPaths: [],
  compendiumRoot: "Compendium",
  userEntityFolder: "me",
  srdImported: false,
};
