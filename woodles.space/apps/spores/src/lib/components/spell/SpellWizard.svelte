<script lang="ts">
	import { garden } from '$lib/garden.svelte';
	import { CURATED_CATEGORIES, getCategory, inferArchetype } from '$lib/spells/registry';
	import { buildSpell } from '$lib/spells/assembler';
	import { parseImport } from '$lib/spells/parser';
	import type { Category, SpellDraft, FieldDef, ChildLevel } from '$lib/spells/types';
	import type { ImportResult } from '$lib/spells/types';
	import CustomCategoryEditor from './CustomCategoryEditor.svelte';

	// ── wizard state ───────────────────────────────────────────────

	let step = $state(1);
	let draft = $state<SpellDraft>({
		categoryId: '',
		subject: '',
		disambiguation: '',
		selectedFields: [],
		includedLevels: [],
		modifiers: []
	});

	let pasteText = $state('');
	let importResult = $state<ImportResult | null>(null);
	let spellText = $state('');
	let copied = $state(false);
	let showCustomEditor = $state(false);

	// Post-import state
	let pendingSpore = $state<import('$lib/types').Spore | null>(null);
	let pendingSpellbookIds = $state<string[]>([]);

	// ── category resolution ────────────────────────────────────────

	let allCategories = $derived([
		...CURATED_CATEGORIES,
		...(garden.settings.customCategories ?? [])
	]);

	let selectedCategory = $derived(
		draft.categoryId ? getCategory(draft.categoryId, garden.settings.customCategories ?? []) : null
	);

	// ── field initialization when category changes ─────────────────

	function initFieldsForCategory(cat: Category) {
		const fields: string[] = [];
		const levels: string[] = [];

		// Root fields
		for (const f of cat.rootFields) {
			if (f.default !== false) fields.push(`root.${f.key}`);
		}

		// Walk child levels
		function walkLevel(level: ChildLevel) {
			levels.push(level.kind);
			for (const f of level.fields) {
				if (f.default !== false) fields.push(`${level.kind}.${f.key}`);
			}
			if (level.children) walkLevel(level.children);
		}
		if (cat.children) walkLevel(cat.children);

		draft.selectedFields = fields;
		draft.includedLevels = levels;
		draft.modifiers = [];
	}

	// ── helpers ────────────────────────────────────────────────────

	function toggleField(path: string) {
		draft.selectedFields = draft.selectedFields.includes(path)
			? draft.selectedFields.filter((f) => f !== path)
			: [...draft.selectedFields, path];
	}

	function toggleLevel(kind: string, level: ChildLevel) {
		const included = draft.includedLevels.includes(kind);
		if (included) {
			// Remove this kind and all descendants
			const toRemove = new Set<string>();
			function collectDescendants(l: ChildLevel | undefined) {
				if (!l) return;
				toRemove.add(l.kind);
				collectDescendants(l.children);
			}
			collectDescendants(level);
			draft.includedLevels = draft.includedLevels.filter((k) => !toRemove.has(k));
			draft.selectedFields = draft.selectedFields.filter(
				(f) => !Array.from(toRemove).some((k) => f.startsWith(`${k}.`))
			);
		} else {
			draft.includedLevels = [...draft.includedLevels, kind];
			for (const f of level.fields) {
				if (f.default !== false) {
					const path = `${kind}.${f.key}`;
					if (!draft.selectedFields.includes(path)) {
						draft.selectedFields = [...draft.selectedFields, path];
					}
				}
			}
		}
	}

	function toggleModifier(id: string) {
		draft.modifiers = draft.modifiers.includes(id)
			? draft.modifiers.filter((m) => m !== id)
			: [...draft.modifiers, id];
	}

	function hasModifiers(): boolean {
		return (selectedCategory?.modifiers ?? []).length > 0;
	}

	function goStep(n: number) {
		if (n === 5 && selectedCategory) {
			spellText = buildSpell(draft, selectedCategory);
			importResult = null;
			pasteText = '';
			pendingSpore = null;
		}
		step = n;
	}

	function next() {
		if (step === 3 && !hasModifiers()) goStep(5);
		else goStep(step + 1);
	}

	function back() {
		if (step === 5 && !hasModifiers()) goStep(3);
		else goStep(step - 1);
	}

	function selectCategory(cat: Category) {
		draft.categoryId = cat.id;
		initFieldsForCategory(cat);
		showCustomEditor = false;
		step = 2;
	}

	async function copySpell() {
		await navigator.clipboard.writeText(spellText);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}

	function runParser() {
		if (!pasteText.trim()) return;
		const result = parseImport(pasteText);
		importResult = result;
		if (result.ok) pendingSpore = result.spore;
	}

	function plantSpore() {
		if (!pendingSpore) return;
		const created = garden.importStructuredSpore(pendingSpore, pendingSpellbookIds);
		garden.closeSpellWizard();
		garden.openSpore(created.id);
	}

	// ── field tree rendering ────────────────────────────────────────

	function renderFieldGroup(
		kind: string,
		label: string,
		fields: FieldDef[],
		level: ChildLevel | undefined = undefined,
		depth = 0
	) {
		// handled inline in template
		return { kind, label, fields, level, depth };
	}
