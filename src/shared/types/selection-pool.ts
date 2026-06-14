/** A (sub)class-declared selectable pool (e.g. Interdict Boons). The engine is
 *  generic: every game-specific string lives here in data, never in code. */
export interface SelectionPool {
  id: string;
  label: string;
  source: {
    entity_type: "optional-feature";
    where: { feature_type: string; available_to: "self" };
  };
  /** Pick count read from the owning class table column at the current level. */
  count: { column: string };
  replaceable?: boolean;
}

/** Subclass auto-grants that extend a named pool and do NOT count toward picks. */
export interface PoolGrant {
  pool: string;
  grants: Array<{ feature: string; at_level: number }>;
}

/** A data-declared tab that renders a pool (one generic pool-tab per declaration). */
export interface TabDecl {
  id: string;
  label: string;
  renders: { pool: string };
}
