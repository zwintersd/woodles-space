<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { store } from '$lib/store.svelte';
	import { flushSync, queueSync, syncState } from '$lib/sync.svelte';
	import { BELL_VOICES, type BellVoiceId } from '$lib/bellVoices';
	import {
		BELL_MARKS, BELL_PRESETS, CLOCK_MARKS, INTERVAL_OPTIONS, audible, bellsResting, chimesBetweenSamples, countsHours,
		markSound, matchingPreset, nextWake, reachableMarks, sampleMinutes, skippedQuarters, upcomingChimes, type ClockMark
	} from '$lib/chimes';
	import { stopBells, unlockAudio } from '$lib/bells';
	import type { BellMark } from '$lib/types';
	import { clockLabel } from '$lib/utils';

	let message = $state('');
	let previewing = $state<BellMark | null>(null);
	let resumeButton: HTMLButtonElement | undefined = $state();
	let firstPauseButton: HTMLButtonElement | undefined = $state();

	let sounds = $derived(store.settings.bellSounds);
	let interval = $derived(store.settings.samplingIntervalMinutes);
	let paused = $derived(store.pausedUntil());
	let resting = $derived(bellsResting(store.settings, store.now, paused));
	let reachable = $derived(reachableMarks(store.settings));
	let clockRows = $derived(CLOCK_MARKS.filter(mark => reachable.has(mark)));
	let skipped = $derived(skippedQuarters(store.settings));
	let samples = $derived(sampleMinutes(store.settings));
	let preset = $derived(matchingPreset(sounds));
	let upcoming = $derived(upcomingChimes({ now: store.now, settings: store.settings, blocksFor: date => store.getBlocksForDate(date), pausedUntil: paused, count: 4 }));
	let hourFromNow = $derived(new Date(store.now.getTime() + 60 * 60_000));
	let morning = $derived(nextWake(store.now, store.settings.wakeAnchor));

	const otherMarks: BellMark[] = ['blockStart', 'leadTime', 'reminder'];
	const voiceName = (id: string) => BELL_VOICES.find(voice => voice.id === id)?.name ?? id;
	const voiceHint = (id: string) => BELL_VOICES.find(voice => voice.id === id)?.description ?? '';
	const markInfo = (id: BellMark) => BELL_MARKS.find(mark => mark.id === id)!;
	const timeFor = clockLabel;
	const percent = (value: number) => `${Math.round(value * 100)}%`;
	// Westminster follows the clock face, so it's offered only where the clock face is.
	const voicesFor = (mark: BellMark) => BELL_VOICES.filter(voice => voice.id !== 'westminster' || ['hour', 'half', 'quarter'].includes(mark));
	function minutesLabel(mark: BellMark): string {
		if (mark !== 'sample') return markInfo(mark).minutes;
		return samples.length > 5 ? `${samples.slice(0, 4).join(' ')} …` : samples.join(' ');
	}

	// Stop shows only while something is sounding; a finished preview resets its button.
	$effect(() => { if (store.bellSounding !== 'preview') previewing = null; });

	onMount(() => {
		// Start from fresh settings, so an edit here isn't made on a stale copy.
		if (syncState.connected) void flushSync();
	});

	/** One quiet live region; clear first so a repeated message is still announced. */
	async function say(text: string) {
		message = '';
		await tick();
		message = text;
	}

	function save() { queueSync(); }

	function setVoice(mark: BellMark, voice: string) { store.setMarkSound(mark, { voice: voice as BellVoiceId }); save(); }
	function setLevel(mark: BellMark, value: number) { store.setMarkSound(mark, { volume: value / 100 }); }

	async function togglePreview(mark: BellMark) {
		if (previewing === mark && store.bellSounding === 'preview') { stopBells(); previewing = null; await say('stopped'); return; }
		const unlocked = await unlockAudio();
		if (unlocked === 'unavailable') { await say('this browser can’t play bell sounds'); return; }
		const result = await store.previewMark(mark);
		if (result === 'scheduled') { previewing = mark; await say(`playing ${voiceName(markSound(sounds, mark).voice).toLowerCase()}`); }
		else if (result === 'locked') await say('the browser is still holding sound — tap the page once, then try again');
		else if (result === 'silent') await say(`${markInfo(mark).name} is silent`);
	}

	async function stop() { stopBells(); previewing = null; await say('stopped'); }

	async function pause(until: Date) {
		store.pauseBells(until);
		await say(`bells paused on this device until ${timeFor(until)}`);
		await tick(); resumeButton?.focus();
	}
	async function resume() {
		store.pauseBells(null);
		await say('bells resumed');
		await tick(); firstPauseButton?.focus();
	}
	async function allowSound() {
		const state = await unlockAudio();
		await say(state === 'running' ? 'sound allowed for this page' : 'the browser is still holding sound');
	}
	async function setEnabled(enabled: boolean) {
		// This click is the gesture browsers need; the page-wide unlock skipped it because bells were still off.
		if (enabled) void unlockAudio();
		store.updateSettings({ bellsEnabled: enabled }); save();
		await say(enabled ? 'bells on' : 'bells off');
	}
	function applyPreset(id: string) { store.applyBellPreset(id); save(); void say(`${BELL_PRESETS.find(item => item.id === id)?.name} bells`); }
	function setTime(key: 'quietHoursStart' | 'quietHoursEnd', value: string) {
		// An emptied time field must not become "never quiet".
		if (/^\d{2}:\d{2}$/.test(value)) { store.updateSettings({ [key]: value }); save(); }
	}
