import { setIcon } from 'obsidian';
import { rollDice, formatDiceRoll, DiceRoll } from './diceRoller';
import { simpleDiceBox } from './SimpleDiceBox';

export class DiceOverlay {
  private overlayEl: HTMLElement | null = null;
  private resultEl: HTMLElement | null = null;
  private canvasEl: HTMLElement | null = null;
  private hideTimeout: ReturnType<typeof setTimeout> | null = null;
  private escHandler: ((e: KeyboardEvent) => void) | null = null;
  private is3DInitialized = false;
  private is3DInitializing = false;

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

  async initialize3D(assetPath: string): Promise<void> {
    if (this.is3DInitialized || this.is3DInitializing) return;
    this.is3DInitializing = true;
    try {
      this.show();
      await simpleDiceBox.initialize(`#${this.getCanvasId()}`, assetPath);
      simpleDiceBox.onRollComplete((results: any) => {
        const total = results.reduce((sum: number, r: any) => sum + r.value, 0);
        const rolls = results.map((r: any) => r.value);
        const diceGroups = results.map((r: any) => `${r.qty || 1}d${r.sides}`);
        const notation = [...new Set(diceGroups)].join('+');
        this.showResult({
          notation,
          rolls,
          modifier: 0,
          total,
          details: rolls.join(' + ') + ` = ${total}`,
        });
      });
      this.is3DInitialized = true;
      this.hide();
    } catch (err) {
      console.warn('[Archivist] 3D dice init failed, using math fallback:', err);
    } finally {
      this.is3DInitializing = false;
    }
  }

  async roll3D(notation: string): Promise<void> {
    if (!this.is3DInitialized) {
      this.rollMath(notation);
      return;
    }
    this.show();
    try {
      await simpleDiceBox.roll(notation);
      // Result handled by onRollComplete callback
    } catch {
      // Fallback to math on any 3D error
      this.rollMath(notation);
    }
  }
}
