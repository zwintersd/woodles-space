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
	<header class="topbar">
		<a href="/" class="home">.space</a>
		<div class="brand">
			<h1>Notebook</h1>
			<p>{notebook.notes.length} notes · {notebook.openTasks.length} open · {notebook.ideas.length} ideas</p>
		</div>
		<div class="top-actions">
			<input
				class="search"
				type="search"
				bind:value={notebook.query}
				placeholder="search"
				aria-label="search notebook"
			/>
			<button class="new-note" onclick={() => notebook.addNote()}>new</button>
		</div>
	</header>

	<div class="rainbow-marquee" aria-label="rainbow notebook marquee">
		<div class="marquee-track">
			<span>rainbow notebook hotline * moonbeam drafts * cloud-soft tasks * candy tabs * tiny ideas forever * </span>
			<span>rainbow notebook hotline * moonbeam drafts * cloud-soft tasks * candy tabs * tiny ideas forever * </span>
		</div>
	</div>

	<div class="mode-tabs" role="tablist" aria-label="notebook mode">
		{#each MODES as mode}
			<button
				class="mode-tab"
				class:active={notebook.mode === mode.id}
				role="tab"
				aria-selected={notebook.mode === mode.id}
				onclick={() => notebook.setMode(mode.id)}
			>
				{mode.label}
			</button>
		{/each}
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
	}

	.title-input {
		font-family: var(--nb-font-display);
		font-size: clamp(1.8rem, 4vw, 2.8rem);
		line-height: 1.05;
		color: #ff4fb8;
		text-shadow: 1px 1px 0 #fff, 2px 2px 0 var(--nb-cyan);
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
</style>
