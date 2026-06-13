<script lang="ts">
	import { garden } from '$lib/garden.svelte';
	import { parseImport } from '$lib/spells/parser';
	import { ONBOARDING_EXAMPLE } from '$lib/onboarding/example';
	import SpellWizard from '$lib/components/spell/SpellWizard.svelte';
	import type { Spore, OnboardingStep } from '$lib/types';

	let step = $derived(garden.onboardingStep);

	// The middle three beats are the real wizard, mounted once for the phase.
	let inWizardPhase = $derived(
		step === 'subject' || step === 'wizard' || step === 'cast'
	);
	const wizardStartStep: Record<string, number> = { subject: 2, wizard: 3, cast: 5 };

	// ── beat 5: the grown Spore ────────────────────────────────────

	let grownSpore = $derived<Spore | null>(
		garden.onboardingGrownSporeId
			? garden.spores.find((s) => s.id === garden.onboardingGrownSporeId) ?? null
			: null
	);

	let seasons = $derived<Array<Record<string, unknown>>>(
		Array.isArray(grownSpore?.data?.seasons)
			? (grownSpore!.data.seasons as Array<Record<string, unknown>>)
			: []
	);
	const spotlightIndex = 0;

	function seasonTitle(s: Record<string, unknown>, i: number): string {
		return typeof s.title === 'string' && s.title.trim() ? s.title : `Season ${i + 1}`;
	}

	// Promote animation state
	let promoted = $state(false);
	let promotedChildTitle = $state('');
	let lineActive = $state(false);

	// Dev backdoor: jumping straight to "grown" with no real Spore seeds the
	// illustrative example so the beat is inspectable without a live LLM hop.
	$effect(() => {
		if (step === 'grown' && !garden.onboardingGrownSporeId) {
			const r = parseImport(ONBOARDING_EXAMPLE);
			if (r.ok) {
				const created = garden.importStructuredSpore(r.spore);
				garden.onboardingGrownSporeId = created.id;
			}
		}
	});

	// Reset the promote animation whenever we (re)enter the grown beat.
	$effect(() => {
		if (step !== 'grown') {
			promoted = false;
			lineActive = false;
			promotedChildTitle = '';
		}
	});

	function continueFromWelcome() {
		garden.setOnboardingStep('subject');
	}

	function handleStep(s: OnboardingStep) {
		garden.setOnboardingStep(s);
	}

	function handleGrown(spore: Spore) {
		garden.onboardingGrownSporeId = spore.id;
		garden.markOnboarded(); // a kept Spore counts as onboarded, even before the end screen
		garden.setOnboardingStep('grown');
	}

	function promoteSpotlight() {
		if (!grownSpore || seasons.length === 0) return;
		const created = garden.promoteChild(grownSpore.id, 'seasons', spotlightIndex);
		if (!created) return;
		promotedChildTitle = created.title;
		promoted = true;
		// settle the freshly-drawn pink line into the active cyan state
		setTimeout(() => (lineActive = true), 700);
	}
</script>

