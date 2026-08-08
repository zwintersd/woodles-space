<script lang="ts">
	// Cast a structured record for an entry — ported from Spores' spell
	// system (see ../spells/). Nothing here calls a model: a prompt is
	// assembled, copied out by hand, and the answer is pasted back in,
	// same backend-free stance as every other authoring tool in this
	// workspace.
	import { CURATED_CATEGORIES, getCategory, suggestedCategoryId } from '../spells/registry';
	import { assembleSpell } from '../spells/assembler';
	import { parseSpell } from '../spells/parser';
	import type { EntrySpell, SectionKey } from '../types';

	let {
		spell,
		sectionKey,
		title,
		onCast,
		onClear
	}: {
		spell: EntrySpell | null;
		sectionKey: SectionKey;
		title: string;
		onCast: (spell: EntrySpell) => void;
		onClear: () => void;
	} = $props();

	let open = $state(false);
	// Set for real in startCast(), which always runs before the picker that
	// reads this is shown — the empty default here just avoids depending on
	// `sectionKey` inside a `$state` initializer (it only ever captures once).
	let categoryId = $state('');
	let disambiguation = $state('');
	let prompt = $state('');
	let pasted = $state('');
	let errors = $state<string[]>([]);
	let warnings = $state<string[]>([]);
	let copied = $state(false);

	const category = $derived(getCategory(categoryId));

	const dataRows = $derived(
		spell
			? Object.entries(spell.data).filter(([key]) => key !== 'woodles' && key !== 'kind' && key !== 'title')
			: []
	);

	function startCast() {
		open = true;
		categoryId = suggestedCategoryId(sectionKey);
		disambiguation = '';
		prompt = '';
		pasted = '';
		errors = [];
		warnings = [];
	}

	function assemble() {
		if (!category) return;
		prompt = assembleSpell(category, title.trim() || 'untitled', disambiguation.trim());
	}

	async function copyPrompt() {
		try {
			await navigator.clipboard.writeText(prompt);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch {
			// Clipboard access can be denied — the textarea is still selectable.
		}
	}

	function ingest() {
		const result = parseSpell(pasted);
		if (!result.ok) {
			errors = result.errors;
			warnings = [];
			return;
		}
		errors = [];
		warnings = result.warnings;
		onCast({ categoryId, data: result.data, castAt: new Date().toISOString() });
		open = false;
		pasted = '';
		prompt = '';
	}

	function cancel() {
		open = false;
		errors = [];
	}
</script>

<div class="spell-panel">
	{#if !open}
		{#if spell}
			<div class="spell-summary">
				<span class="detail-field-label">
					{getCategory(spell.categoryId)?.label ?? spell.categoryId}
				</span>
				<dl class="spell-data">
					{#each dataRows as [key, value] (key)}
						<div class="spell-row">
							<dt>{key}</dt>
							<dd>{Array.isArray(value) ? value.length + ' item(s)' : String(value)}</dd>
						</div>
					{/each}
				</dl>
				<div class="spell-actions">
					<button class="btn-ghost" onclick={startCast}>recast</button>
					<button class="btn-ghost" onclick={onClear}>clear</button>
				</div>
			</div>
		{:else}
			<button class="btn-ghost" onclick={startCast}>✦ cast a spell</button>
		{/if}
	{:else}
		<div class="spell-form">
			<div class="detail-field">
				<label for="spell-category">category</label>
				<select id="spell-category" bind:value={categoryId}>
					{#each CURATED_CATEGORIES as c (c.id)}
						<option value={c.id}>{c.label}</option>
					{/each}
				</select>
			</div>
			<div class="detail-field">
				<label for="spell-disambiguation">disambiguation (optional)</label>
				<input
					id="spell-disambiguation"
					type="text"
					placeholder="e.g. the 2021 film, not the 1984 one"
					bind:value={disambiguation}
				/>
			</div>
			<div class="spell-actions">
				<button class="btn-ghost" onclick={assemble}>assemble prompt</button>
				<button class="btn-ghost" onclick={cancel}>cancel</button>
			</div>
			{#if prompt}
				<div class="detail-field">
					<label for="spell-prompt">paste this into any model</label>
					<textarea id="spell-prompt" class="spell-textarea" readonly value={prompt}></textarea>
					<button class="btn-ghost" onclick={copyPrompt}>{copied ? 'copied' : 'copy'}</button>
				</div>
				<div class="detail-field">
					<label for="spell-answer">paste its answer back</label>
					<textarea
						id="spell-answer"
						class="spell-textarea"
						placeholder="paste the model's JSON answer here"
						bind:value={pasted}
					></textarea>
					<button class="btn-ghost" onclick={ingest} disabled={!pasted.trim()}>read it in</button>
				</div>
			{/if}
			{#if warnings.length > 0}
				<p class="spell-warning">{warnings.join(' ')}</p>
			{/if}
			{#if errors.length > 0}
				<p class="spell-error">{errors.join(' ')}</p>
			{/if}
		</div>
	{/if}
</div>

<style>
	.spell-panel {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.spell-summary,
	.spell-form {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.spell-data {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		margin: 0;
	}
	.spell-row {
		display: flex;
		gap: 0.5rem;
		font-family: var(--ta-font-sans);
		font-size: 0.78rem;
	}
	.spell-row dt {
		color: var(--ta-muted);
		flex-shrink: 0;
	}
	.spell-row dd {
		margin: 0;
		color: var(--ta-text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.spell-actions {
		display: flex;
		gap: 0.4rem;
	}
	.spell-textarea {
		font-family: var(--ta-font-mono);
		font-size: 0.72rem;
		min-height: 6rem;
		resize: vertical;
		padding: 0.5rem 0.6rem;
		border: 1px solid var(--ta-border);
		border-radius: var(--ta-radius-sm);
		color: var(--ta-text);
	}
	.spell-warning {
		font-family: var(--ta-font-sans);
		font-size: 0.76rem;
		color: var(--ta-muted);
		margin: 0;
	}
	.spell-error {
		font-family: var(--ta-font-sans);
		font-size: 0.76rem;
		color: var(--ta-danger);
		margin: 0;
	}
	.btn-ghost {
		font-family: var(--ta-font-sans);
		font-size: 0.76rem;
		padding: 0.35rem 0.7rem;
		border-radius: var(--ta-radius-sm);
		border: 1px solid var(--ta-border);
		color: var(--ta-text-dim);
		transition: border-color var(--ta-transition-fast), color var(--ta-transition-fast);
		align-self: flex-start;
	}
	.btn-ghost:hover {
		border-color: var(--ta-accent);
		color: var(--ta-accent);
	}
	.btn-ghost:disabled {
		opacity: 0.5;
		cursor: default;
	}
</style>
