<script lang="ts">
	import { notebook } from '$lib/notebook.svelte';
	import type { Idea, NotebookMode, NotebookTask } from '$lib/types';

	const MODES: { id: NotebookMode; label: string }[] = [
		{ id: 'notes', label: 'notes' },
		{ id: 'tasks', label: 'tasks' },
		{ id: 'ideas', label: 'ideas' }
	];

	const LANES: { id: Idea['lane']; label: string }[] = [
		{ id: 'spark', label: 'sparks' },
		{ id: 'shape', label: 'shaping' },
		{ id: 'later', label: 'later' }
	];

	let taskTitle = $state('');
	let taskPriority = $state<NotebookTask['priority']>('normal');
	let ideaText = $state('');
	let ideaLane = $state<Idea['lane']>('spark');

	const note = $derived(notebook.selectedNote);
	const noteTags = $derived(note?.tags.join(', ') ?? '');

	function addTask(e: Event) {
		e.preventDefault();
		notebook.addTask(taskTitle, taskPriority);
		taskTitle = '';
		taskPriority = 'normal';
	}

	function addIdea(e: Event) {
		e.preventDefault();
		notebook.addIdea(ideaText, ideaLane);
		ideaText = '';
		ideaLane = 'spark';
	}

	function updateTags(value: string) {
		if (!note) return;
		const tags = value
			.split(',')
			.map((tag) => tag.trim())
			.filter(Boolean);
		notebook.updateNote(note.id, { tags });
	}

	function handleKeydown(e: KeyboardEvent) {
		const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
		if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
		if (e.key === '1') notebook.setMode('notes');
		if (e.key === '2') notebook.setMode('tasks');
		if (e.key === '3') notebook.setMode('ideas');
		if (e.key === 'n' || e.key === 'N') notebook.addNote();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="notebook-page">
	<aside class="side-rail" aria-label="Notebook navigation">
		<div class="traffic-dots" aria-hidden="true">
			<span></span>
			<span></span>
			<span></span>
		</div>
		<div class="mascot-card" aria-hidden="true">
			<div class="pixel-cat">
				<span class="cat-ear left"></span>
				<span class="cat-ear right"></span>
				<span class="cat-face"></span>
				<span class="cat-paw left"></span>
				<span class="cat-paw right"></span>
			</div>
		</div>
		<nav class="rail-nav">
			<a href="/" class="rail-link">
				<span class="rail-icon home-icon"></span>
				<span>home</span>
			</a>
			{#each MODES as mode}
				<button
					class="rail-link"
					class:active={notebook.mode === mode.id}
					onclick={() => notebook.setMode(mode.id)}
				>
					<span class="rail-icon {mode.id}-icon"></span>
					<span>{mode.label}</span>
				</button>
			{/each}
		</nav>
		<div class="rail-moon" aria-hidden="true"></div>
		<div class="rail-clouds" aria-hidden="true"></div>
	</aside>

	<div class="main-stage">
		<header class="topbar">
			<a href="/" class="home">.space</a>
			<div class="top-charms" aria-hidden="true">
				<span class="charm charm-star"></span>
				<span class="charm charm-moon"></span>
				<span class="charm charm-cloud"></span>
				<span class="charm charm-lines"></span>
				<span class="charm charm-gear"></span>
			</div>
		</header>

		<section class="hero-panel">
			<div class="hero-sparkles" aria-hidden="true"></div>
			<div class="hero-moon" aria-hidden="true">
				<span></span>
				<span></span>
				<span></span>
			</div>
			<div class="brand">
				<h1>Notebook</h1>
				<p>{notebook.notes.length} notes <span></span> {notebook.openTasks.length} open <span></span> {notebook.ideas.length} ideas</p>
			</div>
			<div class="top-actions">
				<label class="search-wrap" aria-label="search notebook">
					<input
						class="search"
						type="search"
						bind:value={notebook.query}
						placeholder="search your thoughts..."
					/>
					<span class="search-glass" aria-hidden="true"></span>
				</label>
				<button class="new-note" onclick={() => notebook.addNote()}>
					<span aria-hidden="true">+</span>
					new
				</button>
			</div>
		</section>

		<div class="rainbow-marquee" aria-label="rainbow notebook marquee">
			<div class="marquee-track">
				<span>notebook hotline * moonbeam drafts * cloud-soft tasks * candy tabs * tiny ideas * sparkle storage * </span>
				<span>notebook hotline * moonbeam drafts * cloud-soft tasks * candy tabs * tiny ideas * sparkle storage * </span>
			</div>
		</div>

		<div class="mode-row">
			<div class="mode-tabs" role="tablist" aria-label="notebook mode">
				{#each MODES as mode}
					<button
						class="mode-tab"
						class:active={notebook.mode === mode.id}
						role="tab"
						aria-selected={notebook.mode === mode.id}
						onclick={() => notebook.setMode(mode.id)}
					>
						<span class="mode-gem"></span>
						{mode.label}
					</button>
				{/each}
			</div>
			<div class="sort-pill" aria-hidden="true">
				<span></span>
				recent
				<i></i>
			</div>
		</div>

		<main class="workspace">
		<aside class="note-list" aria-label="notes">
			{#each notebook.filteredNotes as listedNote (listedNote.id)}
				<button
					class="note-row"
					class:active={note?.id === listedNote.id}
					onclick={() => notebook.selectNote(listedNote.id)}
				>
					<span class="note-row-title">{listedNote.title || 'Untitled'}</span>
					<span class="note-row-body">{listedNote.body || listedNote.tags.join(', ') || 'blank'}</span>
				</button>
			{/each}
		</aside>

		{#if notebook.mode === 'notes'}
			<section class="editor-pane">
				{#if note}
					<div class="editor-head">
						<input
							class="title-input"
							value={note.title}
							aria-label="note title"
							oninput={(e) => notebook.updateNote(note.id, { title: e.currentTarget.value })}
						/>
						<button class="delete-note" onclick={() => notebook.deleteNote(note.id)} disabled={notebook.notes.length <= 1}>
							delete
						</button>
					</div>
					<input
						class="tag-input"
						value={noteTags}
						placeholder="tags"
						aria-label="note tags"
						onchange={(e) => updateTags(e.currentTarget.value)}
					/>
					<textarea
						class="body-input"
						value={note.body}
						aria-label="note body"
						spellcheck="true"
						oninput={(e) => notebook.updateNote(note.id, { body: e.currentTarget.value })}
					></textarea>
				{/if}
			</section>
		{:else if notebook.mode === 'tasks'}
			<section class="task-pane">
				<form class="task-form" onsubmit={addTask}>
					<input class="task-input" bind:value={taskTitle} placeholder="task" autocomplete="off" />
					<select class="priority-select" bind:value={taskPriority} aria-label="priority">
						<option value="normal">normal</option>
						<option value="high">high</option>
						<option value="low">low</option>
					</select>
					<button class="submit-btn" type="submit" disabled={!taskTitle.trim()}>add</button>
				</form>

				<div class="task-columns">
					<section class="task-column">
						<h2>open</h2>
						{#each notebook.openTasks as task (task.id)}
							<div class="task-row">
								<button class="check" onclick={() => notebook.toggleTask(task.id)} aria-label="complete task"></button>
								<span class="task-title">{task.title}</span>
								<span class="priority" data-priority={task.priority}>{task.priority}</span>
								<button class="row-delete" onclick={() => notebook.deleteTask(task.id)} aria-label="delete task">×</button>
							</div>
						{/each}
					</section>
					<section class="task-column">
						<h2>done</h2>
						{#each notebook.doneTasks as task (task.id)}
							<div class="task-row done">
								<button class="check checked" onclick={() => notebook.toggleTask(task.id)} aria-label="reopen task"></button>
								<span class="task-title">{task.title}</span>
								<button class="row-delete" onclick={() => notebook.deleteTask(task.id)} aria-label="delete task">×</button>
							</div>
						{/each}
					</section>
				</div>
			</section>
		{:else}
			<section class="ideas-pane">
				<form class="idea-form" onsubmit={addIdea}>
					<input class="idea-input" bind:value={ideaText} placeholder="idea" autocomplete="off" />
					<select class="lane-select" bind:value={ideaLane} aria-label="lane">
						{#each LANES as lane}
							<option value={lane.id}>{lane.label}</option>
						{/each}
					</select>
					<button class="submit-btn" type="submit" disabled={!ideaText.trim()}>add</button>
				</form>

				<div class="idea-board">
					{#each LANES as lane}
						<section class="idea-lane">
							<h2>{lane.label}</h2>
							{#each notebook.ideas.filter((idea) => idea.lane === lane.id) as idea (idea.id)}
								<div class="idea-card">
									<p>{idea.text}</p>
									<div class="idea-actions">
										{#each LANES.filter((target) => target.id !== lane.id) as target}
											<button onclick={() => notebook.moveIdea(idea.id, target.id)}>{target.label}</button>
										{/each}
										<button onclick={() => notebook.deleteIdea(idea.id)}>×</button>
									</div>
								</div>
							{/each}
						</section>
					{/each}
				</div>
			</section>
		{/if}
		</main>
	</div>
</div>

<style>
	.notebook-page {
		width: min(1180px, calc(100vw - 2rem));
		margin: 0 auto;
		padding: 1.2rem 0 2.4rem;
		position: relative;
		z-index: 1;
	}

	.topbar {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 1rem;
		padding: 0.75rem 1rem;
		border: 3px solid #fff;
		border-radius: 28px;
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.86), rgba(255, 224, 244, 0.92)),
			linear-gradient(90deg, var(--nb-cyan), var(--nb-yellow), var(--nb-line-strong));
		box-shadow: 0 7px 0 #ff8ed9, 0 16px 28px rgba(147, 62, 170, 0.22);
		position: relative;
		overflow: hidden;
	}

	.topbar::before {
		content: "";
		position: absolute;
		inset: 0;
		background:
			repeating-linear-gradient(
				90deg,
				rgba(255, 255, 255, 0) 0 18px,
				rgba(255, 255, 255, 0.36) 18px 21px
			);
		pointer-events: none;
	}

	.topbar > * {
		position: relative;
		z-index: 1;
	}

	.home {
		font-size: 0.66rem;
		letter-spacing: 0.16em;
		color: var(--nb-violet);
		text-decoration: none;
		background: var(--nb-cream);
		border: 2px solid #fff;
		border-radius: 999px;
		padding: 0.34rem 0.55rem;
		box-shadow: 0 3px 0 var(--nb-line);
	}

	.brand h1 {
		font-family: var(--nb-font-display);
		font-size: clamp(2.8rem, 7vw, 5rem);
		font-weight: 500;
		line-height: 1;
		color: #ff4fb8;
		letter-spacing: 0;
		text-shadow:
			2px 2px 0 #fff,
			4px 4px 0 var(--nb-cyan),
			6px 6px 0 var(--nb-yellow);
	}

	.brand p {
		font-size: 0.64rem;
		letter-spacing: 0.08em;
		color: var(--nb-violet);
		text-transform: lowercase;
	}

	.top-actions {
		display: flex;
		align-items: center;
		gap: 0.55rem;
	}

	.search,
	.new-note,
	.mode-tab,
	.submit-btn,
	.priority-select,
	.lane-select,
	.delete-note {
		border: 2px solid #fff;
		border-radius: 999px;
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.95), rgba(255, 229, 248, 0.92));
		box-shadow: 0 4px 0 var(--nb-line);
	}

	.search {
		width: 12rem;
		padding: 0.48rem 0.75rem;
		font-size: 0.68rem;
		color: var(--nb-ink);
	}

	.new-note,
	.submit-btn,
	.delete-note {
		padding: 0.48rem 0.85rem;
		font-size: 0.62rem;
		letter-spacing: 0.1em;
		text-transform: lowercase;
		color: var(--nb-violet);
		font-weight: 700;
		transition: transform 120ms ease, box-shadow 120ms ease;
	}

	.new-note:hover,
	.submit-btn:hover:not(:disabled),
	.delete-note:hover:not(:disabled),
	.mode-tab:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 0 var(--nb-line-strong);
	}

	.rainbow-marquee {
		margin: 0.9rem 0 0.75rem;
		border: 3px solid #fff;
		border-radius: 999px;
		overflow: hidden;
		background:
			linear-gradient(90deg, #ff55b8, #ffdf5b, #70f2ff, #9f79ff, #ff55b8);
		box-shadow: 0 5px 0 var(--nb-violet), 0 12px 24px rgba(104, 44, 169, 0.24);
	}

	.marquee-track {
		display: flex;
		width: max-content;
		animation: rainbow-scroll 18s linear infinite;
	}

	.marquee-track span {
		display: inline-block;
		padding: 0.42rem 1.2rem;
		font-size: 0.62rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: #fff;
		text-shadow: 1px 1px 0 #7a32b1, 2px 2px 0 #ff4fb8;
		white-space: nowrap;
	}

	@keyframes rainbow-scroll {
		from { transform: translateX(0); }
		to { transform: translateX(-50%); }
	}

	.mode-tabs {
		display: flex;
		gap: 0.5rem;
		padding: 0.75rem 0 1rem;
	}

	.mode-tab {
		padding: 0.48rem 1rem;
		font-size: 0.62rem;
		letter-spacing: 0.12em;
		color: var(--nb-violet);
		text-transform: lowercase;
	}

	.mode-tab.active {
		background:
			linear-gradient(180deg, #fffad1, #ff8ed9 58%, #9a61ff);
		border-color: #fff;
		color: #fff;
		text-shadow: 1px 1px 0 #7d2aaa;
	}

	.workspace {
		display: grid;
		grid-template-columns: minmax(210px, 270px) 1fr;
		gap: 1rem;
		align-items: start;
	}

	.note-list,
	.editor-pane,
	.task-pane,
	.ideas-pane {
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.9), rgba(255, 241, 253, 0.96));
		border: 3px solid #fff;
		border-radius: var(--nb-radius-md);
		box-shadow: var(--nb-shadow);
		position: relative;
	}

	.note-list::before,
	.editor-pane::before,
	.task-pane::before,
	.ideas-pane::before {
		content: "dreamy";
		position: absolute;
		top: -0.72rem;
		left: 1rem;
		z-index: 2;
		padding: 0.12rem 0.55rem;
		border: 2px solid #fff;
		border-radius: 999px;
		background: var(--nb-yellow);
		color: var(--nb-violet);
		font-size: 0.52rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		box-shadow: 0 3px 0 var(--nb-line-strong);
	}

	.editor-pane::before { content: "moon notes"; }
	.task-pane::before { content: "heart tasks"; }
	.ideas-pane::before { content: "cloud ideas"; }

	.note-list {
		display: flex;
		flex-direction: column;
		max-height: calc(100vh - 10.3rem);
		overflow: auto;
	}

	.note-row {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		text-align: left;
		padding: 0.85rem 0.9rem;
		border-bottom: 2px dotted var(--nb-line);
		color: var(--nb-ink);
		transition: background 120ms ease, transform 120ms ease;
	}

	.note-row.active {
		background:
			linear-gradient(90deg, rgba(255, 248, 184, 0.86), rgba(255, 192, 238, 0.9));
		transform: translateX(4px);
	}

	.note-row-title {
		font-family: var(--nb-font-body);
		font-size: 1.05rem;
		line-height: 1.15;
		color: var(--nb-ink);
	}

	.note-row-body {
		font-size: 0.6rem;
		color: var(--nb-violet);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.editor-pane {
		min-height: calc(100vh - 10.3rem);
		padding: 1.15rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.editor-head {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.75rem;
		align-items: center;
		min-width: 0;
	}

	.title-input {
		font-family: var(--nb-font-display);
		font-size: clamp(1.8rem, 4vw, 2.8rem);
		line-height: 1.05;
		color: #ff4fb8;
		text-shadow: 1px 1px 0 #fff, 2px 2px 0 var(--nb-cyan);
		width: 100%;
		min-width: 0;
	}

	.tag-input {
		border: 2px dashed var(--nb-line);
		border-radius: 16px;
		color: var(--nb-green);
		font-size: 0.68rem;
		padding: 0.5rem 0.7rem;
		background: rgba(255, 255, 255, 0.62);
	}

	.body-input {
		min-height: 24rem;
		resize: vertical;
		font-family: var(--nb-font-body);
		font-size: 1.22rem;
		line-height: 1.68;
		color: var(--nb-ink);
		border-radius: 18px;
		padding: 0.85rem;
		background:
			repeating-linear-gradient(
				180deg,
				rgba(255, 255, 255, 0.75) 0 2.05rem,
				rgba(255, 158, 222, 0.25) 2.05rem calc(2.05rem + 2px)
			);
	}

	.task-pane,
	.ideas-pane {
		padding: 1.15rem;
	}

	.task-form,
	.idea-form {
		display: grid;
		grid-template-columns: 1fr auto auto;
		gap: 0.55rem;
		padding-bottom: 0.85rem;
		border-bottom: 2px dashed var(--nb-line);
	}

	.task-input,
	.idea-input {
		border: 2px solid #fff;
		border-radius: 999px;
		padding: 0.48rem 0.75rem;
		background: rgba(255, 255, 255, 0.72);
		box-shadow: inset 0 2px 0 rgba(255, 158, 222, 0.42);
	}

	.priority-select,
	.lane-select {
		padding: 0.42rem 0.55rem;
		font-size: 0.64rem;
		color: var(--nb-violet);
	}

	.task-columns,
	.idea-board {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.9rem;
		padding-top: 0.9rem;
	}

	.idea-board {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}

	.task-column h2,
	.idea-lane h2 {
		font-size: 0.62rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--nb-violet);
		margin-bottom: 0.45rem;
		text-shadow: 1px 1px 0 #fff;
	}

	.task-row,
	.idea-card {
		background:
			linear-gradient(180deg, #ffffff, #ffe4f7);
		border: 2px solid #fff;
		border-radius: 18px;
		box-shadow: 0 4px 0 rgba(255, 97, 199, 0.48);
	}

	.task-row {
		display: grid;
		grid-template-columns: auto 1fr auto auto;
		align-items: center;
		gap: 0.55rem;
		padding: 0.55rem;
		margin-bottom: 0.45rem;
	}

	.task-row.done {
		opacity: 0.62;
	}

	.check {
		width: 1rem;
		height: 1rem;
		border: 2px solid var(--nb-line-strong);
		border-radius: 50%;
		background:
			linear-gradient(180deg, #fff, #ffd7f2);
	}

	.check.checked {
		background:
			linear-gradient(180deg, var(--nb-cyan), var(--nb-green));
		border-color: var(--nb-green);
	}

	.task-title {
		font-family: var(--nb-font-body);
		font-size: 1rem;
		line-height: 1.25;
	}

	.priority {
		font-size: 0.54rem;
		letter-spacing: 0.08em;
		color: var(--nb-muted);
	}

	.priority[data-priority='high'] {
		color: var(--nb-red);
		font-weight: 700;
	}

	.row-delete {
		color: var(--nb-muted);
		font-size: 0.9rem;
	}

	.idea-card {
		padding: 0.7rem;
		margin-bottom: 0.55rem;
	}

	.idea-card p {
		font-family: var(--nb-font-body);
		font-size: 1rem;
		line-height: 1.35;
		margin-bottom: 0.65rem;
	}

	.idea-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.idea-actions button {
		border: 2px solid #fff;
		border-radius: 999px;
		padding: 0.25rem 0.5rem;
		font-size: 0.55rem;
		color: var(--nb-violet);
		background:
			linear-gradient(180deg, var(--nb-cream), var(--nb-paper-alt));
		box-shadow: 0 2px 0 var(--nb-line);
	}

	@media (max-width: 760px) {
		.notebook-page {
			width: min(100vw - 1rem, 1180px);
		}

		.topbar,
		.workspace,
		.task-columns,
		.idea-board {
			grid-template-columns: 1fr;
		}

		.topbar {
			border-radius: 22px;
		}

		.top-actions {
			width: 100%;
		}

		.search {
			flex: 1;
			width: auto;
		}

		.note-list {
			max-height: 12rem;
		}

		.editor-pane {
			min-height: 28rem;
		}
	}

	/* dream desktop pass */
	.notebook-page {
		width: min(1280px, calc(100vw - 0.6rem));
		min-height: calc(100vh - 0.6rem);
		margin: 0.3rem auto;
		padding: 0;
		display: grid;
		grid-template-columns: 148px minmax(0, 1fr);
		gap: 0.7rem;
		border: 3px solid #ff7dcc;
		border-radius: 34px;
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.72), rgba(255, 216, 244, 0.52)),
			radial-gradient(circle at 16% 18%, rgba(255, 255, 255, 0.88), transparent 18rem),
			radial-gradient(circle at 88% 8%, rgba(139, 105, 255, 0.24), transparent 18rem);
		box-shadow:
			inset 0 0 0 2px #fff,
			inset 0 0 0 7px rgba(255, 185, 231, 0.7),
			0 18px 50px rgba(155, 60, 165, 0.28);
		overflow: hidden;
	}

	.side-rail {
		position: relative;
		min-height: calc(100vh - 1.2rem);
		padding: 1.4rem 0.85rem;
		background:
			linear-gradient(180deg, rgba(255, 199, 233, 0.92), rgba(255, 221, 245, 0.66)),
			repeating-linear-gradient(180deg, transparent 0 34px, rgba(255, 255, 255, 0.26) 34px 36px);
		border-right: 2px solid rgba(255, 115, 203, 0.55);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.1rem;
	}

	.traffic-dots {
		display: flex;
		gap: 0.45rem;
	}

	.traffic-dots span,
	.brand p span {
		width: 0.9rem;
		height: 0.9rem;
		border-radius: 50%;
		border: 2px solid #fff;
		box-shadow: 0 2px 0 rgba(132, 75, 204, 0.35);
	}

	.traffic-dots span:nth-child(1) { background: #ff5fb7; }
	.traffic-dots span:nth-child(2) { background: #ffe45f; }
	.traffic-dots span:nth-child(3) { background: #62e8ff; }

	.mascot-card {
		width: 116px;
		aspect-ratio: 1;
		border: 3px solid #ff8ed9;
		border-radius: 28px;
		background:
			radial-gradient(circle at 50% 62%, rgba(255, 255, 255, 0.9), transparent 38%),
			linear-gradient(180deg, #fff6ff, #ffc9eb);
		box-shadow: inset 0 0 0 3px #fff, 0 7px 0 rgba(255, 105, 200, 0.45);
		display: grid;
		place-items: center;
	}

	.pixel-cat {
		position: relative;
		width: 78px;
		height: 54px;
		border: 4px solid #ff65c5;
		border-radius: 18px;
		background:
			linear-gradient(90deg, transparent 0 8px, rgba(255, 255, 255, 0.38) 8px 12px, transparent 12px),
			#fff;
		box-shadow:
			8px 0 0 #ffd7f0,
			-8px 8px 0 #ffd7f0,
			0 8px 0 #ffd7f0,
			0 0 0 3px #fff;
	}

	.cat-ear,
	.cat-paw {
		position: absolute;
		display: block;
		background: #fff;
		border: 4px solid #ff65c5;
	}

	.cat-ear {
		top: -19px;
		width: 22px;
		height: 22px;
		transform: rotate(45deg);
		border-radius: 5px;
	}

	.cat-ear.left { left: 8px; }
	.cat-ear.right { right: 8px; }

	.cat-face::before,
	.cat-face::after {
		content: "";
		position: absolute;
		top: 22px;
		width: 7px;
		height: 10px;
		border-radius: 50%;
		background: #8d55f0;
		box-shadow: 0 0 0 2px #ffc8ed;
	}

	.cat-face::before { left: 23px; }
	.cat-face::after { right: 23px; }

	.cat-face {
		position: absolute;
		inset: 0;
	}

	.pixel-cat::after {
		content: "w";
		position: absolute;
		left: 50%;
		top: 31px;
		transform: translateX(-50%);
		font-family: var(--nb-font-mono);
		font-size: 0.7rem;
		font-weight: 700;
		color: #ff65c5;
	}

	.cat-paw {
		bottom: -11px;
		width: 18px;
		height: 18px;
		border-radius: 50%;
	}

	.cat-paw.left { left: -10px; }
	.cat-paw.right { right: -10px; }

	.rail-nav {
		width: 100%;
		padding: 0.8rem 0.55rem;
		border: 2px solid rgba(255, 124, 210, 0.72);
		border-radius: 32px;
		background: rgba(255, 245, 253, 0.48);
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 0.55rem;
	}

	.rail-link {
		min-height: 4.15rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.28rem;
		border: 2px solid transparent;
		border-radius: 16px;
		color: #8d55f0;
		text-decoration: none;
		font-size: 0.66rem;
		font-weight: 700;
		letter-spacing: 0.03em;
		background: transparent;
	}

	.rail-link.active,
	.rail-link:hover {
		background: rgba(255, 255, 255, 0.82);
		border-color: #ffb3e7;
		box-shadow: 0 4px 0 rgba(255, 105, 200, 0.28);
	}

	.rail-icon {
		width: 1.85rem;
		height: 1.85rem;
		display: block;
		position: relative;
	}

	.home-icon::before {
		content: "";
		position: absolute;
		inset: 0.42rem 0.22rem 0.18rem;
		border: 4px solid #ff65c5;
		border-top: 0;
		background: #fff;
		box-shadow: inset 0 0 0 2px #ffd4ef;
	}

	.home-icon::after {
		content: "";
		position: absolute;
		left: 0.36rem;
		top: 0.1rem;
		width: 1.1rem;
		height: 1.1rem;
		border-left: 4px solid #ff65c5;
		border-top: 4px solid #ff65c5;
		transform: rotate(45deg);
	}

	.notes-icon,
	.tasks-icon,
	.ideas-icon {
		border: 4px solid currentColor;
		border-radius: 5px;
		background: #fff;
		box-shadow: inset 0 -6px 0 #ffe0f4;
	}

	.notes-icon::before,
	.tasks-icon::before {
		content: "";
		position: absolute;
		left: 0.32rem;
		right: 0.32rem;
		top: 0.42rem;
		height: 4px;
		background: currentColor;
		box-shadow: 0 8px 0 currentColor;
	}

	.tasks-icon::after {
		content: "";
		position: absolute;
		left: -0.45rem;
		top: 0.2rem;
		width: 0.45rem;
		height: 0.45rem;
		border: 3px solid #ffd84d;
		border-radius: 3px;
		box-shadow: 0 0.7rem 0 -1px #fff, 0 0.7rem 0 1px #ffd84d;
	}

	.ideas-icon {
		border-radius: 50% 50% 42% 42%;
		background: radial-gradient(circle at 50% 35%, #fff 0 32%, #ffd84d 33% 58%, #ff9ede 59%);
	}

	.ideas-icon::after {
		content: "";
		position: absolute;
		left: 0.55rem;
		bottom: -0.35rem;
		width: 0.62rem;
		height: 0.42rem;
		border: 3px solid currentColor;
		border-top: 0;
		border-radius: 0 0 5px 5px;
		background: #fff;
	}

	.rail-moon {
		position: absolute;
		left: 1.55rem;
		bottom: 4.4rem;
		width: 4.5rem;
		height: 4.5rem;
		border-radius: 50%;
		background: #ffe583;
		box-shadow: inset -0.75rem -0.45rem 0 #ffc369, 0 0 0 3px #fff;
	}

	.rail-clouds {
		position: absolute;
		left: -1rem;
		right: -1rem;
		bottom: -1.7rem;
		height: 5.7rem;
		background:
			radial-gradient(circle at 16% 42%, #dacfff 0 2.3rem, transparent 2.35rem),
			radial-gradient(circle at 38% 30%, #fff 0 2.6rem, transparent 2.65rem),
			radial-gradient(circle at 58% 45%, #ffc9ed 0 2.4rem, transparent 2.45rem),
			radial-gradient(circle at 80% 36%, #d7f8ff 0 2.2rem, transparent 2.25rem);
	}

	.main-stage {
		min-width: 0;
		padding: 1.3rem 1.35rem 1.6rem 0;
	}

	.topbar {
		min-height: 4.6rem;
		padding: 0.85rem 1.6rem;
		border-width: 2px;
		border-color: rgba(255, 117, 205, 0.72);
		border-radius: 0 28px 0 0;
		background: linear-gradient(180deg, rgba(255, 245, 253, 0.84), rgba(255, 235, 248, 0.48));
		box-shadow: none;
	}

	.topbar::before {
		display: none;
	}

	.home {
		background: transparent;
		border: 0;
		box-shadow: none;
		color: #ff4fb8;
		font-size: 1.25rem;
		font-weight: 700;
		text-shadow: 1px 1px 0 #fff;
	}

	.top-charms {
		justify-self: end;
		display: flex;
		align-items: center;
		gap: 1.35rem;
	}

	.charm {
		position: relative;
		display: block;
		width: 2.1rem;
		height: 2.1rem;
		filter: drop-shadow(1px 2px 0 #fff) drop-shadow(2px 3px 0 rgba(139, 85, 240, 0.34));
	}

	.charm-star {
		background: #fff76e;
		clip-path: polygon(50% 0, 62% 35%, 100% 35%, 69% 56%, 80% 96%, 50% 72%, 20% 96%, 31% 56%, 0 35%, 38% 35%);
	}

	.charm-moon {
		border-radius: 50%;
		background: #fff;
		box-shadow: inset -0.55rem 0 0 #d9c6ff, 0 0 0 3px #8d55f0;
	}

	.charm-cloud {
		width: 2.55rem;
		background:
			radial-gradient(circle at 30% 58%, #fff 0 0.55rem, transparent 0.6rem),
			radial-gradient(circle at 50% 38%, #fff 0 0.72rem, transparent 0.76rem),
			radial-gradient(circle at 70% 58%, #fff 0 0.56rem, transparent 0.6rem),
			linear-gradient(#fff, #fff) 28% 58% / 52% 0.72rem no-repeat;
	}

	.charm-cloud::after {
		content: "";
		position: absolute;
		inset: 0.38rem 0.14rem 0.35rem;
		border-bottom: 3px solid #8d55f0;
		border-radius: 50%;
	}

	.charm-lines {
		width: 6.1rem;
		height: 1.7rem;
		background:
			linear-gradient(90deg, #ff80d2 0 18%, transparent 18% 24%, #ff80d2 24% 70%, transparent 70%) 0 0.25rem / 100% 4px no-repeat,
			linear-gradient(90deg, #ffc7ef 0 54%, transparent 54% 62%, #ffc7ef 62% 100%) 0 0.8rem / 100% 4px no-repeat,
			linear-gradient(90deg, #8d55f0 0 38%, transparent 38% 48%, #8d55f0 48% 82%, transparent 82%) 0 1.35rem / 3.9rem 4px no-repeat;
	}

	.charm-gear {
		border: 3px solid #ff4fb8;
		border-radius: 9px;
		background: rgba(255, 255, 255, 0.72);
	}

	.charm-gear::before {
		content: "";
		position: absolute;
		inset: 0.48rem;
		border: 3px solid #ff4fb8;
		border-radius: 50%;
	}

	.hero-panel {
		position: relative;
		margin-top: 0.6rem;
		padding: clamp(2rem, 5vw, 4.4rem) clamp(1.6rem, 5vw, 3.5rem) 1.65rem;
		border: 3px solid rgba(255, 117, 205, 0.7);
		border-radius: 30px;
		background:
			radial-gradient(circle at 20% 28%, rgba(255, 255, 255, 0.78), transparent 8rem),
			linear-gradient(90deg, rgba(255, 255, 255, 0.42) 1px, transparent 1px),
			linear-gradient(180deg, rgba(255, 255, 255, 0.42) 1px, transparent 1px),
			linear-gradient(135deg, rgba(255, 255, 255, 0.88), rgba(255, 229, 246, 0.72));
		background-size: auto, 34px 34px, 34px 34px, auto;
		box-shadow: inset 0 0 0 3px #fff, 0 8px 0 rgba(255, 132, 213, 0.4);
		overflow: hidden;
	}

	.hero-sparkles,
	.hero-sparkles::before,
	.hero-sparkles::after {
		position: absolute;
		content: "";
		width: 1rem;
		height: 1rem;
		background: #fff;
		clip-path: polygon(50% 0, 61% 38%, 100% 50%, 61% 62%, 50% 100%, 39% 62%, 0 50%, 39% 38%);
		filter: drop-shadow(0 0 0 #ff75cd) drop-shadow(1px 1px 0 #ff75cd);
	}

	.hero-sparkles {
		left: 2.8rem;
		top: 4.4rem;
	}

	.hero-sparkles::before {
		left: 26rem;
		top: -2.5rem;
	}

	.hero-sparkles::after {
		left: 58rem;
		top: 1.8rem;
	}

	.hero-moon {
		position: absolute;
		right: 7.1rem;
		top: 3rem;
		width: 6.4rem;
		height: 6.4rem;
		border-radius: 50%;
		background: #ff93d8;
		box-shadow:
			inset -1rem 0.15rem 0 #ffd1ef,
			inset -1.5rem 0.3rem 0 #ff69c5,
			0 0 0 4px #fff,
			0 0 0 7px rgba(255, 105, 200, 0.65);
		transform: rotate(-20deg);
	}

	.hero-moon::after {
		content: "";
		position: absolute;
		left: -1.7rem;
		right: -1.9rem;
		bottom: 0.25rem;
		height: 1.5rem;
		background:
			radial-gradient(circle at 18% 50%, #fff 0 0.9rem, transparent 0.95rem),
			radial-gradient(circle at 43% 35%, #fff 0 1.05rem, transparent 1.1rem),
			radial-gradient(circle at 70% 52%, #fff 0 0.95rem, transparent 1rem),
			linear-gradient(#fff, #fff) 20% 55% / 62% 0.9rem no-repeat;
	}

	.hero-moon span {
		position: absolute;
		bottom: -3.7rem;
		width: 0.35rem;
		height: 3.5rem;
		background: repeating-linear-gradient(180deg, #be77ff 0 7px, transparent 7px 12px);
	}

	.hero-moon span::after {
		content: "";
		position: absolute;
		left: 50%;
		bottom: -0.65rem;
		width: 1rem;
		height: 1rem;
		transform: translateX(-50%);
		background: #ffd84d;
		clip-path: polygon(50% 0, 62% 35%, 100% 35%, 69% 56%, 80% 96%, 50% 72%, 20% 96%, 31% 56%, 0 35%, 38% 35%);
		filter: drop-shadow(1px 1px 0 #ff75cd);
	}

	.hero-moon span:nth-child(1) { left: 1.4rem; }
	.hero-moon span:nth-child(2) { left: 3.1rem; height: 4.25rem; }
	.hero-moon span:nth-child(3) { left: 4.8rem; }

	.brand {
		position: relative;
		z-index: 1;
		max-width: 43rem;
	}

	.brand h1 {
		font-size: clamp(4.5rem, 12vw, 8rem);
		color: #ff4fb8;
		text-shadow:
			2px 2px 0 #fff,
			4px 4px 0 #ff9ede,
			7px 7px 0 #8d55f0,
			10px 10px 0 #62e8ff,
			13px 13px 0 #ffd84d;
	}

	.brand p {
		margin: 0.35rem 0 1.75rem 2.5rem;
		display: flex;
		align-items: center;
		gap: 1.1rem;
		font-size: 1.05rem;
		color: #8d55f0;
		font-weight: 700;
		text-shadow: 1px 1px 0 #fff;
	}

	.brand p span {
		display: inline-block;
		width: 0.72rem;
		height: 0.72rem;
		background: #ffd84d;
		clip-path: polygon(50% 0, 62% 35%, 100% 35%, 69% 56%, 80% 96%, 50% 72%, 20% 96%, 31% 56%, 0 35%, 38% 35%);
		border: 0;
		border-radius: 0;
	}

	.top-actions {
		position: relative;
		z-index: 1;
		display: grid;
		grid-template-columns: minmax(14rem, 1fr) auto;
		gap: 1.7rem;
		align-items: center;
	}

	.search-wrap {
		position: relative;
		display: block;
	}

	.search,
	.new-note,
	.mode-tab,
	.submit-btn,
	.priority-select,
	.lane-select,
	.delete-note {
		border: 3px solid #fff;
		box-shadow: 0 6px 0 rgba(255, 98, 199, 0.55);
	}

	.search {
		width: 100%;
		min-height: 4.9rem;
		padding: 0 4.3rem 0 2rem;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.82);
		color: #8d55f0;
		font-size: 1rem;
		font-style: italic;
	}

	.search::placeholder {
		color: #b678f3;
		opacity: 0.9;
	}

	.search-glass {
		position: absolute;
		right: 2rem;
		top: 50%;
		width: 1.45rem;
		height: 1.45rem;
		border: 4px solid #d953d9;
		border-radius: 50%;
		transform: translateY(-50%);
	}

	.search-glass::after {
		content: "";
		position: absolute;
		right: -0.52rem;
		bottom: -0.46rem;
		width: 0.8rem;
		height: 4px;
		border-radius: 99px;
		background: #d953d9;
		transform: rotate(45deg);
	}

	.new-note {
		min-width: 13.8rem;
		min-height: 4.9rem;
		border-color: #fff;
		border-radius: 32px;
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.28), transparent 42%),
			linear-gradient(180deg, #ff91d4, #ff61bd);
		color: #fff;
		font-size: 1.05rem;
		text-shadow: 1px 1px 0 #b246c8, 2px 2px 0 #ff4fb8;
	}

	.new-note span {
		margin-right: 0.55rem;
		font-size: 1.35rem;
	}

	.rainbow-marquee {
		margin: 1.1rem 0 1.35rem;
		border: 3px solid #ff78d0;
		border-radius: 16px;
		background:
			linear-gradient(90deg, #9972ff, #d46eff, #ff73cc, #ffb2df);
		box-shadow: inset 0 0 0 3px rgba(255, 255, 255, 0.75), 0 5px 0 rgba(141, 85, 240, 0.56);
		position: relative;
	}

	.rainbow-marquee::before,
	.rainbow-marquee::after {
		content: "";
		position: absolute;
		top: 50%;
		width: 1.6rem;
		height: 1.6rem;
		background: #ffd84d;
		clip-path: polygon(50% 0, 62% 35%, 100% 35%, 69% 56%, 80% 96%, 50% 72%, 20% 96%, 31% 56%, 0 35%, 38% 35%);
		filter: drop-shadow(1px 1px 0 #ff4fb8) drop-shadow(2px 2px 0 #fff);
		transform: translateY(-50%);
		z-index: 2;
	}

	.rainbow-marquee::before { left: -0.55rem; }
	.rainbow-marquee::after { right: -0.55rem; background: #b899ff; }

	.marquee-track span {
		padding: 0.72rem 1.2rem;
		font-size: 0.72rem;
		color: #fff;
		text-shadow: 1px 1px 0 #8d55f0, 0 0 6px #fff;
	}

	.mode-row {
		display: grid;
		grid-template-columns: minmax(0, auto) auto;
		align-items: center;
		gap: 1rem;
		margin-bottom: 1.2rem;
	}

	.mode-tabs {
		width: fit-content;
		padding: 0;
		border: 2px solid rgba(255, 117, 205, 0.58);
		border-radius: 28px;
		background: rgba(255, 255, 255, 0.54);
		overflow: visible;
		gap: 0;
	}

	.mode-tab {
		position: relative;
		min-width: 12.2rem;
		min-height: 4.35rem;
		padding: 0 1.7rem;
		border: 0;
		border-right: 2px solid rgba(255, 117, 205, 0.42);
		border-radius: 0;
		background: transparent;
		box-shadow: none;
		color: #8d55f0;
		font-size: 1.02rem;
		font-weight: 700;
		text-shadow: 1px 1px 0 #fff;
	}

	.mode-tab:first-child {
		border-radius: 26px 0 0 26px;
	}

	.mode-tab:last-child {
		border-right: 0;
		border-radius: 0 26px 26px 0;
	}

	.mode-tab.active {
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.35), transparent 42%),
			linear-gradient(180deg, #ff91d4, #ff5fbd);
		color: #fff;
		border-radius: 24px;
		box-shadow: 0 5px 0 rgba(255, 75, 174, 0.48);
		transform: translateY(-1px);
	}

	.mode-tab.active::after {
		content: "";
		position: absolute;
		left: 50%;
		bottom: -1.05rem;
		width: 1.7rem;
		height: 1.7rem;
		background: #ff5fbd;
		border-right: 3px solid #ff8ed9;
		border-bottom: 3px solid #ff8ed9;
		transform: translateX(-50%) rotate(45deg);
	}

	.mode-gem {
		display: inline-block;
		width: 1.3rem;
		height: 1.3rem;
		margin-right: 0.65rem;
		vertical-align: -0.18rem;
		background: #ffd84d;
		clip-path: polygon(50% 0, 62% 35%, 100% 35%, 69% 56%, 80% 96%, 50% 72%, 20% 96%, 31% 56%, 0 35%, 38% 35%);
		filter: drop-shadow(1px 1px 0 #fff);
	}

	.mode-tab:nth-child(2) .mode-gem {
		clip-path: inset(12% round 3px);
		background: #b899ff;
	}

	.mode-tab:nth-child(3) .mode-gem {
		border-radius: 50%;
		background: #ffd84d;
		clip-path: none;
	}

	.sort-pill {
		justify-self: end;
		min-width: 13rem;
		min-height: 3.25rem;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.65rem;
		border: 2px solid rgba(255, 117, 205, 0.58);
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.58);
		color: #ff4fb8;
		font-size: 0.78rem;
		font-weight: 700;
		box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.68);
	}

	.sort-pill span {
		width: 1.1rem;
		height: 1.1rem;
		background: #ffd84d;
		clip-path: polygon(50% 0, 62% 35%, 100% 35%, 69% 56%, 80% 96%, 50% 72%, 20% 96%, 31% 56%, 0 35%, 38% 35%);
	}

	.sort-pill i {
		width: 0;
		height: 0;
		border-left: 0.45rem solid transparent;
		border-right: 0.45rem solid transparent;
		border-top: 0.55rem solid #a56af3;
	}

	.workspace {
		grid-template-columns: minmax(210px, 260px) minmax(0, 1fr);
		gap: 1rem;
	}

	.note-list,
	.editor-pane,
	.task-pane,
	.ideas-pane {
		border: 3px solid rgba(255, 117, 205, 0.7);
		border-radius: 30px;
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.78), rgba(255, 244, 252, 0.82));
		box-shadow:
			inset 0 0 0 3px #fff,
			0 8px 0 rgba(255, 132, 213, 0.38);
	}

	.note-list::before,
	.editor-pane::before,
	.task-pane::before,
	.ideas-pane::before {
		top: 1.05rem;
		left: 1.5rem;
		background: #fff8b8;
		color: #ff4fb8;
		border-color: #ffcf6b;
		box-shadow: 0 0 0 2px #fff, 0 3px 0 rgba(255, 105, 200, 0.34);
	}

	.note-list {
		padding-top: 2.85rem;
		max-height: calc(100vh - 22rem);
		min-height: 20rem;
	}

	.note-row {
		margin: 0 0.75rem 0.55rem;
		border: 2px solid rgba(255, 158, 222, 0.45);
		border-radius: 18px;
		background: rgba(255, 255, 255, 0.55);
	}

	.note-row.active {
		background: linear-gradient(180deg, #fff8d9, #ffe0f5);
		box-shadow: 0 4px 0 rgba(255, 105, 200, 0.36);
	}

	.note-row-title {
		font-size: 1.3rem;
		color: #ff4fb8;
		text-shadow: 1px 1px 0 #fff;
	}

	.editor-pane,
	.task-pane,
	.ideas-pane {
		min-height: 27.5rem;
		padding: 4.3rem 1.8rem 1.8rem;
	}

	.editor-pane::after,
	.task-pane::after,
	.ideas-pane::after {
		content: "";
		position: absolute;
		right: 1.3rem;
		top: 3.3rem;
		bottom: 2rem;
		width: 1.5rem;
		border-right: 3px dotted #ff8ed9;
	}

	.editor-pane::after {
		background:
			linear-gradient(#ff8ed9, #ff8ed9) 50% 48% / 4px 62% no-repeat,
			radial-gradient(circle at 50% 50%, #ffd84d 0 0.75rem, transparent 0.8rem);
	}

	.title-input {
		font-size: clamp(2.6rem, 6vw, 4.1rem);
		color: #ff4fb8;
		width: 100%;
		min-width: 0;
		min-height: 4.6rem;
	}

	.tag-input {
		border: 0;
		background: transparent;
		color: #8d55f0;
		font-size: 0.82rem;
		font-weight: 700;
		padding-left: 0;
	}

	.body-input {
		min-height: 10.3rem;
		border: 2px dashed #ff8ed9;
		border-radius: 20px;
		background: rgba(255, 255, 255, 0.76);
		color: #ff4fb8;
		font-family: var(--nb-font-mono);
		font-size: 0.88rem;
		line-height: 1.7;
	}

	.task-form,
	.idea-form {
		border-bottom-color: rgba(255, 117, 205, 0.55);
	}

	.task-row,
	.idea-card {
		border-color: #fff;
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(255, 225, 246, 0.86));
	}

	@media (max-width: 920px) {
		.notebook-page {
			grid-template-columns: 1fr;
		}

		.side-rail {
			min-height: auto;
			padding: 0.7rem;
			flex-direction: row;
			justify-content: space-between;
			border-right: 0;
			border-bottom: 2px solid rgba(255, 115, 203, 0.55);
		}

		.mascot-card,
		.rail-moon,
		.rail-clouds {
			display: none;
		}

		.rail-nav {
			width: auto;
			flex-direction: row;
			padding: 0.35rem;
			border-radius: 18px;
		}

		.rail-link {
			min-height: 3rem;
			min-width: 4.7rem;
		}

		.main-stage {
			padding: 0.75rem;
		}

		.hero-moon,
		.top-charms {
			display: none;
		}

		.top-actions,
		.mode-row,
		.workspace {
			grid-template-columns: 1fr;
		}

		.mode-tabs {
			width: 100%;
			display: grid;
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}

		.mode-tab {
			min-width: 0;
			padding: 0 0.2rem;
			font-size: 0.82rem;
			min-height: 4.85rem;
			overflow: hidden;
		}

		.mode-tab.active::after {
			display: none;
		}

		.sort-pill {
			justify-self: stretch;
		}

		.editor-head {
			grid-template-columns: minmax(0, 1fr);
		}

		.title-input {
			font-size: clamp(2rem, 12vw, 3.4rem);
			min-height: 6rem;
		}
	}
</style>
