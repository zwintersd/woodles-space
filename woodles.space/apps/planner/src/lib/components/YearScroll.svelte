<script lang="ts">
	import { onMount } from 'svelte';
	import { store } from '$lib/store.svelte';
	import { getYearCalendar, DOW_LABELS_SHORT, MONTH_NAMES, isSameDay, isBeforeDay } from '$lib/calendar';
	import { dateKey } from '$lib/utils';

	let { compact = false }: { compact?: boolean } = $props();

	// ── navigation ──────────────────────────────────────────────────
	let yearOffset = $state(0);
	let scrollEl: HTMLElement | undefined = $state();

	let year = $derived(store.now.getFullYear() + yearOffset);
	let months = $derived(getYearCalendar(year));

	// ── helpers ──────────────────────────────────────────────────────
	function hasTask(date: Date): boolean {
		const key = dateKey(date);
		return store.tasks.some((t) => t.status !== 'dropped' && t.targetDate === key);
	}

	function taskCount(date: Date): number {
		const key = dateKey(date);
		return store.tasks.filter((t) => t.status !== 'dropped' && t.targetDate === key).length;
	}

	function isPast(date: Date): boolean {
		return isBeforeDay(date, store.now);
	}

	function isDayOff(date: Date): boolean {
		return store.getDayType(date) === 'day-off';
	}

	// Scroll to current month when first loaded
	onMount(() => {
		if (yearOffset !== 0 || !scrollEl) return;
		const currentMonthIndex = store.now.getMonth();
		const monthEls = scrollEl.querySelectorAll<HTMLElement>('.ys-month');
		const target = monthEls[currentMonthIndex];
		if (target) {
			// Scroll the container so the current month is near the top
			setTimeout(() => {
				target.scrollIntoView({ behavior: 'smooth', block: 'start' });
			}, 60);
		}
	});
</script>

