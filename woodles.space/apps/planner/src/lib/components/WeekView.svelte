<script lang="ts">
	import { store } from '$lib/store.svelte';
	import { getWeekDays, DOW_LABELS, MONTH_NAMES_SHORT, weekRangeLabel, isSameDay, isBeforeDay } from '$lib/calendar';
	import { dateKey, timeToMinutes, nowMinutes } from '$lib/utils';

	let { stub = '' }: { stub?: string } = $props();

	// ── navigation ──────────────────────────────────────────────────
	let weekOffset = $state(0);

	let days = $derived.by(() => {
		const base = new Date(store.now);
		base.setDate(base.getDate() + weekOffset * 7);
		return getWeekDays(base);
	});

	const weekLabel = $derived(weekRangeLabel(days));

	// ── time-column layout constants ────────────────────────────────
	const DISPLAY_START = 6 * 60;   // 6:00 AM in minutes
	const DISPLAY_END   = 24 * 60;  // midnight
	const RANGE         = DISPLAY_END - DISPLAY_START; // 1080
	const COL_H         = 540;      // px — column body height
	const PX_PER_MIN    = COL_H / RANGE;

	const TIME_MARKS = [6, 8, 10, 12, 14, 16, 18, 20, 22];

	function topPx(timeStr: string): number {
		return Math.max(0, (timeToMinutes(timeStr) - DISPLAY_START) * PX_PER_MIN);
	}

	function heightPx(startStr: string, endStr: string): number {
		const mins = timeToMinutes(endStr) - timeToMinutes(startStr);
		return Math.max(18, mins * PX_PER_MIN);
	}

	// Current time ruler — only when weekOffset === 0 (this week)
	const nowTop = $derived(
		weekOffset === 0 ? (nowMinutes(store.now) - DISPLAY_START) * PX_PER_MIN : -1
	);

	// ── helpers ─────────────────────────────────────────────────────
	function isPastBlock(day: Date, endStr: string): boolean {
		if (!isSameDay(day, store.now)) return isBeforeDay(day, store.now);
		return timeToMinutes(endStr) <= nowMinutes(store.now);
	}

	function isCurrentBlock(day: Date, startStr: string, endStr: string): boolean {
		if (!isSameDay(day, store.now)) return false;
		const mins = nowMinutes(store.now);
		return timeToMinutes(startStr) <= mins && mins < timeToMinutes(endStr);
	}

	function hourLabel(h: number): string {
		if (h === 0 || h === 24) return '12a';
		if (h === 12) return '12p';
		return h < 12 ? `${h}a` : `${h - 12}p`;
	}
</script>

