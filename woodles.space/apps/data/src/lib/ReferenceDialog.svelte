<script lang="ts">
	import { modal } from '@shared/modal';
	import type { ReferenceCandidate } from '../../../write/src/lib/references.svelte';

	let {
		query = $bindable(''),
		relating,
		browsing,
		candidates,
		loading,
		onBrowse,
		onPick,
		onClose
	}: {
		query?: string;
		/** Choosing a Relation value, rather than adding a referenced record. */
		relating: boolean;
		/** The whole list is showing, not only matches for `query`. */
		browsing: boolean;
		candidates: ReferenceCandidate[];
		loading: boolean;
		onBrowse: () => void;
		onPick: (candidate: ReferenceCandidate) => void;
		onClose: () => void;
	} = $props();
</script>

<div class="modal-shade" role="presentation" onclick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
	<div class="reference-dialog" role="dialog" aria-modal="true" aria-label="Choose a Woodles reference" use:modal>
		<span>WOODLES REFERENCE</span>
		<h2>{relating ? 'Choose a related thing' : 'Add a thing to this Collection'}</h2>
		<input bind:value={query} aria-label="Find a thing" placeholder="Search Bestiary, Marginalia, Thinking About, or Write" data-autofocus />
		{#if !relating && !browsing}<button class="picker-all" onclick={onBrowse}>Show available things</button>{/if}
		<div class="reference-list">
			{#each candidates as candidate (candidate.app + candidate.id)}
				<button onclick={() => onPick(candidate)}><strong>{candidate.text}</strong><small>{candidate.hint ?? candidate.app}</small></button>
			{:else}
				<p>{loading ? 'Looking through local Bestiary and Marginalia records…' : 'No matches. Refresh the HomeSuite window if a new source was just created.'}</p>
			{/each}
		</div>
	</div>
</div>
