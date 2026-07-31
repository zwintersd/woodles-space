<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { notebook } from '$lib/notebook.svelte';
	import { LANES, LANE_LABEL, type Lane } from '$lib/types';
	import { formatBytes } from '@woodles/persistence';
	import type { HandoffTarget } from '@woodles/handoff';

	const SEND_TO: { id: HandoffTarget; label: string; shortLabel: string }[] = [
		{ id: 'spores', label: 'grow in spores', shortLabel: 'spores' },
		{ id: 'write', label: 'shape in write', shortLabel: 'write' }
	];

	let importInput = $state<HTMLInputElement>();
	let searchInput = $state<HTMLInputElement>();
	let bodyInput = $state<HTMLTextAreaElement>();
	let handoffNotice = $state('');
	let deleteArmed = $state(false);

	const capture = $derived(notebook.selected);
	const captureTags = $derived(capture?.tags.join(', ') ?? '');

	onMount(() => {
		const caught = notebook.ingestHandoffs();
		if (caught > 0) {
			handoffNotice = `Caught ${caught} ${caught === 1 ? 'thought' : 'thoughts'} from elsewhere.`;
		}
	});

	function send(target: HandoffTarget) {
		if (!capture) return;
		const result = notebook.promote(capture.id, target);
		handoffNotice = result?.ok
			? `Sent to ${target}. It will be waiting when you open it.`
			: `Could not send this page to ${target}.`;
	}

	function updateTags(value: string) {
		if (!capture) return;
		const tags = value
			.split(',')
			.map((tag) => tag.trim())
			.filter(Boolean);
		notebook.update(capture.id, { tags });
	}

	async function newCapture() {
		notebook.add();
		deleteArmed = false;
		await tick();
		bodyInput?.focus();
	}

	function selectCapture(id: string) {
		notebook.select(id);
		deleteArmed = false;
	}

	function deleteCapture() {
		if (!capture || notebook.captures.length <= 1) return;
		if (!deleteArmed) {
			deleteArmed = true;
			return;
		}
		notebook.remove(capture.id);
		deleteArmed = false;
	}

	function handleKeydown(event: KeyboardEvent) {
		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
			event.preventDefault();
			searchInput?.focus();
			return;
		}

		const tag = (event.target as HTMLElement)?.tagName?.toLowerCase();
		if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

		if (event.key === '1') notebook.setLaneFilter('spark');
		if (event.key === '2') notebook.setLaneFilter('shape');
		if (event.key === '3') notebook.setLaneFilter('later');
		if (event.key === '0' || event.key === 'Escape') notebook.setLaneFilter(null);
		if (event.key === 'n' || event.key === 'N') void newCapture();
	}

	function captureTitle(title: string, body: string): string {
		return title.trim() || body.split('\n').find((line) => line.trim())?.trim() || 'Untitled';
	}

	function capturePreview(body: string, tags: string[]): string {
		return body.replace(/\s+/g, ' ').trim() || tags.join(' · ') || 'A blank page';
	}

	function shortDate(value: string): string {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return '';
		return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
	}

	function longDate(value: string): string {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return '';
		return new Intl.DateTimeFormat(undefined, {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		}).format(date);
	}

	function downloadNotebook() {
		const url = URL.createObjectURL(new Blob([notebook.exportJSON()], { type: 'application/json' }));
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = `notebook-${new Date().toISOString().slice(0, 10)}.json`;
		anchor.click();
		URL.revokeObjectURL(url);
	}

	async function importNotebook(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		try {
			notebook.importJSON(await file.text());
		} catch {
			notebook.importJSON('');
		} finally {
			input.value = '';
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="notebook-shell">
	<header class="app-bar">
		<a class="back-home" href="/" aria-label="Back to woodles.space">
			<span aria-hidden="true">←</span>
			<span class="back-home-label">woodles.space</span>
		</a>

		<div class="identity">
			<span class="identity-mark" aria-hidden="true">✦</span>
			<div>
				<p>catch it before it goes</p>
				<h1>Notebook</h1>
			</div>
		</div>

		<div class="app-actions">
			<label class="search-field">
				<span aria-hidden="true"></span>
				<input
					bind:this={searchInput}
					type="search"
					bind:value={notebook.query}
					placeholder="Search pages"
					aria-label="Search notebook"
				/>
				<kbd>⌘K</kbd>
			</label>
			<button class="new-page-button" type="button" onclick={newCapture}>
				<span aria-hidden="true">＋</span>
				New page
			</button>
		</div>
	</header>

	{#if handoffNotice}
		<div class="notice" role="status">
			<span aria-hidden="true">✦</span>
			<p>{handoffNotice}</p>
			<button type="button" onclick={() => (handoffNotice = '')} aria-label="Dismiss message">×</button>
		</div>
	{/if}

	<main class="notebook-spread">
		<aside class="capture-page" aria-label="Notebook pages">
			<header class="capture-header">
				<div>
					<p class="eyebrow">your notebook</p>
					<h2>Open pages</h2>
				</div>
				<span class="capture-count">{notebook.captures.length}</span>
			</header>

			<div class="lane-filters" aria-label="Filter pages by lane">
				<button
					type="button"
					class:active={notebook.laneFilter === null}
					aria-pressed={notebook.laneFilter === null}
					onclick={() => notebook.setLaneFilter(null)}
				>
					<span class="lane-dot all" aria-hidden="true"></span>
					All
				</button>
				{#each LANES as lane}
					<button
						type="button"
						class:active={notebook.laneFilter === lane}
						aria-pressed={notebook.laneFilter === lane}
						onclick={() => notebook.setLaneFilter(lane)}
					>
						<span class="lane-dot" data-lane={lane} aria-hidden="true"></span>
						{LANE_LABEL[lane]}
						<small>{notebook.laneCount(lane)}</small>
					</button>
				{/each}
			</div>

			<div class="capture-list">
				{#each notebook.filtered as listed (listed.id)}
					<button
						type="button"
						class="capture-row"
						class:active={capture?.id === listed.id}
						data-lane={listed.lane}
						aria-current={capture?.id === listed.id ? 'page' : undefined}
						onclick={() => selectCapture(listed.id)}
					>
						<span class="row-marker" aria-hidden="true"></span>
						<span class="capture-row-top">
							<strong>{captureTitle(listed.title, listed.body)}</strong>
							<time datetime={listed.updatedAt}>{shortDate(listed.updatedAt)}</time>
						</span>
						<span class="capture-preview">{capturePreview(listed.body, listed.tags)}</span>
						{#if listed.tags.length > 0}
							<span class="tag-preview">
								{#each listed.tags.slice(0, 2) as tag}
									<small>#{tag}</small>
								{/each}
								{#if listed.tags.length > 2}<small>+{listed.tags.length - 2}</small>{/if}
							</span>
						{/if}
					</button>
				{:else}
					<div class="list-empty">
						<span aria-hidden="true">☾</span>
						<strong>No pages found</strong>
						<p>Try another search or clear the lane filter.</p>
						<button type="button" onclick={() => notebook.setLaneFilter(null)}>Show everything</button>
					</div>
				{/each}
			</div>

			<footer class="capture-footer">
				<div
					class="save-state"
					class:error={notebook.persistenceHealth.status === 'error'}
					class:recovered={notebook.persistenceHealth.status === 'recovered'}
					aria-live="polite"
				>
					<span aria-hidden="true"></span>
					<div>
						<strong>{notebook.persistenceHealth.message}</strong>
						{#if notebook.persistenceHealth.bytes > 0}
							<small>{formatBytes(notebook.persistenceHealth.bytes)}</small>
						{/if}
					</div>
				</div>
				<div class="file-actions">
					<button type="button" onclick={downloadNotebook}>Export</button>
					<button type="button" onclick={() => importInput?.click()}>Import</button>
					<input
						bind:this={importInput}
						class="file-input"
						type="file"
						accept="application/json,.json"
						onchange={importNotebook}
					/>
				</div>
			</footer>
		</aside>

		<div class="book-seam" aria-hidden="true">
			{#each Array(7) as _}
				<span></span>
			{/each}
		</div>

		<section class="editor-page" aria-label="Open notebook page">
			{#if capture}
				<header class="editor-header">
					<div class="lane-picker" role="group" aria-label="Move page to lane">
						<span>Keep in</span>
						{#each LANES as lane}
							<button
								type="button"
								data-lane={lane}
								class:active={capture.lane === lane}
								aria-pressed={capture.lane === lane}
								onclick={() => notebook.move(capture.id, lane)}
							>
								<span aria-hidden="true"></span>
								{LANE_LABEL[lane]}
							</button>
						{/each}
					</div>
					<time class="updated-time" datetime={capture.updatedAt}>
						<span>last changed</span>
						{longDate(capture.updatedAt)}
					</time>
				</header>

				<div class="writing-area">
					<label class="title-label">
						<span>Page title</span>
						<input
							class="title-input"
							value={capture.title}
							placeholder="Untitled thought"
							aria-label="Capture title"
							oninput={(event) =>
								notebook.update(capture.id, { title: event.currentTarget.value })}
						/>
					</label>

					<label class="tag-field">
						<span aria-hidden="true">#</span>
						<input
							value={captureTags}
							placeholder="Add tags, separated by commas"
							aria-label="Capture tags"
							onchange={(event) => updateTags(event.currentTarget.value)}
						/>
					</label>

					<div class="body-field">
						<div class="page-holes" aria-hidden="true">
							<span></span>
							<span></span>
							<span></span>
						</div>
						<textarea
							bind:this={bodyInput}
							value={capture.body}
							aria-label="Capture body"
							placeholder="Start anywhere. This page can be messy."
							spellcheck="true"
							oninput={(event) =>
								notebook.update(capture.id, { body: event.currentTarget.value })}
						></textarea>
					</div>
				</div>

				<footer class="editor-footer">
					<div class="send-actions">
						<span>Ready for more?</span>
						{#each SEND_TO as target}
							<button
								type="button"
								onclick={() => send(target.id)}
								title="Send this page to {target.shortLabel}"
							>
								{target.label}
								<span aria-hidden="true">↗</span>
							</button>
						{/each}
					</div>

					<div class="delete-actions">
						{#if deleteArmed}
							<button class="cancel-delete" type="button" onclick={() => (deleteArmed = false)}>
								Cancel
							</button>
						{/if}
						<button
							class="delete-page"
							class:armed={deleteArmed}
							type="button"
							onclick={deleteCapture}
							disabled={notebook.captures.length <= 1}
						>
							{deleteArmed ? 'Confirm delete' : 'Delete page'}
						</button>
					</div>
				</footer>
			{/if}
		</section>
	</main>

	<p class="keyboard-hint"><kbd>N</kbd> new page · <kbd>1–3</kbd> filter lanes · <kbd>0</kbd> show all</p>
</div>

<style>
	.notebook-shell {
		width: min(1440px, 100%);
		min-height: 100vh;
		margin: 0 auto;
		padding: clamp(0.75rem, 2vw, 1.5rem);
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.app-bar {
		min-height: 3.75rem;
		display: grid;
		grid-template-columns: minmax(9rem, 1fr) auto minmax(22rem, 1fr);
		align-items: center;
		gap: 1rem;
		padding: 0.55rem 0.7rem;
		border: 1px solid rgba(111, 70, 125, 0.16);
		border-radius: 16px;
		background: rgba(255, 250, 253, 0.76);
		box-shadow: 0 10px 30px rgba(83, 42, 92, 0.08);
		backdrop-filter: blur(14px);
	}

	.back-home {
		width: fit-content;
		min-height: 2.5rem;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0 0.65rem;
		border-radius: 10px;
		color: var(--nb-muted);
		font-size: 0.75rem;
		font-weight: 600;
		text-decoration: none;
	}

	.back-home > span:first-child {
		color: var(--nb-rose);
		font-size: 1rem;
	}

	.back-home:hover {
		background: var(--nb-rose-soft);
		color: var(--nb-ink);
	}

	.identity {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.65rem;
	}

	.identity-mark {
		width: 2.3rem;
		height: 2.3rem;
		display: grid;
		place-items: center;
		border: 1px solid rgba(164, 71, 126, 0.24);
		border-radius: 50%;
		background: linear-gradient(145deg, var(--nb-yellow-soft), var(--nb-rose-soft));
		color: var(--nb-rose);
		box-shadow: inset 0 0 0 3px rgba(255, 255, 255, 0.62);
	}

	.identity p,
	.eyebrow,
	.title-label > span {
		font-family: var(--nb-font-sans);
		font-size: 0.62rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--nb-muted);
	}

	.identity h1 {
		font-family: var(--nb-font-display);
		font-size: 1.65rem;
		font-weight: 600;
		line-height: 0.9;
		color: var(--nb-ink);
	}

	.app-actions {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.55rem;
	}

	.search-field {
		width: min(18rem, 100%);
		height: 2.6rem;
		display: flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0 0.65rem;
		border: 1px solid var(--nb-rule-strong);
		border-radius: 11px;
		background: rgba(255, 255, 255, 0.7);
		transition:
			border-color 140ms ease,
			box-shadow 140ms ease;
	}

	.search-field:focus-within {
		border-color: var(--nb-violet);
		box-shadow: 0 0 0 3px var(--nb-violet-soft);
	}

	.search-field > span {
		width: 0.75rem;
		height: 0.75rem;
		flex: 0 0 auto;
		border: 1.5px solid var(--nb-violet);
		border-radius: 50%;
		position: relative;
	}

	.search-field > span::after {
		content: "";
		position: absolute;
		right: -0.3rem;
		bottom: -0.18rem;
		width: 0.4rem;
		height: 1.5px;
		border-radius: 99px;
		background: var(--nb-violet);
		transform: rotate(45deg);
	}

	.search-field input {
		min-width: 0;
		flex: 1;
		font-size: 0.78rem;
	}

	.search-field input::placeholder {
		color: var(--nb-muted);
	}

	kbd {
		padding: 0.12rem 0.3rem;
		border: 1px solid var(--nb-rule-strong);
		border-radius: 5px;
		background: rgba(255, 255, 255, 0.65);
		color: var(--nb-muted);
		font-family: var(--nb-font-mono);
		font-size: 0.58rem;
		font-weight: 500;
		box-shadow: 0 1px 0 rgba(76, 45, 86, 0.12);
	}

	.new-page-button {
		min-height: 2.6rem;
		display: inline-flex;
		align-items: center;
		gap: 0.38rem;
		padding: 0 0.9rem;
		border: 1px solid #a5427e;
		border-radius: 11px;
		background: linear-gradient(180deg, #d760a4, #bd478c);
		color: #fff;
		font-size: 0.76rem;
		font-weight: 600;
		box-shadow: 0 3px 8px rgba(165, 66, 126, 0.2);
		transition:
			transform 120ms ease,
			box-shadow 120ms ease;
	}

	.new-page-button:hover {
		transform: translateY(-1px);
		box-shadow: 0 5px 12px rgba(165, 66, 126, 0.24);
	}

	.notice {
		align-self: flex-end;
		max-width: min(32rem, 100%);
		min-height: 2.6rem;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.5rem 0.55rem 0.5rem 0.8rem;
		border: 1px solid rgba(112, 84, 169, 0.28);
		border-radius: 12px;
		background: #f8f3ff;
		color: var(--nb-violet);
		box-shadow: 0 8px 24px rgba(71, 51, 104, 0.1);
		font-size: 0.76rem;
	}

	.notice > span {
		color: var(--nb-yellow);
	}

	.notice p {
		flex: 1;
	}

	.notice button {
		width: 2rem;
		height: 2rem;
		border-radius: 8px;
		color: var(--nb-muted);
	}

	.notice button:hover {
		background: var(--nb-violet-soft);
	}

	.notebook-spread {
		flex: 1;
		height: calc(100vh - 7.5rem);
		height: calc(100dvh - 7.5rem);
		min-height: 36rem;
		max-height: 62rem;
		display: grid;
		grid-template-columns: minmax(17rem, 21rem) 1.15rem minmax(0, 1fr);
		padding: 0.72rem;
		border: 1px solid rgba(86, 46, 95, 0.34);
		border-radius: 21px;
		background:
			linear-gradient(135deg, rgba(255, 255, 255, 0.18), transparent 32%),
			linear-gradient(145deg, #8a608f, #c35991 68%, #a14e85);
		box-shadow:
			0 24px 60px rgba(66, 31, 72, 0.2),
			0 5px 10px rgba(66, 31, 72, 0.15);
		position: relative;
	}

	.notebook-spread::before {
		content: "";
		position: absolute;
		inset: 0.3rem;
		border: 1px solid rgba(255, 255, 255, 0.23);
		border-radius: 17px;
		pointer-events: none;
	}

	.capture-page,
	.editor-page {
		min-width: 0;
		position: relative;
		z-index: 1;
		background-color: var(--nb-paper);
		background-image:
			linear-gradient(rgba(124, 90, 133, 0.035) 1px, transparent 1px),
			linear-gradient(90deg, rgba(124, 90, 133, 0.028) 1px, transparent 1px);
		background-size: 24px 24px;
	}

	.capture-page {
		display: flex;
		flex-direction: column;
		border-radius: 12px 3px 3px 12px;
		background-color: var(--nb-paper-rose);
		box-shadow:
			inset -18px 0 28px -28px rgba(67, 31, 72, 0.54),
			inset 0 0 0 1px rgba(120, 74, 119, 0.1);
		overflow: hidden;
	}

	.capture-page::before {
		content: "";
		position: absolute;
		top: 1.1rem;
		left: 0;
		width: 0.28rem;
		height: 5.4rem;
		border-radius: 0 4px 4px 0;
		background: linear-gradient(var(--nb-rose), var(--nb-yellow), var(--nb-violet));
	}

	.capture-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1.35rem 1.25rem 0.85rem;
	}

	.capture-header h2 {
		margin-top: 0.12rem;
		font-family: var(--nb-font-display);
		font-size: 1.75rem;
		font-weight: 600;
		line-height: 1;
		color: var(--nb-ink);
	}

	.capture-count {
		min-width: 2.05rem;
		height: 2.05rem;
		display: grid;
		place-items: center;
		border: 1px solid rgba(166, 69, 126, 0.2);
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.76);
		color: var(--nb-rose);
		font-family: var(--nb-font-mono);
		font-size: 0.7rem;
		font-weight: 500;
	}

	.lane-filters {
		display: flex;
		gap: 0.25rem;
		padding: 0 0.9rem 0.8rem;
		overflow-x: auto;
		scrollbar-width: none;
	}

	.lane-filters::-webkit-scrollbar {
		display: none;
	}

	.lane-filters button {
		min-height: 2.25rem;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0 0.58rem;
		border: 1px solid transparent;
		border-radius: 9px;
		color: var(--nb-muted);
		font-size: 0.67rem;
		font-weight: 600;
		white-space: nowrap;
	}

	.lane-filters button:hover {
		background: rgba(255, 255, 255, 0.58);
		color: var(--nb-ink);
	}

	.lane-filters button.active {
		border-color: var(--nb-rule-strong);
		background: rgba(255, 255, 255, 0.86);
		color: var(--nb-ink);
		box-shadow: 0 2px 7px rgba(78, 43, 83, 0.07);
	}

	.lane-filters small {
		color: var(--nb-muted);
		font-family: var(--nb-font-mono);
		font-size: 0.56rem;
	}

	.lane-dot,
	.row-marker,
	.lane-picker button > span {
		width: 0.48rem;
		height: 0.48rem;
		flex: 0 0 auto;
		border-radius: 50%;
		background: var(--nb-rose);
	}

	.lane-dot.all {
		background: conic-gradient(
			var(--nb-rose) 0 33%,
			var(--nb-yellow) 33% 66%,
			var(--nb-violet) 66%
		);
	}

	[data-lane='spark'] {
		--lane-color: var(--nb-yellow);
		--lane-soft: var(--nb-yellow-soft);
	}

	[data-lane='shape'] {
		--lane-color: var(--nb-rose);
		--lane-soft: var(--nb-rose-soft);
	}

	[data-lane='later'] {
		--lane-color: var(--nb-violet);
		--lane-soft: var(--nb-violet-soft);
	}

	.lane-dot[data-lane],
	.capture-row[data-lane] .row-marker,
	.lane-picker button[data-lane] > span {
		background: var(--lane-color);
	}

	.capture-list {
		min-height: 10rem;
		flex: 1;
		padding: 0.2rem 0.6rem 0.75rem;
		overflow-y: auto;
		scrollbar-color: rgba(181, 113, 157, 0.32) transparent;
		scrollbar-width: thin;
	}

	.capture-row {
		width: 100%;
		display: grid;
		grid-template-columns: 0.5rem minmax(0, 1fr);
		gap: 0 0.62rem;
		padding: 0.75rem 0.7rem;
		border: 1px solid transparent;
		border-radius: 11px;
		color: var(--nb-ink);
		text-align: left;
		transition:
			background 120ms ease,
			border-color 120ms ease,
			transform 120ms ease;
	}

	.capture-row + .capture-row {
		margin-top: 0.2rem;
	}

	.capture-row:hover {
		background: rgba(255, 255, 255, 0.54);
	}

	.capture-row.active {
		border-color: color-mix(in srgb, var(--lane-color) 32%, transparent);
		background: linear-gradient(90deg, var(--lane-soft), rgba(255, 255, 255, 0.78));
		box-shadow: 0 3px 10px rgba(78, 43, 83, 0.07);
		transform: translateX(2px);
	}

	.row-marker {
		grid-row: 1 / span 3;
		align-self: start;
		margin-top: 0.35rem;
	}

	.capture-row-top {
		min-width: 0;
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.capture-row-top strong {
		overflow: hidden;
		color: var(--nb-ink);
		font-family: var(--nb-font-body);
		font-size: 0.92rem;
		font-weight: 600;
		line-height: 1.3;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.capture-row-top time {
		flex: 0 0 auto;
		color: var(--nb-muted);
		font-family: var(--nb-font-mono);
		font-size: 0.53rem;
	}

	.capture-preview {
		margin-top: 0.22rem;
		overflow: hidden;
		color: var(--nb-muted);
		font-family: var(--nb-font-sans);
		font-size: 0.68rem;
		line-height: 1.45;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.tag-preview {
		display: flex;
		gap: 0.3rem;
		margin-top: 0.42rem;
		overflow: hidden;
	}

	.tag-preview small {
		padding: 0.12rem 0.3rem;
		border-radius: 5px;
		background: rgba(123, 97, 176, 0.08);
		color: var(--nb-violet);
		font-family: var(--nb-font-mono);
		font-size: 0.52rem;
		white-space: nowrap;
	}

	.list-empty {
		min-height: 12rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.3rem;
		padding: 1rem;
		color: var(--nb-muted);
		text-align: center;
	}

	.list-empty > span {
		color: var(--nb-violet);
		font-family: var(--nb-font-display);
		font-size: 2rem;
	}

	.list-empty strong {
		color: var(--nb-ink);
		font-family: var(--nb-font-body);
		font-size: 0.9rem;
	}

	.list-empty p {
		max-width: 12rem;
		font-size: 0.68rem;
		line-height: 1.5;
	}

	.list-empty button {
		margin-top: 0.4rem;
		color: var(--nb-rose);
		font-size: 0.66rem;
		font-weight: 600;
		text-decoration: underline;
		text-underline-offset: 0.2rem;
	}

	.capture-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.65rem 0.8rem;
		border-top: 1px solid var(--nb-rule);
		background: rgba(255, 255, 255, 0.4);
	}

	.save-state {
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 0.45rem;
		color: var(--nb-muted);
	}

	.save-state > span {
		width: 0.45rem;
		height: 0.45rem;
		flex: 0 0 auto;
		border-radius: 50%;
		background: var(--nb-green);
		box-shadow: 0 0 0 3px var(--nb-green-soft);
	}

	.save-state.recovered > span {
		background: var(--nb-yellow);
		box-shadow: 0 0 0 3px var(--nb-yellow-soft);
	}

	.save-state.error > span {
		background: var(--nb-danger);
		box-shadow: 0 0 0 3px var(--nb-danger-soft);
	}

	.save-state div {
		min-width: 0;
		display: flex;
		flex-direction: column;
	}

	.save-state strong {
		overflow: hidden;
		font-size: 0.58rem;
		font-weight: 600;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.save-state small {
		font-family: var(--nb-font-mono);
		font-size: 0.48rem;
	}

	.file-actions {
		display: flex;
		gap: 0.15rem;
	}

	.file-actions button {
		min-height: 2rem;
		padding: 0 0.38rem;
		border-radius: 7px;
		color: var(--nb-violet);
		font-size: 0.58rem;
		font-weight: 600;
	}

	.file-actions button:hover {
		background: var(--nb-violet-soft);
	}

	.file-input {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		clip-path: inset(50%);
		white-space: nowrap;
	}

	.book-seam {
		z-index: 2;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: space-around;
		padding: 1.4rem 0;
		background:
			linear-gradient(90deg, rgba(48, 26, 53, 0.16), rgba(255, 255, 255, 0.2) 48%, rgba(48, 26, 53, 0.2));
		box-shadow:
			-6px 0 16px rgba(54, 29, 61, 0.12),
			6px 0 16px rgba(54, 29, 61, 0.12);
	}

	.book-seam span {
		width: 0.42rem;
		height: 0.42rem;
		border: 1px solid rgba(66, 38, 72, 0.28);
		border-radius: 50%;
		background: #f6c8dd;
		box-shadow: inset 0 1px 2px rgba(66, 38, 72, 0.2);
	}

	.editor-page {
		display: flex;
		flex-direction: column;
		border-radius: 3px 12px 12px 3px;
		box-shadow:
			inset 18px 0 28px -28px rgba(67, 31, 72, 0.54),
			inset 0 0 0 1px rgba(120, 74, 119, 0.09);
		overflow: hidden;
	}

	.editor-page::after {
		content: "";
		position: absolute;
		top: 1.6rem;
		right: -0.15rem;
		width: 0.65rem;
		height: 5rem;
		border-radius: 5px 0 0 5px;
		background: linear-gradient(
			to bottom,
			var(--nb-yellow) 0 33%,
			var(--nb-rose) 33% 66%,
			var(--nb-violet) 66%
		);
		box-shadow: -2px 2px 5px rgba(83, 42, 92, 0.15);
	}

	.editor-header {
		min-height: 4.2rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.7rem clamp(1rem, 3vw, 2rem);
		border-bottom: 1px solid var(--nb-rule);
		background: rgba(255, 255, 255, 0.38);
	}

	.lane-picker {
		display: flex;
		align-items: center;
		gap: 0.28rem;
	}

	.lane-picker > span {
		margin-right: 0.2rem;
		color: var(--nb-muted);
		font-size: 0.62rem;
		font-weight: 600;
	}

	.lane-picker button {
		min-height: 2.15rem;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0 0.55rem;
		border: 1px solid transparent;
		border-radius: 8px;
		color: var(--nb-muted);
		font-size: 0.64rem;
		font-weight: 600;
	}

	.lane-picker button:hover {
		background: var(--lane-soft);
		color: var(--nb-ink);
	}

	.lane-picker button.active {
		border-color: color-mix(in srgb, var(--lane-color) 32%, transparent);
		background: var(--lane-soft);
		color: var(--nb-ink);
	}

	.updated-time {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		color: var(--nb-muted);
		font-family: var(--nb-font-mono);
		font-size: 0.58rem;
		line-height: 1.35;
	}

	.updated-time span {
		font-family: var(--nb-font-sans);
		font-size: 0.52rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.writing-area {
		width: min(100%, 58rem);
		min-height: 0;
		flex: 1;
		align-self: center;
		display: flex;
		flex-direction: column;
		padding: clamp(1.35rem, 4vw, 2.7rem) clamp(1rem, 5vw, 4.5rem) 1rem;
	}

	.title-label {
		display: block;
	}

	.title-input {
		width: 100%;
		margin-top: 0.2rem;
		padding: 0.1rem 0 0.55rem;
		border-bottom: 1px solid var(--nb-rule);
		color: var(--nb-ink);
		font-family: var(--nb-font-display);
		font-size: clamp(2rem, 4vw, 2.85rem);
		font-weight: 600;
		line-height: 1.12;
		letter-spacing: -0.015em;
	}

	.title-input::placeholder {
		color: rgba(77, 55, 82, 0.34);
		font-style: italic;
	}

	.title-input:focus {
		border-color: var(--nb-rose);
	}

	.tag-field {
		min-height: 2.8rem;
		display: flex;
		align-items: center;
		gap: 0.45rem;
		border-bottom: 1px solid var(--nb-rule);
	}

	.tag-field > span {
		color: var(--nb-violet);
		font-family: var(--nb-font-mono);
		font-size: 0.72rem;
	}

	.tag-field input {
		width: 100%;
		font-family: var(--nb-font-sans);
		font-size: 0.7rem;
	}

	.tag-field input::placeholder {
		color: var(--nb-muted);
	}

	.body-field {
		min-height: 20rem;
		flex: 1;
		position: relative;
	}

	.body-field::before {
		content: "";
		position: absolute;
		top: 0;
		bottom: 0;
		left: 2.35rem;
		width: 1px;
		background: rgba(198, 77, 139, 0.2);
		pointer-events: none;
	}

	.body-field textarea {
		width: 100%;
		height: 100%;
		min-height: 20rem;
		padding: 1rem 1rem 2rem 3.2rem;
		resize: none;
		background:
			repeating-linear-gradient(
				to bottom,
				transparent 0,
				transparent calc(1.85rem - 1px),
				rgba(105, 126, 161, 0.13) calc(1.85rem - 1px),
				rgba(105, 126, 161, 0.13) 1.85rem
			);
		background-attachment: local;
		color: var(--nb-ink);
		font-family: var(--nb-font-body);
		font-size: 1.02rem;
		font-weight: 400;
		line-height: 1.85rem;
		caret-color: var(--nb-rose);
	}

	.body-field textarea::placeholder {
		color: rgba(77, 55, 82, 0.37);
		font-style: italic;
	}

	.page-holes {
		position: absolute;
		top: 2rem;
		left: 0.42rem;
		bottom: 2rem;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		pointer-events: none;
	}

	.page-holes span {
		width: 0.58rem;
		height: 0.58rem;
		border: 1px solid rgba(80, 51, 83, 0.2);
		border-radius: 50%;
		background: rgba(160, 103, 149, 0.08);
		box-shadow: inset 0 1px 2px rgba(80, 51, 83, 0.12);
	}

	.editor-footer {
		min-height: 4rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.65rem clamp(1rem, 3vw, 2rem);
		border-top: 1px solid var(--nb-rule);
		background: rgba(255, 255, 255, 0.34);
	}

	.send-actions,
	.delete-actions {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.send-actions > span {
		margin-right: 0.2rem;
		color: var(--nb-muted);
		font-size: 0.62rem;
		font-weight: 600;
	}

	.send-actions button {
		min-height: 2.25rem;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0 0.62rem;
		border: 1px solid var(--nb-rule-strong);
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.62);
		color: var(--nb-violet);
		font-size: 0.62rem;
		font-weight: 600;
	}

	.send-actions button:hover {
		border-color: var(--nb-violet);
		background: var(--nb-violet-soft);
	}

	.delete-actions button {
		min-height: 2.2rem;
		padding: 0 0.55rem;
		border-radius: 8px;
		font-size: 0.6rem;
		font-weight: 600;
	}

	.delete-page {
		color: var(--nb-muted);
	}

	.delete-page:hover:not(:disabled) {
		background: var(--nb-danger-soft);
		color: var(--nb-danger);
	}

	.delete-page.armed {
		background: var(--nb-danger);
		color: #fff;
	}

	.cancel-delete {
		color: var(--nb-violet);
	}

	.cancel-delete:hover {
		background: var(--nb-violet-soft);
	}

	.keyboard-hint {
		align-self: center;
		color: rgba(74, 51, 80, 0.58);
		font-size: 0.6rem;
	}

	.keyboard-hint kbd {
		margin-right: 0.15rem;
	}

	@media (max-width: 1050px) {
		.app-bar {
			grid-template-columns: auto 1fr;
		}

		.identity {
			justify-content: flex-start;
		}

		.app-actions {
			grid-column: 1 / -1;
		}

		.search-field {
			flex: 1;
			width: auto;
		}

		.notebook-spread {
			height: calc(100vh - 10.5rem);
			height: calc(100dvh - 10.5rem);
			grid-template-columns: minmax(16rem, 18rem) 0.9rem minmax(0, 1fr);
			min-height: 36rem;
		}

		.editor-header,
		.editor-footer {
			align-items: flex-start;
			flex-direction: column;
		}

		.updated-time {
			align-items: flex-start;
		}

		.editor-footer {
			justify-content: center;
		}
	}

	@media (max-width: 760px) {
		.notebook-shell {
			padding: 0.5rem;
		}

		.app-bar {
			gap: 0.55rem;
			border-radius: 13px;
		}

		.back-home-label,
		.identity p,
		.search-field kbd {
			display: none;
		}

		.back-home {
			min-width: 2.5rem;
			justify-content: center;
			padding: 0;
		}

		.identity h1 {
			font-size: 1.45rem;
		}

		.identity-mark {
			width: 2rem;
			height: 2rem;
		}

		.app-actions {
			width: 100%;
		}

		.new-page-button {
			padding: 0 0.7rem;
		}

		.notebook-spread {
			height: auto;
			min-height: auto;
			max-height: none;
			grid-template-columns: minmax(0, 1fr);
			gap: 0.65rem;
			padding: 0.5rem;
			border-radius: 17px;
		}

		.book-seam {
			display: none;
		}

		.capture-page,
		.editor-page {
			border-radius: 11px;
		}

		.capture-page {
			max-height: 20rem;
		}

		.capture-list {
			min-height: 7rem;
		}

		.capture-footer {
			position: sticky;
			bottom: 0;
		}

		.editor-page::after {
			display: none;
		}

		.editor-header {
			padding: 0.75rem 0.8rem;
		}

		.lane-picker {
			width: 100%;
			display: grid;
			grid-template-columns: auto repeat(3, minmax(0, 1fr));
		}

		.lane-picker button {
			justify-content: center;
			padding: 0 0.3rem;
		}

		.writing-area {
			padding: 1.25rem 0.8rem 0.5rem;
		}

		.title-input {
			font-size: 2rem;
		}

		.body-field textarea {
			min-height: 25rem;
			padding-right: 0.2rem;
			resize: vertical;
		}

		.editor-footer {
			padding: 0.75rem 0.8rem;
		}

		.send-actions {
			width: 100%;
			flex-wrap: wrap;
		}

		.send-actions > span {
			width: 100%;
		}

		.delete-actions {
			align-self: flex-end;
		}

		.keyboard-hint {
			display: none;
		}
	}

	@media (max-width: 430px) {
		.new-page-button {
			font-size: 0;
		}

		.new-page-button span {
			font-size: 1rem;
		}

		.capture-header {
			padding-top: 1rem;
		}

		.lane-filters {
			padding-bottom: 0.55rem;
		}

		.capture-footer {
			align-items: flex-end;
		}

		.lane-picker > span {
			display: none;
		}

		.lane-picker {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}

		.body-field::before {
			left: 1.6rem;
		}

		.body-field textarea {
			padding-left: 2.25rem;
		}

		.page-holes {
			left: 0.15rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		* {
			scroll-behavior: auto !important;
		}

		.new-page-button,
		.capture-row {
			transition: none;
		}
	}
</style>
