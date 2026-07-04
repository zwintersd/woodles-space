<script lang="ts">
	import { bestiary } from '$lib/bestiary.svelte';
	import { gallery } from '$lib/gallery.svelte';
	import PublishedCardPanel from './PublishedCardPanel.svelte';

	// The share-link destination (ROADMAP.md week 4: /bestiary?card=<id>),
	// resolved client-side against the published snapshot — the same one the
	// gallery reads. +layout.svelte loads the gallery and calls
	// bestiary.openCard(id) before this ever mounts; here we just look the id
	// up once that load settles.
	let creature = $derived(gallery.creatures.find((c) => c.id === bestiary.activeCreatureId) ?? null);
	let loading = $derived(gallery.status === 'idle' || gallery.status === 'loading');

	$effect(() => {
		if (creature) document.title = `${creature.name.trim() || 'Unnamed Creature'} · the bestiary · woodles.space`;
	});
</script>

<div class="card-view">
	<nav class="view-nav">
		<button class="nav-btn" onclick={() => bestiary.openGallery()}>← see the whole bestiary</button>
	</nav>

	{#if loading}
		<p class="state-note">loading…</p>
	{:else if creature}
		<div class="panel-wrap">
			<PublishedCardPanel {creature} />
		</div>
	{:else}
		<div class="not-found">
			<span class="nf-glyph">✶</span>
			<p class="nf-lead">This card couldn't be found.</p>
			<p class="nf-sub">It may have been unpublished, or the link's out of date.</p>
			<button class="nav-btn" onclick={() => bestiary.openGallery()}>← see the whole bestiary</button>
		</div>
	{/if}
</div>

<style>
	.card-view {
		padding: var(--b-space-xl) clamp(var(--b-space-lg), 4vw, var(--b-space-2xl)) var(--b-space-2xl);
		max-width: 56rem;
		margin: 0 auto;
	}

	.view-nav { margin-bottom: var(--b-space-xl); }
	.nav-btn {
		font-family: var(--b-font-mono);
		font-size: 0.78rem;
		color: var(--b-text-dim);
		border: 1px solid transparent;
		border-radius: var(--b-radius-sm);
		padding: 0.3rem 0.65rem;
		margin-left: -0.65rem;
		transition: color var(--b-transition-fast), border-color var(--b-transition-fast);
	}
	.nav-btn:hover { color: var(--b-gold); border-color: var(--b-gold-soft); }

	.state-note {
		text-align: center;
		font-family: var(--b-font-body);
		font-style: italic;
		color: var(--b-text-dim);
		margin: var(--b-space-2xl) auto;
	}

	.panel-wrap {
		background: var(--b-surface);
		border: 1px solid var(--b-border);
		border-radius: var(--b-radius-lg);
		box-shadow: var(--b-shadow-card);
		padding: var(--b-space-xl);
	}

	.not-found {
		text-align: center;
		max-width: 28rem;
		margin: var(--b-space-2xl) auto;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--b-space-sm);
	}
	.nf-glyph { font-size: 2.2rem; color: var(--b-gold); opacity: 0.6; }
	.nf-lead { font-family: var(--b-font-codex); font-size: 1.3rem; color: var(--b-text); }
	.nf-sub { font-family: var(--b-font-body); font-size: 0.92rem; color: var(--b-text-dim); }
	.not-found .nav-btn { margin-top: var(--b-space-md); margin-left: 0; border-color: var(--b-border); }
</style>
