<script lang="ts">
	import { store } from '$lib/store.svelte';
	import { onboarding } from '$lib/onboarding.store.svelte';
	import { STEP_COPY, PLACEHOLDERS } from '$lib/onboarding.copy';
	import StepShell from './StepShell.svelte';

	const copy = STEP_COPY[0];

	let wake = $state(store.settings.wakeAnchor);
	let sleep = $state(store.settings.sleepAnchor);

	function advance() {
		store.updateSettings({ wakeAnchor: wake, sleepAnchor: sleep });
		onboarding.advance();
	}

	let canAdvance = $derived(/^\d{2}:\d{2}$/.test(wake) && /^\d{2}:\d{2}$/.test(sleep));
</script>

<StepShell
	eyebrow={copy.eyebrow}
	heading={copy.heading}
	subprompt={copy.subprompt}
	cta={copy.cta}
	stage={1}
	{canAdvance}
	onAdvance={advance}
>
	<div class="anchors-grid">
		<label class="anchor-field">
			<span class="anchor-label">day starts at</span>
			<input
				type="time"
				class="anchor-input"
				bind:value={wake}
				placeholder={PLACEHOLDERS.wakeAnchor}
			/>
			<span class="anchor-hint">{PLACEHOLDERS.wakeAnchor}</span>
		</label>

		<div class="anchor-arrow" aria-hidden="true">→</div>

		<label class="anchor-field">
			<span class="anchor-label">day ends at</span>
			<input
				type="time"
				class="anchor-input"
				bind:value={sleep}
				placeholder={PLACEHOLDERS.sleepAnchor}
			/>
			<span class="anchor-hint">{PLACEHOLDERS.sleepAnchor}</span>
		</label>
	</div>
</StepShell>

<style>
	.anchors-grid {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		gap: 1.25rem;
		align-items: center;
		padding: 1rem 0;
	}

	.anchor-field {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		align-items: center;
	}

	.anchor-label {
		font-family: var(--pl-font-mono);
		font-size: 0.58rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--p-muted);
		opacity: 0.7;
	}

	.anchor-input {
		font-family: var(--pl-font-optical);
		font-weight: 300;
		font-size: clamp(2.4rem, 6vw, 3.4rem);
		color: var(--p-text);
		background: transparent;
		border: none;
		text-align: center;
		padding: 4px 6px;
		border-bottom: 1px solid var(--p-border);
		transition: border-color var(--pl-transition-fast);
		font-variation-settings: 'opsz' 120;
		letter-spacing: -0.01em;
		min-width: 8rem;
	}

	.anchor-input:focus {
		border-color: var(--p-accent);
		outline: none;
	}

	.anchor-hint {
		font-family: var(--pl-font-mono);
		font-size: 0.55rem;
		letter-spacing: 0.12em;
		color: var(--p-muted);
		opacity: 0.5;
	}

	.anchor-arrow {
		font-family: var(--pl-font-mono);
		font-size: 1.1rem;
		color: var(--p-muted);
		opacity: 0.4;
		padding: 0 0.5rem;
	}

	@media (max-width: 480px) {
		.anchors-grid {
			grid-template-columns: 1fr;
			gap: 1.5rem;
		}
		.anchor-arrow {
			transform: rotate(90deg);
		}
	}
</style>
