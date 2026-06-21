<script lang="ts">
	import { bestiary } from '$lib/bestiary.svelte';
	import { domainDef, rarityDef } from '$lib/content/domains';
	import { coreStats, type CoreStat } from '$lib/content/stats';
	import { formatPlainText, formatMarkdown, downloadText } from '$lib/textformat';

	let creature = $derived(bestiary.activeCreature);
	let neighbours = $derived(
		bestiary.activeCreatureId ? bestiary.codexNeighbours(bestiary.activeCreatureId) : { prev: null, next: null }
	);

	let domain = $derived(creature ? domainDef(creature.domain) : null);
	let rarity = $derived(creature ? rarityDef(creature.rarity) : null);

	// Clipboard feedback
	let copiedText = $state(false);
	let copiedMd = $state(false);

	function copyText() {
		if (!creature) return;
		navigator.clipboard.writeText(formatPlainText(creature)).then(() => {
			copiedText = true;
			setTimeout(() => { copiedText = false; }, 1400);
		});
	}

	function copyMarkdown() {
		if (!creature) return;
		navigator.clipboard.writeText(formatMarkdown(creature)).then(() => {
			copiedMd = true;
			setTimeout(() => { copiedMd = false; }, 1400);
		});
	}

	function downloadEntry() {
		if (!creature) return;
		const slug = (creature.name || 'creature').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
		downloadText(formatPlainText(creature), `${slug}.txt`);
	}

	function statVal(id: CoreStat): number {
		if (!creature) return 0;
		return creature.stats[id];
	}
</script>

