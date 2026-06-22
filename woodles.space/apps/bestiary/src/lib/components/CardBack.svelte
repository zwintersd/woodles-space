<script lang="ts">
	import type { Domain } from '$lib/content/domains';
	import { domainDef } from '$lib/content/domains';
	import { bestiary } from '$lib/bestiary.svelte';

	let { domain }: { domain: Domain } = $props();
	let def = $derived(domainDef(domain));
	let customArt = $derived(bestiary.getCardBack(domain));
</script>

<div class="card-back" style="--dc: var({def.colorVar})">
	{#if customArt}
		<img class="back-art" src={customArt.dataUrl} alt="" aria-hidden="true" />
	{/if}
	<!-- inner decorative border (shown as fallback or overlay when no custom art) -->
	<div class="back-frame" class:hidden={!!customArt}>
		<!-- corner ornaments -->
		<span class="corner tl" aria-hidden="true"></span>
		<span class="corner tr" aria-hidden="true"></span>
		<span class="corner bl" aria-hidden="true"></span>
		<span class="corner br" aria-hidden="true"></span>

		<!-- central medallion -->
		<div class="medallion">
			<div class="medallion-ring">
				<span class="back-glyph">{def.glyph}</span>
			</div>
			<span class="back-domain">{def.name}</span>
			<span class="back-label">bestiary</span>
		</div>
	</div>
</div>

<style>
	.card-back {
		width: 100%;
		aspect-ratio: 63 / 88;
		border-radius: var(--b-radius-card, 10px);
		overflow: hidden;
		position: relative;
		container-type: inline-size;
		font-size: 4.4cqw;

		/* layered background: subtle cross-hatch grain over a domain radial glow */
		background:
			repeating-linear-gradient(
				-45deg,
				transparent 0px,
				transparent 6px,
				color-mix(in srgb, var(--dc) 4%, transparent) 6px,
				color-mix(in srgb, var(--dc) 4%, transparent) 7px
			),
			radial-gradient(
				ellipse 72% 58% at 50% 44%,
				color-mix(in srgb, var(--dc) 28%, #2a1228) 0%,
				#130a13 70%,
				#0e080e 100%
			);
	}

	.back-art {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		border-radius: inherit;
	}

	.back-frame.hidden { display: none; }

	/* ── inner frame ── */
	.back-frame {
		position: absolute;
		inset: 5%;
		border: 1px solid color-mix(in srgb, var(--dc) 35%, transparent);
		border-radius: 5px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	/* corner ornaments — four tiny squares at the inner frame corners */
	.corner {
		position: absolute;
		width: 0.5em;
		height: 0.5em;
		border-color: color-mix(in srgb, var(--dc) 55%, transparent);
		border-style: solid;
		border-width: 0;
	}
	.corner.tl { top: -1px; left: -1px; border-top-width: 1.5px; border-left-width: 1.5px; }
	.corner.tr { top: -1px; right: -1px; border-top-width: 1.5px; border-right-width: 1.5px; }
	.corner.bl { bottom: -1px; left: -1px; border-bottom-width: 1.5px; border-left-width: 1.5px; }
	.corner.br { bottom: -1px; right: -1px; border-bottom-width: 1.5px; border-right-width: 1.5px; }

	/* ── central design ── */
	.medallion {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.55em;
	}

	.medallion-ring {
		width: 3.8em;
		height: 3.8em;
		border-radius: 50%;
		border: 1px solid color-mix(in srgb, var(--dc) 45%, transparent);
		box-shadow:
			0 0 1.2em color-mix(in srgb, var(--dc) 22%, transparent),
			inset 0 0 0.8em color-mix(in srgb, var(--dc) 14%, transparent);
		background: color-mix(in srgb, var(--dc) 8%, transparent);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.back-glyph {
		font-size: 1.65em;
		color: color-mix(in srgb, var(--dc) 90%, #fff);
		text-shadow: 0 0 0.6em color-mix(in srgb, var(--dc) 60%, transparent);
		line-height: 1;
	}

	.back-domain {
		font-family: var(--b-font-mono);
		font-size: 0.52em;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: color-mix(in srgb, var(--dc) 65%, #fff);
		opacity: 0.75;
	}

	.back-label {
		font-family: var(--b-font-codex);
		font-size: 0.46em;
		letter-spacing: 0.14em;
		color: #fff;
		opacity: 0.18;
		margin-top: -0.2em;
	}
</style>
