<script lang="ts">
	import type { Creature } from '$lib/types';
	import { domainDef, rarityDef } from '$lib/content/domains';

	let { creature, interactive = false }: { creature: Creature; interactive?: boolean } = $props();

	let domain = $derived(domainDef(creature.domain));
	let rarity = $derived(rarityDef(creature.rarity));

	let displayName = $derived(creature.name.trim() || 'Unnamed Creature');
	let typeLine = $derived(creature.kind.trim() ? `Creature — ${creature.kind.trim()}` : 'Creature');
	let foil = $derived(creature.rarity === 'rare' || creature.rarity === 'mythic');
</script>

<article
	class="card"
	class:interactive
	class:foil
	style="--domain: var({domain.colorVar}); --rarity: var({rarity.colorVar});"
>
	<div class="card-inner">
		<!-- title bar -->
		<header class="title-bar">
			<h3 class="cname" title={displayName}>{displayName}</h3>
			<span class="cost" title="{creature.cost} essence">{creature.cost}</span>
		</header>

		<!-- art window -->
		<div class="art" class:empty={!creature.sprite}>
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
		<div class="type-line">
			<span class="domain-glyph" title={domain.name}>{domain.glyph}</span>
			<span class="type-text" title={typeLine}>{typeLine}</span>
			<span class="set-symbol" title={rarity.name}>{rarity.symbol}</span>
		</div>

		<!-- text box -->
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

		<!-- footer: found-in + power/toughness -->
		<footer class="card-foot">
			{#if creature.foundIn.trim()}
				<span class="found" title="found in {creature.foundIn.trim()}">⌖ {creature.foundIn.trim()}</span>
			{:else}
				<span class="found muted">the margins</span>
			{/if}
			<span class="pt" title="{creature.power} power · {creature.toughness} toughness">
				{creature.power}<span class="slash">/</span>{creature.toughness}
			</span>
		</footer>
	</div>
</article>

<style>
	.card {
		container-type: inline-size;
		position: relative;
		width: 100%;
		aspect-ratio: 63 / 88;
		border-radius: var(--b-radius-card);
		/* the frame: a domain-tinted plate under a gilt edge */
		background:
			linear-gradient(160deg, color-mix(in srgb, var(--domain) 22%, var(--b-surface)) 0%,
				var(--b-surface) 48%, var(--b-bg-2) 100%);
		box-shadow: var(--b-shadow-card);
		border: 1px solid var(--b-border-strong);
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
		font-family: var(--b-font-codex);
		font-weight: 600;
		font-size: 1.1em;
		line-height: 1.05;
		color: var(--b-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
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
</style>
