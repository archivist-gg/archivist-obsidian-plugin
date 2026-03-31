import DiceBox from '@3d-dice/dice-box';

/**
 * Singleton wrapper around @3d-dice/dice-box for 3D physics-based dice rolling.
 * Adapted from the Archivist web app's simpleDiceBox.ts for the Obsidian plugin context.
 */
export class SimpleDiceBox {
  private static instance: SimpleDiceBox;
  private diceBox: DiceBox | null = null;
  private isReady = false;
  private readyCallbacks: Array<() => void> = [];

  static getInstance(): SimpleDiceBox {
    if (!SimpleDiceBox.instance) {
      SimpleDiceBox.instance = new SimpleDiceBox();
    }
    return SimpleDiceBox.instance;
  }

  async initialize(containerId: string, assetPath: string): Promise<void> {
    if (this.isReady) return;

    // Wait a bit for the container to be ready in the DOM
    await new Promise((resolve) => setTimeout(resolve, 100));

    const container = document.querySelector(containerId);
    if (!container) {
      throw new Error(`Container not found: ${containerId}`);
    }

    this.diceBox = new DiceBox({
      container: containerId,
      assetPath,
      origin: '', // Override origin for Electron/Obsidian -- assetPath is already a full file:// URL
      gravity: 3,
      mass: 2.5,
      friction: 0.8,
      restitution: 0.2,
      linearDamping: 0.5,
      angularDamping: 0.4,
      spinForce: 4,
      throwForce: 5,
      startingHeight: 8,
      settleTimeout: 5000,
      delay: 10,
      lightIntensity: 1.2,
      ambientLightIntensity: 0.5,
      shadowTransparency: 0.8,
      theme: 'default',
      themeColor: '#1a1a1a',
      scale: 6,
      sounds: { enabled: false, volume: 0 },
      enableShadows: true,
    });

    await this.diceBox.init();
    this.isReady = true;

    // Resolve any callers that were waiting for initialization
    this.readyCallbacks.forEach((cb) => cb());
    this.readyCallbacks = [];
  }

  async roll(notation: string): Promise<void> {
    if (!this.isReady || !this.diceBox) {
      await this.waitForReady();
    }
    if (this.diceBox) {
      await this.diceBox.clear();
      await this.diceBox.roll(notation);
    }
  }

  onRollComplete(callback: (result: any) => void): void {
    if (this.diceBox) {
      this.diceBox.onRollComplete = callback;
    }
  }

  private waitForReady(): Promise<void> {
    if (this.isReady) return Promise.resolve();
    return new Promise((resolve) => {
      this.readyCallbacks.push(resolve);
    });
  }
}

export const simpleDiceBox = SimpleDiceBox.getInstance();