<div class="onboarding-overlay">
	<div class="onboarding-frame">
		<div class="beat-track">
			{#each ['welcome', 'subject', 'wizard', 'cast', 'grown'] as b, i}
				<span
					class="beat-dot"
					class:active={step === b || (step === 'done' && b === 'grown')}
					class:done={['welcome', 'subject', 'wizard', 'cast', 'grown'].indexOf(step) > i ||
						step === 'done'}
				></span>
			{/each}
		</div>

		<!-- Beat 1: Welcome -->
		{#if step === 'welcome'}
			<div class="beat beat-centered">
				<span class="welcome-glyph">❀</span>
				<h1 class="welcome-title">Welcome to your Garden</h1>
				<p class="welcome-text">
					Your Garden grows from Spores. A Spore is one thing you know about — a show, a
					season, an idea. You grow them by casting Spells.
				</p>
				<button class="btn-enter" onclick={continueFromWelcome}>Continue →</button>
			</div>

		<!-- Beats 2–4: the real wizard, pre-narrowed -->
		{:else if inWizardPhase}
			{#key garden.onboardingMountToken}
				<SpellWizard
					onboarding
					presetSubject=""
					startStep={wizardStartStep[step] ?? 2}
					onstep={handleStep}
					ongrown={handleGrown}
				/>
			{/key}

		<!-- Beat 5: Watch it grow + the one magic move -->
		{:else if step === 'grown' && grownSpore}
			<div class="beat beat-grown">
				<p class="onb-eyebrow">your first Spore</p>
				<h1 class="grown-title">{grownSpore.title}</h1>
				{#if grownSpore.body}
					<p class="grown-body">{grownSpore.body}</p>
				{/if}

				{#if seasons.length > 0}
					<div class="grown-tree">
						<p class="tree-label">seasons</p>
						<ul class="season-list">
							{#each seasons as s, i}
								<li class="season-row" class:spotlight={!promoted && i === spotlightIndex}>
									<span class="season-name">{seasonTitle(s, i)}</span>
									{#if s.episodeCount}
										<span class="season-meta">{s.episodeCount} episodes</span>
									{/if}
								</li>
							{/each}
						</ul>
					</div>

					{#if !promoted}
						<div class="spotlight-prompt">
							<p class="spotlight-text">
								Care about <strong>{seasonTitle(seasons[spotlightIndex], spotlightIndex)}</strong>?
								Promote it to its own Spore.
							</p>
							<button class="btn-promote-glow" onclick={promoteSpotlight}>
								promote {seasonTitle(seasons[spotlightIndex], spotlightIndex)} →
							</button>
							<button class="btn-quiet" onclick={() => handleStep('done')}>
								not now
							</button>
						</div>
					{:else}
						<div class="flight-viz">
							<div class="viz-node">❀ {grownSpore.title}</div>
							<div class="viz-line" class:active={lineActive}></div>
							<div class="viz-node child">❀ {promotedChildTitle}</div>
						</div>
						<p class="grown-note">
							A Line of Flight now connects them. Structure grows where you have something to say.
						</p>
						<button class="btn-enter" onclick={() => handleStep('done')}>continue →</button>
					{/if}
				{:else}
					<p class="grown-note">Your Spore is planted.</p>
					<button class="btn-enter" onclick={() => handleStep('done')}>continue →</button>
				{/if}
			</div>

		<!-- End screen -->
		{:else if step === 'done'}
			<div class="beat beat-centered">
				<span class="welcome-glyph">❀</span>
				<h1 class="welcome-title">This is your Garden now.</h1>
				<p class="welcome-text">Cast again whenever something catches you.</p>
				<button class="btn-enter" onclick={() => garden.completeOnboarding()}>
					Enter the Garden →
				</button>
			</div>
		{/if}
	</div>
</div>

<style>
	.onboarding-overlay {
		position: fixed;
		inset: 0;
		z-index: var(--g-z-overlay);
		background: var(--g-bg);
		overflow-y: auto;
		display: flex;
		justify-content: center;
	}

	.onboarding-frame {
		width: 100%;
		max-width: 720px;
		padding: var(--g-space-2xl) var(--g-space-lg);
		display: flex;
		flex-direction: column;
		gap: var(--g-space-xl);
	}

	.beat-track {
		display: flex;
		gap: var(--g-space-sm);
		justify-content: center;
	}

	.beat-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--g-border);
		transition: background var(--g-transition-medium);
	}

	.beat-dot.done { background: var(--g-flight-active); }
	.beat-dot.active { background: var(--g-flight); }

	.beat {
		display: flex;
		flex-direction: column;
		gap: var(--g-space-lg);
	}

	.beat-centered {
		align-items: center;
		text-align: center;
		gap: var(--g-space-md);
		padding-top: var(--g-space-2xl);
	}

	.welcome-glyph {
		font-size: 3rem;
		color: var(--g-flight);
	}

	.welcome-title {
		font-family: var(--g-font-display);
		font-size: clamp(2rem, 5vw, 3rem);
		font-weight: 400;
		color: var(--g-text);
		line-height: 1.15;
	}

	.welcome-text {
		font-size: 1.05rem;
		line-height: 1.7;
		color: var(--g-text-dim);
		max-width: 460px;
	}

	.btn-enter {
		margin-top: var(--g-space-md);
		background: var(--g-flight);
		color: #0d0d1a;
		border-radius: var(--g-radius-pill);
		padding: var(--g-space-sm) var(--g-space-xl);
		font-size: 1rem;
		font-weight: 600;
		align-self: center;
		transition: transform var(--g-transition-fast), box-shadow var(--g-transition-fast);
	}

	.btn-enter:hover {
		transform: translateY(-1px);
		box-shadow: var(--g-shadow-hover);
	}

	/* ── beat 5: grown ── */
	.onb-eyebrow {
		font-family: var(--g-font-mono);
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--g-flight);
	}

	.grown-title {
		font-family: var(--g-font-display);
		font-size: clamp(1.8rem, 4vw, 2.6rem);
		font-weight: 400;
		color: var(--g-text);
		line-height: 1.2;
	}

	.grown-body {
		font-size: 1rem;
		line-height: 1.7;
		color: var(--g-text-dim);
	}

	.tree-label {
		font-family: var(--g-font-mono);
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--g-muted);
		margin-bottom: var(--g-space-sm);
	}

	.season-list {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: var(--g-space-xs);
	}

	.season-row {
		display: flex;
		align-items: baseline;
		gap: var(--g-space-sm);
		padding: var(--g-space-sm) var(--g-space-md);
		background: var(--g-surface);
		border: 1px solid var(--g-border);
		border-radius: var(--g-radius-md);
		transition: border-color var(--g-transition-medium), box-shadow var(--g-transition-medium);
	}

	.season-row.spotlight {
		border-color: var(--g-flight);
		box-shadow: 0 0 0 1px var(--g-flight-soft), var(--g-shadow-flight);
		animation: pulse 2.4s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% { box-shadow: 0 0 0 1px var(--g-flight-soft), 0 0 8px rgba(240, 143, 184, 0.2); }
		50% { box-shadow: 0 0 0 1px var(--g-flight), 0 0 18px rgba(240, 143, 184, 0.45); }
	}

	.season-name {
		font-family: var(--g-font-display);
		font-size: 1.05rem;
		color: var(--g-text);
	}

	.season-meta {
		font-family: var(--g-font-mono);
		font-size: 0.72rem;
		color: var(--g-muted);
		margin-left: auto;
	}

	.spotlight-prompt {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--g-space-sm);
	}

	.spotlight-text {
		font-size: 1rem;
		color: var(--g-text-dim);
		line-height: 1.6;
	}

	.spotlight-text strong { color: var(--g-flight); font-weight: 600; }

	.btn-promote-glow {
		background: var(--g-flight);
		color: #0d0d1a;
		border-radius: var(--g-radius-pill);
		padding: var(--g-space-sm) var(--g-space-xl);
		font-size: 0.95rem;
		font-weight: 600;
		box-shadow: var(--g-shadow-flight);
		transition: transform var(--g-transition-fast), box-shadow var(--g-transition-fast);
	}

	.btn-promote-glow:hover {
		transform: translateY(-1px);
		box-shadow: 0 0 20px rgba(240, 143, 184, 0.55);
	}

	.btn-quiet {
		font-family: var(--g-font-mono);
		font-size: 0.78rem;
		color: var(--g-muted);
		transition: color var(--g-transition-fast);
	}

	.btn-quiet:hover { color: var(--g-text-dim); }

	/* ── promote → flight animation ── */
	.flight-viz {
		display: flex;
		align-items: center;
		gap: var(--g-space-sm);
		padding: var(--g-space-lg) 0;
		flex-wrap: wrap;
	}

	.viz-node {
		font-family: var(--g-font-display);
		font-size: 1rem;
		color: var(--g-text);
		background: var(--g-surface);
		border: 1px solid var(--g-border-strong);
		border-radius: var(--g-radius-pill);
		padding: var(--g-space-sm) var(--g-space-md);
		white-space: nowrap;
	}

	.viz-node.child {
		opacity: 0;
		animation: bud-in 0.5s var(--g-transition-spring) 0.45s forwards;
		border-color: var(--g-flight);
	}

	@keyframes bud-in {
		from { opacity: 0; transform: scale(0.8) translateX(-8px); }
		to { opacity: 1; transform: scale(1) translateX(0); }
	}

	.viz-line {
		flex: 1;
		min-width: 40px;
		height: 2px;
		background: var(--g-flight);
		transform: scaleX(0);
		transform-origin: left center;
		animation: draw-line 0.55s var(--g-transition-spring) forwards;
		box-shadow: 0 0 8px var(--g-flight);
		transition: background var(--g-transition-medium), box-shadow var(--g-transition-medium);
	}

	.viz-line.active {
		background: var(--g-flight-active);
		box-shadow: 0 0 10px var(--g-flight-active);
	}

	@keyframes draw-line {
		from { transform: scaleX(0); }
		to { transform: scaleX(1); }
	}

	.grown-note {
		font-size: 0.92rem;
		line-height: 1.6;
		color: var(--g-text-dim);
		font-style: italic;
	}
</style>
