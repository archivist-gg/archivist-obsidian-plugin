export interface ExpandState {
  is(key: string): boolean;
  toggle(key: string): void;
  keys(): string[];
}

export function createExpandState(initial: string[] = []): ExpandState {
  const set = new Set<string>(initial);
  return {
    is: (k) => set.has(k),
    toggle: (k) => { if (set.has(k)) set.delete(k); else set.add(k); },
    keys: () => [...set],
  };
}