</script>

<div class="bells" data-testid="bell-settings">
	<section aria-labelledby="bells-now">
		<h3 id="bells-now">now</h3>
		<label class="check"><input type="checkbox" checked={store.settings.bellsEnabled} onchange={event => setEnabled(event.currentTarget.checked)} /> bells on</label>
		<label class="slider">volume on this device
			<span class="slider-row"><input type="range" min="0" max="100" step="5" value={Math.round(store.bellVolume * 100)} oninput={event => store.setBellVolume(Number(event.currentTarget.value) / 100)} aria-valuetext={percent(store.bellVolume)} /><span aria-hidden="true" class="value">{percent(store.bellVolume)}</span></span>
		</label>
		{#if store.bellSounding}<div class="actions"><button type="button" onclick={stop}>stop sound</button></div>{/if}
		{#if resting === 'paused' && paused}
			<p class="status">paused on this device until {timeFor(paused)}. <button type="button" class="link" bind:this={resumeButton} onclick={resume}>resume now</button></p>
		{:else}
			<div class="actions" role="group" aria-label="pause bells on this device">
				<button type="button" bind:this={firstPauseButton} onclick={() => pause(hourFromNow)} disabled={!store.settings.bellsEnabled}>pause until {timeFor(hourFromNow)}</button>
				<button type="button" onclick={() => pause(morning)} disabled={!store.settings.bellsEnabled}>pause until {timeFor(morning)}</button>
			</div>
		{/if}
		{#if resting === 'quiet'}<p class="status">quiet hours: bells rest until {store.settings.quietHoursEnd}.</p>{/if}
		{#if store.settings.bellsEnabled && store.audioReadiness === 'suspended'}<p class="status">your browser holds sound until you tap or press a key on this page. <button type="button" class="link" onclick={allowSound}>allow sound</button></p>{/if}
		{#if store.audioReadiness === 'unavailable'}<p class="status">this browser can’t play bell sounds; Today still shows each bell.</p>{/if}
		<p class="note">on iPhone, bells follow the silent switch and ring only while Carillon is open.</p>
	</section>

	<section aria-labelledby="bells-upcoming">
		<h3 id="bells-upcoming">coming up</h3>
		{#if upcoming.length}
			<ol class="upcoming">{#each upcoming as event (event.at.toISOString())}<li>
				<time datetime={event.at.toISOString()}>{timeFor(event.at)}</time>
				<span>{event.parts.map(part => markInfo(part.mark).name).join(', then ')}</span>
				<small>{event.parts.map(part => part.blockBellId ? `${part.blockBellId} bell` : voiceName(part.sound.voice).toLowerCase()).join(', ')}{event.parts.some(part => part.strikeHour !== undefined) ? ', counted' : ''}</small>
			</li>{/each}</ol>
		{:else}
			<p class="status">{resting === 'off' ? 'bells are off.' : 'no bells in the next day.'}</p>
		{/if}
	</section>

	<section aria-labelledby="bells-marks">
		<h3 id="bells-marks">what rings when</h3>
		<div class="presets" role="group" aria-label="bell sets">
			{#each BELL_PRESETS as item (item.id)}<button type="button" aria-pressed={preset === item.id} onclick={() => applyPreset(item.id)}><strong>{item.name}</strong><small>{item.description}</small></button>{/each}
		</div>
		{#if skipped.length}
			<div class="skip">
				<p>your {interval}-minute rows skip {skipped.join(' ')}.</p>
				<label class="check"><input type="checkbox" checked={chimesBetweenSamples(sounds)} onchange={event => { store.updateBellSounds({ chimeBetweenSamples: event.currentTarget.checked }); save(); }} /> chime them anyway (no moment asked)</label>
			</div>
		{/if}
		{#each clockRows as mark (mark)}
			{@const sound = markSound(sounds, mark)}
			{@const info = markInfo(mark)}
			<fieldset class="mark" data-mark={mark}>
				<legend>{info.name} <small>{minutesLabel(mark)}</small></legend>
				<div class="mark-row">
					<select aria-label={`sound: ${info.name}`} value={sound.voice} onchange={event => setVoice(mark, event.currentTarget.value)}>
						{#each voicesFor(mark) as voice (voice.id)}<option value={voice.id}>{voice.name.toLowerCase()}</option>{/each}
					</select>
					<button type="button" class="play" onclick={() => togglePreview(mark)} disabled={!audible(sound) && !(mark === 'hour' && countsHours(sounds))} aria-label={previewing === mark ? `stop ${info.name}` : `play ${info.name}`}>{previewing === mark ? '■' : '▶'}</button>
				</div>
				<small class="note">{voiceHint(sound.voice)}</small>
				{#if mark === 'hour'}<label class="check"><input type="checkbox" checked={countsHours(sounds)} onchange={event => { store.updateBellSounds({ countHours: event.currentTarget.checked }); save(); }} /> count the hour on a low bell</label>{/if}
			</fieldset>
		{/each}
	</section>

	<details class="more">
		<summary>blocks and reminders</summary>
		{#each otherMarks as mark (mark)}
			{@const sound = markSound(sounds, mark)}
			{@const info = markInfo(mark)}
			<fieldset class="mark" data-mark={mark}>
				<legend>{info.name} <small>{info.minutes}</small></legend>
				<div class="mark-row">
					<select aria-label={`sound: ${info.name}`} value={sound.voice} onchange={event => setVoice(mark, event.currentTarget.value)}>
						{#each voicesFor(mark) as voice (voice.id)}<option value={voice.id}>{voice.name.toLowerCase()}</option>{/each}
					</select>
					<button type="button" class="play" onclick={() => togglePreview(mark)} disabled={!audible(sound)} aria-label={previewing === mark ? `stop ${info.name}` : `play ${info.name}`}>{previewing === mark ? '■' : '▶'}</button>
				</div>
				<small class="note">{voiceHint(sound.voice)}</small>
				{#if mark === 'blockStart'}<small class="note">rings after the clock chime when they share a minute. with the plain bell, a block’s own bell (like a meal bell) is used.</small>{/if}
				{#if mark === 'reminder'}<small class="note">only reminders you set. follows bells on and quiet hours, and sounds only if Carillon is open when it comes due.</small>{/if}
			</fieldset>
		{/each}
	</details>

	<details class="more">
		<summary>levels</summary>
		<p class="note">how loud each bell is next to the others. the mix travels with your bells; overall volume stays on this device.</p>
		{#each [...clockRows, ...otherMarks] as mark (mark)}
			{@const sound = markSound(sounds, mark)}
			<label class="slider">{markInfo(mark).name}
				<span class="slider-row"><input type="range" min="0" max="100" step="5" value={Math.round(sound.volume * 100)} oninput={event => setLevel(mark, Number(event.currentTarget.value))} onchange={save} aria-valuetext={sound.volume > 0 ? percent(sound.volume) : 'silent'} /><span aria-hidden="true" class="value">{sound.volume > 0 ? percent(sound.volume) : 'silent'}</span></span>
			</label>
		{/each}
	</details>

	<section aria-labelledby="bells-timing">
		<h3 id="bells-timing">timing</h3>
		<label>sampling interval
			<select value={interval} onchange={event => { store.updateSettings({ samplingIntervalMinutes: Number(event.currentTarget.value) }); save(); }}>
				{#each [...new Set([...INTERVAL_OPTIONS, interval])].sort((a, b) => a - b) as minutes}<option value={minutes}>{minutes} minutes</option>{/each}
			</select>
		</label>
		<label>bell before a block
			<select value={store.settings.leadTimeMinutes} onchange={event => { store.updateSettings({ leadTimeMinutes: Number(event.currentTarget.value) }); save(); }}>
				{#each [...new Set([0, 2, 5, 10, 15, store.settings.leadTimeMinutes])].sort((a, b) => a - b) as minutes}<option value={minutes}>{minutes ? `${minutes} minutes before` : 'none'}</option>{/each}
			</select>
		</label>
		<div class="pair">
			<label>quiet from<input type="time" value={store.settings.quietHoursStart} onchange={event => setTime('quietHoursStart', event.currentTarget.value)} /></label>
			<label>until<input type="time" value={store.settings.quietHoursEnd} onchange={event => setTime('quietHoursEnd', event.currentTarget.value)} /></label>
		</div>
	</section>

	<p class="message" role="status" aria-live="polite">{message}</p>
</div>

<style>
	.bells { display: flex; flex-direction: column; gap: 1rem; padding-bottom: 1.5rem; color: var(--p-text); font: 0.78rem/1.45 var(--pl-font-body); }
	section, .more[open] { display: flex; flex-direction: column; gap: 0.55rem; }
	h3 { font-family: var(--pl-font-mono); font-size: 0.55rem; font-weight: 400; letter-spacing: 0.18em; text-transform: uppercase; color: var(--p-muted); }
	label { display: grid; gap: 0.3rem; }
	label.check { display: flex; align-items: center; gap: 0.5rem; }
	select, input[type='time'] { font: inherit; color: var(--p-text); background: var(--p-bg); border: 1px solid var(--p-border); border-radius: var(--pl-radius-sm); padding: 0.35rem 0.5rem; min-width: 0; }
	select { width: 100%; }
	.slider-row { display: flex; align-items: center; gap: 0.6rem; }
	.slider-row input { flex: 1; min-width: 0; accent-color: var(--p-accent); }
	.value { font-family: var(--pl-font-mono); font-size: 0.65rem; min-width: 2.8rem; text-align: right; color: var(--p-muted); }
	.actions { display: flex; flex-wrap: wrap; gap: 0.4rem; }
	.actions button, .play, .presets button { font-family: var(--pl-font-mono); font-size: 0.62rem; letter-spacing: 0.04em; color: var(--p-text); border: 1px solid var(--p-border); border-radius: var(--pl-radius-pill); padding: 0.4rem 0.75rem; min-height: 2.2rem; }
	.actions button:hover:not(:disabled), .play:hover:not(:disabled), .presets button:hover { border-color: var(--p-accent); color: var(--p-accent); }
	.play { min-width: 2.4rem; }
	.presets { display: grid; gap: 0.4rem; }
	.presets button { display: grid; gap: 0.1rem; text-align: left; border-radius: var(--pl-radius-md); }
	.presets button small { font-family: var(--pl-font-body); letter-spacing: 0; }
	.presets button[aria-pressed='true'] { border-color: var(--p-accent); background: var(--p-accent-soft); }
	.skip { border-left: 2px solid var(--p-accent-soft); padding-left: 0.6rem; display: grid; gap: 0.35rem; }
	.link { text-decoration: underline; text-underline-offset: 0.2em; color: var(--p-text); }
	.status, .note, small { color: var(--p-muted); }
	.status { font-size: 0.72rem; }
	small, .note { font-size: 0.66rem; }
	.mark { border: 1px solid var(--p-border); border-radius: var(--pl-radius-md); padding: 0.55rem 0.7rem 0.65rem; display: grid; gap: 0.4rem; min-width: 0; }
	legend { padding: 0 0.3rem; font-family: var(--pl-font-display); font-size: 0.9rem; }
	legend small { font-family: var(--pl-font-mono); margin-left: 0.3rem; }
	.mark-row { display: flex; gap: 0.45rem; align-items: center; }
	.upcoming { list-style: none; display: grid; gap: 0.3rem; }
	.upcoming li { display: flex; gap: 0.5rem; align-items: baseline; flex-wrap: wrap; }
	.upcoming time { font-family: var(--pl-font-mono); font-size: 0.68rem; min-width: 4.2rem; }
	.more summary { cursor: pointer; padding: 0.3rem 0; font-family: var(--pl-font-mono); font-size: 0.6rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--p-muted); }
	.pair { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; }
	.message { min-height: 1.1em; color: var(--p-muted); font-size: 0.72rem; }
	:focus-visible { outline: 2px solid var(--p-accent); outline-offset: 2px; }
</style>
