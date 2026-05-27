<script lang="ts">
	import { onboarding } from '$lib/onboarding.store.svelte';
	import { WELCOME } from '$lib/onboarding.copy';
</script>

<div class="welcome">
	<div class="welcome-card">
		<div class="welcome-mark" aria-hidden="true">
			<span class="mark-glyph">∴</span>
		</div>

		<h1 class="welcome-heading">{WELCOME.heading}</h1>
		<p class="welcome-sub">{WELCOME.subheading}</p>

		<div class="welcome-rule" aria-hidden="true">
			<span class="rule-line"></span>
			<span class="rule-dot">·</span>
			<span class="rule-line"></span>
		</div>

		<button class="welcome-cta" onclick={() => onboarding.beginFlow()}>
			{WELCOME.cta}
		</button>

		<p class="welcome-foot">six small questions. about three minutes.</p>
	</div>
</div>

<style>
	.welcome {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: clamp(1.5rem, 5vw, 3rem);
	}

	.welcome-card {
		max-width: 520px;
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.4rem;
	}

	.welcome-mark {
		font-family: var(--pl-font-fell);
		font-size: 3.5rem;
		color: var(--p-accent);
		opacity: 0.85;
		line-height: 1;
		margin-bottom: 0.5rem;
	}

	.mark-glyph {
		display: inline-block;
		animation: mark-breathe 4.5s ease-in-out infinite;
	}

	@keyframes mark-breathe {
		0%, 100% { opacity: 0.7; transform: translateY(0); }
		50%      { opacity: 1;   transform: translateY(-2px); }
	}

	.welcome-heading {
		font-family: var(--pl-font-optical);
		font-weight: 300;
		font-style: italic;
		font-size: clamp(2.2rem, 6vw, 3.4rem);
		line-height: 1.08;
		color: var(--p-text);
		letter-spacing: -0.02em;
		font-variation-settings: 'opsz' 144, 'SOFT' 80;
	}

	.welcome-sub {
		font-family: var(--pl-font-body);
		font-size: clamp(1rem, 2.2vw, 1.15rem);
		line-height: 1.55;
		color: var(--p-muted);
		opacity: 0.85;
	}

	.welcome-rule {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		width: 100%;
		max-width: 18rem;
		margin: 0.5rem 0 0.25rem;
	}

	.rule-line {
		flex: 1;
		height: 1px;
		background: var(--p-border);
	}

	.rule-dot {
		font-family: var(--pl-font-fell);
		color: var(--p-accent);
		opacity: 0.7;
		font-size: 1.1rem;
		line-height: 1;
	}

	.welcome-cta {
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

	.welcome-cta:hover {
		background: var(--p-accent);
		color: var(--p-bg);
	}

	.welcome-foot {
		font-family: var(--pl-font-mono);
		font-size: 0.6rem;
		letter-spacing: 0.18em;
		text-transform: lowercase;
		color: var(--p-muted);
		opacity: 0.5;
		margin-top: 0.5rem;
	}
</style>
