<script lang="ts">
	import { book, fmt } from './book.svelte';
	import { trend } from './history';
	import Sparkline from './Sparkline.svelte';

	const favorWord = $derived(
		book.favorBand === 'high' ? 'at ease' : book.favorBand === 'low' ? 'wary' : 'even'
	);

	const trendGlyph = { [-1]: '▾', [0]: '▪', [1]: '▴' } as const;

	// the three stocks, for the world's-body readout — a reading and a trace,
	// the way an instrument panel gives you both.
	const stockRows = $derived([
		{
			id: 'nutrients',
			label: 'nutrients',
			value: book.stocks.nutrients,
			history: book.stockHistory.nutrients,
			tint: 'var(--leafeon-pink)',
			hint: 'fertility of soil and water — plants draw it down; decay and decomposers return it.'
		},
		{
			id: 'oxygen',
			label: 'oxygen',
			value: book.stocks.oxygen,
			history: book.stockHistory.oxygen,
			tint: 'var(--cyan)',
			hint: 'breathable air — plants make it; animals burn it.'
		},
		{
			id: 'moisture',
			label: 'moisture',
			value: book.stocks.moisture,
			history: book.stockHistory.moisture,
			tint: 'var(--periwinkle)',
			hint: 'water on the land — weather brings it; land plants drink it.'
		}
	]);

	// Show one decimal for small insight so it visibly ticks every rAF frame.
	function fmtLive(n: number): string {
		if (n < 1000) return n.toFixed(1);
		return fmt(n);
	}

	// One copy of each explanation, read by both the (mouse-only) title
	// tooltip and the tap-to-reveal hint below, so they can't drift apart.
	const hints = $derived({
		insight:
			'the world yields Insight every second it is witnessed. spend it on attention, or distill it into Essence.',
		favor: `the world's relationship with her. it eases upward as she comes to Know its life — and it multiplies all Insight, ×${book.favorMult.toFixed(2)} right now.`,
		attention:
			'how many lives she can deepen at once. attended life advances through the observation stages over time.',
		essence: 'raw creative power. spent writing conditions into the Web.',
		knowing: 'lifetime understanding — every observation stage she has ever crossed.',
		stability:
			'resilience — how close the three stocks sit to a balanced world, steadied by the ecosystems she has come to Know.',
		complexity:
			'the richness of the world — its life, how deeply it is witnessed, what has emerged, and what she has fully Known.'
	});

	// Every cell's explanation lives in its title tooltip — useless on a touch
	// screen, which has no hover. Tapping toggles the same text open inline
	// instead, so "how the vital signs read to someone with no context"
	// (ROADMAP.md week 6) doesn't depend on a mouse. One open at a time.
	let expandedId = $state<string | null>(null);
	function toggleHint(id: string) {
		expandedId = expandedId === id ? null : id;
	}
	function hintKeydown(event: KeyboardEvent, id: string) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			toggleHint(id);
		}
	}
</script>

