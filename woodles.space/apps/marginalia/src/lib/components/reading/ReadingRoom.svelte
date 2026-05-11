<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { game } from '$lib/state/game.svelte';
	import { createReadingTimer } from '$lib/reading/timer';
	import Star from './Star.svelte';
	import StarShelf from './StarShelf.svelte';

	const POINT_MS = 20 * 60 * 1000;
	const PASTE_CAP = 500_000;
	const WPM = 230;
	const PERSIST_INTERVAL_MS = 3_000;
	const PASTE_KEY = 'marginalia.reading.paste.v1';

	let paneEl: HTMLElement | undefined = $state();
	let pasteText = $state('');
	let mode = $state<'paste' | 'read'>('paste');
	let truncated = $state(false);

	// Live counters
	let sessionMs = $state(0);
	let nowTick = $state(0); // bumped each frame so derived re-evaluates

	// Word count of the current paste, computed once on commit.
	let committedWordCount = $state(0);

	const timer = createReadingTimer({
		onAccrueMs: (dt) => {
			game.creditReadingMs(dt);
			sessionMs += dt;
			nowTick++;
		}
	});

	const progress = $derived.by(() => {
		void nowTick;
		return game.readingMsTowardNextPoint / POINT_MS;
	});

	const estimatedReadingMin = $derived(committedWordCount > 0 ? committedWordCount / WPM : 0);

	function countWords(s: string): number {
		const trimmed = s.trim();
		if (!trimmed) return 0;
		return trimmed.split(/\s+/).length;
	}

	function formatHms(ms: number): string {
		const s = Math.floor(ms / 1000);
		const h = Math.floor(s / 3600);
		const m = Math.floor((s % 3600) / 60);
		const sec = s % 60;
		const mm = String(m).padStart(2, '0');
		const ss = String(sec).padStart(2, '0');
		if (h > 0) return `${h}:${mm}:${ss}`;
		return `${mm}:${ss}`;
	}

	function formatMin(min: number): string {
		if (min < 1) return '< 1 min';
		const m = Math.round(min);
		if (m < 60) return `${m} min`;
		const h = Math.floor(m / 60);
		const r = m % 60;
		return r === 0 ? `${h} hr` : `${h} hr ${r} min`;
	}

	function commitText() {
		let t = pasteText;
		truncated = false;
		if (t.length > PASTE_CAP) {
			t = t.slice(0, PASTE_CAP);
			truncated = true;
			pasteText = t;
		}
		const words = countWords(t);
		committedWordCount = words;
		game.addReadingWords(words);
		mode = 'read';
		try {
			sessionStorage.setItem(PASTE_KEY, t);
		} catch {
			// ignore quota
		}
	}

	function newText() {
		mode = 'paste';
		pasteText = '';
		committedWordCount = 0;
		truncated = false;
		try {
			sessionStorage.removeItem(PASTE_KEY);
		} catch {
			// ignore
		}
	}

	function onEnter() {
		timer.setPresent(true);
	}

	function onLeave() {
		timer.setPresent(false);
	}

	function onUnload() {
		game.persist();
	}

	onMount(() => {
		try {
			const saved = sessionStorage.getItem(PASTE_KEY);
			if (saved) {
				pasteText = saved;
				committedWordCount = countWords(saved);
				mode = 'read';
			}
		} catch {
			// ignore
		}
		timer.start();
		const id = setInterval(() => game.persist(), PERSIST_INTERVAL_MS);
		window.addEventListener('beforeunload', onUnload);
		return () => {
			clearInterval(id);
			window.removeEventListener('beforeunload', onUnload);
		};
	});

	onDestroy(() => {
		timer.stop();
		game.persist();
	});

	const accruing = $derived.by(() => {
		void nowTick;
		return timer.isAccruing();
	});
</script>

<section
	class="reading-room"
	bind:this={paneEl}
	onpointerenter={onEnter}
	onpointerleave={onLeave}
	aria-labelledby="reading-room-title"
