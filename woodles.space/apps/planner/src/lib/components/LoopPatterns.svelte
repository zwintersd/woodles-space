<script lang="ts">
	import { store } from '$lib/store.svelte';
	import { queueSync } from '$lib/sync.svelte';
	import { CHANNELS, daysLabel, share, summarizeLoopPatterns, type LoopHistory } from '$lib/loopAnalysis';
	import { recurringOffers, repeatedThemes, rhythmOffers } from '$lib/loopInference';
	import { loopIdeas } from '$lib/loopIdeas';

	let rangeDays = $state(30);
	let windowMinutes = $state(120);
	let showIdeas = $state(false);
	let naming = $state(''), namingTitle = $state('');
	let message = $state('');
	const channelNames = { body: 'Body', attention: 'Attention', behavior: 'Actions' } as const;
	const windowName = (minutes: number) => minutes === 60 ? 'an hour' : `${minutes / 60} hours`;

	let summary = $derived(summarizeLoopPatterns({
		loops: store.openLoops, events: store.loopEvents, reflections: store.closureReflections,
		observations: store.intervalObservations, rounds: store.fiveContactsRounds,
		now: store.now, rangeDays, windowMinutes
	}));
	let dismissed = $derived(store.settings.dismissedOffers ?? []);
	let themes = $derived(repeatedThemes({ observations: store.intervalObservations, events: store.loopEvents, loops: store.openLoops, now: store.now, dismissed }));
	let recurring = $derived(recurringOffers(store.openLoops, store.loopEvents, dismissed));
	let rhythms = $derived(rhythmOffers(store.openLoops, store.loopEvents, dismissed));
	let ideas = $derived(showIdeas ? loopIdeas({ loops: store.openLoops, events: store.loopEvents, reflections: store.closureReflections, now: store.now, dismissed }) : []);
	const titleFor = (id: string) => store.openLoops.find(loop => loop.id === id)?.title ?? 'A loop';
	const dateFor = (iso?: string) => iso ? new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '—';

	function activity(loop: LoopHistory): string {
		const parts: string[] = [];
		const add = (count: number | undefined, label: string) => { if (count) parts.push(`${label} ${count}`); };
		add(loop.counts.noticed, 'noticed'); add(loop.counts.approached, 'approached');
		add(loop.counts.related_action, 'related'); add(loop.counts.progress, 'progress');
		add(loop.counts.paused, 'paused'); add(loop.counts.closed, loop.recurring ? 'cycles closed' : 'closed');
		add(loop.counts.released, 'let go'); add(loop.counts.reopened, loop.recurring ? 'need returned' : 'reopened');
		add(loop.linkedMoments, 'linked moments'); add(loop.linkedNoticings, 'linked noticings'); add(loop.contacts, 'contacts');
		return parts.join(' · ') || 'No events in this range';
	}

	function dismiss(key: string) { store.dismissOffer(key); queueSync(); }
	function nameTheme(key: string, word: string) { naming = key; namingTitle = word.charAt(0).toUpperCase() + word.slice(1); }
	function saveTheme(key: string) {
		const loop = store.createOpenLoop(namingTitle);
		if (!loop) return;
		store.dismissOffer(key); queueSync();
		naming = ''; message = `Saved “${loop.title}” as an open loop.`;
	}
	function markRecurring(key: string, loopId: string) {
		store.updateOpenLoop(loopId, { recurring: true }); store.dismissOffer(key); queueSync();
		message = `“${titleFor(loopId)}” is now recurring.`;
	}
	function useRhythm(key: string, loopId: string, days: number) {
		store.updateOpenLoop(loopId, { rhythmDays: days }); store.dismissOffer(key); queueSync();
		message = `Rhythm for “${titleFor(loopId)}” set to about ${daysLabel(days)}.`;
	}
</script>

