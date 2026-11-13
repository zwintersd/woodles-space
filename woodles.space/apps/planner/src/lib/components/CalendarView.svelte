<script lang="ts">
	import { store } from '$lib/store.svelte';
	import { queueSync } from '$lib/sync.svelte';
	import { getMonthCalendar, getWeekDays, MONTH_NAMES, weekRangeLabel } from '$lib/calendar';
	import { dateKey, timeToMinutes } from '$lib/utils';
	import type { Block } from '$lib/types';
	import BlockEditor from './BlockEditor.svelte';

	let {
		onopenshapes,
		onopenedition
	}: { onopenshapes?: () => void; onopenedition?: (date: string) => void } = $props();

	const DEFAULT = '__default';
	const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

	let mode = $state<'week' | 'month'>('week');
	// Any date inside the week or month on show.
	let anchor = $state(new Date(store.now));
	let selected = $state(dateKey(store.now));
	let notice = $state('');

	let todayKey = $derived(dateKey(store.now));
	let weekDays = $derived(getWeekDays(anchor));
	let month = $derived(getMonthCalendar(anchor.getFullYear(), anchor.getMonth()));
	let rangeLabel = $derived(
		mode === 'week' ? weekRangeLabel(weekDays) : `${MONTH_NAMES[month.month]} ${month.year}`
	);
	let activeShapes = $derived(store.dayShapes.filter((shape) => !shape.deletedAt && !shape.archived));

	function fromKey(key: string): Date {
		const [y, m, d] = key.split('-').map(Number);
		return new Date(y, m - 1, d, 12);
	}

	function displayTime(value: string): string {
		const minutes = timeToMinutes(value);
		const hour24 = Math.floor(minutes / 60);
		const minute = minutes % 60;
		return `${hour24 % 12 || 12}:${String(minute).padStart(2, '0')} ${hour24 >= 12 ? 'pm' : 'am'}`;
	}

	// ── what a day holds ───────────────────────────────────────────
	function dayInfo(date: Date) {
		const key = dateKey(date);
		const blocks = store.getBlocksForDate(date);
		return {
			key,
			date,
			past: key < todayKey,
			today: key === todayKey,
			shape: store.getDayShape(date),
			customized: Boolean(store.dayOverrides[key]?.blocks),
			blocks,
			appointments: store.getAppointmentsForDay(key),
			recurring: blocks.filter((block) => block.overlay && block.overlay !== 'appointment'),
			tasks: store.getTasksForDay(key).filter((task) => task.status === 'open')
		};
	}

	let weekInfo = $derived(weekDays.map(dayInfo));
	let detail = $derived(dayInfo(fromKey(selected)));

	// ── day arc: 06:00 → 24:00, each timed block a segment ─────────
	const ARC_START = 6 * 60;
	const ARC_RANGE = 18 * 60;
	function arc(blocks: Block[]) {
		return blocks
			.filter((b) => timeToMinutes(b.endTime) > ARC_START && timeToMinutes(b.endTime) > timeToMinutes(b.startTime))
			.map((b) => {
				const start = Math.max(ARC_START, timeToMinutes(b.startTime));
				const end = Math.min(ARC_START + ARC_RANGE, timeToMinutes(b.endTime));
				return {
					left: ((start - ARC_START) / ARC_RANGE) * 100,
					width: ((end - start) / ARC_RANGE) * 100,
					appointment: b.overlay === 'appointment'
				};
			});
	}

	// ── moving through time ────────────────────────────────────────
	function shift(direction: number): void {
		const next = new Date(anchor);
		if (mode === 'week') next.setDate(next.getDate() + 7 * direction);
		else next.setMonth(next.getMonth() + direction, 1);
		anchor = next;
	}
	function goToday(): void {
		anchor = new Date(store.now);
		select(todayKey);
	}
	function select(key: string): void {
		selected = key;
		editing = false;
		notice = '';
	}

	// ── a day's shape ──────────────────────────────────────────────
	function shapeValue(key: string): string {
		const override = store.dayOverrides[key];
		return override && override.dayShapeId !== undefined ? override.dayShapeId : DEFAULT;
	}
	function defaultShapeName(date: Date): string {
		const id = store.weekPattern.days[date.getDay()];
		return store.dayShapes.find((shape) => shape.id === id && !shape.deletedAt)?.name ?? 'none';
	}
	function setShape(date: Date, value: string): void {
		const key = dateKey(date);
		const override = store.dayOverrides[key];
		if (value === DEFAULT) {
			// A note or a skipped commitment lives on the same record; keep those.
			if (override?.note || override?.skippedRecurring?.length) {
				store.setDayShape(date, store.weekPattern.days[date.getDay()] ?? '');
			} else {
				store.clearDayOverride(date);
			}
		} else {
			store.setDayShape(date, value);
		}
		queueSync();
		select(key);
		notice = 'Day shape changed for this date only.';
	}

	// ── appointments ───────────────────────────────────────────────
	let aptTitle = $state('');
	let aptStart = $state('09:00');
	let aptEnd = $state('10:00');
	function addAppointment(): void {
		const saved = store.saveAppointment({
			date: selected,
			title: aptTitle,
			startTime: aptStart,
			endTime: aptEnd
		});
		if (!saved) {
			notice = 'Give the appointment a name and an end time after its start.';
			return;
		}
		aptTitle = '';
		queueSync();
		notice = 'Appointment added.';
	}
	function removeAppointment(blockId: string, title: string): void {
		store.removeAppointment(blockId.replace(/^apt-/, ''));
		queueSync();
		notice = `${title} removed.`;
	}

	// ── changing one day's activities ──────────────────────────────
	let editing = $state(false);
	let draft = $state<Block[]>([]);
	function startEdit(): void {
		draft = (detail.shape?.blocks ?? []).map((b) => ({ ...b, flexible: b.flexible ?? false }));
		editing = true;
		notice = '';
	}
	function saveEdit(): void {
		if (
			draft.some(
				(b) =>
					!b.title.trim() ||
					(!b.flexible && (!b.startTime || !b.endTime || b.endTime <= b.startTime))
			)
		) {
			notice = 'Give each activity a name and an end time after its start.';
			return;
		}
		store.saveDayPlan(selected, draft);
		queueSync();
		editing = false;
		notice = 'Saved for this date only. The day shape is unchanged.';
	}
	function resetDay(): void {
		store.setDayShape(detail.date, store.dayOverrides[selected]?.dayShapeId ?? '');
		queueSync();
		notice = 'This date follows its day shape again.';
	}

	function overlayLabel(block: Block): string {
		if (block.overlay === 'appointment') return 'Appointment';
		if (block.overlay === 'standing') return 'Thinking About';
		return block.overlay ? 'Recurring' : '';
	}
	function longDate(date: Date): string {
		return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
	}
	function countLabel(count: number, word: string): string {
		return `${count} ${word}${count === 1 ? '' : 's'}`;
	}
