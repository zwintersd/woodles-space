<script lang="ts">
	import { book, fmt } from './book.svelte';

	const favorWord = $derived(
		book.favorBand === 'high' ? 'at ease' : book.favorBand === 'low' ? 'wary' : 'even'
	);

	// the three stocks, for the world's-body readout
	const stockRows = $derived([
		{
			id: 'nutrients',
			label: 'nutrients',
			value: book.stocks.nutrients,
			tint: 'var(--leafeon-pink)',
			hint: 'fertility of soil and water — plants draw it down; decay and decomposers return it.'
		},
		{
			id: 'oxygen',
			label: 'oxygen',
			value: book.stocks.oxygen,
			tint: 'var(--cyan)',
			hint: 'breathable air — plants make it; animals burn it.'
		},
		{
			id: 'moisture',
			label: 'moisture',
			value: book.stocks.moisture,
			tint: 'var(--periwinkle)',
			hint: 'water on the land — weather brings it; land plants drink it.'
		}
	]);

	// Show one decimal for small insight so it visibly ticks every rAF frame.
	function fmtLive(n: number): string {
		if (n < 1000) return n.toFixed(1);
		return fmt(n);
	}
</script>

<div class="ledger">
	<section class="group world">
		<h3>this world</h3>
		<div class="cells">
			<div
				class="cell wide"
				title="the world yields Insight every second it is witnessed. spend it on attention, or distill it into Essence."
			>
				<span class="label">insight</span>
				<span class="value">{fmtLive(book.insight)}</span>
				<span class="rate">+{fmt(book.insightPerSec)}/s</span>
			</div>
			<div
				class="cell"
				title="the world's relationship with her. it eases upward as she comes to Know its life — and it multiplies all Insight, ×{book.favorMult.toFixed(
					2
				)} right now."
			>
				<span class="label">favor</span>
				<span class="value">{Math.round(book.favor)}</span>
				<span class="rate">{favorWord} · ×{book.favorMult.toFixed(2)}</span>
			</div>
			<div
				class="cell"
				title="how many lives she can deepen at once. attended life advances through the observation stages over time."
			>
				<span class="label">attention</span>
				<span class="value">{book.attentionUsed}<span class="of">/{book.attentionCapacity}</span></span>
				<span class="rate">{book.attentionFree} free</span>
			</div>
		</div>
	</section>

	<section class="group book">
		<h3>carried in the book</h3>
		<div class="cells">
			<div class="cell" title="raw creative power. spent writing conditions into the Web.">
				<span class="label">essence</span>
				<span class="value">{book.essence}</span>
			</div>
			<div class="cell" title="lifetime understanding — every observation stage she has ever crossed.">
				<span class="label">knowing</span>
				<span class="value">{fmt(book.knowing)}</span>
			</div>
		</div>
	</section>

	{#if book.life.length > 0}
		<section class="group body">
			<h3>
				the world's body
				{#if book.quiet}<span class="quiet">— going quiet</span>{:else if book.selfBalancing}<span
						class="balancing">— holding itself</span
					>{/if}
			</h3>
			<div class="cells">
				{#each stockRows as row (row.id)}
					<div class="cell stock" title={row.hint}>
						<span class="label">{row.label}</span>
						<span class="value sm">{Math.round(row.value)}</span>
						<span class="bar" aria-hidden="true">
							<span class="fill" style:width="{row.value}%" style:background={row.tint}></span>
						</span>
					</div>
				{/each}
				<div class="cell" title="resilience — how close the three stocks sit to a balanced world, steadied by the ecosystems she has come to Know.">
					<span class="label">stability</span>
					<span class="value sm">{Math.round(book.stability)}</span>
				</div>
				<div class="cell" title="the richness of the world — its life, how deeply it is witnessed, what has emerged, and what she has fully Known.">
					<span class="label">complexity</span>
					<span class="value sm">{fmt(book.complexity)}</span>
				</div>
			</div>
		</section>
	{/if}
</div>

<style>
	.ledger {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem 1.4rem;
		border: 1px solid var(--rule);
		border-radius: 4px;
		background: var(--panel);
		padding: 0.6rem 0.8rem;
	}
	.group {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.group.world {
		flex: 1;
		min-width: 18rem;
	}
	h3 {
		font-family: var(--font-ui);
		font-size: 0.62rem;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: var(--periwinkle);
		margin: 0;
	}
	.cells {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem 1rem;
	}
	.cell {
		display: flex;
		flex-direction: column;
		gap: 0.05rem;
		cursor: help;
	}
	.cell.wide {
		min-width: 6rem;
	}
	.label {
		font-family: var(--font-ui);
		font-size: 0.66rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--muted);
	}
	.value {
		font-family: var(--font-counter);
		font-size: 1.5rem;
		line-height: 1;
		color: var(--leafeon-pink);
	}
	.value .of {
		color: var(--muted);
		font-size: 1rem;
	}
	.rate {
		font-family: var(--font-counter);
		font-size: 0.8rem;
		color: var(--cyan);
	}
	.book .value {
		color: var(--cream);
	}

	/* ── the world's body ─────────────────────────────────────────────────── */
	.group.body {
		flex: 1;
		min-width: 18rem;
	}
	.quiet {
		font-family: var(--font-ui);
		font-size: 0.6rem;
		letter-spacing: 0.12em;
		color: var(--print-pink);
	}
	.balancing {
		font-family: var(--font-ui);
		font-size: 0.6rem;
		letter-spacing: 0.12em;
		color: var(--cyan);
	}
	.value.sm {
		font-size: 1.1rem;
		color: var(--cream);
	}
	.cell.stock {
		min-width: 5rem;
	}
	.bar {
		display: block;
		height: 3px;
		width: 100%;
		background: var(--bg);
		border-radius: 2px;
		overflow: hidden;
		margin-top: 0.15rem;
	}
	.fill {
		display: block;
		height: 100%;
		transition: width 200ms linear;
	}
</style>
