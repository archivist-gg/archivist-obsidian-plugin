declare module '@3d-dice/dice-box' {
  interface DiceBoxConfig {
    container: string;
    assetPath: string;
    origin?: string;
    gravity?: number;
    mass?: number;
    friction?: number;
    restitution?: number;
    linearDamping?: number;
    angularDamping?: number;
    spinForce?: number;
    throwForce?: number;
    startingHeight?: number;
    settleTimeout?: number;
    delay?: number;
    lightIntensity?: number;
    ambientLightIntensity?: number;
    shadowTransparency?: number;
    theme?: string;
    themeColor?: string;
    scale?: number;
    sounds?: { enabled: boolean; volume: number };
    enableShadows?: boolean;
    [key: string]: any;
  }

  interface RollResult {
    value: number;
    sides: number;
    qty?: number;
    [key: string]: any;
  }

  class DiceBox {
    config: DiceBoxConfig;
    onRollComplete: ((results: RollResult[]) => void) | null;
    constructor(config: DiceBoxConfig);
    init(): Promise<void>;
    roll(notation: string): Promise<RollResult[]>;
    clear(): Promise<void>;
    getRollResults?(): RollResult[];
  }

  export default DiceBox;
}
