<script lang="ts" module>
	// Vite resolves this at build time into a codepoint → hashed-URL map, so
	// every OpenMoji SVG this app bundles is registered once, here, rather than
	// import-by-import at every call site.
	const files = import.meta.glob('./assets/emoji/*.svg', {
		eager: true,
		query: '?url',
		import: 'default'
	}) as Record<string, string>;

	function urlFor(codepoint: string): string | undefined {
		return files[`./assets/emoji/${codepoint}.svg`];
	}
</script>

<script lang="ts">
	import { openmojiCodepoint } from '@woodles/emoji';

	/**
	 * Draws one glyph as OpenMoji artwork instead of a native emoji character —
	 * consistent across every OS and browser, rather than however each
	 * platform's system font happens to render the same codepoint. `char` is
	 * looked up in the shared registry; anything not in it (a hand-typed or
	 * legacy value this app never offered) falls back to the raw character
	 * rather than showing nothing.
	 */
	interface Props {
		char: string;
		size?: number;
		/** Accessible label. Omit for a purely decorative icon. */
		label?: string;
	}

	let { char, size = 16, label }: Props = $props();

	const url = $derived.by(() => {
		const codepoint = openmojiCodepoint(char);
		return codepoint ? urlFor(codepoint) : undefined;
	});
</script>

{#if url}
	<img
		class="bf-emoji"
		src={url}
		alt={label ?? ''}
		aria-hidden={label ? undefined : 'true'}
		width={size}
		height={size}
		draggable="false"
	/>
{:else}
	<span class="bf-emoji-fallback" aria-hidden={label ? undefined : 'true'} style:font-size="{size}px">{char}</span>
{/if}

<style>
	.bf-emoji {
		display: inline-block;
		flex: none;
		vertical-align: -0.15em;
	}

	.bf-emoji-fallback {
		display: inline-block;
		flex: none;
		line-height: 1;
	}
</style>
