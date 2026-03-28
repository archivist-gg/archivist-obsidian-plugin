export interface Item {
  name: string;
  type?: string;
  rarity?: string;
  attunement?: boolean | string;
  weight?: number;
  value?: number;
  damage?: string;
  damage_type?: string;
  properties?: string[];
  charges?: number;
  recharge?: string;
  curse?: boolean;
  entries?: string[];
}
