<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { book, fmt } from '$lib/witch/book.svelte';
	import { startTick, stopTick } from '$lib/witch/tick';
	import { titleById } from '$lib/witch/content/titles';
	import { exportSave, importSave } from '$lib/witch/persist';
	import TheWeb from '$lib/witch/TheWeb.svelte';
	import TheWorld from '$lib/witch/TheWorld.svelte';
	import Ledger from '$lib/witch/Ledger.svelte';
	import ReadingRoom from '$lib/components/reading/ReadingRoom.svelte';
	import Arcade from '$lib/arcade/Arcade.svelte';
	import HexStage from '$lib/witch/HexStage.svelte';

	let menuOpen = $state(false);
	let importBox = $state('');
	let exportBlob = $state('');
	let readingOpen = $state(false);
	let arcadeOpen = $state(false);
	let hexStageOpen = $state(false);

	function onFocus() {
		void book.refreshBestiaryCreatures();
	}

	onMount(() => {
		book.hydrate();
		void book.refreshBestiaryCreatures();
		if (window.location.hash === '#reading-room') readingOpen = true;
		startTick();
		window.addEventListener('beforeunload', persist);
		window.addEventListener('focus', onFocus);
	});
	onDestroy(() => {
		stopTick();
		if (typeof window !== 'undefined') {
			window.removeEventListener('beforeunload', persist);
			window.removeEventListener('focus', onFocus);
			book.persist();
		}
	});
	function persist() {
		book.persist();
	}

	function awayLabel(seconds: number): string {
		const m = Math.round(seconds / 60);
		if (m < 1) return 'a moment';
		if (m < 60) return `${m} minute${m === 1 ? '' : 's'}`;
		const h = Math.floor(m / 60);
		const r = m % 60;
		return r === 0 ? `${h} hour${h === 1 ? '' : 's'}` : `${h}h ${r}m`;
	}

	const offline = $derived(book.offlineReport);

	const currentTitle = $derived(titleById(book.title));
	const journal = $derived(book.pendingJournal);

	function doExport() {
		exportBlob = exportSave(book.toSave());
	}
	function doImport() {
		const s = importSave(importBox);
		if (s) {
			book.fromSave(s);
			book.persist();
			importBox = '';
			exportBlob = '';
			menuOpen = false;
		} else {
			exportBlob = '— could not read that as a save.';
		}
	}
	function doWipe() {
		if (confirm('close the Book and forget everything in it. continue?')) {
			book.hardReset();
		}
	}
</script>

<header class="topbar">
	<a class="brand" href="/">✦ marginalia · woodles.space</a>
	<button class="ghost" type="button" onclick={() => (menuOpen = !menuOpen)}>
		{menuOpen ? 'close' : 'menu'}
	</button>
</header>

