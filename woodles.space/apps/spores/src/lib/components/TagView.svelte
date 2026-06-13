<script lang="ts">
	import { garden } from '$lib/garden.svelte';
	import type { Spore } from '$lib/types';

	let tag = $derived(garden.activeTag);
	let spores = $derived(garden.activeTagSpores);

	let renaming = $state(false);
	let renameValue = $state('');

	function startRename() {
		renaming = true;
		renameValue = tag ?? '';
	}

	function commitRename() {
		if (tag && renameValue.trim()) garden.renameTag(tag, renameValue);
		renaming = false;
	}

	function handleDelete() {
		if (!tag) return;
		if (confirm(`Remove the tag “${tag}” from all spores? The spores stay; only the tag is removed.`)) {
			garden.deleteTag(tag);
		}
	}

	function open(spore: Spore) {
		garden.openSpore(spore.id);
	}
</script>

{#if tag}
	<section class="tag-view">
		<button class="back-btn" onclick={() => garden.openGarden()}>← garden</button>

		<header class="view-header">
			{#if renaming}
				<form
					class="rename-form"
					onsubmit={(e) => {
						e.preventDefault();
						commitRename();
					}}
				>
					<span class="hash">#</span>
					<input class="rename-input" bind:value={renameValue} autofocus />
					<button type="submit" class="btn-primary">rename</button>
					<button type="button" class="btn-ghost" onclick={() => (renaming = false)}>cancel</button>
				</form>
			{:else}
				<div class="title-row">
					<h2 class="view-title"><span class="hash">#</span>{tag}</h2>
					<span class="count">{spores.length} {spores.length === 1 ? 'spore' : 'spores'}</span>
				</div>
				<div class="tag-actions">
					<button class="btn-ghost-sm" onclick={startRename}>rename</button>
					<button class="btn-danger-ghost" onclick={handleDelete}>delete tag</button>
				</div>
			{/if}
		</header>

		{#if spores.length === 0}
			<div class="empty-state">
				<p class="empty-hint">No spores carry this tag.</p>
			</div>
		{:else}
			<ul class="spore-list">
				{#each spores as spore (spore.id)}
					<li>
						<button class="spore-item" onclick={() => open(spore)}>
							<span class="spore-title">{spore.title}</span>
							{#if spore.body}
								<span class="spore-preview">
									{spore.body.slice(0, 70)}{spore.body.length > 70 ? '…' : ''}
								</span>
							{/if}
							{#if spore.tags.length > 1}
								<span class="spore-tags">
									{#each spore.tags.filter((t) => t.toLowerCase() !== tag?.toLowerCase()) as t}
										<span class="mini-tag">{t}</span>
									{/each}
								</span>
							{/if}
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
{/if}

<style>
	.tag-view {
		padding: var(--g-space-xl) var(--g-space-lg);
		max-width: 760px;
	}

	.back-btn {
		font-family: var(--g-font-mono);
		font-size: 0.78rem;
		color: var(--g-muted);
		display: block;
		margin-bottom: var(--g-space-md);
		transition: color var(--g-transition-fast);
	}

	.back-btn:hover {
		color: var(--g-flight);
	}

	.view-header {
		margin-bottom: var(--g-space-xl);
		display: flex;
		flex-direction: column;
		gap: var(--g-space-sm);
	}

	.title-row {
		display: flex;
		align-items: baseline;
		gap: var(--g-space-md);
	}

	.view-title {
		font-family: var(--g-font-display);
		font-size: clamp(1.8rem, 4vw, 2.6rem);
		font-weight: 400;
		color: var(--g-text);
	}

	.hash {
		color: var(--g-flight);
	}

	.count {
		font-family: var(--g-font-mono);
		font-size: 0.75rem;
		color: var(--g-muted);
	}

	.tag-actions {
		display: flex;
		gap: var(--g-space-md);
	}

	.btn-ghost-sm {
		font-family: var(--g-font-mono);
		font-size: 0.76rem;
		color: var(--g-muted);
		transition: color var(--g-transition-fast);
	}

	.btn-ghost-sm:hover {
		color: var(--g-flight);
	}

	.btn-danger-ghost {
		font-family: var(--g-font-mono);
		font-size: 0.76rem;
		color: var(--g-muted);
		transition: color var(--g-transition-fast);
	}

	.btn-danger-ghost:hover {
		color: var(--g-flight);
	}

	.rename-form {
		display: flex;
		align-items: center;
		gap: var(--g-space-sm);
	}

	.rename-input {
		font-family: var(--g-font-display);
		font-size: 1.6rem;
		color: var(--g-text);
		background: transparent;
		border-bottom: 1px solid var(--g-flight);
		padding-bottom: 0.1rem;
	}

	.btn-primary {
		background: var(--g-flight);
		color: #0d0d1a;
		border-radius: var(--g-radius-sm);
		padding: 0.3rem 0.8rem;
		font-size: 0.82rem;
		font-weight: 600;
	}

	.btn-ghost {
		border: 1px solid var(--g-border);
		border-radius: var(--g-radius-sm);
		padding: 0.3rem 0.8rem;
		font-size: 0.82rem;
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

	.spore-list {
		list-style: none;
		display: flex;
		flex-direction: column;
	}

	.spore-item {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: var(--g-space-md);
		padding: var(--g-space-sm) 0;
		border-bottom: 1px solid var(--g-rule);
		cursor: pointer;
		width: 100%;
		text-align: left;
		background: none;
	}

	.spore-item:hover .spore-title {
		color: var(--g-flight);
	}

	.spore-title {
		font-family: var(--g-font-display);
		font-size: 1.05rem;
		color: var(--g-text);
		transition: color var(--g-transition-fast);
	}

	.spore-preview {
		font-size: 0.82rem;
		color: var(--g-muted);
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.spore-tags {
		display: flex;
		gap: 0.3rem;
		flex-wrap: wrap;
	}

	.mini-tag {
		font-family: var(--g-font-mono);
		font-size: 0.68rem;
		color: var(--g-muted);
		border: 1px solid var(--g-border);
		border-radius: var(--g-radius-pill);
		padding: 0.05rem 0.45rem;
	}
</style>
