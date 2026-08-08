<script lang="ts">
	// The picker that opens when you type `#` or `@` in the prose.
	//
	// Deliberately not a modal: it floats at the caret, the keystroke that
	// opened it stays in the document, and Escape leaves you exactly where you
	// were with the text you typed intact. Typing "#1 priority" should cost
	// nothing — so the picker opens, finds nothing, and gets out of the way.

	import { candidatesFor, type ReferenceCandidate, type Sigil } from '$lib/references.svelte';

	let {
		sigil = null,
		query = '',
		x = 0,
		y = 0,
		onpick,
		onclose
	}: {
		sigil: Sigil | null;
		query: string;
		x: number;
		y: number;
		onpick: (candidate: ReferenceCandidate) => void;
		onclose: () => void;
	} = $props();

	let active = $state(0);

	const candidates = $derived(sigil ? candidatesFor(sigil, query).slice(0, 8) : []);
	const open = $derived(sigil !== null && candidates.length > 0);

	// Keep the highlight inside the list as it narrows under typing.
	$effect(() => {
		if (active >= candidates.length) active = 0;
	});

	export function handleKey(event: KeyboardEvent): boolean {
		if (!open) return false;
		if (event.key === 'ArrowDown') {
			active = (active + 1) % candidates.length;
			return true;
		}
		if (event.key === 'ArrowUp') {
			active = (active - 1 + candidates.length) % candidates.length;
			return true;
		}
		if (event.key === 'Enter' || event.key === 'Tab') {
			onpick(candidates[active]);
			return true;
		}
		if (event.key === 'Escape') {
			onclose();
			return true;
		}
		return false;
	}
</script>

{#if open}
	<div class="ref-picker" style:left="{x}px" style:top="{y}px" data-testid="reference-picker">
		<ul role="listbox" aria-label="references">
			{#each candidates as candidate, index (candidate.app + candidate.kind + candidate.id)}
				<li>
					<button
						type="button"
						class="ref-option"
						class:active={index === active}
						role="option"
						aria-selected={index === active}
						style:--dot={candidate.color ?? 'transparent'}
						onmousedown={(event) => {
							// mousedown, not click: a click would blur the editor first
							// and lose the selection the reference is inserted into.
							event.preventDefault();
							onpick(candidate);
						}}
					>
						{#if candidate.color}<span class="ref-dot"></span>{/if}
						<span class="ref-text">{candidate.text}</span>
						{#if candidate.hint}<span class="ref-hint">{candidate.hint}</span>{/if}
					</button>
				</li>
			{/each}
		</ul>
	</div>
{/if}

<style>
	.ref-picker {
		position: fixed;
		z-index: 80;
		min-width: 14rem;
		max-width: 22rem;
		background: var(--bg);
		border: 1px solid var(--rule);
		border-radius: 0.4rem;
		box-shadow: 0 0.6rem 1.6rem rgba(0, 0, 0, 0.18);
		overflow: hidden;
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0.2rem;
		max-height: 15rem;
		overflow-y: auto;
	}

	.ref-option {
		width: 100%;
		display: flex;
		align-items: baseline;
		gap: 0.45rem;
		padding: 0.3rem 0.5rem;
		border: none;
		border-radius: 0.25rem;
		background: transparent;
		text-align: left;
		font-size: 0.85rem;
		color: var(--text);
		cursor: pointer;
	}

	.ref-option.active,
	.ref-option:hover {
		background: color-mix(in srgb, var(--accent) 14%, transparent);
	}

	.ref-dot {
		width: 0.45rem;
		height: 0.45rem;
		border-radius: 50%;
		background: var(--dot);
		flex: none;
	}

	.ref-text {
		flex: 1 1 auto;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.ref-hint {
		font-size: 0.72rem;
		opacity: 0.6;
		flex: none;
	}
</style>
