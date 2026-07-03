<script lang="ts">
	import { bestiary } from '$lib/bestiary.svelte';
	import { gallery } from '$lib/gallery.svelte';
	import { beforeAfterCreatures } from '$lib/gallery';
	import SpriteInput from './SpriteInput.svelte';
	import GalleryDetail from './GalleryDetail.svelte';

	// A manual visit (sidebar) needs its own fetch — first-run routing in
	// +layout.svelte may already have loaded this before the view ever
	// mounts, and load() is a no-op once status is past 'idle'.
	$effect(() => {
		if (gallery.status === 'idle') void gallery.load();
	});

	let beforeAfter = $derived(beforeAfterCreatures(gallery.creatures));

	let detailId = $state<string | null>(null);
	let detailCreature = $derived(gallery.creatures.find((c) => c.id === detailId) ?? null);

	function handleDrop(dataUrl: string, pixelated: boolean): void {
		const c = bestiary.newCreatureFromSprite(dataUrl, pixelated);
		bestiary.autoStudioId = c.id;
		bestiary.openEditor(c.id);
	}
</script>

<div class="gallery">
	<header class="gallery-head">
		<h1 class="title">the gallery</h1>
		<p class="tagline">Z's bestiary, open for wandering</p>
		<p class="intro">
			Every creature on this shelf started the same way — someone dropped a picture of
			something, and the studio worked out how it belonged. Look around, then bring your
			own: the same drop zone Z used is waiting at the bottom of the page.
		</p>
	</header>

	{#if gallery.status === 'idle' || gallery.status === 'loading'}
		<p class="state-note">loading the gallery…</p>
	{:else if gallery.status === 'error'}
		<div class="state-note error">
			<p>the gallery couldn't be reached.</p>
			<button class="retry" onclick={() => gallery.load(true)}>⟳ try again</button>
		</div>
	{:else if gallery.status === 'empty'}
		<p class="state-note">nothing published here yet — check back soon.</p>
	{:else}
		<div class="grid">
			{#each gallery.creatures as c (c.id)}
				<button class="tile" onclick={() => (detailId = c.id)}>
					<img src={c.cardImage} alt={c.name.trim() || 'unnamed creature'} loading="lazy" />
				</button>
			{/each}
		</div>

		{#if beforeAfter.length > 0}
			<section class="before-after">
				<h2 class="section-title">before, and after</h2>
				<p class="section-sub">
					the same picture — one rough, one finished. this is the whole trick.
				</p>
				<div class="ba-row">
					{#each beforeAfter as c (c.id)}
						<button class="ba-pair" onclick={() => (detailId = c.id)}>
							<span class="ba-side">
								<img src={c.sourceImage} alt="{c.name.trim() || 'the creature'}, before" loading="lazy" />
								<span class="ba-label">before</span>
							</span>
							<span class="ba-arrow" aria-hidden="true">→</span>
							<span class="ba-side">
								<img src={c.cardImage} alt="{c.name.trim() || 'the creature'}, finished" loading="lazy" />
								<span class="ba-label">after</span>
							</span>
						</button>
					{/each}
				</div>
			</section>
		{/if}
	{/if}

	<section class="invitation">
		<h2 class="section-title">bring something of your own</h2>
		<p class="section-sub">
			drop a png of anything — a doodle, a photo, a screenshot of a character you love.
			the studio pulls it into shape and sets it on your own shelf, right alongside these
			worked examples.
		</p>
		<div class="drop-wrap">
			<SpriteInput sprite={null} onpick={handleDrop} onclear={() => {}} />
		</div>
	</section>
</div>

{#if detailCreature}
	<GalleryDetail creature={detailCreature} onclose={() => (detailId = null)} />
{/if}

<style>
	.gallery {
		padding: var(--b-space-xl) clamp(var(--b-space-lg), 4vw, var(--b-space-2xl)) var(--b-space-2xl);
		max-width: 1400px;
		margin: 0 auto;
	}

	.gallery-head {
		max-width: 42rem;
		margin: 0 auto var(--b-space-xl);
		text-align: center;
	}
	.title {
		font-family: var(--b-font-codex);
		font-weight: 600;
		font-size: clamp(1.8rem, 4vw, 2.7rem);
		color: var(--b-text);
		letter-spacing: 0.01em;
	}
	.tagline {
		margin-top: var(--b-space-xs);
		font-family: var(--b-font-mono);
		font-size: 0.8rem;
		letter-spacing: 0.04em;
		color: var(--b-gold);
	}
	.intro {
		margin-top: var(--b-space-md);
		font-family: var(--b-font-body);
		font-size: 1rem;
		line-height: 1.65;
		color: var(--b-text-dim);
	}

	.state-note {
		text-align: center;
		font-family: var(--b-font-body);
		font-style: italic;
		color: var(--b-text-dim);
		margin: var(--b-space-2xl) auto;
	}
	.state-note.error {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--b-space-sm);
		font-style: normal;
	}
	.retry {
		font-family: var(--b-font-mono);
		font-size: 0.78rem;
		color: var(--b-text-dim);
		border: 1px solid var(--b-border);
		border-radius: var(--b-radius-pill);
		padding: 0.4rem 0.9rem;
		transition: border-color var(--b-transition-fast), color var(--b-transition-fast);
	}
	.retry:hover { border-color: var(--b-gold); color: var(--b-gold); }

	/* ── the shelf, as proof ── */
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: clamp(var(--b-space-md), 2vw, var(--b-space-xl));
		margin-bottom: var(--b-space-2xl);
	}
	.tile {
		display: block;
		width: 100%;
		border-radius: var(--b-radius-card, 12px);
		transition: transform var(--b-transition-fast), filter var(--b-transition-fast);
	}
	.tile img {
		width: 100%;
		aspect-ratio: 63 / 88;
		object-fit: contain;
		border-radius: var(--b-radius-card, 12px);
		filter: drop-shadow(0 6px 16px rgba(206, 130, 175, 0.22));
	}
	.tile:hover { transform: translateY(-3px); }
	.tile:hover img { filter: drop-shadow(0 10px 24px rgba(206, 130, 175, 0.34)); }

	/* ── before / after spotlight ── */
	.before-after {
		margin-bottom: var(--b-space-2xl);
		text-align: center;
	}
	.section-title {
		font-family: var(--b-font-codex);
		font-size: 1.4rem;
		font-weight: 600;
		color: var(--b-text);
	}
	.section-sub {
		margin-top: 0.3rem;
		margin-bottom: var(--b-space-lg);
		font-family: var(--b-font-body);
		font-style: italic;
		font-size: 0.9rem;
		color: var(--b-text-dim);
	}
	.ba-row {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--b-space-xl);
	}
	.ba-pair {
		display: flex;
		align-items: center;
		gap: var(--b-space-sm);
		padding: var(--b-space-sm);
		border-radius: var(--b-radius-lg);
		transition: background var(--b-transition-fast);
	}
	.ba-pair:hover { background: var(--b-gold-soft); }
	.ba-side {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.3rem;
	}
	.ba-side img {
		width: 8rem;
		aspect-ratio: 63 / 88;
		object-fit: contain;
		border-radius: var(--b-radius-sm);
		background: var(--b-vellum);
		border: 1px solid var(--b-border);
	}
	.ba-label {
		font-family: var(--b-font-mono);
		font-size: 0.68rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--b-muted);
	}
	.ba-arrow {
		font-size: 1.3rem;
		color: var(--b-gold);
	}

	/* ── the invitation ── */
	.invitation {
		max-width: 30rem;
		margin: 0 auto;
		text-align: center;
	}
	.drop-wrap {
		margin-top: var(--b-space-lg);
		text-align: left;
	}

	@media (max-width: 680px) {
		.ba-row { gap: var(--b-space-lg); }
		.ba-side img { width: 6.5rem; }
	}
</style>
