<script lang="ts">
	type LayerId = 'foreground' | 'midground' | 'background';
	type Option = { id: string; name: string };

	let {
		saveStatus,
		wordCount,
		theme = $bindable(),
		motif = $bindable(),
		font = $bindable(),
		palettes,
		motifs,
		fonts,
		activeLayer,
		fgIsEmpty,
		isPublic = $bindable(),
		onPublish
	}: {
		saveStatus: 'saved' | 'saving';
		wordCount: number;
		theme: string;
		motif: string;
		font: string;
		palettes: Option[];
		motifs: Option[];
		fonts: Option[];
		activeLayer: LayerId;
		fgIsEmpty: boolean;
		isPublic: boolean;
		onPublish: () => void;
	} = $props();
</script>

<div class="bottom-bar">
	<div class="bottom-meta">
		<span class="save-status" class:saving={saveStatus === 'saving'}>
			{saveStatus === 'saving' ? 'saving…' : 'saved'}
		</span>
		<span class="word-count">{wordCount} word{wordCount !== 1 ? 's' : ''}</span>
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
	</div>
	<div class="publish-cluster">
		{#if activeLayer === 'foreground' && fgIsEmpty}
			<span class="publish-warn">this letter will appear blank to others</span>
		{/if}
		{#if activeLayer === 'foreground'}
			<label class="public-toggle" title="include this letter in the public echoes snapshot">
				<input type="checkbox" bind:checked={isPublic} />
				public
			</label>
			<button class="publish-btn" onclick={onPublish}>Publish →</button>
		{:else}
			<span class="publish-hint">switch to fg to publish</span>
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
	.word-count { color: var(--muted); opacity: 0.45; }
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
	.public-toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.57rem;
		letter-spacing: 0.1em;
		text-transform: lowercase;
		color: var(--muted);
		cursor: pointer;
	}
	.public-toggle:has(input:checked) { color: var(--accent-strong); }
	.public-toggle input {
		width: 0.85em;
		height: 0.85em;
		accent-color: var(--accent-strong);
		cursor: pointer;
	}
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
