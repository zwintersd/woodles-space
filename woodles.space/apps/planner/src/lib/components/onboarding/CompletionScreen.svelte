<script lang="ts">
	import { onboarding } from '$lib/onboarding.store.svelte';
	import { COMPLETION } from '$lib/onboarding.copy';
</script>

<div class="completion">
	<div class="completion-card">
		<div class="completion-mark" aria-hidden="true">
			<span class="mark-line"></span>
			<span class="mark-glyph">✦</span>
			<span class="mark-line"></span>
		</div>

		<h1 class="completion-heading">{COMPLETION.heading}</h1>
		<p class="completion-body">{COMPLETION.body}</p>

		<button class="completion-cta" onclick={() => onboarding.finish()}>
			{COMPLETION.cta}
		</button>
	</div>
</div>

<style>
	.completion {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: clamp(1.5rem, 5vw, 3rem);
	}

	.completion-card {
		max-width: 500px;
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.4rem;
	}

	.completion-mark {
		display: flex;
		align-items: center;
		gap: 1rem;
		width: 100%;
		max-width: 16rem;
		margin-bottom: 0.5rem;
	}

	.mark-line {
		flex: 1;
		height: 1px;
		background: var(--p-accent);
		opacity: 0.7;
	}

	.mark-glyph {
		font-family: var(--pl-font-fell);
		color: var(--p-accent);
		font-size: 1.4rem;
		line-height: 1;
		animation: glyph-arrive 1.6s ease-out;
	}

	@keyframes glyph-arrive {
		0%   { transform: scale(0.3) rotate(-30deg); opacity: 0; }
		60%  { transform: scale(1.2) rotate(8deg);  opacity: 1; }
		100% { transform: scale(1)   rotate(0);     opacity: 1; }
	}

	.completion-heading {
		font-family: var(--pl-font-optical);
		font-weight: 300;
		font-style: italic;
		font-size: clamp(2rem, 5.5vw, 3rem);
		line-height: 1.1;
		color: var(--p-text);
		letter-spacing: -0.018em;
		font-variation-settings: 'opsz' 144, 'SOFT' 80;
	}

	.completion-body {
		font-family: var(--pl-font-body);
		font-size: 1.05rem;
		line-height: 1.55;
		color: var(--p-muted);
		opacity: 0.9;
	}

	.completion-cta {
		font-family: var(--pl-font-mono);
		font-size: 0.82rem;
		letter-spacing: 0.16em;
		color: var(--p-text);
		border: 1px solid var(--p-accent);
		background: var(--p-accent-soft);
		padding: 12px 28px;
		border-radius: var(--pl-radius-pill);
		margin-top: 0.5rem;
		transition: background var(--pl-transition-fast), color var(--pl-transition-fast);
	}

	.completion-cta:hover {
		background: var(--p-accent);
		color: var(--p-bg);
	}
</style>
