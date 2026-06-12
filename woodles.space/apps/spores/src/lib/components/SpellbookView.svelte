<script lang="ts">
	import { garden } from '$lib/garden.svelte';
	import type { Spore, Spellbook } from '$lib/types';
	import { formatDate, formatDateShort } from '$lib/utils';

	let sb = $derived(garden.activeSpellbook);
	let spores = $derived(sb ? garden.sporesInSpellbook(sb.id) : []);

	let showNew = $state(false);
	let newTitle = $state('');

	function handleNew(e: Event) {
		e.preventDefault();
		if (!newTitle.trim() || !sb) return;
		const spore = garden.addSpore({
			title: newTitle.trim(),
			spellbookIds: [sb.id]
		});
		newTitle = '';
		showNew = false;
		garden.openSpore(spore.id);
	}

	function handleOpen(spore: Spore) {
		garden.openSpore(spore.id);
	}

	function handleDelete(e: Event, sb: Spellbook) {
		e.stopPropagation();
		if (confirm(`Delete spellbook "${sb.title}"? Spores will not be deleted.`)) {
			garden.deleteSpellbook(sb.id);
		}
	}

	// Archetype-aware sort
	let sorted = $derived(
		sb?.archetype === 'diary'
			? [...spores].sort((a, b) => b.created.localeCompare(a.created))
			: [...spores].sort((a, b) => a.title.localeCompare(b.title))
	);
</script>