<section class="patterns" aria-labelledby="patterns-heading" data-testid="loop-patterns">
	<h2 id="patterns-heading" class="visually-hidden">Patterns in your loops</h2>
	<p class="caveat">Counts from your own records. Things that happen close together aren’t necessarily causes, and small numbers can mislead.</p>
	<div class="controls">
		<label>Range<select bind:value={rangeDays}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={0}>All records</option></select></label>
		<label>After a resolution<select bind:value={windowMinutes}><option value={60}>Within an hour</option><option value={120}>Within 2 hours</option><option value={240}>Within 4 hours</option></select></label>
	</div>

	<section aria-labelledby="around-heading">
		<h3 id="around-heading">Around resolutions</h3>
		<p>{summary.resolutions.closed} closed · {summary.resolutions.released} let go{summary.from ? ` since ${dateFor(summary.from.toISOString())}` : ''}.</p>
		{#if summary.descriptors.length}
			<table>
				<caption>What changed, as you described it</caption>
				<thead><tr><th scope="col">Description</th><th scope="col">After closing</th><th scope="col">After letting go</th></tr></thead>
				<tbody>{#each summary.descriptors as row (row.descriptor)}<tr><th scope="row">{row.descriptor}</th><td>{row.closed}</td><td>{row.released}</td></tr>{/each}</tbody>
			</table>
		{/if}
		{#if summary.resolutions.closed + summary.resolutions.released}
			<p class="small">What felt possible: something else approachable {summary.nextFeelsPossible.something} · rest {summary.nextFeelsPossible.rest} · nothing in particular {summary.nextFeelsPossible.nothing} · not answered {summary.nextFeelsPossible.unanswered}</p>
		{/if}
		{#if !summary.enough}
			<p class="small">Fewer than three resolutions in this range, so the comparisons below are held back.</p>
		{:else}
			<table>
				<caption>Moments that began within {windowName(windowMinutes)} after a resolution, beside all other moments</caption>
				<thead><tr><th scope="col">Color label</th><th scope="col">After a resolution</th><th scope="col">Other times</th></tr></thead>
				<tbody>{#each summary.labels as row (row.name)}<tr><th scope="row">{row.name}</th><td>{share(row.after, summary.momentsAfter)}</td><td>{share(row.other, summary.momentsOther)}</td></tr>{/each}</tbody>
			</table>
			<ul class="plain">
				{#each CHANNELS as channel}<li>{channelNames[channel]} notes: {share(summary.noticingsAfter[channel], summary.momentsAfter)} moments after · {share(summary.noticingsOther[channel], summary.momentsOther)} other moments</li>{/each}
				<li>{summary.roundsTotal ? `Five Contacts: ${share(summary.roundsAfter, summary.roundsTotal)} rounds began within ${windowName(windowMinutes)} after a resolution.` : 'No Five Contacts rounds in this range.'}</li>
			</ul>
		{/if}
	</section>

	{#if summary.loops.length}
		<section aria-labelledby="loops-heading">
			<h3 id="loops-heading">Each loop</h3>
			<ul class="plain loops">{#each summary.loops as loop (loop.loopId)}<li>
				<strong>{loop.title}</strong>
				<small>{activity(loop)}</small>
				<small>First recorded {dateFor(loop.firstEventAt)}{loop.daysToResolution !== undefined ? ` · ${loop.resolution === 'released' ? 'let go' : 'closed'} after ${daysLabel(loop.daysToResolution)}` : loop.status === 'paused' ? ' · paused' : loop.status === 'resolved' ? loop.recurring && loop.resolution === 'completed' ? ' · between cycles' : '' : ' · open'}</small>
			</li>{/each}</ul>
		</section>
	{/if}

	{#if summary.rhythms.length}
		<section aria-labelledby="rhythm-heading">
			<h3 id="rhythm-heading">Recurring needs</h3>
			<ul class="plain">{#each summary.rhythms as rhythm (rhythm.loopId)}<li>
				<strong>{rhythm.title}</strong>
				<small>{rhythm.closures} cycle{rhythm.closures === 1 ? '' : 's'} closed{rhythm.typicalGapDays !== undefined ? ` · typical gap ${daysLabel(rhythm.typicalGapDays)}` : ''}{rhythm.lastGapDays !== undefined ? ` · last gap ${daysLabel(rhythm.lastGapDays)}` : ''}{rhythm.rhythmDays ? ` · your rhythm about ${daysLabel(rhythm.rhythmDays)}` : ''}</small>
			</li>{/each}</ul>
		</section>
	{/if}

	<section aria-labelledby="noticing-heading">
		<h3 id="noticing-heading">Noticings and loops</h3>
		<ul class="plain">
			{#each summary.attribution as row (row.channel)}<li>{channelNames[row.channel]}: {row.linked} connected to a loop · {row.unlinked} on their own</li>{/each}
			<li>Loop events with no loop: {summary.unattributedEvents}</li>
		</ul>
		<p class="small">Only links you chose are counted. A sensation on its own is a complete record.</p>
	</section>

	{#if themes.length || recurring.length || rhythms.length}
		<section aria-labelledby="offers-heading" data-testid="loop-offers">
			<h3 id="offers-heading">Possible patterns to name</h3>
			<p class="small">Suggestions from your notes. Nothing changes unless you choose it.</p>
			{#each themes as theme (theme.key)}<div class="offer">
				<p>“{theme.word}” came up in {theme.notes} notes across {theme.days} days, none of them linked to a loop.</p>
				{#if naming === theme.key}<form onsubmit={event => { event.preventDefault(); saveTheme(theme.key); }}><label>Loop title<input bind:value={namingTitle} maxlength="200" /></label><div class="actions"><button class="primary" disabled={!namingTitle.trim()}>Save as a loop</button><button type="button" onclick={() => naming = ''}>Cancel</button></div></form>
				{:else}<div class="actions"><button type="button" onclick={() => nameTheme(theme.key, theme.word)}>Name a loop</button><button type="button" onclick={() => dismiss(theme.key)}>Not a loop</button></div>{/if}
			</div>{/each}
			{#each recurring as offer (offer.key)}<div class="offer">
				<p>“{titleFor(offer.loopId)}” has closed {offer.closures} times. It may be a recurring need.</p>
				<div class="actions"><button type="button" onclick={() => markRecurring(offer.key, offer.loopId)}>Treat as recurring</button><button type="button" onclick={() => dismiss(offer.key)}>Leave as is</button></div>
			</div>{/each}
			{#each rhythms as offer (offer.key)}<div class="offer">
				<p>Cycles of “{titleFor(offer.loopId)}” have run about every {daysLabel(offer.days)} across {offer.cycles} closures.</p>
				<div class="actions"><button type="button" onclick={() => useRhythm(offer.key, offer.loopId, offer.days)}>Use about {daysLabel(offer.days)}</button><button type="button" onclick={() => dismiss(offer.key)}>Leave as is</button></div>
			</div>{/each}
		</section>
	{/if}

	<section aria-labelledby="ideas-heading">
		<h3 id="ideas-heading">Ideas from your notes</h3>
		<button type="button" aria-expanded={showIdeas} onclick={() => showIdeas = !showIdeas}>{showIdeas ? 'Hide ideas' : 'Show ideas'}</button>
		{#if showIdeas}
			<div data-testid="loop-ideas">
				{#each ideas as idea (idea.key)}<div class="offer"><p>{idea.text}</p><div class="actions"><button type="button" onclick={() => dismiss(idea.key)}>Not useful</button></div></div>
				{:else}<p class="small">Nothing stands out in your notes right now.</p>{/each}
				<p class="small">Ideas only, drawn from your records. Doing nothing is a fine choice too.</p>
			</div>
		{/if}
	</section>
	{#if message}<p class="small" role="status">{message}</p>{/if}
</section>

<style>
	.patterns { color: var(--car-ink); font: .8rem/1.5 var(--car-body); padding: .2rem 0 .4rem; }
	.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
	h3 { font: 400 1.15rem/1.2 var(--car-fell); margin: 1.1rem 0 .4rem; }
	p { margin: .35rem 0; }
	.caveat, .small, small { color: var(--car-ink-soft); }
	.small, small { font-size: .72rem; }
	small { display: block; }
	.controls { display: flex; flex-wrap: wrap; gap: .75rem; margin: .6rem 0; }
	label { display: grid; gap: .3rem; }
	select, input, button { color: var(--car-ink); background: #ffffff80; border: 1px solid #44365b33; border-radius: .5rem; padding: .45rem .6rem; font: inherit; }
	input { width: 100%; min-width: 0; box-sizing: border-box; }
	button { cursor: pointer; }
	button:disabled { opacity: .5; cursor: default; }
	button.primary { color: var(--car-paper); background: var(--car-ink); }
	table { width: 100%; border-collapse: collapse; margin: .6rem 0; font-size: .74rem; }
	caption { text-align: left; color: var(--car-ink-soft); padding-bottom: .3rem; }
	th, td { text-align: left; padding: .35rem .4rem; border-bottom: 1px solid var(--car-line); vertical-align: top; overflow-wrap: anywhere; }
	thead th { font-weight: 500; color: var(--car-ink-soft); }
	tbody th { font-weight: 500; }
	.plain { list-style: none; padding: 0; margin: .4rem 0; display: grid; gap: .35rem; }
	.loops li { display: grid; gap: .1rem; border-bottom: 1px solid var(--car-line); padding-bottom: .4rem; overflow-wrap: anywhere; }
	.offer { border: 1px dashed #44365b40; border-radius: .6rem; padding: .6rem .7rem; margin: .5rem 0; background: #ffffff40; }
	.actions { display: flex; flex-wrap: wrap; gap: .4rem; margin-top: .4rem; }
	:focus-visible { outline: 2px solid var(--car-pink-dark); outline-offset: 3px; }
	@media (max-width: 520px) { table { font-size: .7rem; } th, td { padding: .3rem .25rem; } }
</style>
