import { describe, expect, it } from 'vitest';
import { connectionIntent, deriveEdges, deriveNodes, FALLBACK_POSITION } from './graph.js';
import { cozyGarden } from './fixtures/index.js';
import { toyDef } from './test-defs.js';

const edgesOf = (kind: string) => deriveEdges(cozyGarden).filter((edge) => edge.kind === kind);

describe('deriving nodes', () => {
	it('produces one node per entity, whatever its kind', () => {
		const nodes = deriveNodes(cozyGarden);
		const expected =
			cozyGarden.currencies.length +
			cozyGarden.generators.length +
			cozyGarden.upgrades.length +
			cozyGarden.prestigeLayers.length +
			cozyGarden.unlocks.length +
			cozyGarden.milestones.length;
		expect(nodes).toHaveLength(expected);
		expect(new Set(nodes.map((node) => node.id)).size).toBe(expected);
	});

	it('falls back to a visible position rather than stacking at the origin', () => {
		const def = toyDef(); // no layout entries at all
		expect(deriveNodes(def).every((node) => node.position === FALLBACK_POSITION)).toBe(true);
	});
});

describe('deriving edges', () => {
	it('draws a production edge from each generator to what it makes', () => {
		expect(edgesOf('production').map((edge) => `${edge.source}->${edge.target}`)).toEqual([
			'petal-farm->soft-petals',
			'cloud-nursery->soft-petals'
		]);
	});

	it('draws a modifier edge from an upgrade to what it touches', () => {
		const modifiers = edgesOf('modifier').map((edge) => `${edge.source}->${edge.target}`);
		expect(modifiers).toContain('green-thumb->petal-farm');
		expect(modifiers).toContain('bloom-boost->soft-petals');
		expect(modifiers).toContain('golden-touch->petal-farm');
	});

	it('draws nothing for a global effect, leaving the node to say so', () => {
		// Eternal Garden boosts everything; an edge to every node is a hairball
		// that says less than the badge already on the card.
		expect(edgesOf('modifier').some((edge) => edge.source === 'eternal-garden')).toBe(false);
	});

	it('draws one edge per target even when several effects share it', () => {
		const def = toyDef();
		def.upgrades[0].effects = [
			{ target: { type: 'generator', id: 'a' }, stat: 'rate', op: 'mul', value: 2 },
			{ target: { type: 'generator', id: 'a' }, stat: 'costScale', op: 'mul', value: 0.9 }
		];
		expect(deriveEdges(def).filter((edge) => edge.kind === 'modifier')).toHaveLength(1);
	});

	it('draws requirement edges for what gates what', () => {
		const requirements = edgesOf('requirement').map((edge) => `${edge.source}->${edge.target}`);
		// The mockup's "Eternal Garden requires Golden Touch 10".
		expect(requirements).toContain('golden-touch->eternal-garden');
		// An unlock is a node in its own right: things flow into it, and it reveals.
		expect(requirements).toContain('soft-petals->unlock-nursery');
		expect(requirements).toContain('unlock-nursery->cloud-nursery');
	});

	it('draws an award edge from a prestige layer to its currency', () => {
		expect(edgesOf('award').map((edge) => `${edge.source}->${edge.target}`)).toEqual(['rebirth->rebirth-petals']);
	});

	it('skips an edge to something that is not on the canvas', () => {
		// The validator reports the dangling reference; the canvas just doesn't
		// draw a line into empty space.
		const def = toyDef();
		def.generators[0].producesCurrencyId = 'ghost';
		expect(deriveEdges(def).some((edge) => edge.target === 'ghost')).toBe(false);
	});

	it('gives every edge a stable, unique id', () => {
		const edges = deriveEdges(cozyGarden);
		expect(new Set(edges.map((edge) => edge.id)).size).toBe(edges.length);
		expect(deriveEdges(cozyGarden).map((edge) => edge.id)).toEqual(edges.map((edge) => edge.id));
	});
});

describe('what a drag would mean', () => {
	it('reads generator → currency as production', () => {
		const intent = connectionIntent(cozyGarden, 'petal-farm', 'soft-petals');
		expect(intent).toMatchObject({ ok: true, kind: 'produces', currencyId: 'soft-petals' });
	});

	it('reads currency → generator as a price', () => {
		const intent = connectionIntent(cozyGarden, 'soft-petals', 'petal-farm');
		expect(intent).toMatchObject({ ok: true, kind: 'pricedIn', generatorId: 'petal-farm' });
	});

	it('reads upgrade → anything boostable as an effect', () => {
		expect(connectionIntent(cozyGarden, 'green-thumb', 'petal-farm')).toMatchObject({
			ok: true,
			kind: 'effect',
			targetKind: 'generator'
		});
		expect(connectionIntent(cozyGarden, 'green-thumb', 'soft-petals')).toMatchObject({
			ok: true,
			kind: 'effect',
			targetKind: 'currency'
		});
	});

	it('reads unlock → anything as a reveal', () => {
		expect(connectionIntent(cozyGarden, 'unlock-nursery', 'cloud-nursery')).toMatchObject({ ok: true, kind: 'reveals' });
	});

	it('refuses a connection that would mean nothing', () => {
		expect(connectionIntent(cozyGarden, 'petal-farm', 'petal-farm')).toMatchObject({ ok: false });
		expect(connectionIntent(cozyGarden, 'one-million', 'petal-farm')).toMatchObject({ ok: false });
		expect(connectionIntent(cozyGarden, 'ghost', 'petal-farm')).toMatchObject({ ok: false });
	});
});
