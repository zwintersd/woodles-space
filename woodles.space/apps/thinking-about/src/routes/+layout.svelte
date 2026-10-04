<script lang="ts">
	import '$lib/style/tokens.css';
	import { initSync, syncState } from '$lib/sync.svelte';
	import { thinkingAbout } from '$lib/thinkingAbout.svelte';
	import { takeOfferedSittings } from '$lib/commitments.svelte';
	import { ARRIVALS_KEY, createArrivals } from '$lib/handoffs';
	import { onMount } from 'svelte';

	let { children } = $props();

	onMount(() => {
		// Publish once on load, not only on save — see the method's own note.
		thinkingAbout.publishShelf();
		// Sittings Carillon offered and a person accepted there. Runs before
		// sync so a same-origin accept shows immediately, and again is safe:
		// ingesting is idempotent by the ledger's own ids.
		void takeOfferedSittings((sittings) => thinkingAbout.ingestSittings(sittings));

		// Things handed over (the companion's "add to thinking about") land
		// only right after a hydrate that went through, or on a board with no
		// sync — never in the pre-sync slot above, because an arrival moves
		// `updatedAt` and hydrate keeps the newer board. See handoffs.ts.
		const arrivals = createArrivals({
			sync: syncState,
			catchUp: initSync,
			ingest: (items) => thinkingAbout.ingestHandoffs(items),
			// A held ?entry= link is settled by the first take that runs — not
			// by a load whose sync failed, when the arrival is still queued.
			onFirstTake: () => thinkingAbout.openPendingEntry()
		});
		void initSync().then(() => {
			arrivals.takeAfterLoadSync();
			return takeOfferedSittings((sittings) => thinkingAbout.ingestSittings(sittings));
		});

		// While open: kept in another tab (the companion's frame included), or
		// back from somewhere else. Each catches up with the server first.
		const onStorage = (event: StorageEvent) => {
			if (event.key === ARRIVALS_KEY) void arrivals.live();
		};
		const onFocus = () => void arrivals.live();
		window.addEventListener('storage', onStorage);
		window.addEventListener('focus', onFocus);
		return () => {
			window.removeEventListener('storage', onStorage);
			window.removeEventListener('focus', onFocus);
		};
	});
</script>

<div class="thinking-about-root">
	{@render children()}
</div>

<style>
	:global(*),
	:global(*::before),
	:global(*::after) {
		box-sizing: border-box;
		margin: 0;
		padding: 0;
	}

	:global(html),
	:global(body) {
		height: 100%;
	}

	:global(button) {
		font: inherit;
		color: inherit;
		background: none;
		border: none;
		cursor: pointer;
	}

	:global(button:disabled) {
		cursor: not-allowed;
		opacity: 0.5;
	}

	:global(input),
	:global(textarea),
	:global(select) {
		font: inherit;
		color: inherit;
		background: none;
		border: none;
		outline: none;
	}

	.thinking-about-root {
		min-height: 100vh;
		background: var(--ta-page-wash);
		color: var(--ta-text);
		font-family: var(--ta-font-sans);
		line-height: 1.5;
	}
</style>
