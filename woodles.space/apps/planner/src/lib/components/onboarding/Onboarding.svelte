<script lang="ts">
	import { onboarding } from '$lib/onboarding.store.svelte';
	import WelcomeScreen from './WelcomeScreen.svelte';
	import StepAnchors from './StepAnchors.svelte';
	import StepObligations from './StepObligations.svelte';
	import StepRituals from './StepRituals.svelte';
	import StepDomains from './StepDomains.svelte';
	import StepWeekRhythm from './StepWeekRhythm.svelte';
	import StepVoice from './StepVoice.svelte';
	import CompletionScreen from './CompletionScreen.svelte';
</script>

<div class="onboarding-host">
	<!-- Four corner fleurons — quietly frame the whole flow -->
	<span class="corner tl" aria-hidden="true">❦</span>
	<span class="corner tr" aria-hidden="true">❧</span>
	<span class="corner bl" aria-hidden="true">❧</span>
	<span class="corner br" aria-hidden="true">❦</span>

	<!-- A small bell that swings briefly each time the stage advances -->
	{#key onboarding.stage}
		<svg class="bell-ring" viewBox="0 0 40 40" aria-hidden="true">
			<g class="bell-swing">
				<path
					d="M20 6 C20 4, 22 4, 22 6 L22 8
					   C28 9.5, 30 14, 30 22
					   L32 26 L8 26 L10 22
					   C10 14, 12 9.5, 18 8 L18 6
					   C18 4, 20 4, 20 6 Z"
					fill="currentColor"
					opacity="0.85"
				/>
				<circle cx="20" cy="30" r="1.6" fill="currentColor" />
			</g>
		</svg>
	{/key}

	{#key onboarding.stage}
		<div class="onboarding-fade">
			{#if onboarding.stage === 'welcome'}
				<WelcomeScreen />
			{:else if onboarding.stage === 1}
				<StepAnchors />
			{:else if onboarding.stage === 2}
				<StepObligations />
			{:else if onboarding.stage === 3}
				<StepRituals />
			{:else if onboarding.stage === 4}
				<StepDomains />
			{:else if onboarding.stage === 5}
				<StepWeekRhythm />
			{:else if onboarding.stage === 6}
				<StepVoice />
			{:else if onboarding.stage === 'done'}
				<CompletionScreen />
			{/if}
		</div>
	{/key}
</div>

<style>
	.onboarding-host {
		min-height: 100vh;
		position: relative;
		overflow: hidden;
	}

	.onboarding-fade {
		animation: stage-in 0.5s ease-out;
	}

	@keyframes stage-in {
		0%   { opacity: 0; transform: translateY(6px); }
		100% { opacity: 1; transform: translateY(0); }
	}

	/* ── corner fleurons ───────────────────────────────────────────── */
	.corner {
		position: fixed;
		font-family: var(--pl-font-fell);
		color: var(--p-accent);
		opacity: 0.18;
		font-size: clamp(1.5rem, 3vw, 2.2rem);
		line-height: 1;
		pointer-events: none;
		user-select: none;
		transition: opacity 1.5s ease;
		z-index: 0;
	}

	.corner.tl { top: 1.2rem;    left: 1.4rem;  }
	.corner.tr { top: 1.2rem;    right: 1.4rem; transform: scaleX(-1); }
	.corner.bl { bottom: 1.2rem; left: 1.4rem;  transform: scaleY(-1); }
	.corner.br { bottom: 1.2rem; right: 1.4rem; transform: scale(-1, -1); }

	/* Hide corners on very small screens — they crowd */
	@media (max-width: 480px) {
		.corner { display: none; }
	}

	/* ── transition bell ───────────────────────────────────────────── */
	.bell-ring {
		position: fixed;
		top: 50%;
		left: 50%;
		width: 24px;
		height: 24px;
		transform: translate(-50%, -50%);
		color: var(--p-accent);
		pointer-events: none;
		opacity: 0;
		animation: bell-fade 1.1s ease-out forwards;
		z-index: 1;
	}

	.bell-swing {
		transform-origin: 20px 6px;
		animation: bell-swing 1.1s ease-in-out;
	}

	@keyframes bell-fade {
		0%   { opacity: 0;    transform: translate(-50%, -50%) scale(0.7); }
		25%  { opacity: 0.55; transform: translate(-50%, -50%) scale(1.05); }
		70%  { opacity: 0.35; }
		100% { opacity: 0;    transform: translate(-50%, -50%) scale(1); }
	}

	@keyframes bell-swing {
		0%   { transform: rotate(-14deg); }
		25%  { transform: rotate(12deg);  }
		50%  { transform: rotate(-8deg);  }
		75%  { transform: rotate(5deg);   }
		100% { transform: rotate(0);      }
	}
</style>
