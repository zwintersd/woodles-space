<script lang="ts">
	import { garden } from '$lib/garden.svelte';
	import type { Spellbook } from '$lib/types';
	import { focusOnMount } from '$lib/focus';

	const ARCHETYPE_GLYPHS: Record<string, string> = {
		plain: '◦',
		diary: '☽',
		media: '▣'
	};

	function glyph(archetype: string): string {
		return ARCHETYPE_GLYPHS[archetype] ?? '◦';
	}

	function handleCreate() {
		garden.showNewSpellbook = true;
		garden.newSpellbookTitle = '';
		garden.newSpellbookArchetype = 'plain';
	}

	function handleSubmitSpellbook(e: Event) {
		e.preventDefault();
		if (!garden.newSpellbookTitle.trim()) return;
		const sb = garden.addSpellbook(
			garden.newSpellbookTitle,
			garden.newSpellbookArchetype
		);
		garden.showNewSpellbook = false;
		garden.openSpellbook(sb.id);
	}

	function handleOpen(sb: Spellbook) {
		garden.openSpellbook(sb.id);
	}

	function sporeCount(sb: Spellbook): number {
		return garden.sporesInSpellbook(sb.id).length;
	}
</script>

<section class="spellbook-list">
	<header class="list-header">
		<h2 class="list-title">the garden</h2>
		<button class="btn-new" onclick={handleCreate}>+ spellbook</button>
	</header>

	{#if garden.showNewSpellbook}
		<form class="new-form" onsubmit={handleSubmitSpellbook}>
			<input
				use:focusOnMount
				class="new-input"
				type="text"
				placeholder="spellbook title…"
				bind:value={garden.newSpellbookTitle}
			/>
			<div class="archetype-row">
				{#each ['plain', 'diary', 'media'] as arch}
					<label class="arch-label" class:active={garden.newSpellbookArchetype === arch}>
						<input
							type="radio"
							name="archetype"
							value={arch}
							bind:group={garden.newSpellbookArchetype}
						/>
						{glyph(arch)} {arch}
					</label>
				{/each}
			</div>
			<div class="form-actions">
				<button type="submit" class="btn-primary" disabled={!garden.newSpellbookTitle.trim()}>
					create
				</button>
				<button type="button" class="btn-ghost" onclick={() => (garden.showNewSpellbook = false)}>
					cancel
				</button>
			</div>
		</form>
	{/if}

	{#if garden.spellbooks.length === 0 && !garden.showNewSpellbook}
		<div class="empty-state">
			<span class="empty-glyph">❀</span>
			<p class="empty-hint">No spellbooks yet. Create one to begin tending.</p>
		</div>
	{:else}
		<ul class="books-grid">
			{#each garden.spellbooks as sb (sb.id)}
				<li>
					<button class="book-card" onclick={() => handleOpen(sb)}>
						<span class="book-glyph">{glyph(sb.archetype)}</span>
						<span class="book-title">{sb.title}</span>
						<span class="book-meta">
							{#if sb.archetype !== 'plain'}
								<span class="book-arch">{sb.archetype}</span>
							{/if}
							<span class="book-count">{sporeCount(sb)}</span>
						</span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}

	{#if garden.allTags.length > 0}
		<section class="tags-cloud">
			<h3 class="cloud-label">tags</h3>
			<div class="cloud">
				{#each garden.allTags as { tag, count } (tag)}
					<button class="cloud-tag" onclick={() => garden.openTag(tag)}>
						{tag}<span class="cloud-count">{count}</span>
					</button>
				{/each}
			</div>
		</section>
	{/if}
</section>

<style>
	.spellbook-list {
		padding: var(--g-space-xl) var(--g-space-lg);
		max-width: 760px;
	}

	.list-header {
		display: flex;
		align-items: baseline;
		gap: var(--g-space-lg);
		margin-bottom: var(--g-space-xl);
	}

	.list-title {
		font-family: var(--g-font-display);
		font-size: clamp(2rem, 5vw, 3rem);
		font-weight: 400;
		color: var(--g-text);
		letter-spacing: -0.01em;
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

	.new-form {
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

	.archetype-row {
		display: flex;
		gap: var(--g-space-sm);
	}

	.arch-label {
		display: flex;
		align-items: center;
		gap: 0.3em;
		font-family: var(--g-font-mono);
		font-size: 0.82rem;
		color: var(--g-muted);
		padding: 0.3rem 0.7rem;
		border: 1px solid var(--g-border);
		border-radius: var(--g-radius-pill);
		cursor: pointer;
		transition: all var(--g-transition-fast);
	}

	.arch-label.active {
		border-color: var(--g-flight);
		color: var(--g-flight);
	}

	.arch-label input {
		display: none;
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
		transition: opacity var(--g-transition-fast);
	}

	.btn-primary:disabled {
		opacity: 0.4;
	}

	.btn-ghost {
		border: 1px solid var(--g-border);
		border-radius: var(--g-radius-sm);
		padding: var(--g-space-sm) var(--g-space-md);
		font-size: 0.85rem;
		color: var(--g-text-dim);
		transition: border-color var(--g-transition-fast);
	}

	.btn-ghost:hover {
		border-color: var(--g-flight);
	}

	.empty-state {
		text-align: center;
		padding: var(--g-space-2xl) 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--g-space-md);
	}

	.empty-glyph {
		font-size: 3rem;
		opacity: 0.3;
	}

	.empty-hint {
		font-size: 0.9rem;
		color: var(--g-muted);
	}

	.books-grid {
		list-style: none;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: var(--g-space-md);
	}

	.book-card {
		width: 100%;
		background: var(--g-surface);
		border: 1px solid var(--g-border);
		border-radius: var(--g-radius-md);
		padding: var(--g-space-lg);
		text-align: left;
		display: flex;
		flex-direction: column;
		gap: var(--g-space-sm);
		transition: border-color var(--g-transition-fast), box-shadow var(--g-transition-fast);
		cursor: pointer;
	}

	.book-card:hover {
		border-color: var(--g-flight);
		box-shadow: var(--g-shadow-hover);
	}

	.book-glyph {
		font-size: 1.4rem;
		color: var(--g-flight);
	}

	.book-title {
		font-family: var(--g-font-display);
		font-size: 1.1rem;
		color: var(--g-text);
		font-weight: 400;
	}

	.book-meta {
		display: flex;
		gap: var(--g-space-sm);
		align-items: center;
	}

	.book-arch {
		font-family: var(--g-font-mono);
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--g-muted);
	}

	.book-count {
		font-family: var(--g-font-mono);
		font-size: 0.78rem;
		color: var(--g-muted);
		margin-left: auto;
	}

	/* ── tag cloud ── */
	.tags-cloud {
		margin-top: var(--g-space-2xl);
		padding-top: var(--g-space-lg);
		border-top: 1px solid var(--g-rule);
	}

	.cloud-label {
		font-family: var(--g-font-mono);
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--g-muted);
		font-weight: 400;
		margin-bottom: var(--g-space-md);
	}

	.cloud {
		display: flex;
		flex-wrap: wrap;
		gap: var(--g-space-sm);
	}

	.cloud-tag {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-family: var(--g-font-mono);
		font-size: 0.82rem;
		color: var(--g-flight);
		background: var(--g-flight-soft);
		border: 1px solid transparent;
		border-radius: var(--g-radius-pill);
		padding: 0.25rem 0.75rem;
		transition: border-color var(--g-transition-fast), color var(--g-transition-fast);
	}

	.cloud-tag:hover {
		border-color: var(--g-flight);
		color: var(--g-flight-active);
	}

	.cloud-count {
		font-size: 0.72rem;
		color: var(--g-muted);
	}
</style>
