<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onboarding } from '$lib/onboarding.store.svelte';

	type Props = {
		eyebrow: string;
		heading: string;
		subprompt: string;
		cta: string;
		canAdvance?: boolean;
		onAdvance: () => void;
		stage: number; // 1..6
		children: Snippet;
	};

	let {
		eyebrow,
		heading,
		subprompt,
		cta,
		canAdvance = true,
		onAdvance,
		stage,
		children
	}: Props = $props();

	const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];
</script>

<div class="step-shell">
	<!-- Roman-numeral progress with ornamental fleurons between -->
	<div class="step-progress" aria-hidden="true">
		{#each [1, 2, 3, 4, 5, 6] as n, idx}
			<div class="prog-cell" class:done={n < stage} class:current={n === stage}>
				<span class="prog-numeral">{ROMAN[n]}</span>
				<span class="prog-underline"></span>
			</div>
			{#if idx < 5}
				<span class="prog-sep" class:done={n < stage}>·</span>
			{/if}
		{/each}
	</div>

	<header class="step-header">
		<div class="step-eyebrow-row">
			<span class="eyebrow-mark" aria-hidden="true">❦</span>
			<span class="step-eyebrow">{eyebrow}</span>
			<span class="eyebrow-mark" aria-hidden="true">❦</span>
		</div>
		<h1 class="step-heading">{heading}</h1>
		<p class="step-subprompt">{subprompt}</p>
	</header>

	<div class="step-body">
		{@render children()}
	</div>

	<footer class="step-footer">
		{#if stage > 1}
			<button class="step-back" onclick={() => onboarding.back()} title="back">← back</button>
		{:else}
			<span></span>
		{/if}
		<button class="step-cta" onclick={onAdvance} disabled={!canAdvance}>{cta}</button>
	</footer>
</div>

<style>
	.step-shell {
		max-width: 640px;
		margin: 0 auto;
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		padding: clamp(1.5rem, 5vw, 3rem) clamp(1.5rem, 5vw, 2.5rem) clamp(2rem, 6vw, 3.5rem);
		gap: clamp(1.25rem, 3vw, 2rem);
		position: relative;
	}

	/* ── progress: roman numerals + fleurons ───────────────────────── */
	.step-progress {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding-top: 0.5rem;
	}

	.prog-cell {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		opacity: 0.35;
		transition: opacity var(--pl-transition-medium);
		min-width: 1.4rem;
	}

	.prog-cell.done { opacity: 0.6; }

	.prog-cell.current {
		opacity: 1;
		transform: scale(1.08);
	}

	.prog-numeral {
		font-family: var(--pl-font-fell);
		font-style: italic;
		font-size: 0.95rem;
		color: var(--p-text);
		letter-spacing: 0.02em;
		line-height: 1;
	}

	.prog-cell.current .prog-numeral { color: var(--p-accent); }

	.prog-underline {
		width: 100%;
		height: 1px;
		background: var(--p-border);
		transition: background var(--pl-transition-medium);
	}

	.prog-cell.done .prog-underline,
	.prog-cell.current .prog-underline {
		background: var(--p-accent);
	}

	.prog-sep {
		font-family: var(--pl-font-fell);
		color: var(--p-muted);
		opacity: 0.4;
		transition: color var(--pl-transition-medium);
	}

	.prog-sep.done { color: var(--p-accent); opacity: 0.7; }

	/* ── header ────────────────────────────────────────────────────── */
	.step-header {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		margin-top: clamp(1.5rem, 6vw, 3rem);
		align-items: flex-start;
	}

	.step-eyebrow-row {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		opacity: 0.85;
	}

	.eyebrow-mark {
		font-family: var(--pl-font-fell);
		color: var(--p-accent);
		opacity: 0.55;
		font-size: 0.78rem;
		line-height: 1;
	}

	.step-eyebrow {
		font-family: var(--pl-font-mono);
		font-weight: 400;
		font-size: 0.62rem;
		letter-spacing: 0.32em;
		text-transform: uppercase;
		color: var(--p-muted);
	}

	.step-heading {
		font-family: var(--pl-font-optical);
		font-weight: 300;
		font-style: italic;
		font-size: clamp(1.85rem, 4.8vw, 2.85rem);
		line-height: 1.12;
		color: var(--p-text);
		letter-spacing: -0.015em;
		font-variation-settings: 'opsz' 96, 'SOFT' 60;
	}

	.step-subprompt {
		font-family: var(--pl-font-body);
		font-size: clamp(0.95rem, 2vw, 1.05rem);
		line-height: 1.55;
		color: var(--p-muted);
		font-style: italic;
		opacity: 0.85;
		max-width: 36rem;
	}

	.step-body {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		padding: 0.5rem 0;
	}

	.step-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-top: 1rem;
		border-top: 1px solid var(--p-border);
		gap: 1rem;
		position: relative;
	}

	.step-footer::before {
		content: '✦';
		position: absolute;
		top: -0.7rem;
		left: 50%;
		transform: translateX(-50%);
		font-family: var(--pl-font-fell);
		font-size: 0.75rem;
		color: var(--p-accent);
		background: var(--p-bg);
		padding: 0 0.6rem;
		opacity: 0.7;
		line-height: 1;
	}

	.step-back {
		font-family: var(--pl-font-mono);
		font-size: 0.65rem;
		letter-spacing: 0.14em;
		color: var(--p-muted);
		opacity: 0.55;
		padding: 6px 10px;
		border-radius: var(--pl-radius-pill);
		transition: opacity var(--pl-transition-fast), color var(--pl-transition-fast);
	}

	.step-back:hover { opacity: 1; color: var(--p-accent); }

	.step-cta {
		font-family: var(--pl-font-mono);
		font-size: 0.78rem;
		letter-spacing: 0.14em;
		color: var(--p-text);
		border: 1px solid var(--p-accent);
		background: var(--p-accent-soft);
		padding: 10px 22px;
		border-radius: var(--pl-radius-pill);
		transition: background var(--pl-transition-fast), color var(--pl-transition-fast),
			opacity var(--pl-transition-fast);
	}

	.step-cta:hover:not(:disabled) {
		background: var(--p-accent);
		color: var(--p-bg);
	}

	.step-cta:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}
</style>
