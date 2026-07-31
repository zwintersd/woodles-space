<script lang="ts">
	import { store } from '$lib/store.svelte';
	import { queueSync } from '$lib/sync.svelte';

	let title = $state('');
	let body = $state('');
	let notice = $state('');

	let captured = $derived(store.surgeDrafts.filter((draft) => draft.status === 'captured'));
	let promoted = $derived(store.surgeDrafts.filter((draft) => draft.status === 'promoted'));
	let discarded = $derived(store.surgeDrafts.filter((draft) => draft.status === 'discarded'));
	let loosePieces = $derived(store.tasks.filter((task) => task.status === 'open' && !task.targetBlockId));

	function formatStamp(iso: string): string {
		return new Intl.DateTimeFormat(undefined, {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		}).format(new Date(iso));
	}

	function capture(): void {
		const draft = store.addSurgeDraft(title, body);
		if (!draft) return;
		title = '';
		body = '';
		notice = `captured at ${formatStamp(draft.createdAt)} · quarantined from the calendar`;
		queueSync();
	}

	function promote(id: string): void {
		const draft = store.promoteSurgeDraft(id);
		if (!draft) return;
		notice = 'promoted to loose pieces · still unscheduled';
		queueSync();
	}

	function discard(id: string): void {
		store.discardSurgeDraft(id);
		notice = 'draft archived without touching the plan';
		queueSync();
	}

	function restore(id: string): void {
		store.restoreSurgeDraft(id);
		notice = 'draft returned to the vault · session lock restarted';
		queueSync();
	}
</script>