</script>

<div class="wizard">
	<header class="wizard-header">
		<button class="close-btn" onclick={() => garden.closeSpellWizard()}>× close</button>
		<div class="step-track">
			{#each [1, 2, 3, hasModifiers() ? 4 : 0, 5].filter((n) => n > 0) as n}
				<span class="step-dot" class:active={step === n} class:done={step > n}></span>
			{/each}
		</div>
		<h2 class="wizard-title">✦ cast a spell</h2>
	</header>

	<div class="wizard-body">
		<!-- Step 1: Category -->
		{#if step === 1}
			<div class="step">
				<h3 class="step-heading">What are you gathering?</h3>
				{#if showCustomEditor}
					<CustomCategoryEditor
						oncreate={(cat) => { garden.addCustomCategory(cat); selectCategory(cat); }}
						oncancel={() => (showCustomEditor = false)}
					/>
				{:else}
					<div class="category-groups">
						{#each ['person', 'media'] as grp}
							<div class="cat-group">
								<p class="cat-group-label">{grp}</p>
								<div class="cat-grid">
									{#each allCategories.filter((c) => c.group === grp) as cat}
										<button class="cat-card" onclick={() => selectCategory(cat)}>
											<span class="cat-glyph">{cat.glyph ?? '◦'}</span>
											<span class="cat-label">{cat.label}</span>
										</button>
									{/each}
									{#if grp === 'media'}
										{#each (garden.settings.customCategories ?? []) as cat}
											<div class="cat-card custom">
												<button class="cat-card-inner" onclick={() => selectCategory(cat)}>
													<span class="cat-glyph">{cat.glyph ?? '◦'}</span>
													<span class="cat-label">{cat.label}</span>
												</button>
												<button
													class="cat-delete"
													onclick={() => garden.deleteCustomCategory(cat.id)}
												>×</button>
											</div>
										{/each}
									{/if}
								</div>
							</div>
						{/each}
					</div>
					<button class="btn-custom" onclick={() => (showCustomEditor = true)}>
						+ custom category…
					</button>
				{/if}
			</div>

		<!-- Step 2: Subject -->
		{:else if step === 2 && selectedCategory}
			<div class="step">
				<h3 class="step-heading">Who or what is this about?</h3>
				<input
					class="subject-input"
					type="text"
					placeholder={selectedCategory.label + ' name…'}
					bind:value={draft.subject}
					onkeydown={(e) => e.key === 'Enter' && draft.subject.trim() && next()}
				/>
				<label class="disambig-label">
					<span class="label-text">Disambiguation (optional)</span>
					<input
						class="disambig-input"
						type="text"
						placeholder="e.g. the Canadian musician, not the band…"
						bind:value={draft.disambiguation}
					/>
				</label>
				<div class="step-nav">
					<button class="btn-ghost" onclick={() => goStep(1)}>← back</button>
					<button class="btn-primary" onclick={next} disabled={!draft.subject.trim()}>
						next →
					</button>
				</div>
			</div>

		<!-- Step 3: Fields & levels -->
		{:else if step === 3 && selectedCategory}
			<div class="step">
				<h3 class="step-heading">What should the spell gather?</h3>

				<!-- Root fields -->
				<div class="field-group root-fields">
					<p class="field-group-label">about {draft.subject || selectedCategory.label}</p>
					{#each selectedCategory.rootFields as f}
						<label class="field-check">
							<input
								type="checkbox"
								checked={draft.selectedFields.includes(`root.${f.key}`)}
								onchange={() => toggleField(`root.${f.key}`)}
							/>
							{f.label}
							{#if f.hint}<span class="field-hint">{f.hint}</span>{/if}
						</label>
					{/each}
				</div>

				<!-- Child levels -->
				{#if selectedCategory.children}
					{@const topLevel = selectedCategory.children}
					<div class="child-level" style="--depth: 0">
						<div class="level-header">
							<label class="level-toggle">
								<input
									type="checkbox"
									checked={draft.includedLevels.includes(topLevel.kind)}
									onchange={() => toggleLevel(topLevel.kind, topLevel)}
								/>
								<span class="level-label">include {topLevel.label}</span>
							</label>
						</div>
						{#if draft.includedLevels.includes(topLevel.kind)}
							<div class="field-group">
								{#each topLevel.fields.filter((f) => f.key !== 'title') as f}
									<label class="field-check">
										<input
											type="checkbox"
											checked={draft.selectedFields.includes(`${topLevel.kind}.${f.key}`)}
											onchange={() => toggleField(`${topLevel.kind}.${f.key}`)}
										/>
										{f.label}
									</label>
								{/each}
							</div>

							{#if topLevel.children}
								{@const childLevel = topLevel.children}
								<div class="child-level" style="--depth: 1">
									<div class="level-header">
										<label class="level-toggle">
											<input
												type="checkbox"
												checked={draft.includedLevels.includes(childLevel.kind)}
												onchange={() => toggleLevel(childLevel.kind, childLevel)}
											/>
											<span class="level-label">include {childLevel.label}</span>
										</label>
									</div>
									{#if draft.includedLevels.includes(childLevel.kind)}
										<div class="field-group">
											{#each childLevel.fields.filter((f) => f.key !== 'title') as f}
												<label class="field-check">
													<input
														type="checkbox"
														checked={draft.selectedFields.includes(`${childLevel.kind}.${f.key}`)}
														onchange={() => toggleField(`${childLevel.kind}.${f.key}`)}
													/>
													{f.label}
												</label>
											{/each}
										</div>
									{/if}
								</div>
							{/if}
						{/if}
					</div>
				{/if}

				<div class="step-nav">
					<button class="btn-ghost" onclick={back}>← back</button>
					<button class="btn-primary" onclick={next}>next →</button>
				</div>
			</div>

		<!-- Step 4: Modifiers -->
		{:else if step === 4 && selectedCategory && hasModifiers()}
			<div class="step">
				<h3 class="step-heading">Optional modifiers</h3>
				<div class="modifiers-list">
					{#each selectedCategory.modifiers ?? [] as mod}
						<label class="mod-item" class:checked={draft.modifiers.includes(mod.id)}>
							<input
								type="checkbox"
								checked={draft.modifiers.includes(mod.id)}
								onchange={() => toggleModifier(mod.id)}
							/>
							<div class="mod-body">
								<span class="mod-label">{mod.label}</span>
								{#if mod.hint}<p class="mod-hint">{mod.hint}</p>{/if}
							</div>
						</label>
					{/each}
				</div>
				<div class="step-nav">
					<button class="btn-ghost" onclick={back}>← back</button>
					<button class="btn-primary" onclick={next}>review spell →</button>
				</div>
			</div>

		<!-- Step 5: Review & cast -->
		{:else if step === 5}
			<div class="step step-review">
				<div class="spell-block">
					<div class="spell-toolbar">
						<span class="spell-label">your spell</span>
						<button class="btn-copy" onclick={copySpell}>
							{copied ? '✓ copied' : 'copy'}
						</button>
					</div>
					<pre class="spell-text">{spellText}</pre>
				</div>

				<p class="paste-instruction">
					Paste this into any LLM. When it responds, paste the JSON below.
				</p>

				<div class="paste-block">
					<textarea
						class="paste-area"
						placeholder="paste the LLM's response here…"
						bind:value={pasteText}
						rows={8}
					></textarea>
					<button
						class="btn-grow"
						onclick={runParser}
						disabled={!pasteText.trim()}
					>
						grow spore →
					</button>
				</div>

				{#if importResult}
					{#if !importResult.ok}
						<div class="import-errors">
							{#each importResult.errors as err}
								<p class="error-line">✕ {err}</p>
							{/each}
						</div>
					{:else}
						<div class="import-preview">
							{#if importResult.warnings.length}
								<div class="warnings">
									{#each importResult.warnings as w}
										<p class="warning-line">⚠ {w}</p>
									{/each}
								</div>
							{/if}
							<div class="preview-card">
								<p class="preview-title">{importResult.spore.title}</p>
								{#if importResult.spore.body}
									<p class="preview-body">{importResult.spore.body.slice(0, 160)}{importResult.spore.body.length > 160 ? '…' : ''}</p>
								{/if}
							</div>
							{#if garden.spellbooks.length > 0}
								<div class="spellbook-assign">
									<p class="assign-label">add to spellbooks (optional)</p>
									<div class="assign-checks">
										{#each garden.spellbooks as sb}
											<label class="assign-item">
												<input
													type="checkbox"
													checked={pendingSpellbookIds.includes(sb.id)}
													onchange={() => {
														pendingSpellbookIds = pendingSpellbookIds.includes(sb.id)
															? pendingSpellbookIds.filter((id) => id !== sb.id)
															: [...pendingSpellbookIds, sb.id];
													}}
												/>
												{sb.title}
											</label>
										{/each}
									</div>
								</div>
							{/if}
							<button class="btn-plant" onclick={plantSpore}>
								plant it →
							</button>
						</div>
					{/if}
				{/if}

				<div class="step-nav">
					<button class="btn-ghost" onclick={back}>← revise spell</button>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.wizard {
		max-width: 680px;
		margin: 0 auto;
		padding: var(--g-space-xl) var(--g-space-lg);
		display: flex;
		flex-direction: column;
		gap: var(--g-space-lg);
	}

	.wizard-header {
		display: flex;
		flex-direction: column;
		gap: var(--g-space-sm);
	}

	.close-btn {
		font-family: var(--g-font-mono);
		font-size: 0.78rem;
		color: var(--g-muted);
		align-self: flex-end;
		transition: color var(--g-transition-fast);
	}

	.close-btn:hover { color: var(--g-flight); }

	.step-track {
		display: flex;
		gap: var(--g-space-sm);
		align-items: center;
	}

	.step-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--g-border);
		transition: background var(--g-transition-fast);
	}

	.step-dot.active { background: var(--g-flight); }
	.step-dot.done { background: var(--g-flight-active); }

	.wizard-title {
		font-family: var(--g-font-display);
		font-size: clamp(1.6rem, 3.5vw, 2.2rem);
		font-weight: 400;
		color: var(--g-text);
		letter-spacing: -0.01em;
	}

	.wizard-body {
		min-height: 300px;
	}

	.step {
		display: flex;
		flex-direction: column;
		gap: var(--g-space-lg);
	}

	.step-heading {
		font-family: var(--g-font-display);
		font-size: 1.3rem;
		font-weight: 400;
		color: var(--g-text-dim);
	}

	/* ── category grid ── */
	.category-groups {
		display: flex;
		flex-direction: column;
		gap: var(--g-space-lg);
	}

	.cat-group-label {
		font-family: var(--g-font-mono);
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--g-muted);
		margin-bottom: var(--g-space-sm);
	}

	.cat-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
		gap: var(--g-space-sm);
	}

	.cat-card {
		background: var(--g-surface);
		border: 1px solid var(--g-border);
		border-radius: var(--g-radius-md);
		padding: var(--g-space-md);
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		align-items: flex-start;
		cursor: pointer;
		transition: border-color var(--g-transition-fast), box-shadow var(--g-transition-fast);
		position: relative;
		width: 100%;
		text-align: left;
	}

	.cat-card:hover {
		border-color: var(--g-flight);
		box-shadow: var(--g-shadow-hover);
	}

	.cat-card.custom {
		border-style: dashed;
		cursor: default;
		padding: 0;
	}

	.cat-card-inner {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		align-items: flex-start;
		padding: var(--g-space-md);
		width: 100%;
		text-align: left;
		background: none;
	}

	.cat-card.custom:hover {
		border-color: var(--g-flight);
	}

	.cat-glyph {
		font-size: 1.2rem;
		color: var(--g-flight);
	}

	.cat-label {
		font-size: 0.88rem;
		color: var(--g-text);
		text-align: left;
	}

	.cat-delete {
		position: absolute;
		top: var(--g-space-xs);
		right: var(--g-space-xs);
		font-size: 0.85rem;
		color: var(--g-muted);
		padding: 2px 4px;
	}

	.cat-delete:hover { color: var(--g-flight); }

	.btn-custom {
		font-family: var(--g-font-mono);
		font-size: 0.8rem;
		color: var(--g-muted);
		border: 1px dashed var(--g-border);
		border-radius: var(--g-radius-pill);
		padding: 0.35rem 0.9rem;
		align-self: flex-start;
		transition: all var(--g-transition-fast);
	}

	.btn-custom:hover { color: var(--g-flight); border-color: var(--g-flight); }

	/* ── subject step ── */
	.subject-input {
		font-family: var(--g-font-display);
		font-size: 1.6rem;
		font-weight: 400;
		color: var(--g-text);
		background: transparent;
		border: none;
		border-bottom: 1px solid var(--g-border);
		padding-bottom: 0.3rem;
		width: 100%;
		transition: border-color var(--g-transition-fast);
	}

	.subject-input:focus {
		border-color: var(--g-flight);
		outline: none;
	}

	.disambig-label {
		display: flex;
		flex-direction: column;
		gap: var(--g-space-xs);
	}

	.label-text {
		font-family: var(--g-font-mono);
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--g-muted);
	}

	.disambig-input {
		background: var(--g-surface);
		border: 1px solid var(--g-border);
		border-radius: var(--g-radius-sm);
		padding: var(--g-space-sm) var(--g-space-md);
		color: var(--g-text-dim);
		font-size: 0.9rem;
		width: 100%;
	}

	/* ── fields step ── */
	.field-group {
		display: flex;
		flex-direction: column;
		gap: var(--g-space-xs);
	}

	.field-group-label {
		font-family: var(--g-font-mono);
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--g-muted);
		margin-bottom: 0.2rem;
	}

	.root-fields {
		padding: var(--g-space-md);
		background: var(--g-surface);
		border-radius: var(--g-radius-md);
		border: 1px solid var(--g-border);
	}

	.field-check {
		display: flex;
		align-items: center;
		gap: var(--g-space-sm);
		font-size: 0.9rem;
		color: var(--g-text-dim);
		cursor: pointer;
		padding: 0.2rem 0;
	}

	.field-check input {
		accent-color: var(--g-flight);
	}

	.field-hint {
		font-size: 0.75rem;
		color: var(--g-muted);
		margin-left: 0.5rem;
	}

	.child-level {
		border-left: 2px solid var(--g-border);
		padding-left: var(--g-space-lg);
		margin-left: calc(var(--depth, 0) * var(--g-space-lg));
	}

	.level-header {
		margin-bottom: var(--g-space-sm);
	}

	.level-toggle {
		display: flex;
		align-items: center;
		gap: var(--g-space-sm);
		cursor: pointer;
	}

	.level-toggle input {
		accent-color: var(--g-flight);
	}

	.level-label {
		font-family: var(--g-font-mono);
		font-size: 0.8rem;
		color: var(--g-flight);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	/* ── modifiers step ── */
	.modifiers-list {
		display: flex;
		flex-direction: column;
		gap: var(--g-space-sm);
	}

	.mod-item {
		display: flex;
		align-items: flex-start;
		gap: var(--g-space-md);
		padding: var(--g-space-md);
		background: var(--g-surface);
		border: 1px solid var(--g-border);
		border-radius: var(--g-radius-md);
		cursor: pointer;
		transition: border-color var(--g-transition-fast);
	}

	.mod-item.checked { border-color: var(--g-flight); }
	.mod-item:hover { border-color: var(--g-flight-active); }

	.mod-item input { accent-color: var(--g-flight); flex-shrink: 0; margin-top: 2px; }

	.mod-body {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.mod-label {
		font-size: 0.9rem;
		color: var(--g-text);
	}

	.mod-hint {
		font-size: 0.8rem;
		color: var(--g-muted);
	}

	/* ── review step ── */
	.step-review {
		gap: var(--g-space-xl);
	}

	.spell-block {
		background: var(--g-surface);
		border: 1px solid var(--g-border);
		border-radius: var(--g-radius-md);
		overflow: hidden;
	}

	.spell-toolbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--g-space-sm) var(--g-space-md);
		border-bottom: 1px solid var(--g-rule);
		background: var(--g-surface-2);
	}

	.spell-label {
		font-family: var(--g-font-mono);
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--g-muted);
	}

	.btn-copy {
		font-family: var(--g-font-mono);
		font-size: 0.78rem;
		color: var(--g-flight);
		border: 1px solid var(--g-flight-soft);
		border-radius: var(--g-radius-pill);
		padding: 0.2rem 0.7rem;
		transition: background var(--g-transition-fast), color var(--g-transition-fast);
	}

	.btn-copy:hover { background: var(--g-flight); color: #0d0d1a; }

	.spell-text {
		font-family: var(--g-font-mono);
		font-size: 0.78rem;
		color: var(--g-text-dim);
		padding: var(--g-space-md);
		overflow-x: auto;
		white-space: pre-wrap;
		word-break: break-word;
		max-height: 280px;
		overflow-y: auto;
		line-height: 1.5;
	}

	.paste-instruction {
		font-size: 0.88rem;
		color: var(--g-muted);
		font-style: italic;
	}

	.paste-block {
		display: flex;
		flex-direction: column;
		gap: var(--g-space-sm);
	}

	.paste-area {
		background: var(--g-surface);
		border: 1px solid var(--g-border);
		border-radius: var(--g-radius-md);
		padding: var(--g-space-md);
		font-family: var(--g-font-mono);
		font-size: 0.8rem;
		color: var(--g-text);
		width: 100%;
		min-height: 150px;
		resize: vertical;
		line-height: 1.5;
		transition: border-color var(--g-transition-fast);
	}

	.paste-area:focus {
		border-color: var(--g-flight);
		outline: none;
	}

	.btn-grow {
		background: var(--g-flight);
		color: #0d0d1a;
		border-radius: var(--g-radius-sm);
		padding: var(--g-space-sm) var(--g-space-xl);
		font-size: 0.9rem;
		font-weight: 600;
		align-self: flex-start;
		transition: opacity var(--g-transition-fast);
	}

	.btn-grow:disabled { opacity: 0.4; }

	.import-errors {
		background: rgba(240, 143, 184, 0.08);
		border: 1px solid rgba(240, 143, 184, 0.2);
		border-radius: var(--g-radius-md);
		padding: var(--g-space-md);
		display: flex;
		flex-direction: column;
		gap: var(--g-space-xs);
	}

	.error-line {
		font-size: 0.85rem;
		color: var(--g-flight);
	}

	.import-preview {
		display: flex;
		flex-direction: column;
		gap: var(--g-space-md);
	}

	.warnings {
		display: flex;
		flex-direction: column;
		gap: var(--g-space-xs);
	}

	.warning-line {
		font-size: 0.82rem;
		color: var(--g-flight-active);
	}

	.preview-card {
		background: var(--g-surface);
		border: 1px solid var(--g-flight-soft);
		border-radius: var(--g-radius-md);
		padding: var(--g-space-lg);
		display: flex;
		flex-direction: column;
		gap: var(--g-space-sm);
	}

	.preview-title {
		font-family: var(--g-font-display);
		font-size: 1.3rem;
		color: var(--g-text);
	}

	.preview-body {
		font-size: 0.88rem;
		color: var(--g-text-dim);
		line-height: 1.6;
	}

	.spellbook-assign {
		display: flex;
		flex-direction: column;
		gap: var(--g-space-sm);
	}

	.assign-label {
		font-family: var(--g-font-mono);
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--g-muted);
	}

	.assign-checks {
		display: flex;
		flex-wrap: wrap;
		gap: var(--g-space-sm);
	}

	.assign-item {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.85rem;
		color: var(--g-text-dim);
		cursor: pointer;
		padding: 0.3rem 0.7rem;
		border: 1px solid var(--g-border);
		border-radius: var(--g-radius-pill);
	}

	.assign-item input { accent-color: var(--g-flight); }

	.btn-plant {
		background: var(--g-flight-active);
		color: #0d0d1a;
		border-radius: var(--g-radius-sm);
		padding: var(--g-space-sm) var(--g-space-xl);
		font-size: 0.9rem;
		font-weight: 700;
		align-self: flex-start;
		transition: opacity var(--g-transition-fast);
	}

	/* ── nav buttons ── */
	.step-nav {
		display: flex;
		gap: var(--g-space-sm);
		margin-top: var(--g-space-sm);
	}

	.btn-primary {
		background: var(--g-flight);
		color: #0d0d1a;
		border-radius: var(--g-radius-sm);
		padding: var(--g-space-sm) var(--g-space-lg);
		font-size: 0.88rem;
		font-weight: 600;
		transition: opacity var(--g-transition-fast);
	}

	.btn-primary:disabled { opacity: 0.4; }

	.btn-ghost {
		border: 1px solid var(--g-border);
		border-radius: var(--g-radius-sm);
		padding: var(--g-space-sm) var(--g-space-lg);
		font-size: 0.88rem;
		color: var(--g-text-dim);
		transition: border-color var(--g-transition-fast);
	}

	.btn-ghost:hover { border-color: var(--g-flight); }
</style>
