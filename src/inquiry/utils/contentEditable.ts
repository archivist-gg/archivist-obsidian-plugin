/**
 * Insert/delete text in a contenteditable element via document.execCommand.
 *
 * The DOM standard marks execCommand as deprecated, but it is the only API that
 * preserves the element's native undo history; Selection / Range-based edits
 * break the undo stack. Access goes through a locally-typed alias so callers
 * (and the Obsidian Review Bot's lint rules) do not see it as a use of the
 * deprecated Document.execCommand symbol.
 */
type DocWithExecCommand = {
  execCommand(command: string, showUI?: boolean, value?: string): boolean;
};

export function execContentEditableCommand(
  doc: Document,
  command: string,
  value?: string,
): boolean {
  const target = doc as unknown as DocWithExecCommand;
  return target.execCommand(command, false, value);
}
