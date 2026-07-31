<script lang="ts">
	import { store } from '$lib/store.svelte';
	import { syncState } from '$lib/sync.svelte';
	import TodayInstrument from '$lib/components/TodayInstrument.svelte';
	import DayPiles from '$lib/components/DayPiles.svelte';
	import RoutinesLab from '$lib/components/RoutinesLab.svelte';
	import SurgeWorkbench from '$lib/components/SurgeWorkbench.svelte';
	import EditionReview from '$lib/components/EditionReview.svelte';
	import Binder from '$lib/components/Binder.svelte';
	import TaskEditDrawer from '$lib/components/TaskEditDrawer.svelte';

	type CarillonSection = 'today' | 'piles' | 'routines' | 'surge' | 'review';

	const SECTIONS: Array<{
		id: CarillonSection;
		label: string;
		note: string;
		key: string;
	}> = [
		{ id: 'today', label: 'Today', note: 'observe', key: '1' },
		{ id: 'piles', label: 'Day piles', note: 'prepare', key: '2' },
		{ id: 'routines', label: 'Routines', note: 'fade', key: '3' },
		{ id: 'surge', label: 'Surge', note: 'capture', key: '4' },
		{ id: 'review', label: 'Editions', note: 'review', key: '5' }
	];

	let section = $state<CarillonSection>('today');
	let mainElement = $state<HTMLElement>();

	function setSection(next: CarillonSection): void {
		section = next;
		window.scrollTo({ top: 0, behavior: 'smooth' });
		requestAnimationFrame(() => mainElement?.focus({ preventScroll: true }));
	}

	function handleKeydown(event: KeyboardEvent): void {
		const target = event.target as HTMLElement | null;
		if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
		const match = SECTIONS.find((item) => item.key === event.key);
		if (match) {
			setSection(match.id);
			event.preventDefault();
		}
		if (event.key === 'Escape' && store.binderTab !== null) {
			store.closeBinder();
			event.preventDefault();
		}
	}

	let syncLabel = $derived.by(() => {
		if (!syncState.connected) return 'local only';
		if (syncState.syncing) return 'syncing';
		if (syncState.status === 'error') return 'sync needs attention';
		return 'phone + desktop';
	});
</script>

<svelte:window onkeydown={handleKeydown} />

<a class="skip-link" href="#carillon-main">skip to instrument</a>

