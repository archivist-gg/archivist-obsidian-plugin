export function updateContextRowHasContent(contextRowEl: HTMLElement): void {
  const editorIndicator = contextRowEl.querySelector<HTMLElement>('.claudian-selection-indicator');
  const browserIndicator = contextRowEl.querySelector<HTMLElement>('.claudian-browser-selection-indicator');
  const canvasIndicator = contextRowEl.querySelector<HTMLElement>('.claudian-canvas-indicator');
  const fileIndicator = contextRowEl.querySelector<HTMLElement>('.claudian-file-indicator');
  const imagePreview = contextRowEl.querySelector<HTMLElement>('.claudian-image-preview');

  const isVisible = (el: HTMLElement | null): boolean =>
    el !== null && !el.classList.contains('archivist-hidden');

  const hasEditorSelection = isVisible(editorIndicator);
  const hasBrowserSelection = isVisible(browserIndicator);
  const hasCanvasSelection = isVisible(canvasIndicator);
  const hasFileChips = isVisible(fileIndicator);
  const hasImageChips = isVisible(imagePreview);

  contextRowEl.classList.toggle(
    'has-content',
    hasEditorSelection || hasBrowserSelection || hasCanvasSelection || hasFileChips || hasImageChips
  );
}
