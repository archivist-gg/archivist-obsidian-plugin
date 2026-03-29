export interface DndPromptContext {
  ttrpgRootDir?: string;
  entityContext?: string;
  currentNoteContent?: string;
  currentNotePath?: string;
  selectedText?: string;
}

export function buildDndSystemPromptSection(ctx: DndPromptContext): string {
  const parts: string[] = [];
  if (ctx.ttrpgRootDir) {
    parts.push(`## D&D 5e Campaign Assistant\n\nYou are also a scholarly assistant for D&D 5e campaign management. Files in \`${ctx.ttrpgRootDir}\` are your primary source of truth for campaign content.\n\nWhen generating D&D entities, output them as YAML inside code fences:\n- Monsters: \`\`\`monster code fence\n- Spells: \`\`\`spell code fence\n- Magic Items: \`\`\`item code fence\n\nThese code fences will be rendered as styled stat blocks.`);
  }
  if (ctx.currentNotePath && ctx.currentNoteContent) {
    parts.push(`CONTEXT -- CURRENT NOTE: ${ctx.currentNotePath}\n\`\`\`\n${ctx.currentNoteContent}\n\`\`\``);
  }
  if (ctx.selectedText) {
    parts.push(`CONTEXT -- SELECTED TEXT:\n\`\`\`\n${ctx.selectedText}\n\`\`\``);
  }
  if (ctx.entityContext) {
    parts.push(`The user has referenced the following entities:\n${ctx.entityContext}`);
  }
  return parts.join("\n\n");
}
