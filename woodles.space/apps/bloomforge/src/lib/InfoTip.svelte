<script lang="ts">
	import EmojiIcon from './EmojiIcon.svelte';
	import Tooltip from './Tooltip.svelte';

	/**
	 * The star you hover next to a label that isn't otherwise clickable — a
	 * currency's "Notation", a prestige layer's "Exponent". The button's own
	 * `aria-label` carries the explanation for anyone who never sees the
	 * bubble; the bubble is just the cute way sighted mouse and keyboard users
	 * get the same thing.
	 */
	interface Props {
		text: string;
		placement?: 'top' | 'bottom';
	}

	let { text, placement = 'top' }: Props = $props();
</script>

<Tooltip {text} {placement}>
	<button type="button" class="bf-infotip" aria-label={text}>
		<EmojiIcon char="⭐" size={10} />
	</button>
</Tooltip>

<style>
	.bf-infotip {
		display: grid;
		place-items: center;
		width: 15px;
		height: 15px;
		flex: none;
		border: 0;
		border-radius: 50%;
		background: var(--bf-accent-soft);
		cursor: help;
		transition: background 120ms ease, transform 120ms ease;
	}

	.bf-infotip:hover,
	.bf-infotip:focus-visible {
		background: var(--bf-tip-to);
		transform: scale(1.12);
	}
</style>
