<script lang="ts">
	import Clock from './Clock.svelte';

	type LayerId = 'foreground' | 'midground' | 'background';

	let {
		activeLayer,
		layerIds,
		layerLabels,
		draftsOpen = $bindable(),
		pocketsOpen = $bindable(),
		pocketsCount,
		onLayerChange
	}: {
		activeLayer: LayerId;
		layerIds: readonly LayerId[];
		layerLabels: Record<LayerId, string>;
		draftsOpen: boolean;
		pocketsOpen: boolean;
		pocketsCount: number;
		onLayerChange: (id: LayerId) => void;
	} = $props();
</script>

<header class="topbar">
	<a href="/" class="topbar-brand">.space</a>
	<span class="topbar-label">echoes · write</span>
	<div class="layer-switch" role="tablist" aria-label="layer">
		{#each layerIds as id}
			<button
				class="layer-btn"
				class:active={activeLayer === id}
				role="tab"
				aria-selected={activeLayer === id}
				onclick={() => onLayerChange(id)}
				title={id}>{layerLabels[id]}</button
			>
		{/each}
	</div>
	<button
		class="drafts-toggle"
		class:on={draftsOpen}
		onclick={() => (draftsOpen = !draftsOpen)}
		aria-pressed={draftsOpen}
		title="drafts"
	>
		drafts
	</button>
	<span class="topbar-divider" aria-hidden="true"></span>
	<button
		class="pockets-toggle"
		class:on={pocketsOpen}
		onclick={() => (pocketsOpen = !pocketsOpen)}
		aria-pressed={pocketsOpen}
		title="pockets"
	>
		pockets{#if pocketsCount > 0}<span class="pockets-count">{pocketsCount}</span>{/if}
	</button>
	<div class="topbar-clock"><Clock /></div>
</header>

<style>
	.topbar {
		position: fixed;
		top: 0; left: 0; right: 0;
		z-index: 20;
		height: 42px;
		display: flex;
		align-items: center;
		padding: 0 1.6rem;
		background: var(--surface);
		backdrop-filter: blur(22px);
		-webkit-backdrop-filter: blur(22px);
		overflow: hidden;
	}
	.topbar::after {
		content: '';
		position: absolute;
		bottom: 0; left: 0; right: 0;
		height: 1px;
		background: linear-gradient(90deg, transparent 0%, var(--lavender) 20%, var(--aqua) 45%, var(--peach) 65%, var(--lilac) 80%, transparent 100%);
		background-size: 220% 100%;
		animation: bar-shimmer 11s ease-in-out infinite;
		opacity: 0.5;
	}
	@keyframes bar-shimmer {
		0% { background-position: 0% 0; }
		50% { background-position: 100% 0; }
		100% { background-position: 0% 0; }
	}
	.topbar-brand {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.68rem;
		letter-spacing: 0.18em;
		text-decoration: none;
		position: relative;
		z-index: 1;
		color: var(--muted);
	}
	.topbar-brand:hover { color: var(--accent-strong); }
	.topbar-label {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.57rem;
		letter-spacing: 0.14em;
		color: var(--muted);
		opacity: 0.45;
		margin-left: 1.2rem;
		position: relative;
		z-index: 1;
	}
	.layer-switch {
		display: flex;
		align-items: center;
		gap: 2px;
		margin-left: 1.4rem;
		position: relative;
		z-index: 1;
	}
	.layer-btn {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.57rem;
		letter-spacing: 0.14em;
		text-transform: lowercase;
		color: var(--muted);
		background: none;
		border: 1px solid transparent;
		padding: 3px 8px;
		border-radius: 4px;
		cursor: pointer;
		opacity: 0.5;
		transition: color 0.18s ease, background 0.18s ease, border-color 0.18s ease, opacity 0.18s ease;
	}
	.layer-btn:hover { opacity: 0.9; color: var(--accent-strong); }
	.layer-btn.active {
		color: var(--accent-strong);
		opacity: 1;
		background: color-mix(in srgb, var(--accent) 22%, transparent);
		border-color: color-mix(in srgb, var(--accent) 40%, transparent);
	}
	.topbar-divider {
		display: inline-block;
		width: 1px;
		height: 14px;
		background: var(--rule);
		margin: 0 0.9rem;
		opacity: 0.6;
		position: relative;
		z-index: 1;
	}
	.pockets-toggle {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.57rem;
		letter-spacing: 0.14em;
		text-transform: lowercase;
		color: var(--muted);
		background: none;
		border: 1px solid transparent;
		padding: 3px 9px;
		border-radius: 4px;
		cursor: pointer;
		opacity: 0.5;
		display: inline-flex;
		align-items: center;
		gap: 0.45em;
		position: relative;
		z-index: 1;
		transition: color 0.22s ease, background 0.22s ease, border-color 0.22s ease, opacity 0.22s ease, transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	.pockets-toggle:hover { opacity: 0.9; color: var(--accent-strong); }
	.pockets-toggle.on {
		color: var(--accent-strong);
		opacity: 1;
		background: color-mix(in srgb, var(--accent) 22%, transparent);
		border-color: color-mix(in srgb, var(--accent) 40%, transparent);
		transform: translateY(-1px);
	}
	.pockets-count {
		font-size: 0.52rem;
		letter-spacing: 0.08em;
		padding: 1px 5px;
		border-radius: 8px;
		background: color-mix(in srgb, var(--accent) 30%, transparent);
		color: var(--accent-strong);
		opacity: 0.85;
	}
	.topbar-clock {
		margin-left: auto;
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.6rem;
		letter-spacing: 0.1em;
		display: flex;
		align-items: center;
		gap: 0.9rem;
		position: relative;
		z-index: 1;
	}
	.drafts-toggle {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.57rem; letter-spacing: 0.14em; text-transform: lowercase;
		color: var(--muted); background: none; border: 1px solid transparent;
		padding: 3px 9px; border-radius: 4px; cursor: pointer; opacity: 0.5;
		display: inline-flex; align-items: center; gap: 0.45em;
		position: relative; z-index: 1; margin-left: 1.4rem;
		transition: color 0.22s ease, background 0.22s ease, border-color 0.22s ease, opacity 0.22s ease, transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	.drafts-toggle:hover { opacity: 0.9; color: var(--accent-strong); }
	.drafts-toggle.on {
		color: var(--accent-strong); opacity: 1;
		background: color-mix(in srgb, var(--accent) 22%, transparent);
		border-color: color-mix(in srgb, var(--accent) 40%, transparent);
		transform: translateY(-1px);
	}
</style>