>
	<header class="head">
		<h3 id="reading-room-title">reading for the stars</h3>
		<p class="sub">a quiet room. read at your own pace — the timer follows your cursor.</p>
	</header>

	<div class="board">
		<div class="active-star">
			<Star points={game.readingStarPoints} progress={progress} active size={120} />
			<p class="points">
				<span class="num">{game.readingStarPoints}</span> / 5 points
				{#if game.readingCompletedStars > 0}
					· <span class="num">{game.readingCompletedStars}</span>
					completed
				{/if}
			</p>
			<p class="time" class:idle={!accruing}>
				{formatHms(sessionMs)} this session
				{#if !accruing && mode === 'read'}
					<span class="paused">— paused</span>
				{/if}
			</p>
		</div>

		<div class="reader">
			{#if mode === 'paste'}
				<label class="paste-label">
					<span>paste a text. word count and reading time will appear once you begin.</span>
					<textarea
						bind:value={pasteText}
						placeholder="paste here — anything you want to read."
						rows="10"
					></textarea>
				</label>
				<div class="paste-actions">
					<button class="commit" type="button" disabled={!pasteText.trim()} onclick={commitText}>
						— begin reading —
					</button>
				</div>
			{:else}
				<div class="text-meta">
					<span><span class="num">{committedWordCount.toLocaleString()}</span> words</span>
					<span>· about <span class="num">{formatMin(estimatedReadingMin)}</span></span>
					<button class="ghost" type="button" onclick={newText}>new text</button>
				</div>
				{#if truncated}
					<p class="notice">— text was longer than 500k characters; the rest was set aside.</p>
				{/if}
				<article class="passage">{pasteText}</article>
			{/if}
		</div>
	</div>

	<footer class="shelf-wrap">
		<h4>the shelf</h4>
		<StarShelf count={game.readingCompletedStars} />
	</footer>
</section>

<style>
	.reading-room {
		max-width: 44rem;
		margin: 1.2rem auto 0;
		padding: 1rem 1rem 1.2rem;
		border: 1px solid var(--rule);
		border-radius: 4px;
		background: var(--panel);
	}
	.head {
		text-align: center;
		margin-bottom: 0.8rem;
	}
	h3 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 1.2rem;
		color: var(--periwinkle);
		margin: 0 0 0.15rem;
	}
	.sub {
		font-family: var(--font-ui);
		font-size: 0.78rem;
		color: var(--muted);
		margin: 0;
	}
	.board {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 1.2rem;
		align-items: start;
	}
	@media (max-width: 600px) {
		.board {
			grid-template-columns: 1fr;
			justify-items: center;
		}
	}
	.active-star {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.4rem;
	}
	.points {
		font-family: var(--font-ui);
		font-size: 0.82rem;
		color: var(--muted);
		margin: 0;
	}
	.time {
		font-family: var(--font-counter);
		font-size: 0.95rem;
		color: var(--cyan);
		margin: 0;
		transition: opacity 220ms;
	}
	.time.idle {
		color: var(--muted);
		opacity: 0.65;
	}
	.paused {
		font-family: var(--font-ui);
		font-size: 0.72rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--print-pink);
		margin-left: 0.4rem;
	}
	.num {
		font-family: var(--font-counter);
		color: var(--leafeon-pink);
	}
	.reader {
		min-width: 0;
	}
	.paste-label {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.paste-label span {
		font-family: var(--font-ui);
		font-size: 0.82rem;
		color: var(--muted);
	}
	textarea {
		width: 100%;
		background: var(--panel-accent);
		color: var(--text);
		border: 1px solid var(--rule);
		border-radius: 3px;
		font-family: var(--font-body);
		font-size: 1rem;
		padding: 0.6rem;
		resize: vertical;
		line-height: 1.6;
	}
	.paste-actions {
		display: flex;
		justify-content: flex-end;
		margin-top: 0.6rem;
	}
	.commit {
		font-family: var(--font-display);
		font-size: 1rem;
		color: var(--cream);
		background: var(--panel-accent);
		border: 1px solid var(--rule);
		border-radius: 3px;
		padding: 0.4rem 0.8rem;
	}
	.commit:hover:not(:disabled) {
		border-color: var(--leafeon-pink);
		color: var(--leafeon-pink);
	}
	.text-meta {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		font-family: var(--font-ui);
		font-size: 0.82rem;
		color: var(--muted);
		margin-bottom: 0.6rem;
		flex-wrap: wrap;
	}
	.ghost {
		margin-left: auto;
		font-family: var(--font-ui);
		font-size: 0.76rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--periwinkle);
	}
	.ghost:hover {
		color: var(--leafeon-pink);
	}
	.notice {
		font-family: var(--font-ui);
		font-size: 0.78rem;
		color: var(--print-pink);
		margin: 0 0 0.5rem;
	}
	.passage {
		font-family: var(--font-body);
		font-size: 1.02rem;
		line-height: 1.7;
		color: var(--text);
		white-space: pre-wrap;
		max-height: 26rem;
		overflow-y: auto;
		padding: 0.4rem 0.6rem 0.4rem 0;
	}
	.shelf-wrap {
		margin-top: 1.1rem;
		padding-top: 0.8rem;
		border-top: 1px solid var(--rule);
	}
	h4 {
		font-family: var(--font-ui);
		font-weight: 500;
		font-size: 0.74rem;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: var(--periwinkle);
		margin: 0 0 0.5rem;
	}
</style>