</script>

<section class="workbench" data-testid="calendar">
	<header class="wb-heading">
		<div>
			<p class="wb-kicker">Calendar</p>
			<h1>Look ahead.</h1>
			<p>Choose what kind of day each date is, and pin appointments to it.</p>
		</div>
		<div class="wb-actions">
			<button aria-pressed={mode === 'week'} onclick={() => (mode = 'week')}>Week</button>
			<button aria-pressed={mode === 'month'} onclick={() => (mode = 'month')}>Month</button>
		</div>
	</header>

	<div class="cal-bar">
		<button onclick={() => shift(-1)} aria-label={`Previous ${mode}`}>←</button>
		<strong aria-live="polite">{rangeLabel}</strong>
		<button onclick={() => shift(1)} aria-label={`Next ${mode}`}>→</button>
		<button onclick={goToday}>Today</button>
	</div>

	{#if mode === 'week'}
		<div class="cal-week">
			{#each weekInfo as day, i (day.key)}
				<article
					class="cal-day"
					class:today={day.today}
					class:past={day.past}
					class:selected={selected === day.key}
					class:restful={day.shape?.restful}
					data-date={day.key}
				>
					<button class="cal-day-head" onclick={() => select(day.key)} aria-pressed={selected === day.key}>
						<span>{WEEKDAYS[i]}</span>
						<strong>{day.date.getDate()}</strong>
						{#if day.today}<small>today</small>{/if}
					</button>
					{#if day.past}
						<p class="cal-shape-name">{day.shape?.name ?? 'No day shape'}</p>
					{:else}
						<select
							aria-label={`Day shape for ${longDate(day.date)}`}
							value={shapeValue(day.key)}
							onchange={(event) => setShape(day.date, event.currentTarget.value)}
						>
							<option value={DEFAULT}>{defaultShapeName(day.date)} (usual)</option>
							{#each activeShapes as shape (shape.id)}<option value={shape.id}>{shape.name}</option>{/each}
							<option value="">No day shape</option>
						</select>
					{/if}
					<div class="cal-arc" aria-hidden="true">
						{#each arc(day.blocks) as seg}<i class:appointment={seg.appointment} style:left="{seg.left}%" style:width="{seg.width}%"></i>{/each}
					</div>
					<ul class="cal-items">
						{#each day.appointments as item (item.id)}
							<li class="apt"><span>{displayTime(item.startTime)}</span> {item.title}</li>
						{/each}
						{#each day.recurring as block (block.id)}
							<li><span>{displayTime(block.startTime)}</span> {block.title}</li>
						{/each}
						{#each day.tasks as task (task.id)}
							<li class="task"><span>task</span> {task.title}</li>
						{/each}
					</ul>
					{#if day.customized && !day.past}<small class="cal-flag">changed for this date</small>{/if}
				</article>
			{/each}
		</div>
	{:else}
		<div class="cal-month" role="group" aria-label={rangeLabel}>
			<div class="cal-month-head" aria-hidden="true">
				{#each WEEKDAYS as name}<span>{name}</span>{/each}
			</div>
			{#each month.weeks as week}
				<div class="cal-month-row">
					{#each week as date}
						{#if date}
							{@const day = dayInfo(date)}
							<button
								class="cal-cell"
								class:today={day.today}
								class:past={day.past}
								class:selected={selected === day.key}
								class:restful={day.shape?.restful}
								data-date={day.key}
								aria-pressed={selected === day.key}
								aria-label={`${longDate(date)}, ${day.shape?.name ?? 'no day shape'}, ${countLabel(day.appointments.length, 'appointment')}, ${countLabel(day.tasks.length, 'task')}`}
								onclick={() => select(day.key)}
							>
								<strong>{date.getDate()}</strong>
								<span class="cal-cell-shape">{day.shape?.name ?? '—'}</span>
								{#if day.appointments.length || day.tasks.length}
									<small>
										{#if day.appointments.length}<b>{countLabel(day.appointments.length, 'appt')}</b>{/if}
										{#if day.tasks.length}<em>{countLabel(day.tasks.length, 'task')}</em>{/if}
									</small>
								{/if}
							</button>
						{:else}
							<span class="cal-cell empty"></span>
						{/if}
					{/each}
				</div>
			{/each}
		</div>
	{/if}

	<section class="wb-card wb-paper cal-detail" aria-label={`Details for ${longDate(detail.date)}`} data-testid="calendar-day">
		<div class="wb-heading">
			<div>
				<p class="wb-kicker">{detail.today ? 'Today' : detail.past ? 'Past day' : 'Coming up'}</p>
				<h2>{longDate(detail.date)}</h2>
				<p>{detail.shape?.name ?? 'No day shape'}{detail.customized && !detail.past ? ' · changed for this date' : ''}</p>
			</div>
			<div class="wb-actions">
				{#if detail.past}
					<button onclick={() => onopenedition?.(selected)}>Open in Editions</button>
				{:else}
					<button disabled={editing} onclick={startEdit}>Change this day</button>
					{#if detail.customized}<button onclick={resetDay}>Follow the day shape again</button>{/if}
					<button onclick={() => store.startCompose({ targetDate: selected })}>+ Add task</button>
					<button onclick={onopenshapes}>Edit day shapes</button>
				{/if}
			</div>
		</div>

		{#if editing}
			<form
				onsubmit={(event) => {
					event.preventDefault();
					saveEdit();
				}}
			>
				<BlockEditor bind:blocks={draft} />
				<div class="wb-actions">
					<button class="primary">Save this day only</button>
					<button type="button" onclick={() => (editing = false)}>Cancel</button>
				</div>
				<p class="wb-note">Appointments and recurring commitments are separate and keep their times.</p>
			</form>
		{:else}
			{#each detail.blocks as block (block.id)}
				<div class="wb-row">
					<span class="cal-time">{displayTime(block.startTime)}–{displayTime(block.endTime)}</span>
					<strong class="grow">{block.title}</strong>
					{#if block.overlay}<small>{overlayLabel(block)}</small>{/if}
					{#if block.overlay === 'appointment' && !detail.past}
						<button aria-label={`Remove appointment: ${block.title}`} onclick={() => removeAppointment(block.id, block.title)}>Remove</button>
					{/if}
				</div>
			{:else}
				<p>Nothing timed on this day.</p>
			{/each}

			{#if detail.tasks.length}
				<h3>Tasks</h3>
				{#each detail.tasks as task (task.id)}
					<div class="wb-row">
						<button class="grow" onclick={() => store.openTaskEdit(task.id)}>{task.title}</button>
						<span>edit or reschedule</span>
					</div>
				{/each}
			{/if}

			{#if !detail.past}
				<form
					class="cal-apt-form"
					onsubmit={(event) => {
						event.preventDefault();
						addAppointment();
					}}
				>
					<h3>Add an appointment</h3>
					<div class="wb-row">
						<label class="grow">What<input bind:value={aptTitle} placeholder="Dentist" /></label>
						<label class="time-field">From<input type="time" bind:value={aptStart} /></label>
						<label class="time-field">To<input type="time" bind:value={aptEnd} /></label>
						<button class="primary" disabled={!aptTitle.trim()}>Add appointment</button>
					</div>
				</form>
			{/if}
		{/if}
		<p class="wb-notice" role="status">{notice}</p>
	</section>
</section>

<style>
	.cal-bar {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-bottom: 1rem;
		color: var(--car-cream);
	}
	.cal-bar strong {
		min-width: 11rem;
		text-align: center;
		font: 600 1.05rem var(--car-display);
	}

	.cal-week {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		gap: 0.5rem;
		margin-bottom: 1.25rem;
	}
	.cal-day {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 0;
		border: 1px solid var(--car-vellum-edge);
		border-radius: 3px 10px 10px 3px;
		background: var(--car-vellum);
		padding: 0.6rem;
		color: var(--car-ink);
	}
	.cal-day.restful,
	.cal-cell.restful {
		background: color-mix(in srgb, var(--car-glass-teal) 9%, var(--car-paper));
	}
	.cal-day.past {
		opacity: 0.72;
	}
	.cal-day.selected,
	.cal-cell.selected {
		box-shadow: 0 0 0 2px var(--car-pink-dark);
	}
	.workbench .cal-day-head {
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
		border: 0;
		background: transparent;
		padding: 0.15rem 0.2rem;
		color: var(--car-ink);
		text-align: left;
		font: 0.7rem var(--car-mono);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	.cal-day-head strong {
		font: 600 1.35rem var(--car-display);
		letter-spacing: 0;
	}
	.cal-day-head small {
		margin-left: auto;
		color: var(--car-pink-dark);
		font-weight: 600;
	}
	.cal-day.today,
	.cal-cell.today {
		border-color: var(--car-pink-dark);
	}
	.workbench .cal-day select {
		width: 100%;
		min-width: 0;
		border-color: rgba(64, 50, 71, 0.25);
		background: #ffffff80;
		color: var(--car-ink);
		font-size: 0.78rem;
		padding: 0.3rem 0.35rem;
	}
	.cal-shape-name {
		margin: 0;
		font: italic 0.85rem var(--car-body);
	}
	.cal-arc {
		position: relative;
		height: 7px;
		border: 1px solid rgba(64, 50, 71, 0.2);
		border-radius: 100px;
		background: #ffffff70;
		overflow: hidden;
	}
	.cal-arc i {
		position: absolute;
		top: 0;
		bottom: 0;
		background: var(--car-glass-amethyst);
		opacity: 0.55;
		border-right: 1px solid #ffffffb0;
	}
	.cal-arc i.appointment {
		background: var(--car-pink-dark);
		opacity: 1;
	}
	.cal-items {
		display: grid;
		gap: 0.25rem;
		margin: 0;
		padding: 0;
		list-style: none;
		font: 0.78rem/1.3 var(--car-body);
	}
	.cal-items li {
		overflow-wrap: anywhere;
	}
	.cal-items span {
		color: var(--car-ink-soft);
		font: 0.62rem var(--car-mono);
	}
	.cal-items .apt {
		border-left: 3px solid var(--car-pink-dark);
		padding-left: 0.35rem;
		font-weight: 600;
	}
	.cal-flag {
		color: var(--car-ink-soft);
		font: 0.6rem var(--car-mono);
	}

	.cal-month {
		display: grid;
		gap: 0.3rem;
		margin-bottom: 1.25rem;
	}
	.cal-month-head,
	.cal-month-row {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		gap: 0.3rem;
	}
	.cal-month-head span {
		color: var(--car-mist);
		font: 0.62rem var(--car-mono);
		letter-spacing: 0.1em;
		text-transform: uppercase;
		text-align: center;
	}
	.workbench .cal-cell {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.15rem;
		min-width: 0;
		min-height: 4.6rem;
		border: 1px solid var(--car-vellum-edge);
		border-radius: 4px;
		background: var(--car-vellum);
		padding: 0.35rem 0.4rem;
		color: var(--car-ink);
		text-align: left;
	}
	.cal-cell.empty {
		border-color: transparent;
		background: transparent;
	}
	.cal-cell.past {
		opacity: 0.65;
	}
	.cal-cell strong {
		font: 600 1rem var(--car-display);
	}
	.cal-cell-shape {
		max-width: 100%;
		overflow: hidden;
		font: italic 0.72rem var(--car-body);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.cal-cell small {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
		font: 0.58rem var(--car-mono);
	}
	.cal-cell small b {
		color: var(--car-pink-dark);
	}
	.cal-cell small em {
		color: var(--car-ink-soft);
		font-style: normal;
	}

	.cal-time {
		font: 0.7rem var(--car-mono);
		white-space: nowrap;
	}
	.cal-apt-form {
		margin-top: 1rem;
	}

	@media (max-width: 760px) {
		/* The week becomes a plain list of days. */
		.cal-week {
			grid-template-columns: 1fr;
		}
		.cal-bar strong {
			min-width: 0;
			flex: 1;
		}
		.workbench .cal-cell {
			min-height: 3.4rem;
			padding: 0.25rem;
		}
		.cal-cell-shape,
		.cal-cell small em {
			display: none;
		}
	}
</style>