<div class="year-scroll" class:compact>
	<!-- Header -->
	<header class="ys-header">
		{#if !compact}
			<a href="/" class="ys-home" title="back to woodles.space">·space</a>
		{/if}
		<div class="ys-nav">
			<button class="ys-nav-btn" onclick={() => yearOffset--} title="previous year">←</button>
			<span class="ys-year-label">{year}</span>
			<button class="ys-nav-btn" onclick={() => yearOffset++} title="next year">→</button>
		</div>
		{#if yearOffset !== 0}
			<button class="ys-this-year-btn" onclick={() => (yearOffset = 0)}>this year</button>
		{:else if !compact}
			<span class="ys-header-spacer"></span>
		{/if}
	</header>

	<!-- All 12 months -->
	<div class="ys-months" bind:this={scrollEl}>
		{#each months as cal (cal.month)}
			{@const isCurrentMonth = yearOffset === 0 && cal.month === store.now.getMonth()}

			<div class="ys-month" class:current-month={isCurrentMonth}>
				<div class="ys-month-name">
					{MONTH_NAMES[cal.month]}
					{#if cal.year !== store.now.getFullYear()}
						<span class="ys-year-suffix">{cal.year}</span>
					{/if}
				</div>

				<div class="ys-month-grid">
					<!-- DOW row -->
					{#each DOW_LABELS_SHORT as dow}
						<div class="ys-dow">{dow}</div>
					{/each}

					<!-- Day cells -->
					{#each cal.weeks as week}
						{#each week as day}
							{#if day}
								{@const today = isSameDay(day, store.now)}
								{@const past = isPast(day)}
								{@const off = isDayOff(day)}
								{@const count = taskCount(day)}

								<div
									class="ys-day"
									class:today
									class:past
									class:day-off={off}
									class:has-tasks={count > 0}
									title={count > 0 ? `${day.getDate()} · ${count} task${count !== 1 ? 's' : ''}` : undefined}
								>
									{day.getDate()}
									{#if count > 0}
										<span class="ys-day-dot"></span>
									{/if}
								</div>
							{:else}
								<div class="ys-day ys-day-empty"></div>
							{/if}
						{/each}
					{/each}
				</div>
			</div>
		{/each}
	</div>
</div>

<style>
	.year-scroll {
		max-width: 680px;
		margin: 0 auto;
		padding: 0 clamp(1rem, 4vw, 2rem) var(--pl-space-xl);
		display: flex;
		flex-direction: column;
	}

	.year-scroll.compact {
		padding: 0;
		max-width: 100%;
	}

	/* ── header ─────────────────────────────────────────────────────── */
	.ys-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.1rem 0 1rem;
		gap: 0.75rem;
	}

	.compact .ys-header {
		padding: 0.5rem 0 0.75rem;
	}

	.ys-home {
		font-family: var(--pl-font-mono);
		font-size: 0.65rem;
		letter-spacing: 0.16em;
		color: var(--p-muted);
		text-decoration: none;
		opacity: 0.6;
		transition: opacity var(--pl-transition-fast);
		flex-shrink: 0;
	}

	.ys-home:hover { opacity: 1; }

	.ys-nav {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.ys-nav-btn {
		font-family: var(--pl-font-mono);
		font-size: 0.8rem;
		color: var(--p-muted);
		padding: 3px 9px;
		border-radius: var(--pl-radius-sm);
		border: 1px solid var(--p-border);
		transition: color var(--pl-transition-fast), border-color var(--pl-transition-fast);
	}

	.ys-nav-btn:hover { color: var(--p-accent); border-color: var(--p-accent); }

	.ys-year-label {
		font-family: var(--pl-font-mono);
		font-size: 0.8rem;
		letter-spacing: 0.1em;
		color: var(--p-text);
	}

	.ys-this-year-btn {
		font-family: var(--pl-font-mono);
		font-size: 0.6rem;
		letter-spacing: 0.1em;
		color: var(--p-muted);
		border: 1px solid var(--p-border);
		padding: 3px 10px;
		border-radius: var(--pl-radius-pill);
		opacity: 0.7;
		transition: opacity var(--pl-transition-fast), color var(--pl-transition-fast), border-color var(--pl-transition-fast);
	}

	.ys-this-year-btn:hover { opacity: 1; color: var(--p-accent); border-color: var(--p-accent); }
	.ys-header-spacer { width: 72px; flex-shrink: 0; }

	/* ── months strip ────────────────────────────────────────────────── */
	.ys-months {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
		gap: var(--pl-space-lg);
		overflow-y: auto;
	}

	.compact .ys-months {
		grid-template-columns: 1fr;
		gap: var(--pl-space-md);
		overflow-y: visible;
	}

	.ys-month {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.ys-month.current-month .ys-month-name {
		color: var(--p-accent);
	}

	.ys-month-name {
		font-family: var(--pl-font-mono);
		font-size: 0.65rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--p-muted);
		margin-bottom: 2px;
		display: flex;
		align-items: baseline;
		gap: 0.4em;
	}

	.ys-year-suffix {
		font-size: 0.55rem;
		opacity: 0.6;
	}

	/* ── month grid ──────────────────────────────────────────────────── */
	.ys-month-grid {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 1px;
	}

	.ys-dow {
		font-family: var(--pl-font-mono);
		font-size: 0.45rem;
		letter-spacing: 0.06em;
		color: var(--p-muted);
		opacity: 0.45;
		text-align: center;
		padding: 1px 0 3px;
	}

	.ys-day {
		position: relative;
		font-family: var(--pl-font-mono);
		font-size: 0.6rem;
		text-align: center;
		padding: 2px 1px;
		border-radius: 3px;
		color: var(--p-text);
		line-height: 1.4;
		transition: background var(--pl-transition-fast);
		cursor: default;
	}

	.ys-day.today {
		background: var(--p-accent);
		color: var(--p-bg);
		border-radius: 3px;
		font-weight: 500;
	}

	.ys-day.past {
		opacity: 0.4;
	}

	.ys-day.day-off {
		color: var(--p-muted);
	}

	.ys-day.has-tasks:not(.today) {
		color: var(--p-accent);
	}

	.ys-day-empty {
		visibility: hidden;
	}

	.ys-day-dot {
		position: absolute;
		bottom: 1px;
		left: 50%;
		transform: translateX(-50%);
		width: 3px;
		height: 3px;
		border-radius: 50%;
		background: var(--p-accent);
	}

	.ys-day.today .ys-day-dot {
		background: var(--p-bg);
	}
</style>
