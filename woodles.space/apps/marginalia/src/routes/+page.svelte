<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { book, fmt } from '$lib/witch/book.svelte';
	import { startTick, stopTick } from '$lib/witch/tick';
	import { titleById } from '$lib/witch/content/titles';
	import { exportSave, importSave } from '$lib/witch/persist';
	import TheWeb from '$lib/witch/TheWeb.svelte';
	import TheWorld from '$lib/witch/TheWorld.svelte';
	import Ledger from '$lib/witch/Ledger.svelte';
	import { LOOK_CLOSER_SECONDS } from '$lib/witch/tuning';
	import type { Life } from '$lib/witch/content/life';
	import ReadingRoom from '$lib/components/reading/ReadingRoom.svelte';
	import Arcade from '$lib/arcade/Arcade.svelte';
	import HexStage from '$lib/witch/HexStage.svelte';
	import TutorialOverlay from '$lib/witch/TutorialOverlay.svelte';

	const TUTORIAL_KEY = 'witch.idle.tutorial.v1';

	let menuOpen = $state(false);
	let importBox = $state('');
	let exportBlob = $state('');
	let readingOpen = $state(false);
	let arcadeOpen = $state(false);
	let hexStageOpen = $state(false);
	let tutorialOpen = $state(false);
	let portalPulse = $state(false);
	let portalHint = $state<string | null>(null);
	let portalFloats = $state<{ key: number; text: string; tone: 'look' | 'attend' | 'guide' }[]>([]);
	let portalSeq = 0;
	let portalTimers: ReturnType<typeof setTimeout>[] = [];

	function onFocus() {
		void book.refreshBestiaryCreatures();
	}

	onMount(() => {
		book.hydrate();
		void book.refreshBestiaryCreatures();
		if (window.location.hash === '#reading-room') readingOpen = true;
		tutorialOpen = localStorage.getItem(TUTORIAL_KEY) !== 'done';
		startTick();
		window.addEventListener('beforeunload', persist);
		window.addEventListener('focus', onFocus);
	});
	onDestroy(() => {
		stopTick();
		for (const timer of portalTimers) clearTimeout(timer);
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
	const portalLabel = $derived(
		book.quiet
			? 'going quiet'
			: book.selfBalancing
				? 'holding itself'
				: book.life.length > 0
					? `${book.life.length} life${book.life.length === 1 ? '' : 's'} present`
					: 'empty planet'
	);
	const portalStyle = $derived(
		[
			`--portal-life:${Math.min(1, book.life.length / 8).toFixed(3)}`,
			`--portal-favor:${Math.max(0, Math.min(1, book.favor / 100)).toFixed(3)}`,
			`--portal-stability:${Math.max(0, Math.min(1, book.stability / 100)).toFixed(3)}`,
			`--portal-moisture:${Math.max(0, Math.min(1, book.stocks.moisture / 100)).toFixed(3)}`,
			`--portal-oxygen:${Math.max(0, Math.min(1, book.stocks.oxygen / 100)).toFixed(3)}`
		].join(';')
	);
	const portalActionLabel = $derived.by(() => {
		const target = portalTargetLife();
		if (book.life.length === 0) return 'open the world';
		if (!target) return 'rest in what is known';
		if (book.isAttending(target.id)) return `look closer at ${target.name}`;
		return `attend to ${target.name}`;
	});

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
	function closeTutorial() {
		tutorialOpen = false;
		localStorage.setItem(TUTORIAL_KEY, 'done');
	}
	function replayTutorial() {
		tutorialOpen = true;
		menuOpen = false;
	}
	function goStudy() {
		book.closeBook();
	}
	function goWeb() {
		book.openBook();
		book.mode = 'web';
	}
	function goWorld() {
		book.openBook();
		book.mode = 'world';
	}
	function portalTargetLife(): Life | null {
		return (
			book.life.find((life) => book.isAttending(life.id)) ??
			book.life.find((life) => book.canAttend(life.id)) ??
			null
		);
	}
	function pushPortalFloat(text: string, tone: 'look' | 'attend' | 'guide') {
		const key = ++portalSeq;
		portalFloats = [...portalFloats, { key, text, tone }];
		const removeTimer = setTimeout(() => {
			portalFloats = portalFloats.filter((item) => item.key !== key);
		}, 900);
		portalTimers.push(removeTimer);
	}
	function setPortalHint(text: string) {
		portalHint = text;
		const hintTimer = setTimeout(() => {
			if (portalHint === text) portalHint = null;
		}, 1500);
		portalTimers.push(hintTimer);
	}
	function pulsePortal() {
		portalPulse = false;
		requestAnimationFrame(() => {
			portalPulse = true;
			const pulseTimer = setTimeout(() => (portalPulse = false), 260);
			portalTimers.push(pulseTimer);
		});
	}
	function clickPortal() {
		goWorld();
		pulsePortal();
		const target = portalTargetLife();
		if (!target) {
			const text = book.life.length === 0 ? 'write a condition first' : 'all known';
			pushPortalFloat(text, 'guide');
			setPortalHint(text);
			return;
		}
		if (book.isAttending(target.id)) {
			book.lookCloser(target.id);
			const secs = LOOK_CLOSER_SECONDS * target.studyEase;
			const label = `+${Number.isInteger(secs) ? secs.toFixed(0) : secs.toFixed(1)}s`;
			pushPortalFloat(label, 'look');
			setPortalHint(`looking closer: ${target.name}`);
			return;
		}
		if (book.canAttend(target.id)) {
			book.attend(target.id);
			pushPortalFloat('attending', 'attend');
			setPortalHint(`attending: ${target.name}`);
		}
	}
	function openRoom(id: 'reading-room' | 'arcade-room' | 'hex-room') {
		if (id === 'reading-room') readingOpen = true;
		if (id === 'arcade-room') arcadeOpen = true;
		if (id === 'hex-room') hexStageOpen = true;
		setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
	}
	function doResetIdle() {
		if (confirm('Reset only the idle Book progress? Bestiary creatures and Bestiary art will not be changed.')) {
			book.resetIdleProgress();
			localStorage.removeItem(TUTORIAL_KEY);
			tutorialOpen = true;
			menuOpen = false;
		}
	}
</script>

<header class="topbar">
	<div class="brand-group">
		<a class="brand" href="/">✦ marginalia · woodles.space</a>
		<span class="room-label">{book.bookOpen ? (book.mode === 'web' ? 'the web' : 'the world') : 'the study'}</span>
	</div>
	<div class="top-meters" aria-label="current book resources">
		<span><b>{fmt(book.insight)}</b> insight</span>
		<span><b>{book.essence}</b> essence</span>
		<span><b>{Math.round(book.favor)}</b> favor</span>
	</div>
	<div class="top-actions">
		{#if !tutorialOpen}
			<button class="ghost resume" type="button" onclick={replayTutorial}>resume tutorial</button>
		{/if}
		<button class="ghost" type="button" onclick={() => (menuOpen = !menuOpen)}>
			{menuOpen ? 'close' : 'menu'}
		</button>
	</div>
</header>

{#if menuOpen}
	<div class="menu">
		<div class="menu-section">
			<h4>tutorial</h4>
			<button class="ghost" onclick={replayTutorial}>resume idle tutorial</button>
		</div>
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
			<h4>reset</h4>
			<button class="ghost danger" onclick={doResetIdle}>reset idle progress only</button>
		</div>
	</div>
{/if}

{#if tutorialOpen}
	<TutorialOverlay onclose={closeTutorial} />
{/if}

<div class="app-shell">
	<aside class="book-spine" aria-label="study rooms">
		<button class:active={!book.bookOpen} onclick={goStudy}>
			<span class="spine-mark">S</span>
			<span>study</span>
		</button>
		<button class:active={book.bookOpen && book.mode === 'web'} onclick={goWeb}>
			<span class="spine-mark">W</span>
			<span>web</span>
		</button>
		<button class:active={book.bookOpen && book.mode === 'world'} onclick={goWorld}>
			<span class="spine-mark">O</span>
			<span>world</span>
		</button>
		<button class:active={readingOpen} onclick={() => openRoom('reading-room')}>
			<span class="spine-mark">R</span>
			<span>reading</span>
		</button>
		<button class:active={arcadeOpen} onclick={() => openRoom('arcade-room')}>
			<span class="spine-mark">A</span>
			<span>arcade</span>
		</button>
		<a href="/bestiary">
			<span class="spine-mark">B</span>
			<span>bestiary</span>
		</a>
		<button class:active={tutorialOpen} onclick={replayTutorial}>
			<span class="spine-mark">?</span>
			<span>guide</span>
		</button>
	</aside>

	<div class="page-column">
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

			<section class="side" id="reading-room">
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

			<section class="side" id="arcade-room">
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

			<section class="side" id="hex-room">
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
	</div>

	<aside class="world-portal-panel" aria-label="world portal">
		<button
			class="portal"
			class:popping={portalPulse}
			style={portalStyle}
			onclick={clickPortal}
			aria-label={portalActionLabel}
		>
			<span class="portal-sky"></span>
			<span class="portal-water"></span>
			<span class="portal-land"></span>
			<span class="portal-life one"></span>
			<span class="portal-life two"></span>
			<span class="portal-life three"></span>
			{#each portalFloats as item (item.key)}
				<span class="portal-float" class:attend={item.tone === 'attend'} class:guide={item.tone === 'guide'}>
					{item.text}
				</span>
			{/each}
		</button>
		<div class="portal-copy">
			<span class="portal-kicker">world clicker</span>
			<strong>{portalLabel}</strong>
			<span>{portalHint ?? portalActionLabel}</span>
		</div>
	</aside>
</div>

<style>
	.topbar {
		position: sticky;
		top: 0;
		z-index: 30;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.7rem 1.2rem;
		border-bottom: 1px solid var(--rule);
		background: color-mix(in srgb, var(--bg) 92%, transparent);
		backdrop-filter: blur(10px);
	}
	.brand-group {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
		min-width: 0;
	}
	.brand {
		font-family: var(--font-ui);
		font-size: 0.78rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--periwinkle);
		text-decoration: none;
	}
	.room-label {
		font-family: var(--font-ui);
		font-size: 0.66rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--muted);
		white-space: nowrap;
	}
	.brand:hover {
		color: var(--leafeon-pink);
	}
	.top-meters {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		flex: 1;
		min-width: 0;
		font-family: var(--font-ui);
		font-size: 0.66rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--muted);
	}
	.top-meters span {
		white-space: nowrap;
	}
	.top-meters b {
		font-family: var(--font-counter);
		font-size: 1.1rem;
		line-height: 1;
		color: var(--cyan);
		font-weight: 400;
		letter-spacing: 0;
	}
	.top-actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
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
	.ghost.resume {
		color: var(--cream);
		border: 1px solid var(--rule);
		border-radius: 4px;
		padding: 0.25rem 0.45rem;
	}
	.ghost.resume:hover {
		border-color: var(--cyan);
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
	.app-shell {
		width: min(100%, 82rem);
		margin: 0 auto;
		display: grid;
		grid-template-columns: 7.5rem minmax(0, 1fr) 11rem;
		gap: 1.1rem;
		padding: 0 1rem 4rem;
	}
	.page-column {
		min-width: 0;
	}
	.book-spine {
		position: sticky;
		top: 4.2rem;
		align-self: start;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		padding-top: 1.4rem;
	}
	.book-spine button,
	.book-spine a {
		display: grid;
		grid-template-columns: 1.5rem minmax(0, 1fr);
		align-items: center;
		gap: 0.45rem;
		min-height: 2.2rem;
		border-left: 2px solid transparent;
		padding: 0.25rem 0.35rem;
		color: var(--muted);
		text-decoration: none;
		text-align: left;
		font-family: var(--font-ui);
		font-size: 0.66rem;
		letter-spacing: 0.13em;
		text-transform: uppercase;
	}
	.book-spine button:hover,
	.book-spine a:hover {
		color: var(--cyan);
	}
	.book-spine button.active {
		color: var(--cream);
		border-left-color: var(--leafeon-pink);
		background: linear-gradient(90deg, rgba(240, 143, 184, 0.12), transparent);
	}
	.spine-mark {
		width: 1.5rem;
		height: 1.5rem;
		border: 1px solid var(--rule);
		border-radius: 50%;
		display: grid;
		place-items: center;
		font-family: var(--font-counter);
		font-size: 1rem;
		letter-spacing: 0;
		color: var(--periwinkle);
	}
	.book-spine button.active .spine-mark,
	.book-spine a:hover .spine-mark,
	.book-spine button:hover .spine-mark {
		border-color: var(--cyan);
		color: var(--cyan);
	}
	.world-portal-panel {
		position: sticky;
		top: 4.2rem;
		align-self: start;
		padding-top: 1.4rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.65rem;
	}
	.portal {
		position: relative;
		width: min(9rem, 100%);
		aspect-ratio: 1;
		border: 1px solid rgba(108, 229, 232, 0.42);
		border-radius: 50%;
		overflow: hidden;
		background:
			radial-gradient(circle at 50% 42%, rgba(245, 242, 232, calc(0.08 + var(--portal-favor) * 0.18)), transparent 34%),
			linear-gradient(180deg, #23235a 0%, #31306c 52%, #171739 100%);
		box-shadow:
			0 0 calc(10px + var(--portal-favor) * 22px) rgba(108, 229, 232, 0.22),
			inset 0 0 26px rgba(26, 26, 62, calc(0.25 + (1 - var(--portal-stability)) * 0.45));
		transition:
			border-color 120ms,
			box-shadow 140ms,
			transform 140ms;
	}
	.portal:hover {
		border-color: var(--cyan);
		transform: translateY(-1px);
		box-shadow:
			0 0 calc(14px + var(--portal-favor) * 26px) rgba(108, 229, 232, 0.28),
			inset 0 0 26px rgba(26, 26, 62, calc(0.25 + (1 - var(--portal-stability)) * 0.45));
	}
	.portal:active,
	.portal.popping {
		transform: scale(0.975);
		border-color: var(--leafeon-pink);
	}
	.portal::before {
		content: '';
		position: absolute;
		inset: 8%;
		border: 1px solid rgba(245, 242, 232, 0.18);
		border-radius: 50%;
		z-index: 5;
		pointer-events: none;
	}
	.portal-sky,
	.portal-water,
	.portal-land,
	.portal-life {
		position: absolute;
		display: block;
		pointer-events: none;
	}
	.portal-sky {
		inset: 0 0 38%;
		background:
			radial-gradient(circle at 66% 28%, rgba(245, 242, 232, calc(0.12 + var(--portal-favor) * 0.26)), transparent 17%),
			radial-gradient(ellipse at 35% 45%, rgba(108, 229, 232, calc(var(--portal-oxygen) * 0.28)), transparent 50%);
	}
	.portal-water {
		left: -8%;
		right: -8%;
		bottom: 0;
		height: calc(24% + var(--portal-moisture) * 18%);
		background:
			radial-gradient(ellipse at 35% 0%, rgba(108, 229, 232, 0.42), transparent 55%),
			linear-gradient(180deg, rgba(108, 229, 232, 0.32), rgba(45, 45, 95, 0.82));
		border-radius: 48% 52% 0 0;
	}
	.portal-land {
		left: 8%;
		right: 8%;
		bottom: calc(18% + var(--portal-moisture) * 9%);
		height: calc(18% + var(--portal-life) * 12%);
		background:
			radial-gradient(ellipse at 48% 0%, rgba(240, 143, 184, calc(var(--portal-life) * 0.22)), transparent 55%),
			linear-gradient(180deg, #4f426d, #272751);
		border-radius: 52% 48% 38% 42%;
	}
	.portal-life {
		width: calc(5px + var(--portal-life) * 6px);
		height: calc(14px + var(--portal-life) * 12px);
		bottom: calc(34% + var(--portal-moisture) * 4%);
		border-radius: 50% 50% 46% 46%;
		background: rgba(108, 229, 232, calc(var(--portal-life) * 0.9));
		box-shadow: 0 0 10px rgba(108, 229, 232, calc(var(--portal-life) * 0.45));
		transform-origin: 50% 100%;
	}
	.portal-life.one {
		left: 33%;
		transform: rotate(-8deg) scale(calc(0.65 + var(--portal-life) * 0.35));
	}
	.portal-life.two {
		left: 50%;
		background: rgba(240, 143, 184, calc(var(--portal-life) * 0.82));
		transform: rotate(5deg) scale(calc(0.5 + var(--portal-life) * 0.3));
	}
	.portal-life.three {
		left: 63%;
		transform: rotate(12deg) scale(calc(0.4 + var(--portal-life) * 0.28));
	}
	.portal-float {
		position: absolute;
		left: 50%;
		top: 47%;
		z-index: 6;
		transform: translate(-50%, -50%);
		font-family: var(--font-counter);
		font-size: 1.05rem;
		line-height: 1;
		color: var(--cyan);
		text-shadow: 0 0 8px rgba(108, 229, 232, 0.75);
		white-space: nowrap;
		pointer-events: none;
		animation: portal-pop 0.9s ease-out forwards;
	}
	.portal-float.attend {
		color: var(--leafeon-pink);
		text-shadow: 0 0 8px rgba(240, 143, 184, 0.72);
	}
	.portal-float.guide {
		font-family: var(--font-ui);
		font-size: 0.58rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--cream);
		text-shadow: 0 0 8px rgba(245, 242, 232, 0.5);
	}
	@keyframes portal-pop {
		0% {
			opacity: 0;
			transform: translate(-50%, -34%) scale(0.86);
		}
		18% {
			opacity: 1;
			transform: translate(-50%, -50%) scale(1);
		}
		70% {
			opacity: 1;
			transform: translate(-50%, -74%) scale(1);
		}
		100% {
			opacity: 0;
			transform: translate(-50%, -96%) scale(0.96);
		}
	}
	.portal-copy {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		text-align: center;
		font-family: var(--font-ui);
		font-size: 0.72rem;
		color: var(--muted);
	}
	.portal-kicker {
		font-size: 0.62rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--periwinkle);
	}
	.portal-copy strong {
		font-family: var(--font-display);
		font-size: 1rem;
		line-height: 1.1;
		font-weight: 400;
		color: var(--cream);
	}
	main {
		max-width: 60rem;
		margin: 0 auto;
		padding: 0 0 4rem;
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
	@media (max-width: 1100px) {
		.app-shell {
			grid-template-columns: 5.4rem minmax(0, 1fr) 8rem;
		}
		.portal {
			width: min(7rem, 100%);
		}
		.portal-copy {
			font-size: 0.66rem;
		}
		.portal-copy strong {
			font-size: 0.9rem;
		}
		.book-spine button,
		.book-spine a {
			grid-template-columns: 1fr;
			justify-items: center;
			gap: 0.2rem;
			font-size: 0.56rem;
			letter-spacing: 0.1em;
		}
	}
	@media (max-width: 760px) {
		.topbar {
			align-items: flex-start;
			flex-wrap: wrap;
		}
		.top-meters {
			order: 3;
			flex-basis: 100%;
			justify-content: flex-start;
			overflow-x: auto;
			padding-bottom: 0.1rem;
		}
		.app-shell {
			display: block;
			padding: 0 1rem 4rem;
		}
		.world-portal-panel {
			display: none;
		}
		.book-spine {
			position: sticky;
			top: 5.6rem;
			z-index: 20;
			flex-direction: row;
			overflow-x: auto;
			padding: 0.45rem 0;
			margin: 0 -1rem 0.6rem;
			background: color-mix(in srgb, var(--bg) 92%, transparent);
			backdrop-filter: blur(10px);
			border-bottom: 1px solid var(--rule);
		}
		.book-spine button,
		.book-spine a {
			flex: 0 0 auto;
			grid-template-columns: 1.3rem auto;
			border-left: 0;
			border-bottom: 2px solid transparent;
			padding: 0.25rem 0.55rem;
		}
		.book-spine button.active {
			border-left-color: transparent;
			border-bottom-color: var(--leafeon-pink);
			background: transparent;
		}
	}
	@media (max-width: 520px) {
		.topbar {
			gap: 0.5rem;
			padding: 0.55rem 0.8rem;
		}
		.brand-group {
			gap: 0.4rem;
		}
		.brand {
			font-size: 0.68rem;
			letter-spacing: 0.14em;
		}
		.room-label {
			display: none;
		}
		.top-actions {
			gap: 0.45rem;
			margin-left: auto;
		}
		.top-meters {
			font-size: 0.58rem;
			gap: 0.55rem;
		}
		.ghost.resume {
			font-size: 0.62rem;
			letter-spacing: 0.1em;
			white-space: nowrap;
			text-align: center;
			padding: 0.2rem 0.35rem;
		}
	}
</style>
