<script lang="ts">
	import { store } from '$lib/store.svelte';
	import { onboarding } from '$lib/onboarding.store.svelte';
	import { STEP_COPY, TONES } from '$lib/onboarding.copy';
	import { fillSlots } from '$lib/voice';
	import type { ToneName } from '$lib/types';
	import StepShell from './StepShell.svelte';

	const copy = STEP_COPY[5];

	let selected = $state<ToneName>(store.settings.tone);

	const sampleCtx = $derived({
		date: store.now,
		block: store.getCurrentBlockForDate(store.now) ?? store.getNextBlockForDate(store.now) ?? null,
		dayShape: store.getDayShape(store.now),
		domains: store.domains,
		blockCount: store.getBlocksForDate(store.now).length
	});

	function tonePreview(tone: ToneName): string {
		const preset = TONES.find((t) => t.id === tone);
		if (!preset) return '';
		return fillSlots(preset.samples[0], sampleCtx);
	}

	function advance() {
		store.updateSettings({ tone: selected });
		onboarding.advance();
	}
</script>

<StepShell
	eyebrow={copy.eyebrow}
	heading={copy.heading}
	subprompt={copy.subprompt}
	cta={copy.cta}
	stage={6}
	onAdvance={advance}
>
	<div class="tone-list" role="radiogroup" aria-label="tone selection">
		{#each TONES as tone (tone.id)}
			{@const active = selected === tone.id}
			<button
				class="tone-card"
				class:active
				role="radio"
				aria-checked={active}
				onclick={() => (selected = tone.id)}
			>
				<div class="tone-card-head">
					<span class="tone-name">{tone.name}</span>
					<span class="tone-desc">{tone.description}</span>
				</div>
				<p class="tone-sample">
					<span class="tone-quote" aria-hidden="true">“</span>
					<span class="tone-sample-text">{tonePreview(tone.id)}</span>
					<span class="tone-quote tone-quote-close" aria-hidden="true">”</span>
				</p>
			</button>
		{/each}
	</div>
</StepShell>

<style>
	.tone-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.tone-card {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		padding: 0.9rem 1rem;
		border: 1px solid var(--p-border);
		border-radius: var(--pl-radius-md);
		background: var(--p-surface);
		text-align: left;
		transition: all var(--pl-transition-fast);
		opacity: 0.75;
	}

	.tone-card:hover { opacity: 1; }

	.tone-card.active {
		opacity: 1;
		border-color: var(--p-accent);
		box-shadow: 0 0 0 1px var(--p-accent), var(--pl-shadow-card);
	}

	.tone-card-head {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.tone-name {
		font-family: var(--pl-font-optical);
		font-style: italic;
		font-weight: 400;
		font-size: 1.25rem;
		color: var(--p-text);
		font-variation-settings: 'opsz' 36;
		letter-spacing: -0.01em;
	}

	.tone-desc {
		font-family: var(--pl-font-mono);
		font-size: 0.6rem;
		letter-spacing: 0.08em;
		color: var(--p-muted);
		opacity: 0.75;
	}

	.tone-sample {
		position: relative;
		font-family: var(--pl-font-body);
		font-size: 0.95rem;
		font-style: italic;
		line-height: 1.55;
		color: var(--p-text);
		opacity: 0.88;
		padding-left: 1.4rem;
		padding-right: 0.4rem;
	}

	.tone-quote {
		font-family: var(--pl-font-fell);
		font-style: italic;
		font-size: 1.85rem;
		line-height: 0.5;
		color: var(--p-accent);
		opacity: 0.55;
		vertical-align: -0.3em;
		margin-right: 0.05em;
	}

	.tone-quote-close {
		margin-left: 0.1em;
		margin-right: 0;
		vertical-align: -0.6em;
	}

	.tone-card.active .tone-quote {
		opacity: 0.9;
	}

	.tone-sample-text { display: inline; }
</style>
