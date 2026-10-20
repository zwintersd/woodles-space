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
	import ShelfArrival from '$lib/components/ShelfArrival.svelte';
	import Onboarding from '$lib/components/onboarding/Onboarding.svelte';
	import { onboarding } from '$lib/onboarding.store.svelte';
	import { Arrival, arrival } from '$lib/arrival.svelte';
	import { thinkingAboutShelf } from '$lib/thinkingAboutShelf.svelte';
	import { onMount } from 'svelte';
	import { stopBells } from '$lib/bells';

	type CarillonSection = 'today' | 'piles' | 'routines' | 'surge' | 'review';

	const SECTIONS: Array<{
		id: CarillonSection;
		label: string;
		note: string;
		key: string;
		/** the pane of glass this section is set in */
		jewel: string;
	}> = [
		{ id: 'today', label: 'Today', note: 'observe', key: '1', jewel: 'amethyst' },
		{ id: 'piles', label: 'Day piles', note: 'prepare', key: '2', jewel: 'teal' },
		{ id: 'routines', label: 'Routines', note: 'use & edit', key: '3', jewel: 'teal' },
		{ id: 'surge', label: 'Surge', note: 'capture', key: '4', jewel: 'ruby' },
		{ id: 'review', label: 'Editions', note: 'review', key: '5', jewel: 'amethyst' }
	];

	let section = $state<CarillonSection>('today');
	let mainElement = $state<HTMLElement>();
	let refreshReturnFocus: HTMLElement | null = null;

	// Capture the opener before the binder closes and removes its contents.
	$effect.pre(() => {
		if (!onboarding.isRefreshing) return;
		const active = document.activeElement;
		refreshReturnFocus = active instanceof HTMLElement ? active : null;
		if (refreshReturnFocus?.closest('#binder-panel')) {
			refreshReturnFocus = document.querySelector<HTMLElement>(
				'.binder-tab[aria-controls="binder-panel"][aria-expanded="true"]'
			);
		}
	});

	function manageRefreshDialog(node: HTMLElement) {
		const bodyOverflow = document.body.style.overflow;
		const rootOverflow = document.documentElement.style.overflow;
		document.body.style.overflow = 'hidden';
		document.documentElement.style.overflow = 'hidden';

		$effect(() => {
			onboarding.stage;
			node.scrollTop = 0;
			node.focus({ preventScroll: true });
		});

		function trapTab(event: KeyboardEvent) {
			if (event.key !== 'Tab') return;
			const controls = Array.from(node.querySelectorAll<HTMLElement>(
				'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), ' +
				'select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'
			)).filter((element) => element.checkVisibility() && !element.closest('[inert]'));
			const current = controls.indexOf(document.activeElement as HTMLElement);
			if (controls.length === 0) {
				event.preventDefault();
				node.focus();
			} else if (event.shiftKey && current <= 0) {
				event.preventDefault();
				controls[controls.length - 1].focus();
			} else if (!event.shiftKey && (current === -1 || current === controls.length - 1)) {
				event.preventDefault();
				controls[0].focus();
			}
		}

		node.addEventListener('keydown', trapTab);
		return {
			destroy() {
				node.removeEventListener('keydown', trapTab);
				document.body.style.overflow = bodyOverflow;
				document.documentElement.style.overflow = rootOverflow;
				queueMicrotask(() => {
					if (onboarding.isRefreshing) return;
					const target = refreshReturnFocus?.isConnected &&
						refreshReturnFocus.checkVisibility() && !refreshReturnFocus.closest('[inert]')
						? refreshReturnFocus
						: document.querySelector<HTMLElement>('.sync-readout');
					target?.focus({ preventScroll: true });
				});
			}
		};
	}

	onMount(() => {
		// Arriving with a reference from Thinking About. The shelf is refreshed
		// so the entry can be named, but the arrival opens either way — the tasks
		// already scheduled are the answer, and they don't depend on the shelf
		// having reached this device.
		const entryId = Arrival.parse(window.location.href);
		if (!entryId) return;
		arrival.open(entryId);
		Arrival.clearFromAddressBar();
		void thinkingAboutShelf.refresh();
	});

	function setSection(next: CarillonSection): void {
		section = next;
		window.scrollTo({ top: 0, behavior: 'smooth' });
		requestAnimationFrame(() => mainElement?.focus({ preventScroll: true }));
	}

	function handleKeydown(event: KeyboardEvent): void {
		if (onboarding.isRefreshing) {
			if (event.key === 'Escape') {
				onboarding.closeRefresh();
				event.preventDefault();
			}
			return;
		}

		const target = event.target as HTMLElement | null;
		// The bells panel is all selects and sliders; Escape from one of them still closes it.
		// Other panels keep their fields' Escape (DayPlan's draft would be lost).
		if (event.key === 'Escape' && store.binderTab === 'bells' && target?.closest('[data-testid="bell-settings"]')) {
			store.closeBinder();
			event.preventDefault();
			return;
		}
		if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;

		const match = store.binderTab === null ? SECTIONS.find((item) => item.key === event.key) : undefined;
		if (match) {
			setSection(match.id);
			event.preventDefault();
		}

		if (event.key === 'Escape' && arrival.active) {
			arrival.close();
			event.preventDefault();
		}

		if (event.key === 'Escape' && store.binderTab !== null) {
			store.closeBinder();
			event.preventDefault();
		}
	}

	/**
	 * While a bell sounds, Escape only stops it. Caught on the way down, so no
	 * other Escape handler (the new-task composer's discard, a panel close)
	 * also acts on the same key press.
	 */
	function stopBellOnEscape(event: KeyboardEvent): void {
		if (event.key !== 'Escape' || !store.bellSounding) return;
		stopBells();
		event.preventDefault();
		event.stopImmediatePropagation();
	}

	let syncLabel = $derived.by(() => {
		if (!syncState.connected) return 'local only';
		if (syncState.syncing) return 'syncing';
		if (syncState.status === 'error') return 'sync needs attention';
		return 'phone + desktop';
	});
