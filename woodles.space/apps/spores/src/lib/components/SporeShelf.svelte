<script lang="ts">
	import { garden } from '$lib/garden.svelte';
	import { ACCENT_COLOR, coverAccent, coverBlurb, coverGlyph } from '$lib/cover';
	import type { Spore } from '$lib/types';

	// Cover cards, ported from the Ologypedia bookcase. The point of the shelf
	// is that finished and unfinished sit side by side and both look like
	// something — a seed is dashed, not diminished.

	let { spores }: { spores: Spore[] } = $props();
</script>

<ul class="shelf">
	{#each spores as spore (spore.id)}
		{@const status = garden.statusOf(spore)}
		<li>
			<button
				class="card"
				data-status={status}
				style="--accent: {ACCENT_COLOR[coverAccent(spore)]}"
				onclick={() => garden.openSpore(spore.id)}
			>
				<span class="cover">
					<span class="glyph">{coverGlyph(spore)}</span>
				</span>
				<span class="title">{spore.title}</span>
				<span class="blurb">{coverBlurb(spore)}</span>
				<span class="status">
					<span class="dot"></span>
					{status}
				</span>
			</button>
		</li>
	{/each}
</ul>

<style>
	.shelf {
		list-style: none;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
		gap: var(--g-space-md);
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: var(--g-space-xs);
		width: 100%;
		height: 100%;
		text-align: left;
		padding: var(--g-space-md);
		background: var(--g-surface);
		border: 1px solid var(--g-border);
		border-radius: var(--g-radius-md);
		box-shadow: var(--g-shadow-card);
		cursor: pointer;
		transition:
			transform var(--g-transition-spring),
			box-shadow var(--g-transition-fast),
			border-color var(--g-transition-fast);
	}

	.card:hover {
		transform: translateY(-2px);
		border-color: var(--g-border-strong);
		box-shadow: var(--g-shadow-hover);
	}

	/* A seed is a legitimate finished state, so it is drawn differently, not
	   faintly — dashed like something deliberately left open. */
	.card[data-status='seed'] {
		border-style: dashed;
		box-shadow: none;
	}

	.cover {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 64px;
		margin-bottom: var(--g-space-xs);
		border-radius: var(--g-radius-sm);
		border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
		background: radial-gradient(
			ellipse 80% 70% at 50% 40%,
			color-mix(in srgb, var(--accent) 16%, var(--g-surface)),
			var(--g-bg) 72%
		);
	}

	.glyph {
		font-family: var(--g-font-display);
		font-size: 1.4rem;
		color: var(--accent);
	}

	.title {
		font-family: var(--g-font-display);
		font-size: 1.05rem;
		color: var(--g-text);
		line-height: 1.25;
	}

	.blurb {
		font-family: var(--g-font-body);
		font-size: 0.78rem;
		line-height: 1.5;
		color: var(--g-text-dim);
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.status {
		display: inline-flex;
		align-items: center;
		gap: var(--g-space-xs);
		margin-top: auto;
		padding-top: var(--g-space-xs);
		font-family: var(--g-font-mono);
		font-size: 0.62rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--g-muted);
	}

	.dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--g-muted);
	}

	[data-status='growing'] .dot {
		background: var(--g-flight-active);
	}

	[data-status='grown'] .dot {
		background: var(--g-flight);
	}

	@media (prefers-reduced-motion: reduce) {
		.card {
			transition: none;
		}
		.card:hover {
			transform: none;
		}
	}
</style>