<div class="ledger">
	<section class="group world">
		<h3>this world</h3>
		<div class="cells">
			<div
				class="cell wide"
				title={hints.insight}
				role="button"
				tabindex="0"
				aria-expanded={expandedId === 'insight'}
				onclick={() => toggleHint('insight')}
				onkeydown={(e) => hintKeydown(e, 'insight')}
			>
				<span class="label">insight</span>
				<span class="value">{fmtLive(book.insight)}</span>
				<span class="rate">+{fmt(book.insightPerSec)}/s</span>
				{#if expandedId === 'insight'}<p class="hint">{hints.insight}</p>{/if}
			</div>
			<div
				class="cell"
				title={hints.favor}
				role="button"
				tabindex="0"
				aria-expanded={expandedId === 'favor'}
				onclick={() => toggleHint('favor')}
				onkeydown={(e) => hintKeydown(e, 'favor')}
			>
				<span class="label">favor</span>
				<span class="value">{Math.round(book.favor)}</span>
				<span class="rate">{favorWord} · ×{book.favorMult.toFixed(2)}</span>
				{#if expandedId === 'favor'}<p class="hint">{hints.favor}</p>{/if}
			</div>
			<div
				class="cell"
				title={hints.attention}
				role="button"
				tabindex="0"
				aria-expanded={expandedId === 'attention'}
				onclick={() => toggleHint('attention')}
				onkeydown={(e) => hintKeydown(e, 'attention')}
			>
				<span class="label">attention</span>
				<span class="value">{book.attentionUsed}<span class="of">/{book.attentionCapacity}</span></span>
				<span class="rate">{book.attentionFree} free</span>
				{#if expandedId === 'attention'}<p class="hint">{hints.attention}</p>{/if}
			</div>
		</div>
	</section>

	<section class="group book">
		<h3>carried in the book</h3>
		<div class="cells">
			<div
				class="cell"
				title={hints.essence}
				role="button"
				tabindex="0"
				aria-expanded={expandedId === 'essence'}
				onclick={() => toggleHint('essence')}
				onkeydown={(e) => hintKeydown(e, 'essence')}
			>
				<span class="label">essence</span>
				<span class="value">{book.essence}</span>
				{#if expandedId === 'essence'}<p class="hint">{hints.essence}</p>{/if}
			</div>
			<div
				class="cell"
				title={hints.knowing}
				role="button"
				tabindex="0"
				aria-expanded={expandedId === 'knowing'}
				onclick={() => toggleHint('knowing')}
				onkeydown={(e) => hintKeydown(e, 'knowing')}
			>
				<span class="label">knowing</span>
				<span class="value">{fmt(book.knowing)}</span>
				{#if expandedId === 'knowing'}<p class="hint">{hints.knowing}</p>{/if}
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
					{@const dir = trend(row.history)}
					<div
						class="cell stock"
						title={row.hint}
						role="button"
						tabindex="0"
						aria-expanded={expandedId === row.id}
						onclick={() => toggleHint(row.id)}
						onkeydown={(e) => hintKeydown(e, row.id)}
					>
						<span class="label">{row.label}</span>
						<span class="value-row">
							<span class="value sm">{Math.round(row.value)}</span>
							<span class="trend" class:rising={dir === 1} class:falling={dir === -1}
								>{trendGlyph[dir]}</span
							>
						</span>
						<span class="bar" aria-hidden="true">
							<span class="fill" style:width="{row.value}%" style:background={row.tint}></span>
						</span>
						<Sparkline samples={row.history} color={row.tint} />
						{#if expandedId === row.id}<p class="hint">{row.hint}</p>{/if}
					</div>
				{/each}
				<div
					class="cell"
					title={hints.stability}
					role="button"
					tabindex="0"
					aria-expanded={expandedId === 'stability'}
					onclick={() => toggleHint('stability')}
					onkeydown={(e) => hintKeydown(e, 'stability')}
				>
					<span class="label">stability</span>
					<span class="value sm">{Math.round(book.stability)}</span>
					{#if expandedId === 'stability'}<p class="hint">{hints.stability}</p>{/if}
				</div>
				<div
					class="cell"
					title={hints.complexity}
					role="button"
					tabindex="0"
					aria-expanded={expandedId === 'complexity'}
					onclick={() => toggleHint('complexity')}
					onkeydown={(e) => hintKeydown(e, 'complexity')}
				>
					<span class="label">complexity</span>
					<span class="value sm">{fmt(book.complexity)}</span>
					{#if expandedId === 'complexity'}<p class="hint">{hints.complexity}</p>{/if}
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
		max-width: 14rem;
		border-radius: 3px;
	}
	.cell:focus-visible {
		outline: 1px solid var(--cyan);
		outline-offset: 2px;
	}
	.cell.wide {
		min-width: 6rem;
	}
	/* the tap-revealed twin of the title tooltip above — same words, reachable
	   without a mouse (ROADMAP.md week 6: the ledger read with no context). */
	.hint {
		margin: 0.2rem 0 0;
		font-family: var(--font-body);
		font-style: italic;
		font-size: 0.72rem;
		line-height: 1.35;
		color: var(--text);
		white-space: normal;
		cursor: auto;
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
		min-width: 6.5rem;
	}
	.value-row {
		display: flex;
		align-items: baseline;
		gap: 0.3rem;
	}
	.trend {
		font-size: 0.7rem;
		color: var(--muted);
	}
	.trend.rising {
		color: var(--cyan);
	}
	.trend.falling {
		color: var(--print-pink);
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