{#if sb}
	<section class="spellbook-view">
		<header class="view-header">
			<button class="back-btn" onclick={() => garden.openGarden()}>← garden</button>
			<div class="header-main">
				<h2 class="view-title">{sb.title}</h2>
				<span class="arch-tag">{sb.archetype}</span>
			</div>
			<div class="header-actions">
				<button class="btn-new" onclick={() => { showNew = true; newTitle = ''; }}>
					+ spore
				</button>
				<button class="btn-danger-ghost" onclick={(e) => handleDelete(e, sb!)}>
					delete
				</button>
			</div>
		</header>

		{#if showNew}
			<form class="new-spore-form" onsubmit={handleNew}>
				<input
					autofocus
					class="new-input"
					type="text"
					placeholder={sb.archetype === 'diary' ? 'today…' : sb.archetype === 'media' ? 'title…' : 'new spore…'}
					bind:value={newTitle}
				/>
				<div class="form-actions">
					<button type="submit" class="btn-primary" disabled={!newTitle.trim()}>create</button>
					<button type="button" class="btn-ghost" onclick={() => (showNew = false)}>cancel</button>
				</div>
			</form>
		{/if}

		{#if sorted.length === 0 && !showNew}
			<div class="empty-state">
				<p class="empty-hint">No spores yet.</p>
			</div>
		{:else if sb.archetype === 'diary'}
			<ul class="diary-list">
				{#each sorted as spore (spore.id)}
					<li>
						<button class="diary-entry" onclick={() => handleOpen(spore)}>
							<span class="diary-date">{formatDate(spore.created)}</span>
							<span class="diary-title">{spore.title}</span>
							{#if spore.body}
								<p class="diary-preview">{spore.body.slice(0, 120)}{spore.body.length > 120 ? '…' : ''}</p>
							{/if}
						</button>
					</li>
				{/each}
			</ul>
		{:else if sb.archetype === 'media'}
			<ul class="media-list">
				{#each sorted as spore (spore.id)}
					<li>
						<button class="media-card" onclick={() => handleOpen(spore)}>
							<span class="media-glyph">▣</span>
							<div class="media-body">
								<span class="media-title">{spore.title}</span>
								{#if spore.data.year}
									<span class="media-meta">{spore.data.year}</span>
								{/if}
								{#if spore.body}
									<p class="media-preview">{spore.body.slice(0, 80)}{spore.body.length > 80 ? '…' : ''}</p>
								{/if}
							</div>
							<span class="media-date">{formatDateShort(spore.created)}</span>
						</button>
					</li>
				{/each}
			</ul>
		{:else}
			<ul class="plain-list">
				{#each sorted as spore (spore.id)}
					<li>
						<button class="plain-item" onclick={() => handleOpen(spore)}>
							<span class="plain-title">{spore.title}</span>
							{#if spore.body}
								<span class="plain-preview">{spore.body.slice(0, 60)}{spore.body.length > 60 ? '…' : ''}</span>
							{/if}
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
{/if}

<style>
	.spellbook-view {
		padding: var(--g-space-xl) var(--g-space-lg);
		max-width: 760px;
	}

	.back-btn {
		font-family: var(--g-font-mono);
		font-size: 0.78rem;
		color: var(--g-muted);
		margin-bottom: var(--g-space-md);
		display: block;
		transition: color var(--g-transition-fast);
	}

	.back-btn:hover { color: var(--g-flight); }

	.view-header {
		margin-bottom: var(--g-space-xl);
	}

	.header-main {
		display: flex;
		align-items: baseline;
		gap: var(--g-space-md);
		margin-bottom: var(--g-space-md);
	}

	.view-title {
		font-family: var(--g-font-display);
		font-size: clamp(1.8rem, 4vw, 2.6rem);
		font-weight: 400;
		color: var(--g-text);
	}

	.arch-tag {
		font-family: var(--g-font-mono);
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--g-muted);
	}

	.header-actions {
		display: flex;
		gap: var(--g-space-sm);
	}

	.btn-new {
		font-family: var(--g-font-mono);
		font-size: 0.78rem;
		color: var(--g-flight);
		border: 1px solid var(--g-flight);
		border-radius: var(--g-radius-pill);
		padding: 0.3rem 0.8rem;
		transition: background var(--g-transition-fast), color var(--g-transition-fast);
	}

	.btn-new:hover {
		background: var(--g-flight);
		color: #0d0d1a;
	}

	.btn-danger-ghost {
		font-family: var(--g-font-mono);
		font-size: 0.78rem;
		color: var(--g-muted);
		border: 1px solid var(--g-border);
		border-radius: var(--g-radius-pill);
		padding: 0.3rem 0.8rem;
		transition: all var(--g-transition-fast);
	}

	.btn-danger-ghost:hover {
		color: #f08fb8;
		border-color: #f08fb8;
	}

	.new-spore-form {
		background: var(--g-surface);
		border: 1px solid var(--g-border);
		border-radius: var(--g-radius-md);
		padding: var(--g-space-lg);
		margin-bottom: var(--g-space-lg);
		display: flex;
		flex-direction: column;
		gap: var(--g-space-md);
	}

	.new-input {
		background: var(--g-surface-2);
		border: 1px solid var(--g-border);
		border-radius: var(--g-radius-sm);
		padding: var(--g-space-sm) var(--g-space-md);
		font-size: 1rem;
		color: var(--g-text);
		width: 100%;
	}

	.form-actions {
		display: flex;
		gap: var(--g-space-sm);
	}

	.btn-primary {
		background: var(--g-flight);
		color: #0d0d1a;
		border-radius: var(--g-radius-sm);
		padding: var(--g-space-sm) var(--g-space-md);
		font-size: 0.85rem;
		font-weight: 600;
	}

	.btn-primary:disabled { opacity: 0.4; }

	.btn-ghost {
		border: 1px solid var(--g-border);
		border-radius: var(--g-radius-sm);
		padding: var(--g-space-sm) var(--g-space-md);
		font-size: 0.85rem;
		color: var(--g-text-dim);
	}

	.empty-state {
		padding: var(--g-space-2xl) 0;
		text-align: center;
	}

	.empty-hint {
		font-size: 0.9rem;
		color: var(--g-muted);
	}

	/* ── diary ── */
	.diary-list {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: var(--g-space-sm);
	}

	.diary-entry {
		border-left: 2px solid var(--g-border);
		padding: var(--g-space-md) var(--g-space-lg);
		cursor: pointer;
		transition: border-color var(--g-transition-fast);
		width: 100%;
		text-align: left;
		display: flex;
		flex-direction: column;
		background: none;
	}

	.diary-entry:hover {
		border-color: var(--g-flight);
	}

	.diary-date {
		font-family: var(--g-font-mono);
		font-size: 0.72rem;
		color: var(--g-muted);
		display: block;
		margin-bottom: 0.2rem;
	}

	.diary-title {
		font-family: var(--g-font-display);
		font-size: 1.1rem;
		color: var(--g-text);
		display: block;
	}

	.diary-preview {
		font-size: 0.85rem;
		color: var(--g-text-dim);
		margin-top: 0.25rem;
	}

	/* ── media ── */
	.media-list {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: var(--g-space-sm);
	}

	.media-card {
		background: var(--g-surface);
		border: 1px solid var(--g-border);
		border-radius: var(--g-radius-md);
		padding: var(--g-space-md) var(--g-space-lg);
		display: flex;
		gap: var(--g-space-md);
		align-items: flex-start;
		cursor: pointer;
		transition: border-color var(--g-transition-fast);
		width: 100%;
		text-align: left;
	}

	.media-card:hover {
		border-color: var(--g-flight);
	}

	.media-glyph {
		font-size: 1.1rem;
		color: var(--g-flight);
		flex-shrink: 0;
		margin-top: 0.1rem;
	}

	.media-body {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.media-title {
		font-family: var(--g-font-display);
		font-size: 1.05rem;
		color: var(--g-text);
	}

	.media-meta {
		font-family: var(--g-font-mono);
		font-size: 0.75rem;
		color: var(--g-muted);
	}

	.media-preview {
		font-size: 0.83rem;
		color: var(--g-text-dim);
	}

	.media-date {
		font-family: var(--g-font-mono);
		font-size: 0.72rem;
		color: var(--g-muted);
		flex-shrink: 0;
	}

	/* ── plain ── */
	.plain-list {
		list-style: none;
		display: flex;
		flex-direction: column;
	}

	.plain-item {
		display: flex;
		align-items: baseline;
		gap: var(--g-space-lg);
		padding: var(--g-space-sm) 0;
		border-bottom: 1px solid var(--g-rule);
		cursor: pointer;
		transition: color var(--g-transition-fast);
		width: 100%;
		text-align: left;
		background: none;
	}

	.plain-item:hover .plain-title {
		color: var(--g-flight);
	}

	.plain-title {
		font-family: var(--g-font-display);
		font-size: 1rem;
		color: var(--g-text);
		transition: color var(--g-transition-fast);
	}

	.plain-preview {
		font-size: 0.82rem;
		color: var(--g-muted);
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
