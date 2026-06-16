<script lang="ts">
	import type { Creature } from '$lib/types';
	import { domainDef, rarityDef } from '$lib/content/domains';
	import { capacities, arc } from '$lib/content/stats';
	import { defaultCardStyle, cardStyleAttr } from '$lib/cardstyle';
	import StatusOverlay from './StatusOverlay.svelte';

	let { creature, interactive = false }: { creature: Creature; interactive?: boolean } = $props();

	let domain = $derived(domainDef(creature.domain));
	let rarity = $derived(rarityDef(creature.rarity));
	let style = $derived(creature.cardStyle ?? defaultCardStyle());

	let displayName = $derived(creature.name.trim() || 'Unnamed Creature');
	let typeLine = $derived(creature.kind.trim() ? `Creature — ${creature.kind.trim()}` : 'Creature');
	let foil = $derived(creature.rarity === 'rare' || creature.rarity === 'mythic');

	// the cold condition (0–10) drives the snow/frost/ice overlay; past 6 it also
	// blends the plate toward ice via --cold-shift (0 at cold 6 → 1 at cold 10).
	let cold = $derived(creature.status?.cold ?? 0);
	let coldShift = $derived(cold <= 6 ? 0 : Math.min(1, (cold - 6) / 4));

	// the art window, handed to the overlay so it can size & place the ice layers
	let artEl = $state<HTMLElement | null>(null);

	let styleAttr = $derived(
		`${cardStyleAttr(style, domain.colorVar, rarity.colorVar)}; --cold-shift: ${coldShift}`
	);
</script>

<article
	class="card frame-{style.frame} finish-{style.finish} tb-{style.textBox} tex-{style.texture} title-{style.titleAlign}"
	class:interactive
	class:foil
	style={styleAttr}
