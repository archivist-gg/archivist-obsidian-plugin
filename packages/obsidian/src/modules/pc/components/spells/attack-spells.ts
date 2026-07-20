/**
 * Curated set of SRD spells whose to-hit is resolved with a SPELL ATTACK ROLL
 * (ranged or melee), keyed by edition-agnostic BASE slug (no `srd-2024_` /
 * `srd-5e_` source prefix; strip it with bareEntitySlug before lookup). The cast
 * view renders "Atk +N" for these instead of a save DC. A spell that is neither
 * in this set nor has a saving throw (e.g. Magic Missile's auto-hit) shows no
 * to-hit at all.
 *
 * Edition note: this targets the SRD 2024 rules. A few spells that used a spell
 * attack in 2014 became saves in 2024 and are deliberately EXCLUDED below.
 */
export const ATTACK_ROLL_SPELLS: Set<string> = new Set([
  // Cantrips (ranged or melee spell attack)
  "fire-bolt",
  "eldritch-blast",
  "ray-of-frost",
  "chill-touch",
  "produce-flame",
  "shocking-grasp",
  "thorn-whip",
  // poison-spray: a CON save in 2024 (was an attack in 2014), EXCLUDED
  // acid-splash: a DEX save, EXCLUDED

  // Leveled spells (ranged or melee spell attack)
  "ray-of-sickness",
  "scorching-ray",
  "guiding-bolt",
  "chromatic-orb",
  "ray-of-enfeeblement",
  "witch-bolt",
  "inflict-wounds", // a melee spell attack in 2024 (was a save in 2014), INCLUDED
  // disintegrate: a DEX save, EXCLUDED

  // NOT in this set (documented invariants): magic-missile (auto-hit, no roll),
  // fireball (a DEX save).
]);
