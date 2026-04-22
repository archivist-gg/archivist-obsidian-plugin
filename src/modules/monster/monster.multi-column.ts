/**
 * Multi-column layout helpers for monster stat blocks.
 */

export function applyColumnLayout(wrapper: HTMLElement, block: HTMLElement, twoCol: boolean): void {
  if (twoCol) {
    wrapper.addClass("two-col");
    block.addClass("two-col-flow");
  } else {
    wrapper.removeClass("two-col");
    block.removeClass("two-col-flow");
  }
}

export function shouldAutoTwoColumn(blockEl: HTMLElement, threshold: number): boolean {
  const features = blockEl.querySelectorAll(".archivist-feature, .archivist-feat-card");
  return features.length >= threshold;
}