>
	<div class="card-inner">
		<!-- title bar -->
		<header class="title-bar">
			<h3 class="cname" title={displayName}>{displayName}</h3>
			<span class="cost" title="{creature.cost} essence">{creature.cost}</span>
		</header>

		<!-- art window -->
		<div class="art" class:empty={!creature.sprite} bind:this={artEl}>
			{#if creature.sprite}
				<img
					src={creature.sprite}
					alt={displayName}
					class:pixelated={creature.pixelated}
					draggable="false"
				/>
			{:else}
				<span class="art-glyph">{domain.glyph}</span>
				<span class="art-empty">awaiting a sprite</span>
			{/if}
		</div>

		<!-- type line -->
		{#if style.showTypeLine}
			<div class="type-line">
				<span class="domain-glyph" title={domain.name}>{domain.glyph}</span>
				<span class="type-text" title={typeLine}>{typeLine}</span>
				<span class="set-symbol" title={rarity.name}>{rarity.symbol}</span>
			</div>
		{/if}

		<!-- text box -->
		{#if style.textBox !== 'none'}
			<div class="text-box">
				{#if creature.abilities.trim()}
					<p class="abilities">{creature.abilities.trim()}</p>
				{/if}
				{#if creature.abilities.trim() && creature.flavor.trim()}
					<hr class="flavor-rule" />
				{/if}
				{#if creature.flavor.trim()}
					<p class="flavor">{creature.flavor.trim()}</p>
				{/if}
				{#if !creature.abilities.trim() && !creature.flavor.trim()}
					<p class="empty-text">no abilities written</p>
				{/if}
			</div>
		{/if}

		<!-- stat strip: the creature's interior, beneath the battle math -->
		{#if style.showStats}
			<div class="stat-strip">
				<div class="stat-group capacities">
					{#each capacities as s (s.id)}
						<span class="stat" style="--c: var({s.colorVar})">
							<span class="glyph">{s.glyph}</span>
							<span class="val">{creature.stats[s.id]}</span>
						</span>
					{/each}
				</div>
				<div class="divider" aria-hidden="true"></div>
				<div class="stat-group arc">
					{#each arc as s (s.id)}
						<span class="stat" style="--c: var({s.colorVar})">
							<span class="glyph">{s.glyph}</span>
							<span class="val">{creature.stats[s.id]}</span>
						</span>
					{/each}
				</div>
			</div>
		{/if}

		<!-- footer: found-in + power/toughness -->
		<footer class="card-foot">
			{#if style.showFoundIn}
				{#if creature.foundIn.trim()}
					<span class="found" title="found in {creature.foundIn.trim()}">⌖ {creature.foundIn.trim()}</span>
				{:else}
					<span class="found muted">the margins</span>
				{/if}
			{:else}
				<span class="found"></span>
			{/if}
			<span class="pt" title="{creature.power} power · {creature.toughness} toughness">
				{creature.power}<span class="slash">/</span>{creature.toughness}
			</span>
		</footer>

		<!-- status conditions: the cold overlay (snow / frost / ice), measured
		     against the art window. Hidden entirely when the creature is unafflicted. -->
		<StatusOverlay {cold} seed={creature.id} {artEl} />
	</div>

	<!-- decorative overlays: texture, then finish, above content, never interactive -->
	<div class="texture" aria-hidden="true"></div>
	<div class="finish-layer" aria-hidden="true"></div>
</article>

<style>
	.card {
		container-type: inline-size;
		position: relative;
		width: 100%;
		aspect-ratio: 63 / 88;
		border-radius: var(--card-radius);
		/* the frame: a domain-tinted plate under a gilt edge. cardstyle hands us
		   --plate-base; here we wash it toward ice as the creature freezes, the
		   oklch mix keeping every domain colour believable (capped near 40% so
		   even a fully-frozen card still reads as itself). --cold-shift is 0 for
		   any creature below cold 6, where this leaves --plate-base untouched. */
		--plate: linear-gradient(
				160deg,
				color-mix(in oklch, #cdeefb calc(var(--cold-shift, 0) * 40%), transparent) 0%,
				color-mix(in oklch, #bfe6f5 calc(var(--cold-shift, 0) * 40%), transparent) 100%
			),
			var(--plate-base);
		background: var(--plate);
		box-shadow: var(--b-shadow-card);
		border: var(--card-border-w) solid var(--card-border-color);
		overflow: hidden;
		user-select: none;
	}

	/* a faint sheen for rare and mythic cards */
	.card.foil::after {
		content: '';
		position: absolute;
		inset: 0;
		pointer-events: none;
		background: linear-gradient(125deg, transparent 38%,
			color-mix(in srgb, var(--rarity) 32%, transparent) 50%, transparent 62%);
		mix-blend-mode: multiply;
		opacity: 0.55;
		z-index: 3;
	}

	.card.interactive {
		cursor: pointer;
		transition: transform var(--b-transition-spring), box-shadow var(--b-transition-medium),
			border-color var(--b-transition-fast);
	}
	.card.interactive:hover {
		transform: translateY(-4px);
		box-shadow: var(--b-shadow-hover);
		border-color: var(--domain);
	}

	.card-inner {
		position: absolute;
		inset: 0;
		/* every inner size is in em; this makes them all scale with card width */
		font-size: 4.4cqw;
		display: flex;
		flex-direction: column;
		gap: 0.4em;
		padding: 0.6em;
		z-index: 1;
	}

	/* ── title bar ── */
	.title-bar {
		display: flex;
		align-items: center;
		gap: 0.4em;
		background: color-mix(in srgb, var(--domain) 16%, var(--b-bg-2));
		border: 1px solid var(--b-border-strong);
		border-radius: 0.5em;
		padding: 0.28em 0.5em;
	}
	.cname {
		flex: 1;
		min-width: 0;
		font-family: var(--title-font);
		font-weight: 600;
		font-size: 1.1em;
		line-height: 1.05;
		color: var(--title-color);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.title-center .cname { text-align: center; }
	.cost {
		flex-shrink: 0;
		display: grid;
		place-items: center;
		width: 1.7em;
		height: 1.7em;
		border-radius: 50%;
		font-family: var(--b-font-pixel);
		font-size: 1em;
		color: var(--b-on-accent);
		background: radial-gradient(circle at 35% 30%, var(--b-gold-bright), var(--domain));
		box-shadow: inset 0 0.08em 0.16em rgba(255, 255, 255, 0.6),
			inset 0 0 0 0.1em rgba(120, 60, 100, 0.18), 0 0.12em 0.3em rgba(206, 130, 175, 0.4);
	}

	/* ── art window ── */
	.art {
		position: relative;
		flex: 1 1 auto;
		min-height: 0;
		border-radius: 0.45em;
		border: 1px solid var(--b-border-strong);
		background:
			radial-gradient(120% 90% at 50% 0%, color-mix(in srgb, var(--domain) 30%, transparent),
				transparent 70%),
			var(--b-vellum);
		overflow: hidden;
		display: grid;
		place-items: center;
	}
	.art img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.art img.pixelated {
		image-rendering: pixelated;
		object-fit: contain;
	}
	.art.empty {
		flex-direction: column;
		gap: 0.3em;
	}
	.art-glyph {
		font-size: 2.6em;
		color: color-mix(in srgb, var(--domain) 60%, var(--b-muted));
		opacity: 0.5;
		line-height: 1;
	}
	.art-empty {
		font-family: var(--b-font-mono);
		font-size: 0.62em;
		letter-spacing: 0.08em;
		color: var(--b-muted);
	}

	/* ── type line ── */
	.type-line {
		display: flex;
		align-items: center;
		gap: 0.4em;
		background: color-mix(in srgb, var(--domain) 14%, var(--b-bg-2));
		border: 1px solid var(--b-border);
		border-radius: 0.4em;
		padding: 0.22em 0.5em;
	}
	.domain-glyph {
		flex-shrink: 0;
		color: var(--domain);
		font-size: 0.82em;
	}
	.type-text {
		flex: 1;
		min-width: 0;
		font-family: var(--b-font-codex);
		font-size: 0.74em;
		color: var(--b-text-dim);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.set-symbol {
		flex-shrink: 0;
		color: var(--rarity);
		font-size: 0.82em;
		text-shadow: 0 0 0.4em color-mix(in srgb, var(--rarity) 50%, transparent);
	}

	/* ── text box ── */
	.text-box {
		flex: 0 1 auto;
		min-height: 3.2em;
		max-height: 42%;
		overflow: hidden;
		background: linear-gradient(180deg, color-mix(in srgb, var(--b-vellum) 80%, var(--b-bg-2)),
			var(--b-bg-2));
		border: 1px solid var(--b-border);
		border-radius: 0.4em;
		padding: 0.4em 0.55em;
		display: flex;
		flex-direction: column;
		gap: 0.3em;
	}
	.abilities {
		font-family: var(--b-font-body);
		font-size: 0.64em;
		line-height: 1.32;
		color: var(--b-text);
		white-space: pre-wrap;
		overflow: hidden;
	}
	.flavor-rule {
		border: none;
		border-top: 1px solid var(--b-rule);
		margin: 0.1em 0;
	}
	.flavor {
		font-family: var(--b-font-body);
		font-style: italic;
		font-size: 0.62em;
		line-height: 1.3;
		color: var(--b-text-dim);
		overflow: hidden;
	}
	.empty-text {
		font-family: var(--b-font-mono);
		font-size: 0.58em;
		color: var(--b-muted);
		font-style: italic;
	}

	/* text-box variants */
	.tb-ghost .text-box {
		background: color-mix(in srgb, var(--b-surface) 32%, transparent);
		border-color: color-mix(in srgb, var(--b-text) 12%, transparent);
		backdrop-filter: blur(2px);
	}
	.tb-ink .text-box {
		background: rgba(18, 12, 26, 0.72);
		border-color: rgba(255, 255, 255, 0.14);
	}
	.tb-ink .abilities { color: #f1ebf7; }
	.tb-ink .flavor { color: #cdbfe0; }
	.tb-ink .flavor-rule { border-top-color: rgba(255, 255, 255, 0.16); }

	/* ── stat strip ── */
	.stat-strip {
		display: flex;
		align-items: center;
		gap: 0.5em;
		padding: 0.25em 0.35em;
		background: color-mix(in srgb, var(--domain) 8%, var(--b-bg-2));
		border: 1px solid var(--b-border);
		border-radius: 0.4em;
	}
	.stat-group {
		display: flex;
		align-items: center;
		gap: 0.5em;
		flex: 1;
	}
	.stat-group.arc {
		flex: 0 0 auto;
		gap: 0.6em;
		padding-left: 0.2em;
	}
	.stat {
		display: inline-flex;
		align-items: baseline;
		gap: 0.18em;
	}
	.stat .glyph {
		color: var(--c);
		font-size: 0.72em;
		line-height: 1;
	}
	.stat .val {
		font-family: var(--b-font-pixel);
		font-size: 0.74em;
		line-height: 1;
		color: var(--b-text);
	}
	.stat-group.arc .glyph { opacity: 0.78; }
	.divider {
		flex-shrink: 0;
		width: 1px;
		align-self: stretch;
		background: var(--b-border);
	}

	/* ── footer ── */
	.card-foot {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 0.5em;
		margin-top: auto;
	}
	.found {
		font-family: var(--b-font-mono);
		font-size: 0.56em;
		letter-spacing: 0.04em;
		color: var(--b-text-dim);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.found.muted {
		color: var(--b-muted);
		font-style: italic;
	}
	.pt {
		flex-shrink: 0;
		font-family: var(--b-font-pixel);
		font-size: 1.15em;
		line-height: 1;
		color: var(--b-text);
		background: color-mix(in srgb, var(--domain) 20%, var(--b-bg-2));
		border: 1px solid var(--b-border-strong);
		border-radius: 0.4em;
		padding: 0.18em 0.5em;
		box-shadow: 0 0.1em 0.28em rgba(206, 130, 175, 0.3);
	}
	.slash {
		color: var(--b-muted);
		margin: 0 0.05em;
	}

	/* ── texture overlay ── */
	.texture {
		position: absolute;
		inset: 0;
		pointer-events: none;
		border-radius: inherit;
		opacity: var(--tex-opacity);
		z-index: 2;
		display: none;
		background-size: cover;
	}
	.tex-paper .texture {
		display: block;
		background-image:
			radial-gradient(circle at 18% 22%, rgba(110, 80, 50, 0.05) 0, transparent 38%),
			radial-gradient(circle at 82% 64%, rgba(110, 80, 50, 0.05) 0, transparent 40%),
			repeating-linear-gradient(92deg, rgba(120, 90, 60, 0.035) 0 1px, transparent 1px 3px);
		mix-blend-mode: multiply;
	}
	.tex-linen .texture {
		display: block;
		background-image:
			repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.05) 0 1px, transparent 1px 4px),
			repeating-linear-gradient(90deg, rgba(0, 0, 0, 0.05) 0 1px, transparent 1px 4px);
		mix-blend-mode: multiply;
	}
	.tex-grain .texture {
		display: block;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E");
		background-size: 180px 180px;
		mix-blend-mode: soft-light;
	}
	.tex-noise .texture {
		display: block;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.5' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)'/%3E%3C/svg%3E");
		background-size: 150px 150px;
		mix-blend-mode: soft-light;
	}

	/* ── finishes ── */
	.finish-layer {
		position: absolute;
		inset: 0;
		pointer-events: none;
		border-radius: inherit;
		z-index: 4;
	}
	.finish-gloss .finish-layer {
		background: linear-gradient(125deg,
			rgba(255, 255, 255, calc(0.4 * var(--finish-amt))) 0%, transparent 36%,
			transparent 64%, rgba(255, 255, 255, calc(0.12 * var(--finish-amt))) 100%);
	}
	.finish-foil .finish-layer {
		background: repeating-linear-gradient(115deg,
			transparent 0 7px,
			color-mix(in srgb, var(--domain) 45%, transparent) 7px 9px,
			color-mix(in srgb, var(--rarity) 45%, transparent) 9px 11px);
		mix-blend-mode: overlay;
		opacity: var(--finish-amt);
	}
	.finish-rainbow .finish-layer {
		background: linear-gradient(125deg,
			#ff6b9d 0%, #ffd36b 22%, #6bffb0 44%, #6bb8ff 66%, #c79bff 88%, #ff6b9d 100%);
		mix-blend-mode: overlay;
		opacity: calc(0.6 * var(--finish-amt));
	}
	.finish-glow {
		box-shadow:
			0 0 calc(22px * var(--finish-amt)) color-mix(in srgb, var(--domain) 70%, transparent),
			0 0 calc(6px * var(--finish-amt)) color-mix(in srgb, var(--domain) 90%, transparent),
			var(--b-shadow-card);
	}
	.finish-glow .finish-layer {
		box-shadow: inset 0 0 calc(10px * var(--finish-amt))
			color-mix(in srgb, var(--domain) 55%, transparent);
	}

	/* ── frames ── */
	/* full art: the sprite fills the card; the panels float over it */
	.frame-fullart .art {
		position: absolute;
		inset: -0.62em;
		border: none;
		border-radius: inherit;
		/* sit beneath the in-flow panels so they float over the art */
		z-index: -1;
	}
	.frame-fullart .title-bar,
	.frame-fullart .type-line,
	.frame-fullart .stat-strip {
		background: color-mix(in srgb, var(--b-bg-2) 55%, transparent);
		backdrop-filter: blur(2px);
	}

	/* borderless: drop the outer edge, lean on the plate */
	.frame-borderless { border-width: 0; }

	/* minimal: flatten the internal chrome for a quiet card */
	.frame-minimal .title-bar,
	.frame-minimal .type-line,
	.frame-minimal .stat-strip {
		background: transparent;
		border-color: transparent;
	}
	.frame-minimal .pt {
		background: transparent;
		box-shadow: none;
		border-color: color-mix(in srgb, var(--domain) 35%, transparent);
	}

	/* cinema: a dark inset edge, art given room */
	.frame-cinema {
		box-shadow: inset 0 0 0 0.5em rgba(12, 8, 18, 0.85), var(--b-shadow-card);
	}
	.frame-cinema .card-inner { padding: 0.9em 0.8em; }
</style>
