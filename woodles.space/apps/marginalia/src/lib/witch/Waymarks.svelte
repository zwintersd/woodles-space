<script lang="ts">
	// "the chart" — a player-authored spawn point ("waymark"), in full: where,
	// what layer/category, what surface it favors, how strongly, how rare.
	// A fourth spawn-point source alongside DEFAULT_WATER_SPAWNS/sediment/
	// features — generateSpawnPoints() and spawnWeightForLife() already read
	// any SpawnPoint generically, so nothing there needed to change.
	import { book, fmt } from './book.svelte';
	import { CUSTOM_SPAWN_TAGS, MAX_CUSTOM_SPAWN_POINTS, type SpawnLayer } from './worldShape';
	import type { LifeCategory } from './content/life';

	const CATEGORY_OPTIONS: { id: LifeCategory; label: string }[] = [
		{ id: 'aquatic', label: 'in the water' },
		{ id: 'terrestrial', label: 'on the land' },
		{ id: 'atmospheric', label: 'in the sky' }
	];

	const LAYER_OPTIONS: Record<LifeCategory, { id: SpawnLayer; label: string }[]> = {
		aquatic: [
			{ id: 'water', label: 'open water' },
			{ id: 'floor', label: 'the floor' }
		],
		terrestrial: [{ id: 'shore', label: 'the shore' }],
		atmospheric: [{ id: 'air', label: 'the sky' }]
	};

	const TAG_HINTS: Record<(typeof CUSTOM_SPAWN_TAGS)[number], string> = {
		mineral: 'draws geology-leaning life',
		nutrient: 'draws plant and ecosystem life',
		shelter: 'draws animal life',
		bottom: 'draws geology and ecosystem life, from the deep',
		perch: 'draws animal life looking for a rest'
	};

	let category = $state<LifeCategory>('aquatic');
	let layer = $state<SpawnLayer>('water');
	let x = $state(0.5);
	let y = $state(0.5);
	let weight = $state(1);
	let rarity = $state<'common' | 'uncommon' | 'rare'>('common');
	let tags = $state<string[]>([]);

	function onCategoryChange(next: LifeCategory) {
		category = next;
		layer = LAYER_OPTIONS[next][0].id;
	}

	function toggleTag(tag: string) {
		tags = tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag];
	}

	const cost = $derived(book.customSpawnPointCostFor(weight, rarity));
	const capReached = $derived(book.worldShape.customSpawnPoints.length >= MAX_CUSTOM_SPAWN_POINTS);
	const locked = $derived(!book.canPlaceCustomSpawnPoint(layer));
	const canAfford = $derived(book.insight >= cost);

	function reasonLine(): string {
		if (capReached) return `the chart is full — ${MAX_CUSTOM_SPAWN_POINTS} marks is all it holds.`;
		if (locked) return 'the shallows need to open before she can mark the shore or sky.';
		if (!canAfford) return `not enough insight — needs ${fmt(cost)}.`;
		return '';
	}

	function place() {
		book.placeCustomSpawnPoint({ x, y, category, layer, tags, weight, rarity });
	}

	function summarize(mark: { layer: SpawnLayer; rarity: string; tags: string[] }): string {
		const parts = [mark.layer, mark.rarity, ...mark.tags];
		return parts.join(' · ');
	}
</script>

