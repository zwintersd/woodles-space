<script lang="ts">
	import { tick } from 'svelte';
	import type { ItemAppearance } from './appearance';
	let { id, text, width, appearance, locked, input, pointerdown, resize }: {
		id: string; text: string; width: number; appearance?: ItemAppearance; locked: boolean;
		input: (value: string) => void; pointerdown: (event: PointerEvent) => void; resize: (height: number) => void;
	} = $props();
	let field = $state<HTMLTextAreaElement>();
	$effect(() => {
		text; width; appearance;
		let current = true;
		void tick().then(() => {
			if (!field || !current) return;
			field.style.height = '1px';
			const height = Math.max(32, field.scrollHeight);
			field.style.height = `${height}px`;
			resize(height + 24);
		});
		return () => { current = false; };
	});
</script>

<textarea bind:this={field} id={`lettering-text-${id}`} class="lettering-text" rows="1" aria-label="Lettering text"
	placeholder="A few words…" value={text} readonly={locked} tabindex={locked ? -1 : 0}
	onpointerdown={pointerdown} oninput={(event) => input(event.currentTarget.value)}
	onkeydown={(event) => { if (event.key === 'Escape') event.currentTarget.blur(); }}></textarea>

<style>
	.lettering-text { display: block; box-sizing: border-box; width: 100%; min-height: 32px; margin: 0; padding: 0; border: 0; outline: none; resize: none; background: transparent; color: var(--object-ink, #604c46); font-family: var(--type-family, Georgia, serif); font-size: var(--type-size, 32px); font-weight: var(--type-weight, 400); font-style: var(--type-style, normal); line-height: var(--type-leading, 1.3); text-align: var(--type-align, left); overflow: hidden; user-select: text; overscroll-behavior: contain; }
	.lettering-text::placeholder { color: #a29185; }
	.lettering-text:focus-visible { outline: 1px dashed #a6667080; outline-offset: 4px; border-radius: 3px; }
	.lettering-text { background-image: linear-gradient(transparent 50%, var(--type-highlight, transparent) 50% 90%, transparent 90%); background-size: 100% calc(var(--type-size, 32px) * var(--type-leading, 1.3)); }
</style>