{#if menuOpen}
	<div class="menu">
		<div class="menu-section">
			<h4>save</h4>
			<button class="ghost" onclick={doExport}>export current save</button>
			{#if exportBlob}
				<textarea readonly rows="3">{exportBlob}</textarea>
			{/if}
			<label>
				<span>paste a save to import:</span>
				<textarea bind:value={importBox} rows="3"></textarea>
			</label>
			<button class="ghost" onclick={doImport} disabled={!importBox.trim()}>import</button>
		</div>
		<div class="menu-section danger">
			<h4>danger</h4>
			<button class="ghost danger" onclick={doWipe}>close the book · wipe everything</button>
		</div>
	</div>
{/if}

<main>
	{#if !book.bookOpen}
		<section class="study">
			<p class="kicker">the witch's book — working title</p>
			<h1>the study</h1>
			<p class="intro">
				A lonely witch on an empty planet. Her name is Brianna. She does not
				know why she is here, only that she has a Book, and that the Book lets
				her write worlds into being.
			</p>
			<p class="intro muted">
				This is the foundation of a larger game. The Book opens onto two modes
				— the Web, where she writes conditions, and the World, where she
				watches what they become.
			</p>
			<div class="title-plate">
				<span class="title-name">{currentTitle.name}</span>
				<span class="title-note">{currentTitle.earnedNote}</span>
			</div>
			<button class="open-book" onclick={() => book.openBook()}>— open the Book —</button>
		</section>
	{:else}
		<section class="open">
			<div class="open-head">
				<div class="who">
					<span class="title-name">{currentTitle.name}</span>
					<span class="title-note">{currentTitle.earnedNote}</span>
				</div>
				<button class="ghost" onclick={() => book.closeBook()}>close the book</button>
			</div>

			{#if offline}
				<aside class="offline">
					<p>
						she watched the world for <strong>{awayLabel(offline.seconds)}</strong> while you were
						away. it gathered <span class="num">{fmt(offline.insight)}</span> insight{#if offline.advanced > 0}, and crossed <span class="num">{offline.advanced}</span> observation{offline.advanced === 1 ? '' : 's'}{/if}.
					</p>
					<button class="ghost tiny" onclick={() => book.dismissOfflineReport()}>thank you</button>
				</aside>
			{/if}

			<Ledger />

			<nav class="tabs">
				<button class:active={book.mode === 'web'} onclick={() => (book.mode = 'web')}>
					the web
				</button>
				<button class:active={book.mode === 'world'} onclick={() => (book.mode = 'world')}>
					the world
				</button>
			</nav>

			{#if journal}
				<aside class="journal">
					<p class="journal-label">from her journal</p>
					<p class="journal-text">{journal.text}</p>
					<button class="ghost tiny" onclick={() => book.dismissJournal(journal.id)}>
						close the page
					</button>
				</aside>
			{/if}

			<div class="mode-panel">
				{#if book.mode === 'web'}
					<TheWeb />
				{:else}
					<TheWorld />
				{/if}
			</div>
		</section>
	{/if}

	<hr class="rule" />

	<section class="side">
		<button class="side-toggle" onclick={() => (readingOpen = !readingOpen)}>
			reading alongside Brianna {readingOpen ? '−' : '+'}
		</button>
		<p class="side-note">
			While she watches her world, you can read one of your own. A quiet side
			room — the timer follows your cursor; finished stars hang in the margin.
		</p>
		{#if readingOpen}
			<ReadingRoom />
		{/if}
	</section>

	<hr class="rule" />

	<section class="side">
		<button class="side-toggle" onclick={() => (arcadeOpen = !arcadeOpen)}>
			the arcade {arcadeOpen ? '−' : '+'}
		</button>
		<p class="side-note">
			Small games tucked into a corner of the study. Some reward patience,
			others speed. Prizes drift back into the Book.
		</p>
		{#if arcadeOpen}
			<div class="arcade-wrap">
				<Arcade />
			</div>
		{/if}
	</section>

	<hr class="rule" />

	<section class="side">
		<button class="side-toggle" onclick={() => (hexStageOpen = !hexStageOpen)}>
			hex stage · dev {hexStageOpen ? '−' : '+'}
		</button>
		<p class="side-note">
			A mockup stage for previewing Bestiary creature sprites inside Marginalia.
			Reads your local Bestiary — open both apps on the same device.
		</p>
		{#if hexStageOpen}
			<HexStage />
		{/if}
	</section>

	<footer>
		<p>
			a game about writing worlds into being, and learning that witnessing them
			is enough. <a href="/">return to woodles.space ✦</a>
		</p>
	</footer>
</main>

<style>
	.topbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.7rem 1.2rem;
		border-bottom: 1px solid var(--rule);
		background: var(--bg);
	}
	.brand {
		font-family: var(--font-ui);
		font-size: 0.78rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--periwinkle);
		text-decoration: none;
	}
	.brand:hover {
		color: var(--leafeon-pink);
	}
	.ghost {
		font-family: var(--font-ui);
		color: var(--periwinkle);
		font-size: 0.78rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}
	.ghost:hover {
		color: var(--cyan);
	}
	.ghost.tiny {
		font-size: 0.68rem;
	}
	.ghost.danger {
		color: var(--print-pink);
	}
	.menu {
		max-width: 38rem;
		margin: 0 auto;
		padding: 1rem 1.2rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		border-bottom: 1px solid var(--rule);
	}
	.menu h4 {
		font-family: var(--font-ui);
		text-transform: uppercase;
		letter-spacing: 0.18em;
		font-size: 0.74rem;
		color: var(--periwinkle);
		margin: 0 0 0.5rem;
	}
	.menu-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.menu textarea {
		width: 100%;
		background: var(--panel);
		color: var(--text);
		border: 1px solid var(--rule);
		border-radius: 3px;
		font-family: var(--font-counter);
		font-size: 1rem;
		padding: 0.4rem;
		resize: vertical;
	}
	.menu .ghost {
		text-align: left;
		color: var(--cream);
		padding: 0.3rem 0;
	}
	.menu .ghost:hover {
		color: var(--leafeon-pink);
	}
	main {
		max-width: 60rem;
		margin: 0 auto;
		padding: 0 1rem 4rem;
	}

	/* ── the study (book closed) ─────────────────────────────────────────── */
	.study {
		max-width: 38rem;
		margin: 3rem auto 0;
		text-align: center;
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}
	.kicker {
		font-family: var(--font-ui);
		font-size: 0.7rem;
		letter-spacing: 0.24em;
		text-transform: uppercase;
		color: var(--periwinkle);
		margin: 0;
	}
	.study h1 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 2.4rem;
		color: var(--cream);
		margin: 0;
	}
	.intro {
		font-family: var(--font-body);
		color: var(--text);
		margin: 0;
	}
	.intro.muted {
		color: var(--muted);
		font-style: italic;
		font-size: 0.9rem;
	}
	.title-plate {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		border: 1px solid var(--rule);
		border-radius: 4px;
		background: var(--panel);
		padding: 0.7rem;
		margin: 0.5rem 0;
	}
	.title-name {
		font-family: var(--font-display);
		font-size: 1.2rem;
		color: var(--leafeon-pink);
	}
	.title-note {
		font-family: var(--font-body);
		font-style: italic;
		font-size: 0.84rem;
		color: var(--muted);
	}
	.open-book {
		align-self: center;
		font-family: var(--font-display);
		font-size: 1.2rem;
		color: var(--cream);
		background: var(--panel-accent);
		border: 1px solid var(--rule);
		border-radius: 4px;
		padding: 0.5rem 1.1rem;
		margin-top: 0.4rem;
	}
	.open-book:hover {
		border-color: var(--leafeon-pink);
		color: var(--leafeon-pink);
	}

	/* ── the open book ───────────────────────────────────────────────────── */
	.open {
		margin-top: 1.4rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.open-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}
	.who {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}
	.tabs {
		display: flex;
		gap: 0.4rem;
		border-bottom: 1px solid var(--rule);
	}
	.tabs button {
		font-family: var(--font-ui);
		font-size: 0.76rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--muted);
		padding: 0.5rem 0.8rem;
		border-bottom: 2px solid transparent;
	}
	.tabs button:hover {
		color: var(--periwinkle);
	}
	.tabs button.active {
		color: var(--cream);
		border-bottom-color: var(--leafeon-pink);
	}
	.journal {
		border-left: 2px solid var(--leafeon-pink);
		background: var(--panel-accent);
		padding: 0.7rem 0.9rem;
		border-radius: 0 4px 4px 0;
	}
	.journal-label {
		font-family: var(--font-ui);
		font-size: 0.66rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--periwinkle);
		margin: 0 0 0.3rem;
	}
	.journal-text {
		font-family: var(--font-hand);
		font-size: 1.18rem;
		line-height: 1.45;
		color: var(--cream);
		margin: 0 0 0.4rem;
	}
	.mode-panel {
		min-height: 12rem;
	}
	.offline {
		border: 1px solid var(--cyan);
		border-radius: 4px;
		background: var(--panel-accent);
		padding: 0.6rem 0.8rem;
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.8rem;
		flex-wrap: wrap;
	}
	.offline p {
		font-family: var(--font-body);
		font-size: 0.86rem;
		color: var(--text);
		margin: 0;
	}
	.offline strong {
		color: var(--cyan);
		font-weight: 500;
	}
	.num {
		font-family: var(--font-counter);
		color: var(--leafeon-pink);
		font-size: 1.1em;
	}

	.rule {
		border: 0;
		border-top: 1px solid var(--rule);
		margin: 2rem auto;
	}

	/* ── side room ───────────────────────────────────────────────────────── */
	.side-toggle {
		font-family: var(--font-ui);
		font-size: 0.74rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--periwinkle);
	}
	.side-toggle:hover {
		color: var(--cyan);
	}
	.side-note {
		font-family: var(--font-body);
		font-style: italic;
		font-size: 0.84rem;
		color: var(--muted);
		max-width: 34rem;
		margin: 0.3rem 0 0;
	}
	.arcade-wrap {
		margin-top: 1rem;
	}
	footer {
		margin-top: 3rem;
		text-align: center;
		font-family: var(--font-ui);
		font-size: 0.78rem;
		color: var(--muted);
	}
	footer a {
		color: var(--periwinkle);
	}
</style>