<div class="carillon-shell" data-section={section}>
	<header class="app-header">
		<div class="brand-lockup">
			<a href="/" class="world-link" aria-label="Back to woodles.space">·space</a>
			<button type="button" class="brand" onclick={() => setSection('today')}>
				<span class="brand-bell" aria-hidden="true">
					<i></i>
					<b></b>
				</span>
				<span>
					<strong>Carillon</strong>
					<small>self-observation instrument</small>
				</span>
			</button>
		</div>

		<nav class="section-nav" aria-label="Carillon sections">
			{#each SECTIONS as item (item.id)}
				<button
					type="button"
					class:active={section === item.id}
					aria-current={section === item.id ? 'page' : undefined}
					onclick={() => setSection(item.id)}
				>
					<span>{item.label}</span>
					<small>{item.note} · {item.key}</small>
				</button>
			{/each}
		</nav>

		<div class="instrument-status">
			<div class="spore-readout" aria-label={`${store.sporeEvents.length} Carillon spores`}>
				<span aria-hidden="true">✦</span>
				<strong>{store.sporeEvents.length}</strong>
				<small>spores</small>
			</div>
			<button
				type="button"
				class="sync-readout"
				class:connected={syncState.connected}
				onclick={() => store.toggleBinder('sync')}
				aria-label={`Open sync panel, ${syncLabel}`}
			>
				<i aria-hidden="true"></i>
				<span>
					<small>data</small>
					<strong>{syncLabel}</strong>
				</span>
			</button>
		</div>
	</header>

	<main id="carillon-main" class="carillon-main" tabindex="-1" bind:this={mainElement}>
		{#if section === 'today'}
			<TodayInstrument onopenpiles={() => setSection('piles')} />
		{:else if section === 'piles'}
			<DayPiles />
		{:else if section === 'routines'}
			<RoutinesLab />
		{:else if section === 'surge'}
			<SurgeWorkbench />
		{:else}
			<EditionReview />
		{/if}
	</main>

	<footer class="app-footer">
		<p>
			<span>interval</span>
			<strong>{store.settings.samplingIntervalMinutes} min</strong>
			<i></i>
			<span>reinforcement</span>
			<strong>observation, never compliance</strong>
		</p>
		<p>local first · passphrase sync to Neon · private by default</p>
	</footer>

	<Binder />
	<TaskEditDrawer />
</div>

<style>
	.skip-link {
		position: fixed;
		top: 0.5rem;
		left: 0.5rem;
		z-index: 100;
		border-radius: 999px;
		background: var(--car-cream);
		padding: 0.45rem 0.75rem;
		color: var(--car-night);
		font-family: var(--car-mono);
		font-size: 0.65rem;
		text-decoration: none;
		transform: translateY(-200%);
	}

	.skip-link:focus {
		transform: translateY(0);
	}

	.carillon-shell {
		position: relative;
		min-height: 100vh;
		overflow: hidden;
		background:
			radial-gradient(circle at 8% 4%, rgba(240, 154, 184, 0.13), transparent 27rem),
			radial-gradient(circle at 92% 22%, rgba(113, 207, 184, 0.08), transparent 24rem),
			linear-gradient(180deg, #1d1428 0%, var(--car-night) 32%, #140d1d 100%);
		color: var(--car-cream);
	}

	.carillon-shell::before {
		position: fixed;
		inset: 0;
		background-image:
			linear-gradient(rgba(255, 246, 218, 0.025) 1px, transparent 1px),
			linear-gradient(90deg, rgba(255, 246, 218, 0.025) 1px, transparent 1px);
		background-size: 2rem 2rem;
		content: '';
		mask-image: linear-gradient(to bottom, black, transparent 75%);
		pointer-events: none;
	}

	.app-header {
		position: relative;
		z-index: 5;
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: clamp(1rem, 3vw, 2.4rem);
		width: min(100% - 2rem, 88rem);
		margin: 0 auto;
		padding: 0.85rem 0;
		border-bottom: 1px solid var(--car-line);
	}

	.brand-lockup {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.world-link {
		color: var(--car-mist);
		font-family: var(--car-mono);
		font-size: 0.6rem;
		letter-spacing: 0.13em;
		text-decoration: none;
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		color: var(--car-cream);
		text-align: left;
	}

	.brand-bell {
		position: relative;
		display: block;
		width: 1.85rem;
		height: 1.85rem;
		border: 1px solid var(--car-pink);
		border-radius: 50%;
	}

	.brand-bell i {
		position: absolute;
		top: 0.38rem;
		left: 0.52rem;
		width: 0.78rem;
		height: 0.72rem;
		border: 1px solid var(--car-pink);
		border-top-left-radius: 50%;
		border-top-right-radius: 50%;
		border-bottom: 0;
	}

	.brand-bell i::after {
		position: absolute;
		bottom: -0.15rem;
		left: -0.13rem;
		width: 1rem;
		border-top: 1px solid var(--car-pink);
		content: '';
	}

	.brand-bell b {
		position: absolute;
		bottom: 0.3rem;
		left: 0.82rem;
		width: 0.18rem;
		height: 0.18rem;
		border-radius: 50%;
		background: var(--car-pink);
	}

	.brand > span:last-child {
		display: grid;
	}

	.brand strong {
		font-family: var(--car-display);
		font-size: 1.4rem;
		font-weight: 500;
		letter-spacing: -0.02em;
		line-height: 1;
	}

	.brand small {
		margin-top: 0.15rem;
		color: var(--car-mist);
		font-family: var(--car-mono);
		font-size: 0.43rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.section-nav {
		display: flex;
		justify-content: center;
		gap: 0.2rem;
		scrollbar-width: none;
	}

	.section-nav::-webkit-scrollbar {
		display: none;
	}

	.section-nav button {
		display: grid;
		min-width: 5.2rem;
		gap: 0.05rem;
		border-radius: 0.65rem;
		padding: 0.38rem 0.58rem;
		color: var(--car-mist);
		text-align: left;
		transition:
			background 150ms ease,
			color 150ms ease;
	}

	.section-nav button:hover,
	.section-nav button.active {
		background: rgba(255, 246, 218, 0.065);
		color: var(--car-cream);
	}

	.section-nav button.active {
		box-shadow: inset 0 -1px var(--car-pink);
	}

	.section-nav span {
		font-family: var(--car-body);
		font-size: 0.67rem;
	}

	.section-nav small {
		font-family: var(--car-mono);
		font-size: 0.42rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.instrument-status {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.spore-readout {
		display: grid;
		grid-template-columns: auto auto;
		gap: 0 0.25rem;
		align-items: center;
	}

	.spore-readout > span {
		grid-row: 1 / 3;
		color: var(--car-pink);
		font-size: 0.78rem;
	}

	.spore-readout strong {
		font-family: var(--car-counter);
		font-size: 0.98rem;
		font-weight: 400;
		line-height: 1;
	}

	.spore-readout small {
		color: var(--car-mist);
		font-family: var(--car-mono);
		font-size: 0.4rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.sync-readout {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		border: 1px solid var(--car-line);
		border-radius: 999px;
		padding: 0.35rem 0.6rem;
		color: var(--car-cream);
		text-align: left;
	}

	.sync-readout > i {
		width: 0.42rem;
		height: 0.42rem;
		border: 1px solid var(--car-mist);
		border-radius: 50%;
	}

	.sync-readout.connected > i {
		border-color: var(--car-sage);
		background: var(--car-sage);
		box-shadow: 0 0 0 0.2rem rgba(113, 207, 184, 0.1);
	}

	.sync-readout > span {
		display: grid;
	}

	.sync-readout small {
		color: var(--car-mist);
		font-family: var(--car-mono);
		font-size: 0.38rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.sync-readout strong {
		font-family: var(--car-body);
		font-size: 0.56rem;
		font-weight: 500;
		white-space: nowrap;
	}

	.carillon-main {
		position: relative;
		z-index: 1;
		width: min(100% - 2rem, 84rem);
		min-height: calc(100vh - 10rem);
		margin: 0 auto;
		padding: clamp(1.2rem, 3vw, 2.4rem) 0 3rem;
		outline: none;
	}

	.app-footer {
		position: relative;
		z-index: 1;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		width: min(100% - 2rem, 84rem);
		margin: 0 auto;
		padding: 0.8rem 0 1.2rem;
		border-top: 1px solid var(--car-line);
		color: var(--car-mist);
		font-family: var(--car-mono);
		font-size: 0.45rem;
		letter-spacing: 0.06em;
	}

	.app-footer p:first-child {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.app-footer strong {
		color: var(--car-cream);
		font-weight: 400;
	}

	.app-footer i {
		width: 1.5rem;
		height: 1px;
		background: var(--car-line);
	}

	:global(.binder-tabs) {
		filter: saturate(0.72) brightness(0.92);
	}

	@media (max-width: 1050px) {
		.app-header {
			grid-template-columns: auto 1fr;
		}

		.section-nav {
			grid-column: 1 / -1;
			grid-row: 2;
			justify-content: flex-start;
			overflow-x: auto;
			padding-top: 0.45rem;
			border-top: 1px solid var(--car-line);
		}

		.instrument-status {
			justify-self: end;
		}
	}

	@media (max-width: 640px) {
		.app-header,
		.carillon-main,
		.app-footer {
			width: min(100% - 1rem, 84rem);
		}

		.world-link,
		.spore-readout {
			display: none;
		}

		.brand small {
			display: none;
		}

		.section-nav {
			position: sticky;
			left: 0;
			gap: 0.1rem;
		}

		.section-nav button {
			min-width: 4.55rem;
			padding: 0.34rem 0.42rem;
		}

		.app-footer {
			align-items: flex-start;
			flex-direction: column;
		}

		:global(.binder-tabs) {
			display: none;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.section-nav button {
			transition: none;
		}

		.skip-link,
		.carillon-shell * {
			scroll-behavior: auto;
		}
	}

	@media print {
		.app-header,
		.app-footer,
		:global(.binder-tabs),
		:global(.binder-panel),
		:global(.binder-backdrop) {
			display: none !important;
		}

		.carillon-shell,
		.carillon-main {
			width: 100%;
			min-height: 0;
			margin: 0;
			padding: 0;
			overflow: visible;
			background: #fff8e8;
		}

		.carillon-shell::before {
			display: none;
		}
	}
</style>
