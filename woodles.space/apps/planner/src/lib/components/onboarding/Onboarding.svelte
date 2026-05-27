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
	}

	.onboarding-fade {
		animation: stage-in 0.4s ease-out;
	}

	@keyframes stage-in {
		0%   { opacity: 0; transform: translateY(4px); }
		100% { opacity: 1; transform: translateY(0); }
	}
</style>
