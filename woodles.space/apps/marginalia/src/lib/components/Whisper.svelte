<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { fly } from 'svelte/transition';
	import { game } from '$lib/state/game.svelte';
	import { pickNextWhisper, type Whisper } from '$lib/content/whispers';

	const VISIBLE_MS = 14_000;          // whisper stays expanded this long
	const COLLAPSED_MS = 8_000;         // before we shrink to a quiet dot
	const POLL_MS = 1_000;              // how often to re-check whether a whisper should fire

	type Phase = 'hidden' | 'visible' | 'collapsed';

	let current = $state<Whisper | null>(null);
	let phase = $state<Phase>('hidden');
	let firedAt = 0;
	let pollHandle: ReturnType<typeof setInterval> | undefined;
	let phaseHandle: ReturnType<typeof setTimeout> | undefined;

	function clearPhaseTimer() {
		if (phaseHandle) {
			clearTimeout(phaseHandle);
			phaseHandle = undefined;
		}
	}

	function fire(w: Whisper) {
		current = w;
		phase = 'visible';
		firedAt = Date.now();
		game.markWhisperShown(w.id, !!w.repeat);

		clearPhaseTimer();
		phaseHandle = setTimeout(() => {
			phase = 'collapsed';
			phaseHandle = setTimeout(() => {
				phase = 'hidden';
				current = null;
			}, COLLAPSED_MS);
		}, VISIBLE_MS);
	}

	function poll() {
		// don't interrupt a whisper that's still in its visible window
		if (phase === 'visible') return;
		const idleSec = (Date.now() - game.lastInteractionAt) / 1000;
		const next = pickNextWhisper(game, {
			idleSec,
			lastFiredAtById: game.whispersLastFiredAt
		});
		if (next && next.id !== current?.id) fire(next);
	}

	function dismiss() {
		clearPhaseTimer();
		phase = 'hidden';
		current = null;
	}

	function expand() {
		if (phase !== 'collapsed' || !current) return;
		phase = 'visible';
		clearPhaseTimer();
		phaseHandle = setTimeout(() => {
			phase = 'collapsed';
			phaseHandle = setTimeout(() => {
				phase = 'hidden';
				current = null;
			}, COLLAPSED_MS);
		}, VISIBLE_MS);
	}

	onMount(() => {
		// initial poll after a short beat so the page can settle in
		const opening = setTimeout(poll, 1200);
		pollHandle = setInterval(poll, POLL_MS);
		return () => clearTimeout(opening);
	});

	onDestroy(() => {
		if (pollHandle) clearInterval(pollHandle);
		clearPhaseTimer();
	});

	const fromLabel = $derived(current?.from ?? 'an unknown hand');
</script>

{#if phase !== 'hidden' && current}
	{#if phase === 'visible'}
		<aside
			class="whisper"
			role="status"
			aria-live="polite"
			transition:fly={{ x: 24, duration: 320 }}
		>
			<header>
				<span class="from">— {fromLabel}</span>
				<button class="dismiss" type="button" onclick={dismiss} aria-label="dismiss">×</button>
			</header>
			<p class="text">{current.text}</p>
		</aside>
	{:else}
		<button
			class="dot"
			type="button"
			onclick={expand}
			aria-label="re-read the last whisper"
			transition:fly={{ x: 24, duration: 240 }}
		>—</button>
	{/if}
{/if}

<style>
	.whisper {
		position: fixed;
		top: 4.2rem;
		right: 1.1rem;
		z-index: 900;
		max-width: 22rem;
		padding: 0.55rem 0.7rem 0.6rem;
		background: var(--panel);
		border: 1px solid var(--rule);
		border-left: 2px solid var(--periwinkle);
		border-radius: 4px;
		box-shadow: 0 6px 18px rgba(0, 0, 0, 0.28);
		font-family: var(--font-body);
		color: var(--text);
		animation: pulse-border 2400ms ease-in-out infinite;
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
		margin-bottom: 0.25rem;
	}

	.from {
		font-family: var(--font-ui);
		font-size: 0.66rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--periwinkle);
	}

	.dismiss {
		background: none;
		border: none;
		color: var(--rule);
		font-size: 0.95rem;
		line-height: 1;
		padding: 0 0.2rem;
		cursor: pointer;
	}

	.dismiss:hover {
		color: var(--leafeon-pink);
	}

	.text {
		margin: 0;
		font-size: 0.92rem;
		line-height: 1.4;
		font-style: italic;
		color: var(--cream);
	}

	.dot {
		position: fixed;
		top: 4.4rem;
		right: 1.1rem;
		z-index: 900;
		width: 1.8rem;
		height: 1.8rem;
		border-radius: 50%;
		border: 1px solid var(--rule);
		background: var(--panel);
		color: var(--periwinkle);
		font-family: var(--font-counter);
		line-height: 1;
		cursor: pointer;
		opacity: 0.72;
	}

	.dot:hover {
		color: var(--leafeon-pink);
		border-color: var(--leafeon-pink);
		opacity: 1;
	}

	@keyframes pulse-border {
		0%, 100% { border-left-color: var(--periwinkle); }
		50%      { border-left-color: var(--leafeon-pink); }
	}

	@media (prefers-reduced-motion: reduce) {
		.whisper { animation: none; }
	}

	@media (max-width: 540px) {
		.whisper { right: 0.6rem; left: 0.6rem; max-width: none; top: 3.6rem; }
		.dot { right: 0.6rem; top: 3.6rem; }
	}
</style>
