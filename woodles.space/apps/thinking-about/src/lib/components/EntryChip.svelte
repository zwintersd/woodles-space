<script lang="ts">
	import { onDestroy } from 'svelte';
	import { collect, prefersReducedMotion, sparkBurst, type Spark } from '$lib/motion';
	import { sessionVerb } from '$lib/constants';
	import { latestSessionDate, today } from '$lib/entries';
	import { thinkingAbout } from '$lib/thinkingAbout.svelte';
	import type { ThinkingAboutEntry } from '$lib/types';

	// `index` is only ever a motion concern: it staggers the chip's arrival
	// so a section deals itself out like a hand of cards instead of blinking
	// into place all at once.
	let { entry, index = 0 }: { entry: ThinkingAboutEntry; index?: number } = $props();

	let lastLogged = $derived(latestSessionDate(entry.sessions));
	let satToday = $derived(lastLogged !== null && lastLogged === today());
	let logTitle = $derived(
		lastLogged
			? `log a ${sessionVerb(entry.columnKey)} session — last logged ${lastLogged}`
			: `log a ${sessionVerb(entry.columnKey)} session`
	);

	// The burst thrown off by logging a sitting. Keyed by `id` so a second tap
	// restarts it mid-flight rather than landing on an animation already
	// running, and cleared on a timer because a finished burst has nothing
	// left to say — there is no state here worth keeping.
	const BURST_MS = 640;
	let burst = $state<{ id: number; sparks: Spark[] } | null>(null);
	let burstCount = 0;
	let burstTimer: ReturnType<typeof setTimeout> | undefined;

	function logSitting(): void {
		thinkingAbout.logSession(entry.id);
		// Nothing to celebrate with when a person has asked for stillness.
		if (prefersReducedMotion()) return;
		const id = ++burstCount;
		burst = { id, sparks: sparkBurst() };
		clearTimeout(burstTimer);
		burstTimer = setTimeout(() => {
			if (burstCount === id) burst = null;
		}, BURST_MS);
	}

	onDestroy(() => clearTimeout(burstTimer));
</script>

<div
	class="chip"
	class:sat-today={satToday}
	class:bursting={burst !== null}
	style:--chip-color={entry.color}
	style:--i={index}
	out:collect