<div class="week-view">
	<!-- Header -->
	<header class="wv-header">
		<a href="/" class="wv-home" title="back to woodles.space">·space</a>
		<div class="wv-nav">
			<button class="wv-nav-btn" onclick={() => weekOffset--} title="previous week">←</button>
			<span class="wv-label">{weekLabel}</span>
			<button class="wv-nav-btn" onclick={() => weekOffset++} title="next week">→</button>
		</div>
		{#if weekOffset !== 0}
			<button class="wv-today-btn" onclick={() => (weekOffset = 0)}>this week</button>
		{:else}
			<span class="wv-header-spacer"></span>
		{/if}
	</header>

	<!-- Columns wrap — horizontal scroll on narrow screens -->
	<div class="wv-scroll">
		<!-- Time gutter -->
		<div class="wv-gutter">
			<div class="wv-gutter-header"></div>
			<div class="wv-gutter-body" style:height="{COL_H}px">
				{#each TIME_MARKS as h}
					<span class="wv-time-mark" style:top="{(h * 60 - DISPLAY_START) * PX_PER_MIN}px">
						{hourLabel(h)}
					</span>
				{/each}
			</div>
		</div>

		<!-- Day columns -->
		<div class="wv-columns">
			{#each days as day, i}
				{@const today = isSameDay(day, store.now)}
				{@const shape = store.getDayShape(day)}
				{@const blocks = shape?.blocks ?? []}

				<div class="wv-col" class:today>
					<!-- Column header -->
					<div class="wv-col-header">
						<span class="wv-dow">{DOW_LABELS[i]}</span>
						<button
							class="wv-date-num"
							class:today-num={today}
							onclick={() => store.openDayPanel(dateKey(day))}
							title="view {day.toDateString()}"
						>{day.getDate()}</button>
						{#if shape?.restful}
							<span class="wv-off-badge">off</span>
						{/if}
					</div>

					<!-- Column body — absolute-positioned blocks -->
					<div class="wv-col-body" style:height="{COL_H}px">
						<!-- Hour grid lines -->
						{#each TIME_MARKS as h}
							<div
								class="wv-hour-line"
								style:top="{(h * 60 - DISPLAY_START) * PX_PER_MIN}px"
							></div>
						{/each}

						<!-- Blocks -->
						{#each blocks as block}
							{@const top = topPx(block.startTime)}
							{@const h = heightPx(block.startTime, block.endTime)}
							{@const past = isPastBlock(day, block.endTime)}
							{@const current = isCurrentBlock(day, block.startTime, block.endTime)}

							{#if top < COL_H}
								<div
									class="wv-block"
									class:past
									class:current
									style:top="{top}px"
									style:height="{Math.min(h, COL_H - top)}px"
									title="{block.title} · {block.startTime}"
								>
									<span class="wv-block-name">{block.title}</span>
								</div>
							{/if}
						{/each}

						<!-- Current time rule -->
						{#if today && nowTop >= 0 && nowTop <= COL_H}
							<div class="wv-now-rule" style:top="{nowTop}px">
								<span class="wv-now-dot"></span>
							</div>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>

<style>
	.week-view {
		max-width: 820px;
		margin: 0 auto;
		padding: 0 clamp(0.75rem, 3vw, 1.5rem) var(--pl-space-xl);
	}

	/* ── header ─────────────────────────────────────────────────────── */
	.wv-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.1rem 0 1rem;
		gap: 0.75rem;
	}

	.wv-home {
		font-family: var(--pl-font-mono);
		font-size: 0.65rem;
		letter-spacing: 0.16em;
		color: var(--p-muted);
		text-decoration: none;
		opacity: 0.6;
		transition: opacity var(--pl-transition-fast);
		flex-shrink: 0;
	}

	.wv-home:hover { opacity: 1; }

	.wv-nav {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.wv-nav-btn {
		font-family: var(--pl-font-mono);
		font-size: 0.8rem;
		color: var(--p-muted);
		padding: 4px 10px;
		border-radius: var(--pl-radius-sm);
		border: 1px solid var(--p-border);
		transition: color var(--pl-transition-fast), border-color var(--pl-transition-fast);
	}

	.wv-nav-btn:hover { color: var(--p-accent); border-color: var(--p-accent); }

	.wv-label {
		font-family: var(--pl-font-mono);
		font-size: 0.72rem;
		letter-spacing: 0.08em;
		color: var(--p-text);
		white-space: nowrap;
	}

	.wv-today-btn {
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

	.wv-today-btn:hover { opacity: 1; color: var(--p-accent); border-color: var(--p-accent); }
	.wv-header-spacer { width: 56px; flex-shrink: 0; }

	/* ── scrollable wrap ─────────────────────────────────────────────── */
	.wv-scroll {
		display: flex;
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
		gap: 0;
		/* subtle inner border */
		border: 1px solid var(--p-border);
		border-radius: var(--pl-radius-md);
		background: var(--p-surface);
	}

	/* ── time gutter ─────────────────────────────────────────────────── */
	.wv-gutter {
		flex-shrink: 0;
		width: 30px;
		border-right: 1px solid var(--p-border);
	}

	.wv-gutter-header {
		height: 56px;
		border-bottom: 1px solid var(--p-border);
	}

	.wv-gutter-body {
		position: relative;
	}

	.wv-time-mark {
		position: absolute;
		right: 4px;
		transform: translateY(-50%);
		font-family: var(--pl-font-mono);
		font-size: 0.48rem;
		letter-spacing: 0.04em;
		color: var(--p-muted);
		opacity: 0.5;
		user-select: none;
	}

	/* ── columns ─────────────────────────────────────────────────────── */
	.wv-columns {
		display: flex;
		flex: 1;
		min-width: 0;
	}

	.wv-col {
		flex: 1;
		min-width: 88px;
		border-right: 1px solid var(--p-border);
	}

	.wv-col:last-child {
		border-right: none;
	}

	.wv-col.today {
		background: color-mix(in srgb, var(--p-accent-soft) 60%, transparent);
	}

	.wv-col-header {
		height: 56px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		border-bottom: 1px solid var(--p-border);
		padding: 6px 0;
	}

	.wv-dow {
		font-family: var(--pl-font-mono);
		font-size: 0.52rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--p-muted);
		opacity: 0.7;
	}

	.wv-col.today .wv-dow { color: var(--p-accent); opacity: 1; }

	.wv-date-num {
		font-family: var(--pl-font-mono);
		font-size: 0.9rem;
		color: var(--p-text);
		letter-spacing: 0;
		line-height: 1;
		border-radius: var(--pl-radius-sm);
		padding: 1px 4px;
		transition: background var(--pl-transition-fast), color var(--pl-transition-fast);
	}

	.wv-date-num:hover:not(.today-num) {
		background: var(--p-accent-soft);
		color: var(--p-accent);
	}

	.wv-date-num.today-num {
		color: var(--p-accent);
		font-weight: 500;
	}

	.wv-off-badge {
		font-family: var(--pl-font-mono);
		font-size: 0.44rem;
		letter-spacing: 0.1em;
		color: var(--p-muted);
		opacity: 0.5;
		font-style: italic;
	}

	/* ── column body ─────────────────────────────────────────────────── */
	.wv-col-body {
		position: relative;
		overflow: hidden;
	}

	.wv-hour-line {
		position: absolute;
		left: 0;
		right: 0;
		height: 1px;
		background: var(--p-border);
		opacity: 0.5;
		pointer-events: none;
	}

	/* ── blocks ──────────────────────────────────────────────────────── */
	.wv-block {
		position: absolute;
		left: 2px;
		right: 2px;
		border-left: 2px solid var(--p-accent);
		background: var(--p-accent-soft);
		border-radius: 0 var(--pl-radius-sm) var(--pl-radius-sm) 0;
		padding: 2px 4px;
		overflow: hidden;
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 2px;
		transition: opacity var(--pl-transition-fast);
		cursor: default;
	}

	.wv-block.past {
		opacity: 0.35;
		border-left-color: var(--p-muted);
		background: var(--p-border);
	}

	.wv-block.current {
		border-left-color: var(--p-accent);
		background: color-mix(in srgb, var(--p-accent-soft) 80%, var(--p-surface));
		box-shadow: inset 0 0 0 1px var(--p-accent-soft);
	}

	.wv-block-name {
		font-family: var(--pl-font-mono);
		font-size: 0.55rem;
		letter-spacing: 0.02em;
		color: var(--p-text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		line-height: 1.3;
		flex: 1;
	}

	.wv-block.past .wv-block-name { color: var(--p-muted); }

	/* ── current time rule ───────────────────────────────────────────── */
	.wv-now-rule {
		position: absolute;
		left: 0;
		right: 0;
		height: 1px;
		background: var(--p-accent);
		opacity: 0.85;
		display: flex;
		align-items: center;
		pointer-events: none;
		z-index: 2;
	}

	.wv-now-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--p-accent);
		flex-shrink: 0;
		margin-left: -3px;
	}
</style>
