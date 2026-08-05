<script lang="ts">
	import type { Snippet } from 'svelte';
	import EmojiIcon from './EmojiIcon.svelte';

	/**
	 * A soft-but-bright hover callout — candy-pink bubble, a small gold star,
	 * a little pop on the way in. Wraps whatever's already interactive (a
	 * button, a badge, an info dot); the bubble is decorative, so the trigger
	 * itself must carry its own accessible name — a tooltip is a bonus, never
	 * the only way to learn something.
	 */
	interface Props {
		text: string;
		placement?: 'top' | 'bottom';
		children: Snippet;
	}

	let { text, placement = 'top', children }: Props = $props();
</script>

<span class="bf-tooltip" data-placement={placement}>
	{@render children()}
	<span class="bf-tooltip-bubble" aria-hidden="true">
		<span class="bf-tooltip-star"><EmojiIcon char="⭐" size={10} /></span>
		{text}
	</span>
</span>

<style>
	.bf-tooltip {
		position: relative;
		display: inline-flex;
	}

	.bf-tooltip-bubble {
		position: absolute;
		left: 50%;
		z-index: 30;
		display: flex;
		align-items: flex-start;
		gap: 4px;
		width: max-content;
		max-width: 200px;
		padding: 7px 10px 7px 8px;
		border-radius: 12px;
		border: 1px solid rgba(255, 255, 255, 0.5);
		background: linear-gradient(155deg, var(--bf-tip-from), var(--bf-tip-to));
		box-shadow: var(--bf-tip-shadow);
		color: var(--bf-tip-ink);
		font-family: var(--bf-font-sans);
		font-size: 11.5px;
		font-weight: 600;
		line-height: 1.4;
		text-align: left;
		text-transform: none;
		letter-spacing: normal;
		opacity: 0;
		pointer-events: none;
		transform: translate(-50%, 4px) scale(0.85);
		transform-origin: bottom center;
		transition:
			opacity 120ms ease,
			transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.bf-tooltip[data-placement='top'] .bf-tooltip-bubble {
		bottom: calc(100% + 9px);
	}

	.bf-tooltip[data-placement='bottom'] .bf-tooltip-bubble {
		top: calc(100% + 9px);
		transform: translate(-50%, -4px) scale(0.85);
		transform-origin: top center;
	}

	.bf-tooltip-bubble::after {
		content: '';
		position: absolute;
		left: 50%;
		width: 9px;
		height: 9px;
		background: var(--bf-tip-to);
		transform: translateX(-50%) rotate(45deg);
	}

	.bf-tooltip[data-placement='top'] .bf-tooltip-bubble::after {
		bottom: -4px;
		border-radius: 0 0 3px 0;
	}

	.bf-tooltip[data-placement='bottom'] .bf-tooltip-bubble::after {
		top: -4px;
		border-radius: 3px 0 0 0;
	}

	.bf-tooltip-star {
		display: inline-flex;
		flex: none;
		margin-top: 1px;
		filter: drop-shadow(0 1px 1px rgba(214, 32, 116, 0.35));
	}

	.bf-tooltip:hover .bf-tooltip-bubble,
	.bf-tooltip:focus-within .bf-tooltip-bubble {
		opacity: 1;
		transform: translate(-50%, 0) scale(1);
	}
</style>
