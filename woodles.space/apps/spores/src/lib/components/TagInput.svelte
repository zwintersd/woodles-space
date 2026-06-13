<script lang="ts">
	import { parseTags, sameTag } from '$lib/tags';

	// Reusable tag editor: removable (and optionally navigable) chips plus an
	// add-input with autocomplete. Stateless about persistence — it calls back.
	let {
		tags,
		suggestions = [],
		onadd,
		onremove,
		onnavigate
	}: {
		tags: string[];
		suggestions?: string[];
		onadd: (tag: string) => void;
		onremove: (tag: string) => void;
		onnavigate?: (tag: string) => void;
	} = $props();

	let query = $state('');

	let matches = $derived(
		query.trim()
			? suggestions
					.filter(
						(s) =>
							s.toLowerCase().includes(query.trim().toLowerCase()) &&
							!tags.some((t) => sameTag(t, s))
					)
					.slice(0, 6)
			: []
	);

	function commit(raw: string) {
		for (const t of parseTags(raw)) onadd(t);
		query = '';
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ',') {
			e.preventDefault();
			if (query.trim()) commit(query);
		} else if (e.key === 'Backspace' && query === '' && tags.length > 0) {
			onremove(tags[tags.length - 1]);
		}
	}
</script>

<div class="tag-input">
	<ul class="chips">
		{#each tags as tag (tag)}
			<li class="chip">
				{#if onnavigate}
					<button type="button" class="chip-label" onclick={() => onnavigate?.(tag)} title="browse #{tag}">
						{tag}
					</button>
				{:else}
					<span class="chip-label static">{tag}</span>
				{/if}
				<button type="button" class="chip-x" onclick={() => onremove(tag)} title="remove">×</button>
			</li>
		{/each}
		<li class="entry">
			<input
				class="entry-input"
				type="text"
				placeholder={tags.length ? 'add tag…' : 'add a tag…'}
				bind:value={query}
				onkeydown={handleKeydown}
			/>
		</li>
	</ul>

	{#if matches.length > 0}
		<ul class="suggestions">
			{#each matches as s (s)}
				<li>
					<button type="button" class="suggestion" onclick={() => commit(s)}>
						{s}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.tag-input {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: var(--g-space-xs);
	}

	.chips {
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		gap: var(--g-space-xs);
		align-items: center;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		background: var(--g-flight-soft);
		border: 1px solid var(--g-flight-soft);
		border-radius: var(--g-radius-pill);
		padding: 0.1rem 0.2rem 0.1rem 0.6rem;
		transition: border-color var(--g-transition-fast);
	}

	.chip:hover {
		border-color: var(--g-flight);
	}

	.chip-label {
		font-family: var(--g-font-mono);
		font-size: 0.78rem;
		color: var(--g-flight);
		transition: color var(--g-transition-fast);
	}

	.chip-label.static {
		cursor: default;
	}

	button.chip-label:hover {
		color: var(--g-flight-active);
	}

	.chip-x {
		color: var(--g-muted);
		font-size: 0.9rem;
		line-height: 1;
		padding: 0 0.3rem;
		transition: color var(--g-transition-fast);
	}

	.chip-x:hover {
		color: var(--g-flight);
	}

	.entry {
		flex: 1;
		min-width: 120px;
	}

	.entry-input {
		width: 100%;
		background: transparent;
		border: none;
		font-family: var(--g-font-mono);
		font-size: 0.82rem;
		color: var(--g-text);
		padding: 0.25rem 0;
	}

	.entry-input::placeholder {
		color: var(--g-muted);
	}

	.suggestions {
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		gap: var(--g-space-xs);
	}

	.suggestion {
		font-family: var(--g-font-mono);
		font-size: 0.76rem;
		color: var(--g-text-dim);
		border: 1px dashed var(--g-border);
		border-radius: var(--g-radius-pill);
		padding: 0.15rem 0.6rem;
		transition: border-color var(--g-transition-fast), color var(--g-transition-fast);
	}

	.suggestion:hover {
		border-color: var(--g-flight);
		color: var(--g-flight);
	}
</style>
