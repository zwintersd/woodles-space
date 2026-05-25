<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import type { DraftIndexItem } from './drafts';

	let {
		open = $bindable(),
		drafts,
		currentDraftId,
		onSelect,
		onCreate,
		onDelete
	}: {
		open: boolean;
		drafts: DraftIndexItem[];
		currentDraftId: string | null;
		onSelect: (id: string) => void;
		onCreate: () => void;
		onDelete: (id: string, e: Event) => void;
	} = $props();

	const sorted = $derived([...drafts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
	const dateFormat: Intl.DateTimeFormatOptions = {
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit'
	};
</script>

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="drafts-overlay"
		transition:fade={{ duration: 240 }}
		onclick={() => (open = false)}
	>
		<div
			class="drafts-modal"
			onclick={(e) => e.stopPropagation()}
			transition:fly={{ y: 8, duration: 320, easing: cubicOut }}
		>
			<div class="drafts-header">
				<h2 class="drafts-title">your drafts</h2>
				<button class="drafts-new-btn" onclick={onCreate}>+ new draft</button>
			</div>
			<div class="drafts-list">
				{#each sorted as d (d.id)}
					<div class="draft-item" class:active={d.id === currentDraftId}>
						<button class="draft-item-btn" onclick={() => onSelect(d.id)}>
							<span class="draft-item-title">{d.title || 'untitled letter'}</span>
							<span class="draft-item-date">
								{new Date(d.updatedAt).toLocaleDateString(undefined, dateFormat)}
							</span>
						</button>
						<button
							class="draft-item-delete"
							onclick={(e) => onDelete(d.id, e)}
							title="discard draft"
						>×</button>
					</div>
				{/each}
			</div>
		</div>
	</div>
{/if}

<style>
	.drafts-overlay {
		position: fixed; inset: 0;
		background: color-mix(in srgb, var(--bg) 60%, transparent);
		backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
		z-index: 100; display: flex; align-items: flex-start; justify-content: center;
		padding-top: 12vh;
	}
	.drafts-modal {
		background: var(--surface); border: 1px solid var(--rule); border-radius: 12px;
		width: 100%; max-width: 420px;
		box-shadow: 0 12px 40px color-mix(in srgb, var(--bg) 80%, transparent);
		overflow: hidden; display: flex; flex-direction: column; max-height: 70vh;
	}
	.drafts-header {
		display: flex; align-items: center; justify-content: space-between;
		padding: 1.2rem 1.4rem; border-bottom: 1px dashed var(--rule);
	}
	.drafts-title {
		font-family: var(--editor-mono, var(--font-mono)); font-size: 0.75rem;
		letter-spacing: 0.15em; text-transform: lowercase; color: var(--accent-strong); font-weight: 400;
	}
	.drafts-new-btn {
		font-family: var(--editor-mono, var(--font-mono)); font-size: 0.55rem;
		letter-spacing: 0.12em; text-transform: lowercase; color: var(--bg);
		background: var(--accent-strong); border: none; padding: 6px 12px; border-radius: 100px;
		cursor: pointer; transition: background 0.18s ease, transform 0.18s ease;
	}
	.drafts-new-btn:hover { background: var(--accent-deep); transform: translateY(-1px); }
	.drafts-list { padding: 0.8rem; overflow-y: auto; display: flex; flex-direction: column; gap: 0.4rem; }
	.draft-item {
		display: flex; align-items: center; border-radius: 8px;
		transition: background 0.18s ease; padding: 0.4rem;
	}
	.draft-item:hover { background: color-mix(in srgb, var(--surface) 50%, var(--rule)); }
	.draft-item.active { background: color-mix(in srgb, var(--accent) 15%, transparent); }
	.draft-item-btn {
		flex: 1; text-align: left; background: none; border: none; padding: 0.6rem;
		cursor: pointer; display: flex; flex-direction: column; gap: 0.3rem; overflow: hidden;
	}
	.draft-item-title {
		font-family: var(--editor-display, var(--font-display)); font-size: 1.1rem;
		color: var(--accent-strong); font-style: italic; white-space: nowrap; overflow: hidden;
		text-overflow: ellipsis; max-width: 100%;
	}
	.draft-item-date {
		font-family: var(--editor-mono, var(--font-mono)); font-size: 0.5rem;
		letter-spacing: 0.1em; color: var(--muted); opacity: 0.6;
	}
	.draft-item-delete {
		background: none; border: none; font-size: 1rem; color: var(--muted); opacity: 0.3;
		cursor: pointer; padding: 0.5rem; border-radius: 50%; width: 32px; height: 32px;
		display: flex; align-items: center; justify-content: center; margin-left: 0.4rem;
		transition: opacity 0.18s ease, color 0.18s ease, background 0.18s ease;
	}
	.draft-item-delete:hover {
		opacity: 1; color: var(--accent-strong); background: color-mix(in srgb, var(--accent) 20%, transparent);
	}
</style>