{#if creature && domain && rarity}
	<div class="codex">
		<!-- Nav bar -->
		<div class="codex-nav">
			<div class="nav-left">
				<button class="nav-btn back" onclick={() => bestiary.openCollection()}>
					← collection
				</button>
				{#if neighbours.prev}
					<button class="nav-btn" onclick={() => bestiary.openCodex(neighbours.prev!)} title="previous creature">
						‹ prev
					</button>
				{/if}
				{#if neighbours.next}
					<button class="nav-btn" onclick={() => bestiary.openCodex(neighbours.next!)} title="next creature">
						next ›
					</button>
				{/if}
			</div>
			<div class="nav-right">
				<button class="nav-btn edit" onclick={() => bestiary.openEditor(creature!.id)}>
					edit card ✎
				</button>
			</div>
		</div>

		<!-- Entry -->
		<article class="entry">
			<!-- Header -->
			<header class="entry-head">
				<div class="identity-line">
					<span class="rarity-sym" style="color: var({rarity.colorVar})" title={rarity.name}>{rarity.symbol}</span>
					<span class="domain-pip" style="color: var({domain.colorVar})" title={domain.name}>{domain.glyph}</span>
					<span class="kind">{creature.kind || 'Creature'}</span>
				</div>
				<h1 class="creature-name">{#if creature.name}{creature.name}{:else}<span class="unnamed">(unnamed)</span>{/if}</h1>
				<div class="stats-line">
					<span class="stat-chip rarity" style="--c: var({rarity.colorVar})">{rarity.name}</span>
					<span class="dot">·</span>
					<span class="stat-chip domain" style="--c: var({domain.colorVar})">{domain.name}</span>
					<span class="dot">·</span>
					<span class="stat-chip">Cost {creature.cost}</span>
					<span class="dot">·</span>
					<span class="stat-chip pt">{creature.power}/{creature.toughness}</span>
				</div>
			</header>

			<hr class="rule" />

			<!-- Abilities -->
			{#if creature.abilities.trim()}
				<section class="section abilities-section">
					<p class="abilities-text">{creature.abilities}</p>
				</section>
			{/if}

			<!-- Flavor -->
			{#if creature.flavor.trim()}
				<section class="section flavor-section">
					<p class="flavor-text">"{creature.flavor}"</p>
				</section>
			{/if}

			<!-- Found in -->
			{#if creature.foundIn.trim()}
				<section class="section found-section">
					<p class="found-text"><span class="found-label">Found in:</span> {creature.foundIn}</p>
				</section>
			{/if}

			{#if creature.abilities.trim() || creature.flavor.trim() || creature.foundIn.trim()}
				<hr class="rule" />
			{/if}

			<!-- Stats -->
			<section class="section stats-section">
				<h2 class="section-title">Stats</h2>
				<div class="stats-grid">
					{#each coreStats as stat}
						{@const val = statVal(stat.id)}
						<div class="stat-row" style="--stat-c: var({stat.colorVar})">
							<span class="stat-glyph" style="color: var({stat.colorVar})">{stat.glyph}</span>
							<span class="stat-name">{stat.name}</span>
							<span class="stat-bar-wrap">
								<span class="stat-bar" style="width: {val * 10}%"></span>
							</span>
							<span class="stat-val">{val}</span>
						</div>
						{#each stat.substats as sub}
							{@const override = creature?.stats.substats[sub.id]}
							{#if override !== undefined}
								<div class="sub-row">
									<span class="sub-name">{sub.name}</span>
									<span class="sub-val">{override}</span>
								</div>
							{/if}
						{/each}
					{/each}
				</div>
			</section>

			<hr class="rule" />

			<!-- Export bar -->
			<footer class="export-bar">
				<span class="export-label">export / copy</span>
				<button class="export-btn" onclick={copyText}>
					{copiedText ? '✓ copied' : '⎘ copy text'}
				</button>
				<button class="export-btn" onclick={copyMarkdown}>
					{copiedMd ? '✓ copied' : '⎘ copy markdown'}
				</button>
				<button class="export-btn" onclick={downloadEntry}>
					↓ download .txt
				</button>
			</footer>
		</article>
	</div>
{:else}
	<div class="empty-codex">
		<p>No creature selected.</p>
		<button onclick={() => bestiary.openCollection()}>← back to collection</button>
	</div>
{/if}

<style>
	.codex {
		max-width: 680px;
		margin: 0 auto;
		padding: var(--b-space-lg) clamp(var(--b-space-md), 4vw, var(--b-space-xl)) var(--b-space-2xl);
	}

	/* ── nav bar ── */
	.codex-nav {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--b-space-sm);
		margin-bottom: var(--b-space-xl);
		padding-bottom: var(--b-space-md);
		border-bottom: 1px solid var(--b-rule, var(--b-border));
	}
	.nav-left, .nav-right { display: flex; gap: var(--b-space-sm); align-items: center; }

	.nav-btn {
		font-family: var(--b-font-mono);
		font-size: 0.76rem;
		color: var(--b-text-dim);
		border: 1px solid transparent;
		border-radius: var(--b-radius-sm);
		padding: 0.3rem 0.65rem;
		transition: color var(--b-transition-fast), border-color var(--b-transition-fast);
	}
	.nav-btn:hover { color: var(--b-text); border-color: var(--b-border); }
	.nav-btn.back:hover { color: var(--b-gold); border-color: var(--b-gold-soft); }
	.nav-btn.edit { color: var(--b-gold); }
	.nav-btn.edit:hover { border-color: var(--b-gold); background: var(--b-gold-soft); }

	/* ── entry header ── */
	.entry-head { margin-bottom: var(--b-space-lg); }

	.identity-line {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		margin-bottom: var(--b-space-sm);
		font-family: var(--b-font-mono);
		font-size: 0.8rem;
	}
	.rarity-sym { font-size: 0.7rem; }
	.domain-pip { font-size: 0.85rem; }
	.kind { color: var(--b-text-dim); letter-spacing: 0.04em; }

	.creature-name {
		font-family: var(--b-font-codex);
		font-size: clamp(1.8rem, 5vw, 2.6rem);
		font-weight: 600;
		color: var(--b-text);
		letter-spacing: 0.01em;
		line-height: 1.1;
		margin-bottom: var(--b-space-sm);
	}
	.unnamed { color: var(--b-muted); font-style: italic; }

	.stats-line {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
		align-items: center;
		font-family: var(--b-font-mono);
		font-size: 0.78rem;
	}
	.dot { color: var(--b-muted); }

	.stat-chip {
		color: var(--b-text-dim);
		padding: 0.1rem 0;
	}
	.stat-chip.rarity,
	.stat-chip.domain { color: var(--c); }
	.stat-chip.pt {
		font-weight: 600;
		color: var(--b-text);
	}

	/* ── rule ── */
	.rule {
		border: none;
		border-top: 1px solid var(--b-rule, var(--b-border));
		margin: var(--b-space-lg) 0;
	}

	/* ── sections ── */
	.section { margin-bottom: var(--b-space-md); }
	.section:last-of-type { margin-bottom: 0; }

	.section-title {
		font-family: var(--b-font-mono);
		font-size: 0.7rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--b-muted);
		margin-bottom: var(--b-space-sm);
	}

	.abilities-text {
		font-family: var(--b-font-body);
		font-size: 1rem;
		line-height: 1.65;
		color: var(--b-text);
		white-space: pre-wrap;
	}

	.flavor-text {
		font-family: var(--b-font-body);
		font-style: italic;
		font-size: 0.95rem;
		line-height: 1.65;
		color: var(--b-text-dim);
	}

	.found-text {
		font-family: var(--b-font-mono);
		font-size: 0.8rem;
		color: var(--b-muted);
	}
	.found-label { color: var(--b-text-dim); }

	/* ── stats grid ── */
	.stats-grid {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.stat-row {
		display: grid;
		grid-template-columns: 1.2rem 5rem 1fr 2rem;
		align-items: center;
		gap: 0.6rem;
	}
	.stat-glyph {
		font-size: 0.75rem;
		text-align: center;
	}
	.stat-name {
		font-family: var(--b-font-mono);
		font-size: 0.78rem;
		color: var(--b-text-dim);
	}
	.stat-bar-wrap {
		height: 4px;
		background: var(--b-border);
		border-radius: 2px;
		overflow: hidden;
	}
	.stat-bar {
		display: block;
		height: 100%;
		background: var(--stat-c);
		border-radius: 2px;
		transition: width 0.3s ease;
	}
	.stat-val {
		font-family: var(--b-font-mono);
		font-size: 0.82rem;
		color: var(--b-text);
		text-align: right;
	}

	.sub-row {
		display: grid;
		grid-template-columns: 1.2rem 5rem 1fr 2rem;
		align-items: center;
		gap: 0.6rem;
		padding-left: 1.8rem;
		opacity: 0.75;
	}
	.sub-name {
		font-family: var(--b-font-mono);
		font-size: 0.73rem;
		color: var(--b-text-dim);
		grid-column: 2;
	}
	.sub-val {
		font-family: var(--b-font-mono);
		font-size: 0.76rem;
		color: var(--b-text-dim);
		grid-column: 4;
		text-align: right;
	}

	/* ── export bar ── */
	.export-bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--b-space-sm);
	}

	.export-label {
		font-family: var(--b-font-mono);
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--b-muted);
		margin-right: var(--b-space-xs);
	}

	.export-btn {
		font-family: var(--b-font-mono);
		font-size: 0.76rem;
		color: var(--b-text-dim);
		border: 1px solid var(--b-border);
		border-radius: var(--b-radius-pill);
		padding: 0.3rem 0.75rem;
		transition:
			color var(--b-transition-fast),
			border-color var(--b-transition-fast),
			background var(--b-transition-fast);
	}
	.export-btn:hover {
		color: var(--b-gold);
		border-color: var(--b-gold);
		background: var(--b-gold-soft);
	}

	/* ── empty ── */
	.empty-codex {
		text-align: center;
		padding: var(--b-space-2xl);
		font-family: var(--b-font-body);
		color: var(--b-text-dim);
	}
</style>
