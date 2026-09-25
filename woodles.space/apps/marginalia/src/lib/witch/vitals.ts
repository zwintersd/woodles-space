// Vital signs now live in @woodles/witch-engine, fully parameterized — see
// that package's vitals.ts. Re-exported here so the rest of this app's
// imports from './vitals' keep working unchanged, plus one convenience
// wrapper: `neutralStocks()` used to default to World 1's own start value,
// and several call sites (book.svelte.ts, cheats.ts, persist.ts) still call
// it with no argument.

export {
	type StockId,
	type Stocks,
	type StockVector,
	type Needs,
	STOCK_IDS,
	leakRate,
	bandHealth,
	severityFor,
	nextVitality,
	type VitalityRates,
	lifeStockRate,
	driftRate,
	focusStock,
	stabilityOf
} from '@woodles/witch-engine';

import { neutralStocks as engineNeutralStocks, type Stocks } from '@woodles/witch-engine';
import { world1Def } from './def';

export function neutralStocks(): Stocks {
	return engineNeutralStocks(world1Def.stock.start);
}
