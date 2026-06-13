<script lang="ts">
	import { garden } from '$lib/garden.svelte';
	import type { OnboardingStep } from '$lib/types';

	// Dev backdoor (see build handoff §7). Rendered only when garden.devMode is
	// on — enabled via `?dev=1` or the Ctrl+Shift+D chord. Never shows in a
	// normal session. Lets you re-arm first-run and jump to any beat.

	const STEPS: OnboardingStep[] = ['welcome', 'subject', 'wizard', 'cast', 'grown', 'done'];

	function clearAndReset() {
		if (confirm('Clear all Spores + flights and re-arm onboarding?')) {
			garden.resetOnboarding(true);
		}
	}
</script>

<aside class="dev-panel">
	<div class="dev-head">
		<span class="dev-title">dev · onboarding</span>
		<button class="dev-x" onclick={() => (garden.devMode = false)} title="hide">×</button>
	</div>

	<p class="dev-flag">onboarded: <strong>{String(garden.settings.onboarded === true)}</strong></p>

	<div class="dev-actions">
		<button class="dev-btn" onclick={() => garden.resetOnboarding(false)}>reset first-run</button>
		<button class="dev-btn danger" onclick={clearAndReset}>clear + reset</button>
	</div>

	<p class="dev-sub">jump to beat</p>
	<div class="dev-steps">
		{#each STEPS as s}
			<button
				class="dev-step"
				class:active={garden.showOnboarding && garden.onboardingStep === s}
				onclick={() => garden.jumpToOnboardingStep(s)}
			>
				{s}
			</button>
		{/each}
	</div>
</aside>

<style>
	.dev-panel {
		position: fixed;
		bottom: var(--g-space-md);
		right: var(--g-space-md);
		z-index: 9999;
		width: 220px;
		background: var(--g-surface-2);
		border: 1px solid var(--g-border-strong);
		border-radius: var(--g-radius-md);
		padding: var(--g-space-md);
		display: flex;
		flex-direction: column;
		gap: var(--g-space-sm);
		box-shadow: var(--g-shadow-card);
		font-family: var(--g-font-mono);
	}

	.dev-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.dev-title {
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--g-flight-active);
	}

	.dev-x {
		color: var(--g-muted);
		font-size: 1rem;
		line-height: 1;
	}

	.dev-x:hover { color: var(--g-flight); }

	.dev-flag {
		font-size: 0.72rem;
		color: var(--g-muted);
	}

	.dev-flag strong { color: var(--g-text-dim); }

	.dev-actions {
		display: flex;
		flex-direction: column;
		gap: var(--g-space-xs);
	}

	.dev-btn {
		font-size: 0.74rem;
		color: var(--g-text-dim);
		border: 1px solid var(--g-border);
		border-radius: var(--g-radius-sm);
		padding: 0.3rem 0.5rem;
		text-align: left;
		transition: border-color var(--g-transition-fast), color var(--g-transition-fast);
	}

	.dev-btn:hover { border-color: var(--g-flight); color: var(--g-flight); }
	.dev-btn.danger:hover { border-color: var(--g-flight); color: var(--g-flight); }

	.dev-sub {
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--g-muted);
		margin-top: var(--g-space-xs);
	}

	.dev-steps {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--g-space-xs);
	}

	.dev-step {
		font-size: 0.72rem;
		color: var(--g-text-dim);
		border: 1px solid var(--g-border);
		border-radius: var(--g-radius-sm);
		padding: 0.25rem 0.4rem;
		transition: border-color var(--g-transition-fast), color var(--g-transition-fast);
	}

	.dev-step:hover { border-color: var(--g-flight-active); color: var(--g-flight-active); }
	.dev-step.active { border-color: var(--g-flight); color: var(--g-flight); }
</style>
