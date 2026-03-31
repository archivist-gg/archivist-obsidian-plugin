import { setIcon } from 'obsidian';
import { rollDice, formatDiceRoll, DiceRoll } from './diceRoller';

export class DiceOverlay {
  private overlayEl: HTMLElement | null = null;
  private resultEl: HTMLElement | null = null;
  private canvasEl: HTMLElement | null = null;
  private hideTimeout: ReturnType<typeof setTimeout> | null = null;
  private escHandler: ((e: KeyboardEvent) => void) | null = null;

  show(): void {
    if (this.overlayEl) return;

    this.overlayEl = document.body.createDiv({ cls: 'archivist-dice-overlay' });
    this.canvasEl = this.overlayEl.createDiv({ cls: 'archivist-dice-canvas', attr: { id: 'archivist-dice-box' } });
    this.resultEl = this.overlayEl.createDiv({ cls: 'archivist-dice-result' });

    this.overlayEl.addEventListener('click', (e) => {
      if (e.target === this.overlayEl) this.hide();
    });

    this.escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') this.hide();
    };
    document.addEventListener('keydown', this.escHandler);
  }

  hide(): void {
    if (this.hideTimeout) clearTimeout(this.hideTimeout);
    if (this.escHandler) document.removeEventListener('keydown', this.escHandler);
    this.escHandler = null;
    if (this.overlayEl) {
      this.overlayEl.remove();
      this.overlayEl = null;
      this.resultEl = null;
      this.canvasEl = null;
    }
  }

  showResult(roll: DiceRoll): void {
    if (!this.resultEl) return;
    this.resultEl.empty();

    this.resultEl.createDiv({ cls: 'archivist-dice-result-notation', text: roll.notation });
    this.resultEl.createDiv({ cls: 'archivist-dice-result-details', text: roll.details });
    this.resultEl.createDiv({ cls: 'archivist-dice-result-total', text: String(roll.total) });

    this.resultEl.addClass('visible');

    if (this.hideTimeout) clearTimeout(this.hideTimeout);
    this.hideTimeout = setTimeout(() => this.hide(), 2500);
  }

  rollMath(notation: string): DiceRoll | null {
    this.show();
    const result = rollDice(notation);
    if (result.success && result.roll) {
      this.showResult(result.roll);
      return result.roll;
    }
    this.hide();
    return null;
  }

  getCanvasId(): string {
    return 'archivist-dice-box';
  }

  isVisible(): boolean {
    return this.overlayEl !== null;
  }
}
