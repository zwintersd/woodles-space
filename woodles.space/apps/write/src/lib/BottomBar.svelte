<script lang="ts">
	import { goalLabel } from './kinds';

	type Option = { id: string; name: string };

	let {
		saveStatus,
		wordCount,
		goal,
		onSetGoal,
		theme = $bindable(),
		motif = $bindable(),
		font = $bindable(),
		ruled,
		onRuledChange,
		palettes,
		motifs,
		fonts,
		foregroundVisible,
		fgIsEmpty,
		isListKind = false,
		liquidItemCount = 0,
		onPublish
	}: {
		saveStatus: 'saved' | 'saving';
		wordCount: number;
		goal: number | null;
		onSetGoal: () => void;
		theme: string;
		motif: string;
		font: string;
		ruled: boolean;
		onRuledChange: (ruled: boolean) => void;
		palettes: Option[];
		motifs: Option[];
		fonts: Option[];
		/** Publishing follows whether the prose is on screen, not what has focus. */
		foregroundVisible: boolean;
		fgIsEmpty: boolean;
		/** Liquid has neither a word count nor a goal — an item count instead. */
		isListKind?: boolean;
		liquidItemCount?: number;
		onPublish: () => void;
	} = $props();
</script>

<div class="bottom-bar">
	<div class="bottom-meta">
		<span class="save-status" class:saving={saveStatus === 'saving'}>
			{saveStatus === 'saving' ? 'saving…' : 'saved'}
		</span>
		{#if isListKind}
			<span class="word-count" title="items across every list">
				{liquidItemCount} item{liquidItemCount === 1 ? '' : 's'}
			</span>
		{:else}
			<button
				class="word-count"
				class:met={goal !== null && wordCount >= goal}
				onclick={onSetGoal}
				title={goal === null ? 'set a word goal' : 'change or clear the word goal'}
			>{goalLabel(wordCount, goal)}</button>
		{/if}
		<span class="picker-sep">·</span>
		<label class="picker">
			<span class="picker-label">palette</span>
			<select bind:value={theme} class="picker-select">
				{#each palettes as p}<option value={p.id}>{p.name}</option>{/each}
			</select>
		</label>
		<label class="picker">
			<span class="picker-label">motif</span>
			<select bind:value={motif} class="picker-select">
				{#each motifs as m}<option value={m.id}>{m.name}</option>{/each}
			</select>
		</label>
		<label class="picker">
			<span class="picker-label">font</span>
			<select bind:value={font} class="picker-select">
				{#each fonts as f}<option value={f.id}>{f.name}</option>{/each}
			</select>
		</label>
		<label class="picker">
			<span class="picker-label">paper</span>
			<!-- named explicitly: "paper" is also a palette and a motif, so the
			     label text alone would not tell the three selects apart -->
			<select
				aria-label="paper ruling"
				value={ruled ? 'ruled' : 'plain'}
				onchange={(e) => onRuledChange(e.currentTarget.value === 'ruled')}
				class="picker-select"
			>
				<option value="plain">plain</option>
				<option value="ruled">ruled</option>
			</select>
		</label>
	</div>
	<div class="publish-cluster">
		{#if isListKind}
			<span class="publish-hint">liquid boards stay here — echoes is for finished prose</span>
		{:else}
			{#if foregroundVisible && fgIsEmpty}
				<span class="publish-warn">this will be blank in the archive</span>
			{/if}
			{#if foregroundVisible}
				<button class="publish-btn" onclick={onPublish}>Publish →</button>
			{:else}
				<span class="publish-hint">open the fg page to publish</span>
			{/if}
		{/if}
	</div>
</div>

<style>
	.bottom-bar {
		position: fixed;
		bottom: 0; left: 0; right: 0;
		min-height: 46px;
		display: flex; align-items: center; justify-content: space-between;
		padding: 0.4rem 1.8rem;
		background: var(--surface);
		backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px);
		border-top: 1px solid var(--rule);
		z-index: 20;
		flex-wrap: wrap; gap: 0.6rem;
	}
	.bottom-meta {
		display: flex; align-items: center; gap: 1.2rem;
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.57rem; letter-spacing: 0.1em;
		flex-wrap: wrap;
	}
	.save-status {
		transition: color 0.3s ease, opacity 0.3s ease;
		color: var(--muted); opacity: 0.5;
	}
	.save-status.saving { color: var(--accent-deep); opacity: 0.9; }
	.word-count {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: inherit; letter-spacing: inherit;
		color: var(--muted); opacity: 0.45;
		background: none; border: none; padding: 0; cursor: pointer;
		transition: color 0.18s ease, opacity 0.18s ease;
	}
	/* Liquid's item count is read-only, unlike the word-count/goal button. */
	span.word-count { cursor: default; }
	.word-count:hover { opacity: 0.85; color: var(--accent-strong); }
	.word-count.met { color: var(--accent-strong); opacity: 0.8; }
	.picker-sep { color: var(--muted); opacity: 0.3; }
	.picker { display: inline-flex; align-items: center; gap: 0.4rem; }
	.picker-label { color: var(--muted); opacity: 0.55; text-transform: uppercase; }
	.picker-select {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.6rem; letter-spacing: 0.06em;
		color: var(--accent-strong);
		background: transparent;
		border: 1px solid var(--rule);
		padding: 3px 18px 3px 8px; border-radius: 4px;
		cursor: pointer;
		appearance: none; -webkit-appearance: none;
		background-image: linear-gradient(45deg, transparent 50%, var(--muted) 50%),
			linear-gradient(-45deg, transparent 50%, var(--muted) 50%);
		background-position: calc(100% - 9px) 50%, calc(100% - 5px) 50%;
		background-size: 4px 4px, 4px 4px;
		background-repeat: no-repeat;
	}
	.picker-select:focus { outline: none; border-color: var(--accent); }

	.publish-cluster { display: flex; align-items: center; gap: 0.9rem; }
	.publish-warn {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.55rem; letter-spacing: 0.12em;
		text-transform: lowercase; color: var(--muted);
		opacity: 0.7; font-style: italic;
	}
	.publish-hint {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.55rem; letter-spacing: 0.12em;
		text-transform: lowercase; color: var(--muted); opacity: 0.5;
	}
	.publish-btn {
		font-family: var(--editor-mono, var(--font-mono));
		font-weight: 300; font-size: 0.62rem;
		letter-spacing: 0.16em; text-transform: uppercase;
		color: var(--bg); background: var(--accent-strong);
		border: none; padding: 8px 24px; border-radius: 100px;
		cursor: pointer;
		transition: background 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease;
	}
	.publish-btn:hover { background: var(--accent-deep); transform: translateY(-1px); }
	.publish-btn:active { transform: translateY(0); }
</style>
