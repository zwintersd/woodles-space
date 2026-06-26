<script lang="ts">
	import { store } from '$lib/store.svelte';
	import { getMonthCalendar, DOW_LABELS, MONTH_NAMES, isSameDay, isBeforeDay } from '$lib/calendar';
	import { dateKey } from '$lib/utils';

	// ── navigation ──────────────────────────────────────────────────
	let monthOffset = $state(0);

	let targetDate = $derived.by(() => {
		const d = new Date(store.now.getFullYear(), store.now.getMonth() + monthOffset, 1);
		return d;
	});

	let year = $derived(targetDate.getFullYear());
	let month = $derived(targetDate.getMonth());
	let calendar = $derived(getMonthCalendar(year, month));

	// ── helpers ──────────────────────────────────────────────────────
	function isPast(date: Date): boolean {
		return isBeforeDay(date, store.now);
	}

	function isDayOff(date: Date): boolean {
		return store.isRestful(date);
	}
</script>

<div class="month-view">
	<!-- Header -->
	<header class="mv-header">
		<a href="/" class="mv-home" title="back to woodles.space">·space</a>
		<div class="mv-nav">
			<button class="mv-nav-btn" onclick={() => monthOffset--} title="previous month">←</button>
			<h2 class="mv-month-label">{MONTH_NAMES[month]} {year}</h2>
			<button class="mv-nav-btn" onclick={() => monthOffset++} title="next month">→</button>
		</div>
		{#if monthOffset !== 0}
			<button class="mv-today-btn" onclick={() => (monthOffset = 0)}>this month</button>
		{:else}
			<span class="mv-header-spacer"></span>
		{/if}
	</header>

	<!-- Calendar grid -->
	<div class="mv-grid">
		<!-- DOW headers -->
		{#each DOW_LABELS as dow}
			<div class="mv-dow">{dow}</div>
		{/each}

		<!-- Day cells -->
		{#each calendar.weeks as week}
			{#each week as day}
				{#if day}
					{@const today = isSameDay(day, store.now)}
					{@const past = isPast(day)}
					{@const off = isDayOff(day)}
					{@const shape = store.getDayShape(day)}

					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="mv-cell"
						class:today
						class:past
						class:day-off={off}
						onclick={() => store.openDayPanel(dateKey(day))}
					>
						<div class="mv-cell-head">
							<span class="mv-cell-num">{day.getDate()}</span>
							{#if off}
								<span class="mv-day-badge">off</span>
							{/if}
						</div>
						{#if shape}
							<div class="mv-cell-blocks">
								<span class="mv-cell-block">{shape.name}</span>
							</div>
						{/if}
					</div>
				{:else}
					<div class="mv-cell mv-cell-empty"></div>
				{/if}
			{/each}
		{/each}
	</div>
</div>

<style>
	.month-view {
		max-width: 720px;
		margin: 0 auto;
		padding: 0 clamp(1rem, 4vw, 2rem) var(--pl-space-xl);
	}

	/* ── header ─────────────────────────────────────────────────────── */
	.mv-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.1rem 0 1.25rem;
		gap: 0.75rem;
	}

	.mv-home {
		font-family: var(--pl-font-mono);
		font-size: 0.65rem;
		letter-spacing: 0.16em;
		color: var(--p-muted);
		text-decoration: none;
		opacity: 0.6;
		transition: opacity var(--pl-transition-fast);
		flex-shrink: 0;
	}

	.mv-home:hover { opacity: 1; }

	.mv-nav {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.mv-nav-btn {
		font-family: var(--pl-font-mono);
		font-size: 0.8rem;
		color: var(--p-muted);
		padding: 4px 10px;
		border-radius: var(--pl-radius-sm);
		border: 1px solid var(--p-border);
		transition: color var(--pl-transition-fast), border-color var(--pl-transition-fast);
	}

	.mv-nav-btn:hover { color: var(--p-accent); border-color: var(--p-accent); }

	.mv-month-label {
		font-family: var(--pl-font-display);
		font-size: 1.6rem;
		font-weight: 400;
		color: var(--p-text);
		letter-spacing: -0.01em;
		white-space: nowrap;
	}

	.mv-today-btn {
		font-family: var(--pl-font-mono);
		font-size: 0.6rem;
		letter-spacing: 0.12em;
		color: var(--p-muted);
		border: 1px solid var(--p-border);
		padding: 3px 10px;
		border-radius: var(--pl-radius-pill);
		opacity: 0.7;
		transition: opacity var(--pl-transition-fast), color var(--pl-transition-fast), border-color var(--pl-transition-fast);
		flex-shrink: 0;
	}

	.mv-today-btn:hover { opacity: 1; color: var(--p-accent); border-color: var(--p-accent); }
	.mv-header-spacer { width: 72px; flex-shrink: 0; }

	/* ── grid ────────────────────────────────────────────────────────── */
	.mv-grid {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		border: 1px solid var(--p-border);
		border-radius: var(--pl-radius-md);
		overflow: hidden;
		background: var(--p-border); /* shows as grid lines */
		gap: 1px;
	}

	.mv-dow {
		background: var(--p-surface);
		font-family: var(--pl-font-mono);
		font-size: 0.55rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--p-muted);
		opacity: 0.6;
		text-align: center;
		padding: 8px 4px;
	}

	/* ── cells ───────────────────────────────────────────────────────── */
	.mv-cell {
		background: var(--p-bg);
		min-height: 80px;
		padding: 6px 8px;
		transition: background var(--pl-transition-fast);
		cursor: pointer;
	}

	.mv-cell:hover {
		background: color-mix(in srgb, var(--p-surface) 80%, var(--p-bg));
	}

	.mv-cell.today {
		background: color-mix(in srgb, var(--p-accent-soft) 70%, var(--p-bg));
	}

	.mv-cell.past {
		opacity: 0.55;
	}

	.mv-cell.day-off {
		background: color-mix(in srgb, var(--p-surface) 60%, var(--p-bg));
	}

	.mv-cell.today.day-off {
		background: color-mix(in srgb, var(--p-accent-soft) 70%, var(--p-bg));
	}

	.mv-cell-empty {
		background: color-mix(in srgb, var(--p-bg) 40%, transparent);
		min-height: 80px;
	}

	.mv-cell-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 4px;
	}

	.mv-cell-num {
		font-family: var(--pl-font-mono);
		font-size: 0.75rem;
		color: var(--p-text);
		line-height: 1;
	}

	.mv-cell.today .mv-cell-num {
		color: var(--p-accent);
		font-weight: 500;
	}

	.mv-cell.past .mv-cell-num {
		color: var(--p-muted);
	}

	.mv-day-badge {
		font-family: var(--pl-font-mono);
		font-size: 0.5rem;
		color: var(--p-accent);
		background: var(--p-accent-soft);
		border-radius: 3px;
		padding: 1px 4px;
		line-height: 1.4;
	}

	.mv-cell-blocks {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.mv-cell-block {
		font-family: var(--pl-font-mono);
		font-size: 0.52rem;
		color: var(--p-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		line-height: 1.4;
	}

	/* Collapse block text on narrow cells */
	@media (max-width: 500px) {
		.mv-cell-block { display: none; }
		.mv-cell { min-height: 48px; }
	}
</style>