<section class="surge-page" aria-labelledby="surge-heading">
	<header class="surge-heading">
		<div>
			<p class="kicker">surge capture · separate state</p>
			<h1 id="surge-heading">The ambitious version can speak here.</h1>
			<p>
				Capture is not commitment. Nothing on this page can enter a day pile in the session
				that created it.
			</p>
		</div>
		<div class="quarantine-seal" aria-label="quarantine rule">
			<span aria-hidden="true">◌</span>
			<strong>session lock</strong>
			<small>review later</small>
		</div>
	</header>

	<div class="surge-grid">
		<form
			class="capture-card"
			onsubmit={(event) => {
				event.preventDefault();
				capture();
			}}
		>
			<div class="capture-topline">
				<span>SURGE DRAFT / {new Date().toLocaleDateString()}</span>
				<span>metadata kept automatically</span>
			</div>
			<label>
				<span>what is the plan called?</span>
				<input bind:value={title} placeholder="rebuild the entire week" />
			</label>
			<label>
				<span>give it all the room it wants</span>
				<textarea
					bind:value={body}
					rows="10"
					placeholder="Fourteen projects, a new system, every dependency. Put the whole weather front here."
				></textarea>
			</label>
			<footer>
				<p aria-live="polite">
					{notice || 'A draft can be true as a thought without becoming true as a schedule.'}
				</p>
				<button type="submit" disabled={!title.trim() && !body.trim()}>capture, do not commit</button>
			</footer>
		</form>

		<aside class="session-card">
			<p class="kicker">the circuit breaker</p>
			<h2>Two sessions, two decisions.</h2>
			<ol>
				<li>
					<span>01</span>
					<p><strong>Now:</strong> collect the shape of the idea.</p>
				</li>
				<li>
					<span>02</span>
					<p><strong>Later:</strong> decide whether any piece deserves a place.</p>
				</li>
			</ol>
			<div class="night-note">
				<span class="moon" aria-hidden="true">◒</span>
				<p>
					“drafted at 11:40 pm” is not a warning. It is context your reviewing self gets to
					keep.
				</p>
			</div>
		</aside>
	</div>

	<section class="draft-vault" aria-labelledby="vault-heading">
		<header>
			<div>
				<p class="kicker">draft vault</p>
				<h2 id="vault-heading">{captured.length} plan{captured.length === 1 ? '' : 's'} waiting for another session</h2>
			</div>
			<p>Promotion creates an unscheduled loose piece—never a calendar block.</p>
		</header>

		<div class="draft-list">
			{#each captured as draft (draft.id)}
				<article class:locked={!store.canPromoteSurgeDraft(draft.id)}>
					<div class="draft-stamp">
						<time datetime={draft.createdAt}>{formatStamp(draft.createdAt)}</time>
						<span>{draft.createdSessionId === store.sessionId ? 'this session' : 'review session'}</span>
					</div>
					<h3>{draft.title}</h3>
					<p>{draft.body || 'No further notes. The title was enough.'}</p>
					<footer>
						{#if store.canPromoteSurgeDraft(draft.id)}
							<button type="button" class="promote" onclick={() => promote(draft.id)}>
								promote to loose pieces
							</button>
						{:else}
							<span class="locked-copy">close Carillon before this can be promoted</span>
						{/if}
						<button type="button" class="discard" onclick={() => discard(draft.id)}>
							archive without promoting
						</button>
					</footer>
				</article>
			{:else}
				<div class="empty-vault">
					<span aria-hidden="true">✦</span>
					<p>The vault is empty. It will hold as much ambition as you put in it.</p>
				</div>
			{/each}
		</div>
	</section>

	<div class="lower-grid">
		<section class="loose-pieces" aria-labelledby="pieces-heading">
			<header>
				<p class="kicker">loose pieces</p>
				<h2 id="pieces-heading">Promoted, still uncommitted</h2>
			</header>
			<ul>
				{#each loosePieces as task (task.id)}
					<li>
						<button
							type="button"
							onclick={() => store.openTaskEdit(task.id)}
							aria-label={`Edit or schedule ${task.title}`}
						>
							<span>{task.title}</span>
							<small>{task.notes?.startsWith('Promoted from Surge') ? 'from surge' : 'task inbox'}</small>
						</button>
						<span class="piece-action">edit · schedule</span>
					</li>
				{:else}
					<li class="empty">Nothing is asking for a slot.</li>
				{/each}
			</ul>
			{#if discarded.length > 0}
				<p class="closed-label">closed without promotion</p>
				<ul>
					{#each discarded as draft (draft.id)}
						<li>
							<span>{draft.title}</span>
							<button type="button" class="restore" onclick={() => restore(draft.id)}>
								restore to vault
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<section class="promoted-log" aria-labelledby="promoted-heading">
			<header>
				<p class="kicker">provenance</p>
				<h2 id="promoted-heading">What crossed the boundary</h2>
			</header>
			<ul>
				{#each promoted as draft (draft.id)}
					<li>
						<span>{draft.title}</span>
						<small>drafted {formatStamp(draft.createdAt)} · promoted {draft.promotedAt ? formatStamp(draft.promotedAt) : '—'}</small>
					</li>
				{:else}
					<li class="empty">No draft has been promoted. This is allowed indefinitely.</li>
				{/each}
			</ul>
		</section>
	</div>
</section>

<style>
	.surge-page {
		display: grid;
		gap: 1rem;
	}

	.surge-heading {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;
	}

	.kicker {
		color: var(--car-surge);
		font-family: var(--car-mono);
		font-size: 0.62rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
	}

	.surge-heading h1 {
		max-width: 14ch;
		margin-top: 0.25rem;
		color: var(--car-cream);
		font-family: var(--car-display);
		font-size: clamp(2.4rem, 5vw, 4.5rem);
		font-weight: 400;
		letter-spacing: -0.04em;
		line-height: 0.95;
	}

	.surge-heading > div > p:last-child {
		max-width: 46rem;
		margin-top: 0.7rem;
		color: var(--car-mist);
		font-family: var(--car-body);
		font-size: 0.84rem;
	}

	.quarantine-seal {
		display: grid;
		width: 7.2rem;
		height: 7.2rem;
		flex: 0 0 auto;
		place-content: center;
		border: 1px solid var(--car-surge);
		border-radius: 50%;
		box-shadow:
			inset 0 0 0 0.35rem var(--car-night),
			inset 0 0 0 0.42rem rgba(255, 137, 90, 0.45);
		color: var(--car-surge);
		text-align: center;
		transform: rotate(5deg);
	}

	.quarantine-seal span {
		font-size: 1.2rem;
	}

	.quarantine-seal strong,
	.quarantine-seal small {
		font-family: var(--car-mono);
		text-transform: uppercase;
	}

	.quarantine-seal strong {
		font-size: 0.58rem;
		letter-spacing: 0.12em;
	}

	.quarantine-seal small {
		font-size: 0.44rem;
		letter-spacing: 0.08em;
	}

	.surge-grid {
		display: grid;
		grid-template-columns: minmax(0, 1.55fr) minmax(16rem, 0.65fr);
		gap: 1rem;
	}

	.capture-card,
	.session-card,
	.draft-vault,
	.loose-pieces,
	.promoted-log {
		border: 1px solid var(--car-line);
		border-radius: 1rem;
	}

	.capture-card {
		display: grid;
		gap: 1rem;
		background:
			linear-gradient(135deg, rgba(255, 137, 90, 0.08), transparent 40%),
			rgba(255, 246, 218, 0.055);
		padding: 1.15rem;
	}

	.capture-topline {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		color: var(--car-surge);
		font-family: var(--car-mono);
		font-size: 0.52rem;
		letter-spacing: 0.11em;
	}

	.capture-card label {
		display: grid;
		gap: 0.35rem;
	}

	.capture-card label > span {
		color: var(--car-mist);
		font-family: var(--car-mono);
		font-size: 0.54rem;
		letter-spacing: 0.09em;
		text-transform: uppercase;
	}

	.capture-card input,
	.capture-card textarea {
		width: 100%;
		border: 1px solid rgba(255, 246, 218, 0.14);
		border-radius: 0.75rem;
		background: rgba(6, 3, 11, 0.23);
		padding: 0.8rem;
		color: var(--car-cream);
		font-family: var(--car-body);
		resize: vertical;
	}

	.capture-card input {
		font-family: var(--car-display);
		font-size: 1.35rem;
	}

	.capture-card footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.capture-card footer p {
		color: var(--car-mist);
		font-family: var(--car-body);
		font-size: 0.68rem;
		font-style: italic;
	}

	.capture-card footer button {
		flex: 0 0 auto;
		border-radius: 999px;
		background: var(--car-surge);
		padding: 0.58rem 0.9rem;
		color: #20111c;
		font-family: var(--car-mono);
		font-size: 0.6rem;
	}

	.session-card {
		background: var(--car-paper);
		padding: 1.15rem;
		color: var(--car-ink);
	}

	.session-card .kicker,
	.draft-vault .kicker,
	.lower-grid .kicker {
		color: var(--car-pink-dark);
	}

	.session-card h2,
	.draft-vault h2,
	.lower-grid h2 {
		margin-top: 0.25rem;
		font-family: var(--car-display);
		font-size: 1.55rem;
		font-weight: 500;
		line-height: 1;
	}

	.session-card ol {
		display: grid;
		gap: 0.75rem;
		margin-top: 1rem;
		list-style: none;
	}

	.session-card li {
		display: grid;
		grid-template-columns: 1.7rem 1fr;
		gap: 0.55rem;
		align-items: start;
	}

	.session-card li > span {
		color: var(--car-pink-dark);
		font-family: var(--car-counter);
		font-size: 1rem;
	}

	.session-card li p {
		color: var(--car-ink-soft);
		font-family: var(--car-body);
		font-size: 0.7rem;
	}

	.night-note {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.55rem;
		margin-top: 1.25rem;
		border-top: 1px solid rgba(68, 54, 91, 0.12);
		padding-top: 0.8rem;
	}

	.moon {
		color: var(--car-pink-dark);
	}

	.night-note p {
		color: var(--car-ink-soft);
		font-family: var(--car-body);
		font-size: 0.66rem;
		font-style: italic;
	}

	.draft-vault,
	.loose-pieces,
	.promoted-log {
		background: var(--car-paper);
		color: var(--car-ink);
	}

	.draft-vault > header {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;
		padding: 1rem 1.15rem;
		border-bottom: 1px solid rgba(68, 54, 91, 0.12);
	}

	.draft-vault > header > p {
		max-width: 22rem;
		color: var(--car-ink-soft);
		font-family: var(--car-body);
		font-size: 0.64rem;
		text-align: right;
	}

	.draft-list {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.7rem;
		padding: 0.8rem;
	}

	.draft-list article {
		display: flex;
		min-height: 12rem;
		flex-direction: column;
		border: 1px solid rgba(68, 54, 91, 0.16);
		border-radius: 0.75rem;
		background: rgba(255, 255, 255, 0.44);
		padding: 0.85rem;
	}

	.draft-list article.locked {
		border-style: dashed;
	}

	.draft-stamp {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
		color: var(--car-ink-soft);
		font-family: var(--car-mono);
		font-size: 0.46rem;
		text-transform: uppercase;
	}

	.draft-list h3 {
		margin-top: 0.75rem;
		font-family: var(--car-display);
		font-size: 1.35rem;
		font-weight: 500;
		line-height: 1;
	}

	.draft-list article > p {
		display: -webkit-box;
		overflow: hidden;
		margin-top: 0.55rem;
		color: var(--car-ink-soft);
		font-family: var(--car-body);
		font-size: 0.65rem;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 4;
		line-clamp: 4;
	}

	.draft-list article footer {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
		align-items: center;
		justify-content: space-between;
		margin-top: auto;
		padding-top: 0.8rem;
	}

	.draft-list footer button,
	.locked-copy {
		font-family: var(--car-mono);
		font-size: 0.48rem;
	}

	.promote {
		border-radius: 999px;
		background: var(--car-ink);
		padding: 0.38rem 0.6rem;
		color: var(--car-paper);
	}

	.discard,
	.locked-copy {
		color: var(--car-ink-soft);
	}

	.empty-vault {
		display: grid;
		grid-column: 1 / -1;
		min-height: 8rem;
		place-items: center;
		align-content: center;
		gap: 0.4rem;
		color: var(--car-ink-soft);
		font-family: var(--car-body);
		font-size: 0.7rem;
		text-align: center;
	}

	.empty-vault span {
		color: var(--car-pink-dark);
		font-size: 1.2rem;
	}

	.lower-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}

	.lower-grid section {
		padding: 1rem 1.15rem;
	}

	.lower-grid ul {
		display: grid;
		gap: 0.45rem;
		margin-top: 0.85rem;
		list-style: none;
	}

	.lower-grid li {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.75rem;
		border-top: 1px solid rgba(68, 54, 91, 0.1);
		padding-top: 0.45rem;
		font-family: var(--car-body);
		font-size: 0.68rem;
	}

	.lower-grid li small {
		color: var(--car-ink-soft);
		font-family: var(--car-mono);
		font-size: 0.46rem;
		text-align: right;
	}

	.loose-pieces li > button {
		display: grid;
		flex: 1;
		gap: 0.08rem;
		color: var(--car-ink);
		text-align: left;
	}

	.loose-pieces li > button:hover span {
		color: var(--car-pink-dark);
		text-decoration: underline;
		text-underline-offset: 0.18rem;
	}

	.piece-action,
	.closed-label,
	.restore {
		color: var(--car-ink-soft);
		font-family: var(--car-mono);
		font-size: 0.46rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	.closed-label {
		margin-top: 1rem;
	}

	.restore:hover {
		color: var(--car-pink-dark);
	}

	.lower-grid li.empty {
		color: var(--car-ink-soft);
		font-style: italic;
	}

	@media (max-width: 900px) {
		.surge-grid,
		.lower-grid {
			grid-template-columns: 1fr;
		}

		.draft-list {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 620px) {
		.surge-heading {
			align-items: flex-start;
		}

		.quarantine-seal {
			width: 5.4rem;
			height: 5.4rem;
		}

		.capture-topline,
		.capture-card footer,
		.draft-vault > header {
			align-items: flex-start;
			flex-direction: column;
		}

		.draft-vault > header > p {
			text-align: left;
		}

		.draft-list {
			grid-template-columns: 1fr;
		}
	}
</style>
