<script lang="ts">
	import { garden, SAMPLE_STRUCTURED_SPORE } from '$lib/garden.svelte';
	import type { Spore } from '$lib/types';
	import { formatDate } from '$lib/utils';

	let spore = $derived(garden.activeSpore);
	let editing = $derived(garden.editingSporeId === garden.activeSporeId);

	let draftTitle = $state('');
	let draftBody = $state('');

	$effect(() => {
		if (spore && editing) {
			draftTitle = spore.title;
			draftBody = spore.body;
		}
	});

	function startEdit() {
		if (!spore) return;
		garden.editingSporeId = spore.id;
		draftTitle = spore.title;
		draftBody = spore.body;
	}

	function saveEdit() {
		if (!spore) return;
		garden.updateSpore(spore.id, { title: draftTitle.trim() || spore.title, body: draftBody });
		garden.editingSporeId = null;
	}

	function cancelEdit() {
		garden.editingSporeId = null;
	}

	function handleDelete() {
		if (!spore) return;
		if (confirm(`Delete "${spore.title}"? This cannot be undone.`)) {
			garden.deleteSpore(spore.id);
		}
	}

	function handleBack() {
		if (garden.activeSpellbookId) garden.currentView = 'spellbook';
		else garden.openGarden();
	}

	// ── flights ────────────────────────────────────────────────────

	let linkedSpores = $derived(spore ? garden.linkedSpores(spore.id) : []);

	function handleAddFlight() {
		garden.showAddFlight = true;
		garden.flightSearchQuery = '';
	}

	function handleFlightSelect(targetSpore: Spore) {
		if (!spore) return;
		garden.addFlight(spore.id, targetSpore.id);
		garden.showAddFlight = false;
		garden.flightSearchQuery = '';
	}

	function handleDeleteFlight(flightId: string) {
		garden.deleteFlight(flightId);
	}

	// ── structured data / branches ─────────────────────────────────

	let branches = $derived(
		spore?.data?.branches as Array<Record<string, unknown>> | undefined
	);

	function handlePromote(branchKey: string) {
		if (!spore) return;
		const promoted = garden.promoteBranch(spore.id, branchKey);
		if (promoted) garden.openSpore(promoted.id);
	}

	// ── spellbook membership ────────────────────────────────────────

	function toggleMembership(spellbookId: string) {
		if (!spore) return;
		if (spore.spellbookIds.includes(spellbookId)) {
			garden.removeFromSpellbook(spore.id, spellbookId);
		} else {
			garden.addToSpellbook(spore.id, spellbookId);
		}
	}

	// ── sample structured spore ─────────────────────────────────────

	function loadSampleStructured() {
		// Import seam stub: seeds the sample structured spore for demo
		const exists = garden.spores.find((s) => s.id === SAMPLE_STRUCTURED_SPORE.id);
		if (!exists) {
			garden.spores = [...garden.spores, SAMPLE_STRUCTURED_SPORE];
		}
		garden.openSpore(SAMPLE_STRUCTURED_SPORE.id);
	}
</script>

