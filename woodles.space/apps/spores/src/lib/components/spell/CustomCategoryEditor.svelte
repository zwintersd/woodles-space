<script lang="ts">
	import type { Category, FieldDef } from '$lib/spells/types';
	import { uid } from '$lib/utils';

	let { oncreate, oncancel }: {
		oncreate: (cat: Category) => void;
		oncancel: () => void;
	} = $props();

	let label = $state('');
	let rootKind = $state('');
	let glyph = $state('◦');
	let rootFields = $state<FieldDef[]>([
		{ key: 'description', label: 'Description', default: true }
	]);
	let hasChildren = $state(false);
	let childKind = $state('');
	let childArrayKey = $state('');
	let childLabel = $state('');
	let childFields = $state<FieldDef[]>([
		{ key: 'title', label: 'Title', default: true }
	]);

	function addRootField() {
		rootFields = [...rootFields, { key: uid().slice(0, 6), label: '', default: true }];
	}

	function removeRootField(i: number) {
		rootFields = rootFields.filter((_, idx) => idx !== i);
	}

	function updateRootField(i: number, patch: Partial<FieldDef>) {
		rootFields = rootFields.map((f, idx) => idx === i ? { ...f, ...patch } : f);
	}

	function addChildField() {
		childFields = [...childFields, { key: uid().slice(0, 6), label: '', default: true }];
	}

	function removeChildField(i: number) {
		childFields = childFields.filter((_, idx) => idx !== i);
	}

	function updateChildField(i: number, patch: Partial<FieldDef>) {
		childFields = childFields.map((f, idx) => idx === i ? { ...f, ...patch } : f);
	}

	function canCreate(): boolean {
		if (!label.trim() || !rootKind.trim()) return false;
		if (hasChildren && (!childKind.trim() || !childArrayKey.trim() || !childLabel.trim())) return false;
		return true;
	}

	function handleCreate() {
		if (!canCreate()) return;

		const cat: Category = {
			id: `custom-${uid()}`,
			label: label.trim(),
			group: 'custom',
			glyph: glyph || '◦',
			rootKind: rootKind.trim().toLowerCase().replace(/\s+/g, '-'),
			rootFields: rootFields.filter((f) => f.label.trim()),
			children: hasChildren && childKind.trim()
				? {
					kind: childKind.trim().toLowerCase().replace(/\s+/g, '-'),
					label: childLabel.trim(),
					arrayKey: childArrayKey.trim().toLowerCase().replace(/\s+/g, ''),
					fields: childFields.filter((f) => f.label.trim())
				}
				: undefined
		};

		oncreate(cat);
	}
</script>

<div class="editor">
	<h4 class="editor-title">custom category</h4>

	<div class="form-row">
		<label class="form-field short">
			<span>glyph</span>
			<input class="input" type="text" maxlength="2" bind:value={glyph} />
		</label>
		<label class="form-field grow">
			<span>name</span>
			<input class="input" type="text" placeholder="e.g. Band" bind:value={label} />
		</label>
		<label class="form-field grow">
			<span>kind key</span>
			<input class="input" type="text" placeholder="e.g. band-discography" bind:value={rootKind} />
		</label>
	</div>

	<div class="fields-section">
		<p class="section-label">root fields</p>
		{#each rootFields as f, i}
			<div class="field-row">
				<input class="input small" placeholder="label" value={f.label} oninput={(e) => updateRootField(i, { label: (e.target as HTMLInputElement).value })} />
				<input class="input small" placeholder="key" value={f.key} oninput={(e) => updateRootField(i, { key: (e.target as HTMLInputElement).value })} />
				<button class="rm-btn" onclick={() => removeRootField(i)}>×</button>
			</div>
		{/each}
		<button class="add-btn" onclick={addRootField}>+ field</button>
	</div>

	<label class="child-toggle">
		<input type="checkbox" bind:checked={hasChildren} />
		include a child level (e.g. albums, episodes)
	</label>

	{#if hasChildren}
		<div class="fields-section">
			<div class="form-row">
				<label class="form-field grow">
					<span>child name</span>
					<input class="input" type="text" placeholder="Albums" bind:value={childLabel} />
				</label>
				<label class="form-field grow">
					<span>JSON key</span>
					<input class="input" type="text" placeholder="albums" bind:value={childArrayKey} />
				</label>
				<label class="form-field grow">
					<span>kind key</span>
					<input class="input" type="text" placeholder="album" bind:value={childKind} />
				</label>
			</div>
			<p class="section-label">child fields</p>
			{#each childFields as f, i}
				<div class="field-row">
					<input class="input small" placeholder="label" value={f.label} oninput={(e) => updateChildField(i, { label: (e.target as HTMLInputElement).value })} />
					<input class="input small" placeholder="key" value={f.key} oninput={(e) => updateChildField(i, { key: (e.target as HTMLInputElement).value })} />
					<button class="rm-btn" onclick={() => removeChildField(i)}>×</button>
				</div>
			{/each}
			<button class="add-btn" onclick={addChildField}>+ field</button>
		</div>
	{/if}

	<div class="editor-actions">
		<button class="btn-primary" onclick={handleCreate} disabled={!canCreate()}>
			create category
		</button>
		<button class="btn-ghost" onclick={oncancel}>cancel</button>
	</div>
</div>

<style>
	.editor {
		background: var(--g-surface);
		border: 1px solid var(--g-border);
		border-radius: var(--g-radius-md);
		padding: var(--g-space-lg);
		display: flex;
		flex-direction: column;
		gap: var(--g-space-md);
	}

	.editor-title {
		font-family: var(--g-font-mono);
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--g-muted);
		font-weight: 400;
	}

	.form-row {
		display: flex;
		gap: var(--g-space-sm);
		flex-wrap: wrap;
	}

	.form-field {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		font-family: var(--g-font-mono);
		font-size: 0.72rem;
		color: var(--g-muted);
	}

	.form-field.short { width: 60px; }
	.form-field.grow { flex: 1; min-width: 120px; }

	.input {
		background: var(--g-surface-2);
		border: 1px solid var(--g-border);
		border-radius: var(--g-radius-sm);
		padding: 0.3rem 0.6rem;
		color: var(--g-text);
		font-size: 0.85rem;
		width: 100%;
	}

	.input.small { font-size: 0.82rem; }

	.section-label {
		font-family: var(--g-font-mono);
		font-size: 0.7rem;
		color: var(--g-muted);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.fields-section {
		display: flex;
		flex-direction: column;
		gap: var(--g-space-xs);
	}

	.field-row {
		display: flex;
		gap: var(--g-space-xs);
		align-items: center;
	}

	.add-btn {
		font-family: var(--g-font-mono);
		font-size: 0.75rem;
		color: var(--g-flight);
		align-self: flex-start;
		transition: opacity var(--g-transition-fast);
	}

	.add-btn:hover { opacity: 0.7; }

	.rm-btn {
		color: var(--g-muted);
		font-size: 0.9rem;
		padding: 0 0.3rem;
		flex-shrink: 0;
		transition: color var(--g-transition-fast);
	}

	.rm-btn:hover { color: var(--g-flight); }

	.child-toggle {
		display: flex;
		align-items: center;
		gap: var(--g-space-sm);
		font-size: 0.88rem;
		color: var(--g-text-dim);
		cursor: pointer;
	}

	.child-toggle input { accent-color: var(--g-flight); }

	.editor-actions {
		display: flex;
		gap: var(--g-space-sm);
		margin-top: var(--g-space-sm);
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
</style>
