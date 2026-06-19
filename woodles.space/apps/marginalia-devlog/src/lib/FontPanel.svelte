<script lang="ts">
	import { fontStore, FONTS } from '$lib/fontStore.svelte';

	let { onclose }: { onclose: () => void } = $props();

	const SAMPLE = 'the witch writes at midnight';

	const CATEGORY_LABEL: Record<string, string> = {
		serif: 'serif',
		sans: 'sans-serif',
		mono: 'monospace',
		display: 'display',
	};
</script>

<div class="font-panel" role="dialog" aria-label="Font selector">
	<div class="panel-header">
		<span class="panel-title">✦ writing font</span>
		<button class="panel-close" onclick={onclose} aria-label="close font panel">×</button>
	</div>

	<div class="font-list">
		{#each FONTS as font (font.key)}
			<button
				class="font-option"
				class:selected={fontStore.key === font.key}
				onclick={() => { fontStore.select(font.key); }}
				title={font.label}
			>
				<div class="font-row">
					<span class="font-name" style="font-family: var({font.cssVar});">{font.label}</span>
					<span class="font-badge">{CATEGORY_LABEL[font.category]}</span>
				</div>
				<span class="font-sample" style="font-family: var({font.cssVar});">{SAMPLE}</span>
			</button>
		{/each}
	</div>
</div>

<style>
	.font-panel {
		position: fixed;
		bottom: 72px;
		right: 20px;
		z-index: 60;
		width: 300px;
		max-height: 480px;
		display: flex;
		flex-direction: column;
		background: rgba(255, 255, 255, 0.88);
		backdrop-filter: blur(18px) saturate(1.4);
		-webkit-backdrop-filter: blur(18px) saturate(1.4);
		border: 1px solid var(--d-border-mid);
		border-radius: var(--d-radius-lg);
		box-shadow: var(--d-shadow-pop);
		overflow: hidden;
		animation: panel-pop 0.22s var(--d-transition-spring) both;
	}

	@keyframes panel-pop {
		from { opacity: 0; transform: scale(0.9) translateY(12px); }
		to   { opacity: 1; transform: scale(1) translateY(0); }
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--d-space-sm) var(--d-space-md);
		border-bottom: 1px solid var(--d-border);
		flex-shrink: 0;
	}

	.panel-title {
		font-family: var(--d-font-mono);
		font-size: 11px;
		letter-spacing: 0.08em;
		color: var(--d-accent);
	}

	.panel-close {
		width: 22px;
		height: 22px;
		border-radius: var(--d-radius-sm);
		font-size: 15px;
		color: var(--d-text-faint);
		display: flex;
		align-items: center;
		justify-content: center;
		transition: color var(--d-transition-fast);
	}
	.panel-close:hover { color: var(--d-text); }

	.font-list {
		flex: 1;
		overflow-y: auto;
		padding: var(--d-space-xs);
	}

	.font-option {
		width: 100%;
		text-align: left;
		padding: var(--d-space-sm) var(--d-space-sm);
		border-radius: var(--d-radius-md);
		border: 1.5px solid transparent;
		transition: all var(--d-transition-fast);
		display: flex;
		flex-direction: column;
		gap: 2px;
		cursor: pointer;
	}
	.font-option:hover {
		background: var(--d-accent-soft);
		border-color: rgba(183, 140, 240, 0.20);
	}
	.font-option.selected {
		background: var(--d-accent-soft);
		border-color: var(--d-accent);
		box-shadow: 0 0 0 3px var(--d-accent-glow);
	}

	.font-row {
		display: flex;
		align-items: baseline;
		gap: var(--d-space-sm);
	}

	.font-name {
		font-size: 15px;
		color: var(--d-text);
		line-height: 1.3;
		flex: 1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.font-option.selected .font-name { color: var(--d-accent); }

	.font-badge {
		font-family: var(--d-font-mono);
		font-size: 9px;
		color: var(--d-text-faint);
		letter-spacing: 0.05em;
		flex-shrink: 0;
	}

	.font-sample {
		font-size: 12px;
		color: var(--d-text-dim);
		line-height: 1.4;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
