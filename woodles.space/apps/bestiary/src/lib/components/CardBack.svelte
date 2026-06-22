<script lang="ts">
	import type { Domain } from '$lib/content/domains';
	import { domainDef } from '$lib/content/domains';
	import { bestiary } from '$lib/bestiary.svelte';

	let { domain }: { domain: Domain } = $props();
	let def = $derived(domainDef(domain));
	let back = $derived(bestiary.getCardBack(domain));
	let customArt = $derived(back?.dataUrl ?? null);
	let border = $derived(back?.border ?? 'none');
</script>

<div
	class="card-back"
	class:fx-pulse={border === 'pulse'}
	class:fx-shimmer={border === 'shimmer'}
	class:fx-halo={border === 'halo'}
	class:fx-drift={border === 'drift'}
	style="--dc: var({def.colorVar})"
>
	{#if customArt}
		<img class="back-art" src={customArt} alt="" aria-hidden="true" />
	{/if}

	<!-- decorative default design, hidden when custom art is present -->
	<div class="back-frame" class:hidden={!!customArt}>
		<span class="corner tl" aria-hidden="true"></span>
		<span class="corner tr" aria-hidden="true"></span>
		<span class="corner bl" aria-hidden="true"></span>
		<span class="corner br" aria-hidden="true"></span>
		<div class="medallion">
			<div class="medallion-ring">
				<span class="back-glyph">{def.glyph}</span>
			</div>
			<span class="back-domain">{def.name}</span>
			<span class="back-label">bestiary</span>
		</div>
	</div>

	<!-- fx overlay: always on top, handled by ::after on .card-back -->
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

	/* ── custom art ── */
	.back-art {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		border-radius: inherit;
	}

	/* ── default CSS design ── */
	.back-frame.hidden { display: none; }

	.back-frame {
		position: absolute;
		inset: 5%;
		border: 1px solid color-mix(in srgb, var(--dc) 35%, transparent);
		border-radius: 5px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

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

	/* ═══════════════════════════════════════════
	   ANIMATED FX — all via ::after on .card-back
	   The card has overflow:hidden so anything
	   that overflows is cleanly clipped.
	   ═══════════════════════════════════════════ */

	.card-back.fx-pulse::after,
	.card-back.fx-shimmer::after,
	.card-back.fx-halo::after,
	.card-back.fx-drift::after {
		content: '';
		position: absolute;
		pointer-events: none;
		z-index: 30;
	}

	/* ── pulse: breathing inner-edge glow ── */
	@keyframes cb-pulse {
		0%, 100% { opacity: 0.3; }
		50%       { opacity: 1; }
	}
	.card-back.fx-pulse::after {
		inset: 0;
		border-radius: inherit;
		box-shadow:
			inset 0 0 1.8em 0.5em color-mix(in srgb, var(--dc) 60%, transparent),
			inset 0 0 0.6em 0.1em color-mix(in srgb, var(--dc) 45%, transparent),
			inset 0 0 0.25em 0      color-mix(in srgb, var(--dc) 80%, white);
		animation: cb-pulse 3.2s ease-in-out infinite;
	}

	/* ── shimmer: slow diagonal silver light sweep ── */
	@keyframes cb-shimmer {
		0%        { transform: translateX(-160%) skewX(-18deg); opacity: 0; }
		8%        { opacity: 1; }
		55%       { opacity: 0.9; }
		60%, 100% { transform: translateX(210%) skewX(-18deg); opacity: 0; }
	}
	.card-back.fx-shimmer::after {
		top: -10%;
		left: 0;
		width: 55%;
		height: 120%;
		background: linear-gradient(
			105deg,
			transparent 10%,
			rgba(255, 255, 255, 0.04) 30%,
			rgba(255, 255, 255, 0.13) 50%,
			rgba(255, 255, 255, 0.04) 70%,
			transparent 90%
		);
		animation: cb-shimmer 7s ease-in-out infinite;
		transform: translateX(-160%) skewX(-18deg);
	}

	/* ── halo: slow rotating conic sweep (holographic) ── */
	@keyframes cb-halo {
		to { transform: rotate(360deg); }
	}
	.card-back.fx-halo::after {
		/* oversized so the rotating gradient fills the card from every angle */
		top: -50%;
		left: -50%;
		width: 200%;
		height: 200%;
		background: conic-gradient(
			from 0deg at 50% 50%,
			transparent                                        0deg,
			color-mix(in srgb, var(--dc) 22%, transparent)   30deg,
			transparent                                       70deg,
			transparent                                      180deg,
			color-mix(in srgb, var(--dc) 14%, transparent)  220deg,
			transparent                                      260deg
		);
		mix-blend-mode: screen;
		animation: cb-halo 14s linear infinite;
	}

	/* ── drift: a slow-floating domain-tinted veil ── */
	@keyframes cb-drift {
		0%   { transform: translate(  0%,   0%) scale(1.00); opacity: 0.45; }
		25%  { transform: translate( -7%,   5%) scale(1.08); opacity: 0.65; }
		50%  { transform: translate(  5%,  -6%) scale(0.96); opacity: 0.5;  }
		75%  { transform: translate( -4%,  -3%) scale(1.05); opacity: 0.7;  }
		100% { transform: translate(  0%,   0%) scale(1.00); opacity: 0.45; }
	}
	.card-back.fx-drift::after {
		top: -20%;
		left: -20%;
		width: 140%;
		height: 140%;
		background: radial-gradient(
			ellipse 75% 60% at 40% 45%,
			color-mix(in srgb, var(--dc) 32%, transparent),
			transparent 68%
		);
		mix-blend-mode: screen;
		animation: cb-drift 11s ease-in-out infinite;
	}
</style>