>
	{#if burst}
		{#key burst.id}
			<span class="chip-wash" aria-hidden="true"></span>
		{/key}
	{/if}

	<span class="chip-sheen" aria-hidden="true"></span>

	<button class="chip-open" onclick={() => thinkingAbout.openEntry(entry.id)}>
		<span class="chip-dot" aria-hidden="true"></span>
		<span class="chip-title">{entry.title || 'untitled'}</span>
	</button>
	<button class="chip-log" onclick={logSitting} title={logTitle}
		aria-label="log a {sessionVerb(entry.columnKey)} session for {entry.title || 'untitled'}"
	>
		<span class="log-arrow" aria-hidden="true">▸</span>
		{#if entry.sessions.length > 0}
			{#key entry.sessions.length}
				<span class="chip-log-count">{entry.sessions.length}</span>
			{/key}
		{/if}
		{#if burst}
			{#key burst.id}
				<span class="burst" aria-hidden="true">
					<span class="burst-ring"></span>
					{#each burst.sparks as spark (spark.id)}
						<span
							class="spark"
							style:--angle="{spark.angle}deg"
							style:--distance="{spark.distance}px"
							style:--spark-delay="{spark.delay}ms"
						></span>
					{/each}
				</span>
			{/key}
		{/if}
	</button>
	<button
		class="chip-archive"
		onclick={() => thinkingAbout.archiveEntry(entry.id)}
		title="mark done"
		aria-label="mark {entry.title || 'untitled'} done"
	>
		✓
	</button>
</div>

<style>
	.chip {
		position: relative;
		display: flex;
		align-items: stretch;
		gap: 0.3rem;
		border-radius: var(--ta-radius-sm);
		background:
			linear-gradient(90deg, color-mix(in srgb, var(--chip-color) 26%, white), white 150%),
			color-mix(in srgb, var(--chip-color) 18%, white);
		border: 1px solid color-mix(in srgb, var(--chip-color) 42%, white);
		transition: background var(--ta-transition-fast), box-shadow var(--ta-transition-fast),
			transform var(--ta-transition-spring);
		animation: ta-rise 0.42s var(--ta-ease-spring) both;
		/* last in the cascade: after the column, after the section, then one
		   chip after another down the list */
		animation-delay: calc(var(--section-delay, 0ms) + min(calc(var(--i, 0) * 34ms), 170ms));
	}

	/* The moment a thing is marked done: the row floods with its own color,
	   stamps a check over itself, and only then folds shut. `--ta-collect`
	   is driven by the `collect` transition in $lib/motion. */
	.chip::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		/* the check is drawn, not typed: a '✓' in `content` would be read out
		   as part of every chip on the board, and this layer is invisible for
		   all but the third of a second an entry takes to leave */
		background:
			url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 13l4 4L19 7'/%3E%3C/svg%3E")
				center / 14px 14px no-repeat,
			var(--chip-color);
		opacity: var(--ta-collect, 0);
		pointer-events: none;
		z-index: 3;
	}

	.chip:hover,
	.chip:focus-within {
		background:
			linear-gradient(90deg, color-mix(in srgb, var(--chip-color) 34%, white), white 145%),
			color-mix(in srgb, var(--chip-color) 24%, white);
		box-shadow: var(--ta-shadow-sm);
		transform: var(--ta-lift-hover);
	}

	/* the wash that runs over the whole chip when a sitting is logged */
	.chip-wash {
		position: absolute;
		inset: -1px;
		border-radius: inherit;
		background: var(--chip-color);
		opacity: 0;
		pointer-events: none;
		animation: ta-wash 0.5s var(--ta-ease-glide) both;
	}

	@keyframes ta-wash {
		0% {
			opacity: 0.3;
		}
		100% {
			opacity: 0;
		}
	}

	/* The pass of light on hover gets its own layer over the whole chip: it
	   needs to be clipped to the chip's rounded box, and the chip itself
	   can't clip — the burst has to be able to leave. */
	.chip-sheen {
		position: absolute;
		inset: 0;
		overflow: hidden;
		border-radius: inherit;
		pointer-events: none;
		z-index: 2;
	}

	.chip-sheen::after {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		left: 0;
		width: 40%;
		background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.6), transparent);
		transform: translateX(-120%) skewX(-12deg);
	}

	.chip:hover .chip-sheen::after {
		animation: ta-sheen 0.85s var(--ta-ease-glide);
	}

	.chip-open {
		position: relative;
		flex: 1;
		display: flex;
		align-items: center;
		gap: 0.4rem;
		min-width: 0;
		padding: 0.4rem 0.5rem;
		text-align: left;
	}

	.chip-open:active {
		transform: scale(0.985);
	}

	.chip-dot {
		position: relative;
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: var(--chip-color);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--chip-color) 18%, transparent);
		flex-shrink: 0;
		transition: transform var(--ta-transition-spring);
	}

	/* something sat with today keeps a slow halo going — the board's one
	   piece of ambient motion, and the only one that means anything. */
	.chip-dot::after {
		content: '';
		position: absolute;
		inset: -1px;
		border-radius: 50%;
		border: 1.5px solid var(--chip-color);
		opacity: 0;
	}

	.chip.sat-today .chip-dot::after {
		animation: ta-breathe 3.2s var(--ta-ease-glide) infinite;
	}

	.chip:hover .chip-dot {
		transform: scale(1.2);
	}

	.chip-title {
		flex: 1;
		min-width: 0;
		font-family: var(--ta-font-sans);
		font-size: 0.82rem;
		color: var(--ta-text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.chip-log,
	.chip-archive {
		position: relative;
		flex-shrink: 0;
		width: 1.6rem;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.7rem;
		color: color-mix(in srgb, var(--chip-color) 65%, black 25%);
		opacity: 0.45;
		transition: opacity var(--ta-transition-fast), background var(--ta-transition-fast),
			transform var(--ta-transition-spring);
		border-radius: var(--ta-radius-sm);
	}

	.chip-log {
		width: auto;
		min-width: 1.6rem;
		padding: 0 0.3rem;
		gap: 0.12rem;
	}

	.log-arrow {
		display: inline-block;
	}

	.chip.bursting .log-arrow {
		animation: ta-nudge 0.42s var(--ta-ease-spring);
	}

	.chip-log-count {
		font-family: var(--ta-font-mono);
		font-size: 0.6rem;
		animation: ta-pop 0.34s var(--ta-ease-spring) both;
	}

	/* dim by default rather than fully hidden — touch has no hover to reveal it */
	.chip:hover .chip-log,
	.chip:focus-within .chip-log,
	.chip:hover .chip-archive,
	.chip:focus-within .chip-archive {
		opacity: 0.8;
	}

	.chip-log:hover,
	.chip-log:focus-visible,
	.chip-archive:hover,
	.chip-archive:focus-visible {
		opacity: 1;
		background: rgba(255, 255, 255, 0.55);
		transform: scale(1.15);
	}

	.chip-log:active,
	.chip-archive:active {
		transform: scale(0.92);
	}

	/* the tap itself, thrown off the log button: one ring, and flecks in the
	   entry's own color. Purely decorative, and never built at all when
	   motion is reduced — see logSitting(). */
	.burst {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	.burst-ring {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 1.6rem;
		height: 1.6rem;
		border-radius: 50%;
		border: 1.5px solid var(--chip-color);
		transform: translate(-50%, -50%) scale(0.2);
		animation: ta-ripple 0.55s var(--ta-ease-glide) both;
	}

	.spark {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 4px;
		height: 4px;
		margin: -2px 0 0 -2px;
		border-radius: 50%;
		background: var(--chip-color);
		transform-origin: center;
		opacity: 0;
		animation: ta-spark 0.58s var(--ta-ease-glide) both;
		animation-delay: var(--spark-delay, 0ms);
	}
</style>