{#if spore}
	<article class="spore-view">
		<header class="spore-header">
			<button class="back-btn" onclick={handleBack}>
				← {garden.activeSpellbook ? garden.activeSpellbook.title : 'garden'}
			</button>

			{#if editing}
				<input class="title-input" bind:value={draftTitle} />
			{:else}
				<h1 class="spore-title">{spore.title}</h1>
			{/if}

			<div class="header-meta">
				<span class="spore-date">{formatDate(spore.updated)}</span>
				<div class="header-actions">
					{#if editing}
						<button class="btn-primary" onclick={saveEdit}>save</button>
						<button class="btn-ghost" onclick={cancelEdit}>cancel</button>
					{:else}
						<button class="btn-ghost" onclick={startEdit}>edit</button>
						<button class="btn-danger-ghost" onclick={handleDelete}>delete</button>
					{/if}
				</div>
			</div>
		</header>

		<!-- body -->
		<div class="spore-body-section">
			{#if editing}
				<textarea
					class="body-editor"
					bind:value={draftBody}
					placeholder="write something…"
					rows={10}
				></textarea>
			{:else if spore.body}
				<div class="body-text">{spore.body}</div>
			{:else}
				<button class="body-placeholder" onclick={startEdit}>add a body…</button>
			{/if}
		</div>

		<!-- structured data / branches (import seam) -->
		{#if branches && branches.length > 0}
			<section class="branches-section">
				<h3 class="section-label">branches</h3>
				<p class="branches-hint">Promote a branch to its own Spore when you have something to say.</p>
				<ul class="branches-list">
					{#each branches as branch}
						<li class="branch-item">
							<div class="branch-info">
								<span class="branch-label">{branch.label ?? branch.key}</span>
								{#if branch.year}
									<span class="branch-meta">{branch.year}</span>
								{/if}
								{#if branch.notes}
									<p class="branch-notes">{branch.notes}</p>
								{/if}
							</div>
							<button
								class="btn-promote"
								onclick={() => handlePromote(String(branch.key))}
							>
								promote →
							</button>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		<!-- lines of flight -->
		<section class="flights-section">
			<div class="flights-header">
				<h3 class="section-label">lines of flight</h3>
				<button class="btn-add-flight" onclick={handleAddFlight}>+ link</button>
			</div>

			{#if garden.showAddFlight}
				<div class="flight-search">
					<input
						autofocus
						class="flight-input"
						type="text"
						placeholder="search spores…"
						bind:value={garden.flightSearchQuery}
					/>
					{#if garden.flightSearchResults.length > 0}
						<ul class="search-results">
							{#each garden.flightSearchResults as result}
								<li>
									<button
										class="search-result-btn"
										onclick={() => handleFlightSelect(result)}
									>
										{result.title}
									</button>
								</li>
							{/each}
						</ul>
					{:else if garden.flightSearchQuery.trim()}
						<p class="no-results">no matches</p>
					{/if}
					<button
						class="btn-ghost-sm"
						onclick={() => { garden.showAddFlight = false; garden.flightSearchQuery = ''; }}
					>
						cancel
					</button>
				</div>
			{/if}

			{#if linkedSpores.length === 0 && !garden.showAddFlight}
				<p class="flights-empty">No connections yet.</p>
			{:else}
				<ul class="flights-list">
					{#each linkedSpores as { flight, spore: linked }}
						<li class="flight-item">
							<button
								class="flight-link"
								onclick={() => garden.openSpore(linked.id)}
							>
								<span class="flight-glyph">⟶</span>
								<span class="flight-name">{linked.title}</span>
								{#if flight.label}
									<span class="flight-label">{flight.label}</span>
								{/if}
							</button>
							<button
								class="flight-delete"
								onclick={() => handleDeleteFlight(flight.id)}
								title="remove link"
							>×</button>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<!-- spellbook membership -->
		<section class="membership-section">
			<h3 class="section-label">spellbooks</h3>
			{#if garden.spellbooks.length === 0}
				<p class="membership-empty">No spellbooks yet.</p>
			{:else}
				<ul class="membership-list">
					{#each garden.spellbooks as sb}
						<li>
							<label class="membership-item" class:active={spore.spellbookIds.includes(sb.id)}>
								<input
									type="checkbox"
									checked={spore.spellbookIds.includes(sb.id)}
									onchange={() => toggleMembership(sb.id)}
								/>
								{sb.title}
								<span class="sb-arch">{sb.archetype}</span>
							</label>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	</article>
{/if}

<style>
	.spore-view {
		padding: var(--g-space-xl) var(--g-space-lg);
		max-width: 720px;
	}

	.back-btn {
		font-family: var(--g-font-mono);
		font-size: 0.78rem;
		color: var(--g-muted);
		display: block;
		margin-bottom: var(--g-space-lg);
		transition: color var(--g-transition-fast);
	}

	.back-btn:hover { color: var(--g-flight); }

	.spore-header {
		margin-bottom: var(--g-space-xl);
	}

	.spore-title {
		font-family: var(--g-font-display);
		font-size: clamp(1.8rem, 4vw, 2.8rem);
		font-weight: 400;
		color: var(--g-text);
		line-height: 1.2;
		margin-bottom: var(--g-space-md);
	}

	.title-input {
		font-family: var(--g-font-display);
		font-size: clamp(1.8rem, 4vw, 2.8rem);
		font-weight: 400;
		color: var(--g-text);
		background: transparent;
		border-bottom: 1px solid var(--g-flight);
		border-radius: 0;
		width: 100%;
		margin-bottom: var(--g-space-md);
		padding-bottom: 0.2rem;
	}

	.header-meta {
		display: flex;
		align-items: center;
		gap: var(--g-space-lg);
	}

	.spore-date {
		font-family: var(--g-font-mono);
		font-size: 0.72rem;
		color: var(--g-muted);
	}

	.header-actions {
		display: flex;
		gap: var(--g-space-sm);
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
		transition: border-color var(--g-transition-fast);
	}

	.btn-ghost:hover { border-color: var(--g-flight); }

	.btn-ghost-sm {
		font-family: var(--g-font-mono);
		font-size: 0.78rem;
		color: var(--g-muted);
		transition: color var(--g-transition-fast);
	}

	.btn-ghost-sm:hover { color: var(--g-flight); }

	.btn-danger-ghost {
		border: 1px solid var(--g-border);
		border-radius: var(--g-radius-sm);
		padding: 0.3rem 0.8rem;
		font-size: 0.82rem;
		color: var(--g-muted);
		transition: all var(--g-transition-fast);
	}

	.btn-danger-ghost:hover { color: var(--g-flight); border-color: var(--g-flight); }

	/* ── body ── */
	.spore-body-section {
		margin-bottom: var(--g-space-2xl);
		padding-bottom: var(--g-space-2xl);
		border-bottom: 1px solid var(--g-rule);
	}

	.body-text {
		font-family: var(--g-font-body);
		font-size: 1rem;
		line-height: 1.75;
		color: var(--g-text);
		white-space: pre-wrap;
	}

	.body-editor {
		width: 100%;
		background: var(--g-surface);
		border: 1px solid var(--g-border);
		border-radius: var(--g-radius-md);
		padding: var(--g-space-md);
		font-size: 1rem;
		line-height: 1.7;
		color: var(--g-text);
		min-height: 200px;
	}

	.body-placeholder {
		font-family: var(--g-font-mono);
		font-size: 0.85rem;
		color: var(--g-muted);
		font-style: italic;
		transition: color var(--g-transition-fast);
	}

	.body-placeholder:hover { color: var(--g-flight); }

	/* ── branches ── */
	.branches-section {
		margin-bottom: var(--g-space-2xl);
		padding-bottom: var(--g-space-xl);
		border-bottom: 1px solid var(--g-rule);
	}

	.section-label {
		font-family: var(--g-font-mono);
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--g-muted);
		font-weight: 400;
		margin-bottom: var(--g-space-sm);
	}

	.branches-hint {
		font-size: 0.82rem;
		color: var(--g-muted);
		margin-bottom: var(--g-space-md);
		font-style: italic;
	}

	.branches-list {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: var(--g-space-sm);
	}

	.branch-item {
		display: flex;
		align-items: flex-start;
		gap: var(--g-space-md);
		padding: var(--g-space-md);
		background: var(--g-surface);
		border: 1px solid var(--g-border);
		border-radius: var(--g-radius-md);
	}

	.branch-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.branch-label {
		font-family: var(--g-font-display);
		font-size: 1rem;
		color: var(--g-text);
	}

	.branch-meta {
		font-family: var(--g-font-mono);
		font-size: 0.72rem;
		color: var(--g-muted);
	}

	.branch-notes {
		font-size: 0.85rem;
		color: var(--g-text-dim);
	}

	.btn-promote {
		font-family: var(--g-font-mono);
		font-size: 0.75rem;
		color: var(--g-flight);
		border: 1px solid var(--g-flight-soft);
		border-radius: var(--g-radius-pill);
		padding: 0.25rem 0.6rem;
		flex-shrink: 0;
		transition: background var(--g-transition-fast), color var(--g-transition-fast);
	}

	.btn-promote:hover {
		background: var(--g-flight);
		color: #0d0d1a;
	}

	/* ── flights ── */
	.flights-section {
		margin-bottom: var(--g-space-2xl);
		padding-bottom: var(--g-space-xl);
		border-bottom: 1px solid var(--g-rule);
	}

	.flights-header {
		display: flex;
		align-items: center;
		gap: var(--g-space-md);
		margin-bottom: var(--g-space-md);
	}

	.btn-add-flight {
		font-family: var(--g-font-mono);
		font-size: 0.75rem;
		color: var(--g-flight);
		border: 1px solid var(--g-flight-soft);
		border-radius: var(--g-radius-pill);
		padding: 0.2rem 0.6rem;
		transition: background var(--g-transition-fast), color var(--g-transition-fast);
	}

	.btn-add-flight:hover {
		background: var(--g-flight);
		color: #0d0d1a;
	}

	.flight-search {
		background: var(--g-surface);
		border: 1px solid var(--g-border);
		border-radius: var(--g-radius-md);
		padding: var(--g-space-md);
		margin-bottom: var(--g-space-md);
		display: flex;
		flex-direction: column;
		gap: var(--g-space-sm);
	}

	.flight-input {
		background: var(--g-surface-2);
		border: 1px solid var(--g-border);
		border-radius: var(--g-radius-sm);
		padding: var(--g-space-sm) var(--g-space-md);
		color: var(--g-text);
		font-size: 0.9rem;
		width: 100%;
	}

	.search-results {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.search-result-btn {
		width: 100%;
		text-align: left;
		padding: var(--g-space-sm) var(--g-space-md);
		font-size: 0.9rem;
		color: var(--g-text);
		border-radius: var(--g-radius-sm);
		transition: background var(--g-transition-fast), color var(--g-transition-fast);
	}

	.search-result-btn:hover {
		background: var(--g-flight-soft);
		color: var(--g-flight);
	}

	.no-results {
		font-size: 0.82rem;
		color: var(--g-muted);
		padding: var(--g-space-sm) var(--g-space-md);
	}

	.flights-empty {
		font-size: 0.85rem;
		color: var(--g-muted);
	}

	.flights-list {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: var(--g-space-xs);
	}

	.flight-item {
		display: flex;
		align-items: center;
		gap: var(--g-space-sm);
	}

	.flight-link {
		display: flex;
		align-items: center;
		gap: var(--g-space-sm);
		flex: 1;
		padding: var(--g-space-sm) 0;
		color: var(--g-flight);
		transition: color var(--g-transition-fast);
		text-align: left;
	}

	.flight-link:hover {
		color: var(--g-flight-active);
	}

	.flight-glyph {
		font-size: 0.85rem;
		opacity: 0.7;
	}

	.flight-name {
		font-size: 0.95rem;
	}

	.flight-label {
		font-family: var(--g-font-mono);
		font-size: 0.7rem;
		color: var(--g-muted);
	}

	.flight-delete {
		color: var(--g-muted);
		font-size: 1rem;
		padding: 0 var(--g-space-xs);
		transition: color var(--g-transition-fast);
	}

	.flight-delete:hover {
		color: var(--g-flight);
	}

	/* ── membership ── */
	.membership-section {
		margin-bottom: var(--g-space-2xl);
	}

	.membership-empty {
		font-size: 0.85rem;
		color: var(--g-muted);
	}

	.membership-list {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: var(--g-space-xs);
		margin-top: var(--g-space-sm);
	}

	.membership-item {
		display: flex;
		align-items: center;
		gap: var(--g-space-sm);
		font-size: 0.9rem;
		color: var(--g-text-dim);
		cursor: pointer;
		padding: var(--g-space-xs) 0;
	}

	.membership-item.active {
		color: var(--g-flight);
	}

	.membership-item input {
		accent-color: var(--g-flight);
		width: 14px;
		height: 14px;
	}

	.sb-arch {
		font-family: var(--g-font-mono);
		font-size: 0.7rem;
		color: var(--g-muted);
		margin-left: auto;
	}
</style>