</script>

<svelte:window onkeydown={handleKeydown} onkeydowncapture={stopBellOnEscape} />

{#if !store.settings.onboardingComplete}
	<Onboarding />
{:else}
	<a class="skip-link" href="#carillon-main" inert={onboarding.isRefreshing}>skip to content</a>

	<div class="carillon-shell" data-section={section} inert={onboarding.isRefreshing}>
		<div class="glass-transom" aria-hidden="true"></div>
		<div class="window-light" aria-hidden="true"><i></i><b></b></div>
		<div class="study-window" aria-hidden="true"></div>
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
						<small>days, routines & ideas</small>
					</span>
				</button>
			</div>

			<nav class="section-nav" aria-label="Carillon sections">
				{#each SECTIONS as item (item.id)}
					<button
						type="button"
						class:active={section === item.id}
						aria-current={section === item.id ? 'page' : undefined}
						style:--jewel="var(--car-glass-{item.jewel})"
						onclick={() => setSection(item.id)}
					>
						<span>{item.label}</span>
						<small>{item.note} · {item.key}</small>
					</button>
				{/each}
			</nav>

			<div class="instrument-status">
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
				<TodayInstrument
					onopenpiles={() => setSection('piles')}
					onopenroutines={() => setSection('routines')}
					onopensurge={() => setSection('surge')}
				/>
			{:else if section === 'piles'}
				<DayPiles />
			{:else if section === 'routines'}
				<RoutinesLab />
			{:else if section === 'surge'}
				<SurgeWorkbench />
			{:else}
				<EditionReview onopenpiles={() => setSection('piles')} onopenroutines={() => setSection('routines')} onopensurge={() => setSection('surge')} />
			{/if}
		</main>

		<footer class="app-footer">
			<p>
				<span>interval</span>
				<strong>{store.settings.samplingIntervalMinutes} min</strong>
				<i></i>
				<span>records</span>
				<strong>editable</strong>
			</p>
			<span class="footer-ornament" aria-hidden="true"></span>
			<p>saved locally · optional passphrase sync</p>
		</footer>

		<Binder onopenpiles={() => setSection('piles')} />
		<TaskEditDrawer />
		<ShelfArrival />

	</div>
	{#if onboarding.isRefreshing}
		<div
			class="refresh-overlay"
			role="dialog"
			aria-modal="true"
			aria-label="refresh setup"
			tabindex="-1"
			use:manageRefreshDialog
		>
			<Onboarding />
		</div>
	{/if}
{/if}

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

	/* An aubergine cabinet above the hour's writing desk. The glass casts
	   shaped, still light, leaving the parchment sheets clear to write on. */
	.carillon-shell {
		position: relative;
		min-height: 100vh;
		overflow: hidden;
		background:
			radial-gradient(ellipse 30rem 42rem at 103% 13%, color-mix(in srgb, var(--car-glass-teal) 14%, transparent), transparent 75%),
			radial-gradient(ellipse 32rem 30rem at -10% 65%, color-mix(in srgb, var(--car-glass-amethyst) 12%, transparent), transparent 75%),
			linear-gradient(
				180deg,
				var(--car-ground-top) 0%,
				var(--car-night) 32%,
				var(--car-ground-bottom) 100%
			);
		color: var(--car-cream);
		transition:
			background 900ms linear,
			color 900ms linear;
	}

	/* One oversized engraved chart, cropped at the desk's edge. */
	.carillon-shell::before {
		position: absolute;
		top: 23rem;
		left: -19rem;
		width: 48rem;
		height: 48rem;
		background: var(--car-orn-chart) center / contain no-repeat;
		content: '';
		opacity: 0.2;
		pointer-events: none;
	}

	/* the grain and tea-stain mottling of old parchment */
	.carillon-shell::after {
		position: fixed;
		inset: 0;
		background-image: var(--car-parchment-grain), var(--car-parchment-mottle);
		background-size: 240px 240px, 720px 720px;
		content: '';
		opacity: var(--car-grain-strength, 1);
		pointer-events: none;
	}

	/* Recognizable mullions stay in the light, instead of a rainbow haze. */
	.window-light {
		position: absolute;
		top: 0;
		right: 0;
		left: 0;
		height: min(150vh, 100%);
		overflow: hidden;
		mix-blend-mode: var(--car-window-blend);
		opacity: var(--car-window-strength);
		pointer-events: none;
	}

	.window-light i {
		position: absolute;
		top: 5rem;
		right: -6rem;
		width: 30rem;
		height: 50rem;
		border-radius: 70% 70% 0 0;
		background:
			repeating-linear-gradient(0deg, transparent 0 7rem, rgba(50, 29, 55, 0.4) 7rem 7.22rem),
			linear-gradient(90deg, var(--car-glass-teal) 0 29%, transparent 29% 31%, var(--car-glass-amethyst) 31% 68%, transparent 68% 70%, var(--car-glass-teal) 70%);
		filter: blur(3px);
		-webkit-mask-image: linear-gradient(180deg, black, transparent 80%);
		mask-image: linear-gradient(180deg, black, transparent 80%);
		opacity: 0.5;
		transform: rotate(32deg) skewY(-12deg);
		transform-origin: top center;
	}

	.window-light b {
		position: absolute;
		top: 10rem;
		left: -8rem;
		width: 32rem;
		height: 24rem;
		background: radial-gradient(ellipse, color-mix(in srgb, var(--car-glass-amber) 30%, transparent), transparent 68%);
		opacity: 0.3;
	}

	.study-window {
		position: absolute;
		top: 11rem;
		right: -7rem;
		width: 24rem;
		height: 34rem;
		background: var(--car-orn-window) center top / contain no-repeat;
		opacity: 0.17;
		pointer-events: none;
	}

	/* a leaded transom of jewel panes across the top of the instrument */
	.glass-transom {
		position: relative;
		z-index: 5;
		height: 0.45rem;
		border-bottom: 2px solid var(--car-lead);
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.38), rgba(255, 255, 255, 0) 55%, rgba(0, 0, 0, 0.16)),
			var(--car-glass-strip);
		box-shadow: 0 1px 0 var(--car-furniture-line);
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
		padding: 1rem 0 0.85rem;
		border-bottom: 3px double var(--car-furniture-line);
		color: var(--car-furniture-ink);
	}

	.app-header::before {
		position: absolute;
		z-index: -1;
		top: -0.45rem;
		bottom: -3px;
		left: 50%;
		width: 100vw;
		background:
			radial-gradient(ellipse 25rem 20rem at 10% 0%, rgba(137, 61, 94, 0.28), transparent 75%),
			linear-gradient(105deg, var(--car-furniture-deep), var(--car-furniture) 45%, #2e172b);
		box-shadow: 0 0.65rem 1.75rem rgba(34, 17, 36, 0.17);
		content: '';
		transform: translateX(-50%);
	}

	.brand-lockup {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.world-link {
		color: var(--car-furniture-muted);
		font-family: var(--car-mono);
		font-size: 0.6rem;
		letter-spacing: 0.13em;
		text-decoration: none;
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		color: var(--car-furniture-ink);
		text-align: left;
	}

	/* a rose window: eight jewel panes held in lead, a vellum medallion,
	   and the bell set in the middle of it in garnet */
	.brand-bell {
		position: relative;
		display: block;
		flex: none;
		width: 2.7rem;
		height: 2.7rem;
		border-radius: 50%;
		background:
			radial-gradient(circle at 32% 26%, rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0) 42%),
			radial-gradient(
				circle closest-side,
				var(--car-glass-cream) 0 52%,
				var(--car-lead) 52% 59%,
				transparent 59%
			),
			repeating-conic-gradient(from 22.5deg, var(--car-lead) 0 4deg, transparent 4deg 45deg),
			conic-gradient(
				from 22.5deg,
				var(--car-glass-ruby) 0 45deg,
				var(--car-glass-amber) 45deg 90deg,
				var(--car-glass-emerald) 90deg 135deg,
				var(--car-glass-sapphire) 135deg 180deg,
				var(--car-glass-amethyst) 180deg 225deg,
				var(--car-glass-rose) 225deg 270deg,
				var(--car-glass-teal) 270deg 315deg,
				var(--car-glass-amber) 315deg 360deg
			);
		box-shadow:
			0 0 0 2px var(--car-lead),
			0 0 0 3.5px var(--car-gilt),
			0 0 1.1rem var(--car-glow-warm);
		transition: transform 600ms cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.brand:hover .brand-bell {
		transform: rotate(45deg);
	}

	.brand-bell i {
		position: absolute;
		top: 0.81rem;
		left: 1.07rem;
		width: 0.56rem;
		height: 0.56rem;
		border: 1.5px solid var(--car-lead);
		border-top-left-radius: 50%;
		border-top-right-radius: 50%;
		border-bottom: 0;
		background: var(--car-glass-ruby);
		transition: transform 600ms cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.brand:hover .brand-bell i {
		transform: rotate(-45deg);
	}

	.brand-bell i::after {
		position: absolute;
		bottom: -0.14rem;
		left: -0.2rem;
		width: 0.86rem;
		border-top: 1.5px solid var(--car-lead);
		content: '';
	}

	.brand-bell b {
		position: absolute;
		top: 1.45rem;
		left: 1.26rem;
		width: 0.18rem;
		height: 0.18rem;
		border-radius: 50%;
		background: var(--car-gilt);
	}

	.brand > span:last-child {
		display: grid;
	}

	/* the wordmark is set in glazed glass — see --carillon-glass in tokens.css */
	.brand strong {
		font-family: var(--car-wordmark);
		font-palette: --carillon-glass-lit;
		font-size: 1.75rem;
		font-weight: 600;
		letter-spacing: 0.01em;
		line-height: 1;
	}

	.brand small {
		margin-top: 0.15rem;
		color: var(--car-furniture-muted);
		font-family: var(--car-mono);
		font-size: 0.49rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.section-nav {
		display: flex;
		justify-content: center;
		gap: 0.35rem;
		scrollbar-width: none;
	}

	.section-nav::-webkit-scrollbar {
		display: none;
	}

	/* each section is a pane of its own jewel: a quarry of it marks the
	   tab, and the open section is set entirely in that glass, arched like
	   a lancet and held in lead */
	.section-nav button {
		position: relative;
		display: grid;
		grid-template-columns: auto 1fr;
		column-gap: 0.4rem;
		min-width: 5.9rem;
		min-height: 4.15rem;
		row-gap: 0.05rem;
		align-content: end;
		border: 1px solid var(--car-furniture-line);
		border-radius: 3.2rem 3.2rem 0.3rem 0.3rem;
		background: linear-gradient(180deg, color-mix(in srgb, var(--jewel) 36%, transparent), rgba(15, 8, 24, 0.35));
		padding: 1.1rem 0.7rem 0.6rem;
		color: var(--car-furniture-ink);
		text-align: left;
		box-shadow: inset 0 0 0 3px rgba(13, 9, 20, 0.45);
		transition:
			background 150ms ease,
			color 150ms ease,
			border-color 150ms ease;
	}

	.section-nav button::after {
		position: absolute;
		inset: 0.3rem;
		border: 1px solid color-mix(in srgb, var(--car-furniture-line) 60%, transparent);
		border-radius: inherit;
		content: '';
		pointer-events: none;
	}

	.section-nav button::before {
		grid-row: 1 / span 2;
		align-self: center;
		width: 0.48rem;
		height: 0.48rem;
		border: 1.5px solid var(--car-lead);
		background:
			linear-gradient(135deg, rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0) 60%),
			var(--jewel);
		content: '';
		transform: rotate(45deg);
	}

	.section-nav button:hover {
		border-color: #dbbb7d;
		background: color-mix(in srgb, var(--jewel) 65%, var(--car-furniture));
		color: var(--car-furniture-ink);
	}

	.section-nav button:focus-visible,
	.brand:focus-visible,
	.world-link:focus-visible,
	.sync-readout:focus-visible {
		outline: 2px solid var(--car-furniture-ink);
		outline-offset: 3px;
	}

	.section-nav button.active {
		border-color: #dbbb7d;
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0) 48%, rgba(0, 0, 0, 0.14)),
			var(--jewel);
		color: var(--car-glass-cream);
		box-shadow:
			inset 0 0 0 3px rgba(24, 11, 32, 0.45),
			0 0.3rem 1rem color-mix(in srgb, var(--jewel) 35%, transparent);
	}

	.section-nav button.active::before {
		border-color: var(--car-glass-cream);
		background: var(--car-glass-cream);
	}

	.section-nav span {
		font-family: var(--car-body);
		font-size: 0.75rem;
	}

	.section-nav button.active span {
		font-weight: 600;
	}

	.section-nav small {
		font-family: var(--car-mono);
		font-size: 0.47rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--car-furniture-muted);
	}

	.instrument-status {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.sync-readout {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		border: 1px solid var(--car-furniture-line);
		border-radius: 0.2rem;
		background: rgba(11, 7, 19, 0.3);
		padding: 0.45rem 0.65rem;
		color: var(--car-furniture-ink);
		text-align: left;
	}

	.sync-readout > i {
		width: 0.42rem;
		height: 0.42rem;
		border: 1.5px solid var(--car-furniture-muted);
		transform: rotate(45deg);
	}

	.sync-readout.connected > i {
		border-color: var(--car-lead);
		background: var(--car-glass-emerald);
		box-shadow: 0 0 0.45rem color-mix(in srgb, var(--car-glass-emerald) 55%, transparent);
	}

	.sync-readout > span {
		display: grid;
	}

	.sync-readout small {
		color: var(--car-furniture-muted);
		font-family: var(--car-mono);
		font-size: 0.45rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.sync-readout strong {
		font-family: var(--car-body);
		font-size: 0.63rem;
		font-weight: 500;
		white-space: nowrap;
	}

	.carillon-main {
		position: relative;
		z-index: 1;
		width: min(100% - 2rem, 84rem);
		min-height: calc(100vh - 10rem);
		margin: 0 auto;
		padding: 1.55rem 0 1.5rem;
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
		border-top: 3px double color-mix(in srgb, var(--car-gilt) 55%, transparent);
		color: var(--car-mist);
		font-family: var(--car-mono);
		font-size: 0.45rem;
		letter-spacing: 0.06em;
	}

	/* The ribbon spine has its own margin, clear of every field and action. */
	@media (min-width: 641px) {
		.carillon-main,
		.app-footer {
			width: min(calc(100% - 7rem), 84rem);
			margin-left: max(1rem, calc((100% - 89rem) / 2));
			margin-right: 6rem;
		}
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
		width: 0.36rem;
		height: 0.36rem;
		margin: 0 0.3rem;
		border: 1px solid var(--car-lead);
		background: var(--car-glass-amber);
		transform: rotate(45deg);
	}

	/* a small celestial clasp between the footer's two lines */
	.footer-ornament {
		flex: none;
		width: 8rem;
		height: 0.8rem;
		background: var(--car-orn-divider) center / contain no-repeat;
	}

	.carillon-main :global(summary::marker) {
		color: var(--car-glass-rose);
	}

	.refresh-overlay {
		position: fixed;
		inset: 0;
		z-index: var(--pl-z-modal);
		overflow-y: auto;
		overscroll-behavior: contain;
		background: var(--p-bg);
		outline: none;
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
			border-top: 1px solid var(--car-furniture-line);
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

		 .world-link { display:none; }

		.brand small {
			display: none;
		}

		.section-nav {
			position: sticky;
			left: 0;
			gap: 0.35rem;
			padding-bottom: 0.2rem;
		}

		.section-nav button {
			flex: none;
			min-width: 6rem;
			min-height: 3.6rem;
			padding: 0.75rem 0.6rem 0.55rem;
			column-gap: 0.32rem;
		}

		.study-window {
			top: 15rem;
			right: -11rem;
			opacity: 0.12;
		}

		.carillon-shell::before {
			left: -23rem;
			opacity: 0.12;
		}

		.app-footer {
			align-items: flex-start;
			flex-direction: column;
			padding-bottom: 6rem;
		}

		.footer-ornament {
			display: none;
		}

		/* The binder's panels are a desk surface, not a phone one — but new task
		   lives in that strip now, and it is the only way in to the composer
		   from anywhere in the instrument. So the panel tabs go and it stays. */
		:global(.binder-tabs .binder-tab:not(.binder-tab-add)) {
			display: none;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.section-nav button,
		.brand-bell,
		.brand-bell i {
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

		.carillon-shell::before,
		.carillon-shell::after,
		.glass-transom,
		.window-light,
		.study-window {
			display: none;
		}
	}
</style>
