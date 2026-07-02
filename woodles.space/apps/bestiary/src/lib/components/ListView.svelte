<script lang="ts">
	import { bestiary } from '$lib/bestiary.svelte';
	import { domainDef, rarityDef } from '$lib/content/domains';
	import { formatPlainText } from '$lib/textformat';
	import type { Creature } from '$lib/types';

	let visible = $derived(bestiary.visibleCreatures);

	// Clipboard copy with transient confirmation per-row
	let copied = $state<string | null>(null);

	function copyCreature(c: Creature) {
		navigator.clipboard.writeText(formatPlainText(c)).then(() => {
			copied = c.id;
			setTimeout(() => { copied = null; }, 1400);
		});
	}
</script>

<div class="list-view" role="table" aria-label="creature list">
	<div class="list-head" role="row">
		<span class="col-sym" role="columnheader">rarity · domain</span>
		<span class="col-name" role="columnheader">name</span>
		<span class="col-meta" role="columnheader">type</span>
		<span class="col-cost" role="columnheader">cost</span>
		<span class="col-pt" role="columnheader">p/t</span>
		<span class="col-text" role="columnheader">abilities</span>
		<span class="col-actions" role="columnheader"><span class="sr-only">actions</span></span>
	</div>

	{#each visible as c (c.id)}
		{@const domain = domainDef(c.domain)}
		{@const rarity = rarityDef(c.rarity)}
		<div class="list-row" role="row">
			<span class="col-sym" role="cell">
				<span class="sym rarity-sym" style="color: var({rarity.colorVar})" title={rarity.name}>{rarity.symbol}</span>
				<span class="sym domain-sym" style="color: var({domain.colorVar})" title={domain.name}>{domain.glyph}</span>
			</span>

			<button
				class="col-name name-btn"
				role="cell"
				onclick={() => bestiary.openCodex(c.id)}
				title="read entry"
			>
				{#if c.published}<span class="pub-dot" title="published to the public gallery"></span>{/if}
				{#if c.name}{c.name}{:else}<span class="unnamed">(unnamed)</span>{/if}
			</button>

			<span class="col-meta kind" role="cell">{c.kind || '—'}</span>

			<span class="col-cost" role="cell">
				<span class="cost-badge">{c.cost}</span>
			</span>

			<span class="col-pt pt" role="cell">{c.power}/{c.toughness}</span>

			<span class="col-text abilities" role="cell" title={c.abilities || undefined}>
				{#if c.abilities}{c.abilities}{:else}<span class="none">—</span>{/if}
			</span>

			<span class="col-actions" role="cell">
				<button
					class="act-btn"
					onclick={() => copyCreature(c)}
					title="copy as text"
					aria-label="copy {c.name || 'creature'} as text"
				>
					{copied === c.id ? '✓' : '⎘'}
				</button>
				<button
					class="act-btn"
					onclick={() => bestiary.openCodex(c.id)}
					title="read entry"
					aria-label="read {c.name || 'creature'} entry"
				>✦</button>
				<button
					class="act-btn edit-btn"
					onclick={() => bestiary.openEditor(c.id)}
					title="edit card"
					aria-label="edit {c.name || 'creature'}"
				>✎</button>
			</span>
		</div>
	{/each}
</div>

<style>
	.sr-only {
		position: absolute;
		width: 1px; height: 1px;
		overflow: hidden;
		clip: rect(0,0,0,0);
		white-space: nowrap;
	}

	.list-view {
		font-family: var(--b-font-body);
		font-size: 0.88rem;
		border: 1px solid var(--b-border);
		border-radius: var(--b-radius-sm);
		overflow: hidden;
	}

	/* column layout — names are wide, abilities fill remaining */
	.list-head,
	.list-row {
		display: grid;
		grid-template-columns:
			52px          /* sym */
			minmax(120px, 180px) /* name */
			minmax(80px, 130px)  /* meta/type */
			36px          /* cost */
			42px          /* p/t */
			1fr           /* abilities */
			88px;         /* actions */
		align-items: center;
		gap: 0;
	}

	.list-head {
		background: var(--b-surface-2, var(--b-surface));
		border-bottom: 1px solid var(--b-border);
		padding: 0.35rem 0;
	}

	.list-head > * {
		padding: 0.25rem 0.6rem;
		font-family: var(--b-font-mono);
		font-size: 0.68rem;
		color: var(--b-muted);
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.list-row {
		border-bottom: 1px solid var(--b-rule, var(--b-border));
		transition: background var(--b-transition-fast);
		min-height: 2.4rem;
	}
	.list-row:last-child { border-bottom: none; }
	.list-row:hover { background: var(--b-surface-2, color-mix(in srgb, var(--b-bg) 60%, var(--b-surface))); }

	/* shared cell padding */
	.list-row > * {
		padding: 0.45rem 0.6rem;
		overflow: hidden;
	}

	/* column-specific */
	.col-sym {
		display: flex;
		gap: 0.3rem;
		align-items: center;
		justify-content: center;
		padding-left: 0.7rem;
	}

	.sym {
		font-size: 0.78rem;
		line-height: 1;
		flex-shrink: 0;
	}

	.col-name { overflow: hidden; }

	.name-btn {
		width: 100%;
		text-align: left;
		font-family: var(--b-font-codex);
		font-size: 0.92rem;
		font-weight: 600;
		color: var(--b-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		padding: 0.45rem 0.6rem;
		transition: color var(--b-transition-fast);
	}
	.name-btn:hover { color: var(--b-gold); }

	.kind {
		font-style: italic;
		color: var(--b-text-dim);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.col-cost {
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.cost-badge {
		font-family: var(--b-font-mono);
		font-size: 0.78rem;
		color: var(--b-text);
		background: var(--b-surface-2, var(--b-bg));
		border: 1px solid var(--b-border);
		border-radius: var(--b-radius-sm);
		padding: 0.1rem 0.35rem;
		min-width: 1.4rem;
		text-align: center;
	}

	.pt {
		font-family: var(--b-font-mono);
		font-size: 0.82rem;
		color: var(--b-text-dim);
		white-space: nowrap;
		text-align: center;
	}

	.abilities {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		color: var(--b-text-dim);
		font-size: 0.84rem;
	}

	.none { color: var(--b-muted); }
	.unnamed { color: var(--b-muted); font-style: italic; }
	.pub-dot {
		display: inline-block;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--b-biochemical);
		margin-right: 0.4rem;
		vertical-align: middle;
	}

	.col-actions {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 2px;
		padding-right: 0.7rem;
	}

	.act-btn {
		font-size: 0.78rem;
		color: var(--b-muted);
		border: 1px solid transparent;
		border-radius: var(--b-radius-sm);
		padding: 0.25rem 0.4rem;
		line-height: 1;
		transition:
			color var(--b-transition-fast),
			border-color var(--b-transition-fast),
			background var(--b-transition-fast);
	}
	.act-btn:hover {
		color: var(--b-text);
		border-color: var(--b-border);
		background: var(--b-surface);
	}
	.edit-btn:hover { color: var(--b-gold); border-color: var(--b-gold-soft); }

	@media (max-width: 760px) {
		.list-head,
		.list-row {
			grid-template-columns:
				44px
				1fr
				36px
				40px
				72px;
		}
		/* hide type and abilities on narrow viewports */
		.col-meta,
		.col-text { display: none; }
	}
</style>