<section class="waymarks-panel">
	<div class="waymarks-head">
		<div>
			<span class="waymarks-kicker">the chart</span>
			<h3>waymarks</h3>
		</div>
		<span class="waymarks-count">{book.worldShape.customSpawnPoints.length}/{MAX_CUSTOM_SPAWN_POINTS}</span>
	</div>
	<p class="waymarks-sub">
		not everything has to arrive on its own. she can mark a place, and say what she hopes finds
		it — though nothing is promised.
	</p>

	<div class="waymarks-form">
		<label class="field">
			<span>where it belongs</span>
			<select value={category} onchange={(e) => onCategoryChange(e.currentTarget.value as LifeCategory)}>
				{#each CATEGORY_OPTIONS as opt (opt.id)}
					<option value={opt.id}>{opt.label}</option>
				{/each}
			</select>
		</label>

		<label class="field">
			<span>layer</span>
			<select bind:value={layer}>
				{#each LAYER_OPTIONS[category] as opt (opt.id)}
					<option value={opt.id}>{opt.label}</option>
				{/each}
			</select>
		</label>

		<label class="field">
			<span>position — left to right ({Math.round(x * 100)}%)</span>
			<input type="range" min="0" max="1" step="0.01" bind:value={x} />
		</label>

		<label class="field">
			<span>position — high to low ({Math.round(y * 100)}%)</span>
			<input type="range" min="0" max="1" step="0.01" bind:value={y} />
		</label>

		<label class="field">
			<span>how strongly it calls ({weight.toFixed(2)}×)</span>
			<input type="range" min="0.3" max="2" step="0.05" bind:value={weight} />
		</label>

		<label class="field">
			<span>rarity</span>
			<select bind:value={rarity}>
				<option value="common">common</option>
				<option value="uncommon">uncommon</option>
				<option value="rare">rare — draws strange life, and repels ordinary life</option>
			</select>
		</label>

		<div class="field">
			<span>surface</span>
			<div class="tag-grid">
				{#each CUSTOM_SPAWN_TAGS as tag (tag)}
					<label class="tag-check">
						<input type="checkbox" checked={tags.includes(tag)} onchange={() => toggleTag(tag)} />
						<span class="tag-name">{tag}</span>
						<span class="tag-hint">{TAG_HINTS[tag]}</span>
					</label>
				{/each}
			</div>
		</div>

		<div class="waymarks-action">
			<button class="mark-btn" disabled={capReached || locked || !canAfford} onclick={place}>
				mark it · {fmt(cost)} insight
			</button>
			{#if reasonLine()}
				<span class="reason">{reasonLine()}</span>
			{/if}
		</div>
	</div>

	{#if book.worldShape.customSpawnPoints.length > 0}
		<ul class="waymarks-list">
			{#each book.worldShape.customSpawnPoints as mark (mark.id)}
				<li>
					<span class="mark-summary">{summarize(mark)}</span>
					<button class="clear-btn" onclick={() => book.removeCustomSpawnPoint(mark.id)}>
						clear this mark
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.waymarks-panel {
		border: 1px solid rgba(95, 122, 82, 0.24);
		border-radius: 4px;
		background:
			linear-gradient(180deg, rgba(95, 122, 82, 0.05), rgba(52, 40, 29, 0.24)),
			var(--panel);
		padding: 0.75rem 0.85rem;
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}
	.waymarks-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}
	.waymarks-kicker {
		display: block;
		font-family: var(--font-ui);
		font-size: 0.64rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--cyan);
	}
	.waymarks-head h3 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 1.2rem;
		color: var(--cream);
		margin: 0.05rem 0 0;
	}
	.waymarks-count {
		font-family: var(--font-counter);
		font-size: 0.9rem;
		color: var(--muted);
		white-space: nowrap;
	}
	.waymarks-sub {
		font-family: var(--font-body);
		font-style: italic;
		font-size: 0.84rem;
		color: var(--muted);
		margin: 0;
	}
	.waymarks-form {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.6rem 0.9rem;
		border-top: 1px solid var(--rule);
		padding-top: 0.6rem;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.field > span:first-child {
		font-family: var(--font-ui);
		font-size: 0.64rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--periwinkle);
	}
	.field select,
	.field input[type='range'] {
		width: 100%;
	}
	.field select {
		font-family: var(--font-ui);
		font-size: 0.8rem;
		color: var(--cream);
		background: var(--bg);
		border: 1px solid var(--rule);
		border-radius: 3px;
		padding: 0.3rem 0.4rem;
	}
	.tag-grid {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}
	.tag-check {
		display: grid;
		grid-template-columns: auto auto 1fr;
		align-items: baseline;
		gap: 0.4rem;
	}
	.tag-name {
		font-family: var(--font-ui);
		font-size: 0.76rem;
		color: var(--cream);
		text-transform: capitalize;
	}
	.tag-hint {
		font-family: var(--font-body);
		font-style: italic;
		font-size: 0.7rem;
		color: var(--muted);
	}
	.waymarks-action {
		grid-column: 1 / -1;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.3rem;
		margin-top: 0.2rem;
	}
	.mark-btn {
		font-family: var(--font-ui);
		font-size: 0.74rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--cream);
		border: 1px solid var(--leafeon-pink);
		border-radius: 3px;
		padding: 0.35rem 0.6rem;
		background: var(--panel-accent);
		transition: color 120ms, box-shadow 120ms, transform 80ms;
	}
	.mark-btn:hover:not(:disabled) {
		color: var(--leafeon-pink);
		box-shadow: 0 0 8px rgba(184, 80, 108, 0.25);
	}
	.mark-btn:active:not(:disabled) {
		transform: scale(0.96);
	}
	.mark-btn:disabled {
		opacity: 0.45;
		border-color: var(--rule);
	}
	.reason {
		font-family: var(--font-ui);
		font-size: 0.68rem;
		font-style: italic;
		color: var(--muted);
	}
	.waymarks-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		border-top: 1px solid var(--rule);
	}
	.waymarks-list li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
		padding: 0.45rem 0;
		border-bottom: 1px solid var(--rule);
	}
	.mark-summary {
		font-family: var(--font-ui);
		font-size: 0.76rem;
		color: var(--muted);
		text-transform: capitalize;
	}
	.clear-btn {
		font-family: var(--font-ui);
		font-size: 0.66rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--muted);
		border: 1px solid var(--rule);
		border-radius: 3px;
		padding: 0.22rem 0.45rem;
		white-space: nowrap;
	}
	.clear-btn:hover {
		border-color: var(--print-pink);
		color: var(--print-pink);
	}
	@media (max-width: 680px) {
		.waymarks-form {
			grid-template-columns: 1fr;
		}
	}
</style>
