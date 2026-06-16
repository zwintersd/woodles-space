<script lang="ts">
	import { bestiary } from '$lib/bestiary.svelte';

	// The three knobs that change how the whole place *feels* rather than how it's
	// arranged — quietness, stillness, and how much text whispers at you. Each is
	// a plain on/off switch, remembered between visits.
	type ComfortKey = 'calm' | 'reduceMotion' | 'showHints';
	const rows: { key: ComfortKey; glyph: string; label: string; note: string }[] = [
		{ key: 'calm', glyph: '✺', label: 'calm the lights', note: 'still backgrounds, a softer glow' },
		{ key: 'reduceMotion', glyph: '❍', label: 'still the air', note: 'hold drifting & springing motion' },
		{ key: 'showHints', glyph: '❧', label: 'whispered notes', note: 'show the little hints & descriptions' }
	];

	let w = $derived(bestiary.workshop);
	const toggle = (k: ComfortKey) => bestiary.setWorkshop({ [k]: !w[k] });
</script>

<div class="comfort">
	<header class="cm-head">
		<span class="cm-glyph">☾</span>
		<div class="cm-heading">
			<h2 class="cm-title">comfort &amp; quiet</h2>
			<p class="cm-sub">tune the workshop to your senses — take what you need</p>
		</div>
	</header>

	<ul class="cm-list">
		{#each rows as r (r.key)}
			<li>
				<button
					type="button"
					class="cm-row"
					role="switch"
					aria-checked={w[r.key]}
					onclick={() => toggle(r.key)}
				>
					<span class="cm-icon">{r.glyph}</span>
					<span class="cm-text">
						<span class="cm-label">{r.label}</span>
						<span class="cm-note">{r.note}</span>
					</span>
					<span class="cm-switch" class:on={w[r.key]} aria-hidden="true"><span class="knob"></span></span>
				</button>
			</li>
		{/each}
	</ul>

	<p class="cm-foot">the workshop also follows your system's “reduce motion” setting on its own.</p>
</div>

<style>
	.comfort { padding: var(--b-space-lg); display: flex; flex-direction: column; gap: var(--b-space-md); }

	.cm-head { display: flex; align-items: flex-start; gap: var(--b-space-sm); }
	.cm-glyph { font-size: 1.5rem; color: var(--b-gold); line-height: 1; margin-top: 0.1rem; }
	.cm-title {
		font-family: var(--b-font-codex);
		font-size: 1.3rem;
		font-weight: 600;
		color: var(--b-text);
		line-height: 1.1;
	}
	.cm-sub {
		font-family: var(--b-font-body);
		font-style: italic;
		font-size: 0.82rem;
		color: var(--b-muted);
		margin-top: 0.15rem;
	}

	.cm-list { list-style: none; display: flex; flex-direction: column; gap: var(--b-space-sm); }
	.cm-row {
		display: flex;
		align-items: center;
		gap: var(--b-space-sm);
		width: 100%;
		text-align: left;
		padding: 0.7rem 0.8rem;
		border: 1px solid var(--b-border);
		border-radius: var(--b-radius-md);
		background: var(--b-surface-2);
		transition: border-color var(--b-transition-fast), background var(--b-transition-fast);
	}
	.cm-row:hover { border-color: var(--b-border-strong); }
	.cm-icon { font-size: 1.1rem; color: var(--b-gold); width: 1.6rem; text-align: center; flex-shrink: 0; }
	.cm-text { display: flex; flex-direction: column; gap: 0.1rem; flex: 1; min-width: 0; }
	.cm-label { font-family: var(--b-font-mono); font-size: 0.86rem; color: var(--b-text); }
	.cm-note { font-family: var(--b-font-body); font-style: italic; font-size: 0.76rem; color: var(--b-muted); }

	/* the switch — a little lantern that lights when on */
	.cm-switch {
		flex-shrink: 0;
		width: 42px;
		height: 24px;
		border-radius: var(--b-radius-pill);
		background: var(--b-muted);
		position: relative;
		transition: background var(--b-transition-medium);
	}
	.cm-switch.on { background: var(--b-gold); }
	.knob {
		position: absolute;
		top: 3px;
		left: 3px;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: var(--b-surface);
		box-shadow: 0 1px 3px rgba(90, 54, 80, 0.3);
		transition: transform var(--b-transition-spring);
	}
	.cm-switch.on .knob { transform: translateX(18px); }

	.cm-foot {
		font-family: var(--b-font-body);
		font-style: italic;
		font-size: 0.74rem;
		color: var(--b-muted);
		line-height: 1.5;
	}
</style>
