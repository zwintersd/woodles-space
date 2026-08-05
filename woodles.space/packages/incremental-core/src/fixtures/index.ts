import { parseGameDef } from '../serialize.js';
import type { GameDef } from '../types.js';
import cozyGardenJson from './cozy-garden.json' with { type: 'json' };
import apiaryOfBadDecisionsJson from './apiary-of-bad-decisions.json' with { type: 'json' };

/**
 * The garden from the mockup, as a real project file rather than a TypeScript
 * literal. It goes through `parseGameDef` for the same reason a user's import
 * does: if the fixture ever stops being a valid def, every test that leans on
 * it should fail loudly at load, not quietly produce different numbers.
 */
export const cozyGarden: GameDef = parseGameDef(cozyGardenJson).def;

/**
 * A stress-test def, not a mockup: a Hive whose output leans on
 * `Generator.populationBoost` and a milestone pair that reads
 * `{ metric: 'unequippedUpgrades' }` — the two pieces `Curve` and `Condition`
 * grew to let "buy it, don't equip it" be a real strategy rather than a typo.
 */
export const apiaryOfBadDecisions: GameDef = parseGameDef(apiaryOfBadDecisionsJson).def;

export { cozyGardenJson, apiaryOfBadDecisionsJson };
