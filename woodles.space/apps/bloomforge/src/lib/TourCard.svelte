<script lang="ts">
	import { apiaryOfBadDecisions, choirOfUnspokenNames, confessionBooth, type GameDef } from '@woodles/incremental-core';
	import { balance } from './balance.svelte.js';
	import { playtest } from './playtest.svelte.js';
	import { studio } from './studio.svelte.js';
	import { stepState, tour } from './tour.svelte.js';

	interface Props {
		/** Opens the finished example once the tour is done. */
		onexample: () => void;
		/** Opens one of the stress-test samples once the advanced tour is done. */
		ontryexample: (def: GameDef, title: string) => void;
	}

	let { onexample, ontryexample }: Props = $props();

	/**
	 * The tour watches the world rather than the buttons. Everything it reads is
	 * the same state the canvas and the dock read, so a step can only complete
	 * because the thing actually happened — including if it happened by a route
	 * the hint never mentioned.
	 */
	$effect(() => {
		tour.observe({
			def: studio.def,
			selectedId: studio.selectedId,
			elapsed: playtest.elapsed,
			balanceRuns: balance.runs.length
		});
	});
</script>

{#if tour.active}
	<!--
		A banner above the canvas rather than a card floating over it. Floating
		looked tidier and was wrong twice over: it covered the Fast-forward button
		it was pointing at, and then it covered the only node on the canvas. A row
		in the grid reserves its own space and cannot cover anything.
	-->
	<aside class="tour" class:done={tour.finished} aria-live="polite">
		{#if tour.finished && tour.track === 'core'}
			<div class="text">
				<p class="eyebrow">Tour complete</p>
				<h2>That's the loop.</h2>
				<p class="body">
					Count something, make something that produces it, watch it run, read the curve, add a lever, find the wall.
					Everything else here is more of those six things.
				</p>
			</div>
			<div class="actions">
				<button class="bf-button" type="button" onclick={onexample}>Open the example</button>
				<button class="bf-button" type="button" onclick={() => tour.startAdvanced()}>Show me what's new</button>
				<button class="bf-button bf-button--primary" type="button" onclick={() => tour.close()}>Keep building</button>
			</div>
		{:else if tour.finished}
			<div class="text">
				<p class="eyebrow">Advanced tour complete</p>
				<h2>That's the whole schema.</h2>
				<p class="body">
					Tags, a rate that reads them, a currency that taxes, a generator that converts — every stress-test sample is
					built from exactly those four ideas, combined differently. Pull one apart:
				</p>
			</div>
			<div class="actions">
				<button
					class="bf-button"
					type="button"
					onclick={() => ontryexample(apiaryOfBadDecisions, 'The Apiary of Bad Decisions')}
				>
					Apiary
				</button>
				<button class="bf-button" type="button" onclick={() => ontryexample(confessionBooth, 'Confession Booth')}>
					Confession Booth
				</button>
				<button
					class="bf-button"
					type="button"
					onclick={() => ontryexample(choirOfUnspokenNames, 'The Choir of Unspoken Names')}
				>
					Choir
				</button>
				<button class="bf-button bf-button--primary" type="button" onclick={() => tour.close()}>Keep building</button>
			</div>
		{:else if tour.step}
			{@const step = tour.step}
			<div class="text">
				<p class="eyebrow">Step {tour.index + 1} of {tour.total}</p>
				<h2>{step.title}</h2>
				<p class="body">{step.body}</p>
			</div>

			<div class="actions">
				<p class="hint"><span aria-hidden="true">→</span> {step.hint}</p>
				<button class="close" type="button" onclick={() => tour.skip()} aria-label="Skip the tour">×</button>
			</div>
		{/if}

		<ol class="pips">
			{#each tour.steps as entry, index (entry.id)}
				<li data-state={stepState(index, tour.index, tour.finished)}>
					<span class="sr-only">{entry.title}</span>
				</li>
			{/each}
		</ol>
	</aside>
{/if}

<style>
	.tour {
		position: relative;
		display: flex;
		align-items: flex-start;
		gap: 16px;
		padding: 11px 14px 13px;
		border: 1px solid var(--bf-upgrade-line);
		border-radius: var(--bf-radius);
		background: linear-gradient(120deg, var(--bf-surface), var(--bf-accent-soft) 220%);
		box-shadow: var(--bf-shadow-soft);
	}

	.tour.done {
		border-color: var(--bf-generator-line);
		background: linear-gradient(120deg, var(--bf-surface), var(--bf-generator-soft) 220%);
	}

	.text {
		flex: 1;
		min-width: 0;
	}

	.eyebrow {
		margin: 0 0 2px;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--bf-accent);
	}

	.tour.done .eyebrow {
		color: var(--bf-generator);
	}

	h2 {
		margin: 0 0 3px;
		font-family: var(--bf-font-display);
		font-size: 18px;
		font-weight: 600;
		color: var(--bf-ink);
	}

	.body {
		margin: 0;
		max-width: 88ch;
		font-size: 12.5px;
		line-height: 1.5;
		color: var(--bf-ink-soft);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: flex-end;
		gap: 7px;
		flex: none;
	}

	.hint {
		margin: 0;
		padding: 6px 11px;
		border-radius: var(--bf-radius-pill);
		background: var(--bf-accent);
		color: var(--bf-on-accent);
		font-size: 11.5px;
		font-weight: 650;
		white-space: nowrap;
	}

	.hint span {
		opacity: 0.65;
	}

	.close {
		width: 24px;
		height: 24px;
		display: grid;
		place-items: center;
		border: 0;
		border-radius: var(--bf-radius-sm);
		background: none;
		color: var(--bf-faint);
		font-size: 17px;
		line-height: 1;
		cursor: pointer;
	}

	.close:hover {
		background: var(--bf-surface);
		color: var(--bf-ink-soft);
	}

	.pips {
		position: absolute;
		left: 14px;
		right: 14px;
		bottom: 6px;
		display: flex;
		gap: 4px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.pips li {
		height: 3px;
		flex: 1;
		border-radius: var(--bf-radius-pill);
		background: var(--bf-rule);
		transition: background 200ms ease;
	}

	.pips li[data-state='done'] {
		background: var(--bf-generator);
	}

	.pips li[data-state='current'] {
		background: var(--bf-accent);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	@media (max-width: 900px) {
		.tour {
			flex-direction: column;
			gap: 10px;
		}

		.actions {
			align-self: stretch;
		}

		.hint {
			flex: 1;
			white-space: normal;
		}
	}
</style>
