<script lang="ts">
	import { book, fmt } from './book.svelte';

	const favorWord = $derived(
		book.favorBand === 'high' ? 'at ease' : book.favorBand === 'low' ? 'wary' : 'even'
	);
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
				<span class="value">{fmt(book.insight)}</span>
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
</style>
