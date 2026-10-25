<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { normalizeLinkUrl, type BlockKind } from './formatting';

	// Write's own menu for its prose — what a right-click in the writing opens,
	// in place of the browser's. Formatting first: the character styles, then
	// the paragraph styles, then links, then the clipboard the browser's menu
	// would have offered. It owns none of the edits; it says which one was
	// picked, and the page applies it to the selection it remembered.

	export type FormatAction =
		| 'bold' | 'italic' | 'underline' | 'strike' | 'highlight' | 'block'
		| 'link' | 'link:open' | 'link:remove' | 'ref:open' | 'ref:remove'
		| 'clear' | 'cut' | 'copy' | 'paste' | 'paste-plain' | 'margin-note';

	export type FormatState = {
		bold: boolean;
		italic: boolean;
		underline: boolean;
		strike: boolean;
		highlight: boolean;
		/** The paragraph style every touched line shares, or null when they differ. */
		block: BlockKind | null;
		collapsed: boolean;
		/** The selected words, shortened — what the menu is about to act on. */
		excerpt: string;
		link: { href: string } | null;
		/** `canOpen` is false for a reference whose app no longer says where it lives. */
		reference: { label: string; canOpen: boolean } | null;
		canLink: boolean;
		canMarginNote: boolean;
	};

	let {
		x,
		y,
		avoid = null,
		keyboard,
		format,
		onAction,
		onClose
	}: {
		x: number;
		y: number;
		/** The line being formatted: the menu opens just below it, or above, rather than over it. */
		avoid?: { top: number; bottom: number } | null;
		/** Opened from the keyboard, so the first item takes focus rather than the menu. */
		keyboard: boolean;
		format: FormatState;
		onAction: (action: FormatAction, value?: string) => void;
		/** `restore` puts the caret and selection back where they were. */
		onClose: (restore: boolean) => void;
	} = $props();

	type InlineKey = 'bold' | 'italic' | 'underline' | 'strike' | 'highlight';

	const mac = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
	const keys = (key: string, shift = false) => (mac ? `${shift ? '⇧' : ''}⌘${key}` : `Ctrl+${shift ? 'Shift+' : ''}${key}`);

	const INLINE: { key: InlineKey; label: string; shortcut?: string }[] = [
		{ key: 'bold', label: 'bold', shortcut: keys('B') },
		{ key: 'italic', label: 'italic', shortcut: keys('I') },
		{ key: 'underline', label: 'underline', shortcut: keys('U') },
		{ key: 'strike', label: 'strikethrough' },
		{ key: 'highlight', label: 'highlight' }
	];
	// Same glyphs as the toolbar above the page, so the two read as one set.
	const BLOCKS: { kind: BlockKind; label: string; glyph: string }[] = [
		{ kind: 'p', label: 'text', glyph: '¶' },
		{ kind: 'h1', label: 'heading', glyph: 'H1' },
		{ kind: 'h2', label: 'subheading', glyph: 'H2' },
		{ kind: 'blockquote', label: 'quote', glyph: '❝' },
		{ kind: 'ul', label: 'bulleted list', glyph: '· —' },
		{ kind: 'ol', label: 'numbered list', glyph: '1.' }
	];

	let menu: HTMLDivElement;
	let urlInput: HTMLInputElement | undefined = $state();
	let left = $state(0);
	let top = $state(0);
	let flipX = $state(false);
	let flipY = $state(false);
	let pointing = $state<string | null>(null);
	let linking = $state(false);
	let url = $state('');
	let invalid = $state(false);

	const blockLabel = $derived(BLOCKS.find((block) => block.kind === format.block)?.label ?? 'mixed styles');

	function point(label: string, shortcut?: string) {
		pointing = shortcut ? `${label} · ${shortcut}` : label;
	}

	// Opens toward the room it has: below and right of the pointer, flipping
	// up or left near an edge, the way a native menu does — and never over
	// the line it is about to format.
	function fit() {
		// Layout size, not the bounding box — the opening animation scales it.
		const width = menu.offsetWidth;
		const height = menu.offsetHeight;
		const floor = window.innerHeight - 8;
		const below = avoid ? avoid.bottom + 4 : y;
		const above = avoid ? avoid.top - 4 : y;
		flipX = x + width + 8 > window.innerWidth;
		left = Math.max(8, flipX ? x - width : x);
		flipY = below + height > floor && above - height >= 8;
		top = flipY ? above - height : Math.max(8, Math.min(below, floor - height));
	}

	function options(): HTMLButtonElement[] {
		return [...menu.querySelectorAll<HTMLButtonElement>('button[data-nav]:not(:disabled)')];
	}

	// The two style rows move left and right; every other item is a row of its own.
	function rows(): HTMLButtonElement[][] {
		const out: HTMLButtonElement[][] = [];
		let previous = '';
		for (const option of options()) {
			const row = option.dataset.row ?? '';
			if (row && row === previous) out[out.length - 1].push(option);
			else out.push([option]);
			previous = row;
		}
		return out;
	}

	function move(key: string) {
		const grid = rows();
		const flat = grid.flat();
		if (!flat.length) return;
		const r = grid.findIndex((row) => row.includes(document.activeElement as HTMLButtonElement));
		const c = r >= 0 ? grid[r].indexOf(document.activeElement as HTMLButtonElement) : 0;
		let target: HTMLButtonElement | undefined;
		if (key === 'Home') target = flat[0];
		else if (key === 'End') target = flat[flat.length - 1];
		else if (r < 0) target = key === 'ArrowUp' ? flat[flat.length - 1] : flat[0];
		else if (key === 'ArrowDown' || key === 'ArrowUp') {
			const next = grid[(r + (key === 'ArrowDown' ? 1 : -1) + grid.length) % grid.length];
			target = next[Math.min(c, next.length - 1)];
		} else {
			const row = grid[r];
			target = row[(c + (key === 'ArrowRight' ? 1 : -1) + row.length) % row.length];
		}
		target?.focus();
	}

	function keydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			if (linking) void closeLink();
			else onClose(true);
			return;
		}
		if (linking) return;
		if (event.key === 'Tab') {
			event.preventDefault();
			onClose(true);
			return;
		}
		if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
			event.preventDefault();
			event.stopPropagation();
			move(event.key);
		}
	}

	async function openLink() {
		url = format.link?.href ?? '';
		invalid = false;
		linking = true;
		pointing = null;
		await tick();
		fit();
		urlInput?.focus();
		urlInput?.select();
	}

	async function closeLink() {
		linking = false;
		await tick();
		fit();
		menu.querySelector<HTMLButtonElement>('[data-link]')?.focus();
	}

	function submitLink(event: SubmitEvent) {
		event.preventDefault();
		if (!url.trim() && format.link) {
			onAction('link:remove');
			return;
		}
		if (!normalizeLinkUrl(url)) {
			invalid = true;
			urlInput?.focus();
			return;
		}
		onAction('link', url);
	}

	onMount(() => {
		fit();
		if (keyboard) options()[0]?.focus({ preventScroll: true });
		else menu.focus({ preventScroll: true });
		const outside = (event: PointerEvent) => {
			if (!menu.contains(event.target as Node)) onClose(false);
		};
		const dismiss = () => onClose(false);
		const scroll = (event: Event) => {
			if (!menu.contains(event.target as Node)) onClose(false);
		};
		window.addEventListener('pointerdown', outside, true);
		window.addEventListener('blur', dismiss);
		window.addEventListener('resize', dismiss);
		window.addEventListener('scroll', scroll, true);
		return () => {
			window.removeEventListener('pointerdown', outside, true);
			window.removeEventListener('blur', dismiss);
			window.removeEventListener('resize', dismiss);
			window.removeEventListener('scroll', scroll, true);
		};
	});
</script>

{#snippet glyph(key: InlineKey)}
	{#if key === 'bold'}<b>B</b>
	{:else if key === 'italic'}<i>I</i>
	{:else if key === 'underline'}<u>U</u>
	{:else if key === 'strike'}<s>S</s>
	{:else}<span class="swatch">a</span>
	{/if}
{/snippet}

<div
	class="format-menu"
	class:flip-x={flipX}
	class:flip-y={flipY}
	bind:this={menu}
	role={linking ? 'dialog' : 'menu'}
	aria-label={linking ? 'link' : 'format text'}
	aria-describedby={linking ? undefined : 'format-menu-hint'}
	tabindex="-1"
	style:left="{left}px"
	style:top="{top}px"
	onkeydown={keydown}
	onfocusout={(event) => {
		// Tabbing on past the link field leaves the menu behind; close it rather than strand it.
		const next = event.relatedTarget as Node | null;
		if (linking && next && !menu.contains(next)) onClose(false);
	}}
	oncontextmenu={(event) => event.preventDefault()}
	data-testid="format-menu"
>
	{#if linking}
		<form class="link-form" onsubmit={submitLink}>
			<label class="link-label" for="format-menu-url">{format.link ? 'edit link' : 'link to'}</label>
			<input
				id="format-menu-url"
				class="link-input"
				bind:this={urlInput}
				bind:value={url}
				oninput={() => (invalid = false)}
				type="text"
				inputmode="url"
				placeholder="example.com"
				autocomplete="off"
				spellcheck="false"
				aria-invalid={invalid ? 'true' : 'false'}
				aria-describedby={invalid ? 'format-menu-url-error' : undefined}
			/>
			{#if invalid}
				<p class="link-error" id="format-menu-url-error">a web or email address, like example.com</p>
			{/if}
			<div class="link-actions">
				<button type="button" class="link-back" onclick={closeLink}>back</button>
				<button type="submit" class="link-apply">{format.link ? 'update' : 'apply'}</button>
			</div>
		</form>
	{:else}
		<div class="row inline" role="group" aria-label="character style">
			{#each INLINE as item (item.key)}
				<button
					type="button"
					role="menuitemcheckbox"
					class="glyph"
					class:on={format[item.key]}
					aria-checked={format[item.key] ? 'true' : 'false'}
					aria-label={item.label}
					disabled={item.key === 'highlight' && format.collapsed}
					data-nav
					data-row="inline"
					onclick={() => onAction(item.key)}
					onpointerenter={() => point(item.label, item.shortcut)}
					onpointerleave={() => (pointing = null)}
					onfocus={() => point(item.label, item.shortcut)}
					onblur={() => (pointing = null)}
				>
					{@render glyph(item.key)}
				</button>
			{/each}
		</div>
		<div class="row blocks" role="group" aria-label="paragraph style">
			{#each BLOCKS as block (block.kind)}
				<button
					type="button"
					role="menuitemradio"
					class="glyph block"
					class:on={format.block === block.kind}
					aria-checked={format.block === block.kind ? 'true' : 'false'}
					aria-label={block.label}
					data-nav
					data-row="blocks"
					onclick={() => onAction('block', block.kind)}
					onpointerenter={() => point(block.label)}
					onpointerleave={() => (pointing = null)}
					onfocus={() => point(block.label)}
					onblur={() => (pointing = null)}
				>
					{block.glyph}
				</button>
			{/each}
		</div>
		<p class="caption" aria-hidden="true">
			{#if pointing}
				{pointing}
			{:else if format.excerpt}
				<span class="caption-excerpt">“{format.excerpt}”</span>
			{:else}
				at the caret · {blockLabel}
			{/if}
		</p>

		<div class="divider" role="separator"></div>
		{#if format.reference}
			<button type="button" role="menuitem" class="item" data-nav disabled={!format.reference.canOpen} onclick={() => onAction('ref:open')}>
				<span class="item-label">open <em>{format.reference.label}</em></span>
				<span class="item-key" aria-hidden="true">↗</span>
			</button>
			<button type="button" role="menuitem" class="item" data-nav onclick={() => onAction('ref:remove')}>
				<span class="item-label">remove reference</span>
				<span class="item-key">keeps the words</span>
			</button>
		{:else if format.link}
			<button type="button" role="menuitem" class="item" data-nav data-link onclick={openLink}>
				<span class="item-label">edit link…</span>
			</button>
			<button type="button" role="menuitem" class="item" data-nav onclick={() => onAction('link:open')}>
				<span class="item-label">open link</span>
				<span class="item-key" aria-hidden="true">↗</span>
			</button>
			<button type="button" role="menuitem" class="item" data-nav onclick={() => onAction('link:remove')}>
				<span class="item-label">remove link</span>
			</button>
		{:else}
			<button type="button" role="menuitem" class="item" data-nav data-link disabled={!format.canLink} onclick={openLink}>
				<span class="item-label">link…</span>
			</button>
		{/if}
		<button type="button" role="menuitem" class="item" data-nav disabled={format.collapsed} onclick={() => onAction('clear')}>
			<span class="item-label">clear formatting</span>
		</button>

		<div class="divider" role="separator"></div>
		<button type="button" role="menuitem" class="item" data-nav disabled={format.collapsed} onclick={() => onAction('cut')}>
			<span class="item-label">cut</span><span class="item-key">{keys('X')}</span>
		</button>
		<button type="button" role="menuitem" class="item" data-nav disabled={format.collapsed} onclick={() => onAction('copy')}>
			<span class="item-label">copy</span><span class="item-key">{keys('C')}</span>
		</button>
		<button type="button" role="menuitem" class="item" data-nav onclick={() => onAction('paste')}>
			<span class="item-label">paste</span><span class="item-key">{keys('V')}</span>
		</button>
		<button type="button" role="menuitem" class="item" data-nav onclick={() => onAction('paste-plain')}>
			<span class="item-label">paste as plain text</span><span class="item-key">{keys('V', true)}</span>
		</button>

		{#if format.canMarginNote}
			<div class="divider" role="separator"></div>
			<button type="button" role="menuitem" class="item" data-nav onclick={() => onAction('margin-note')}>
				<span class="item-label">+ margin note</span>
			</button>
		{/if}

		<p class="hint" id="format-menu-hint">⇧ right-click · spelling &amp; browser menu</p>
	{/if}
</div>

<style>
	.format-menu {
		position: fixed;
		z-index: 90;
		width: 15.5rem;
		max-width: calc(100vw - 16px);
		max-height: calc(100dvh - 16px);
		overflow-y: auto;
		padding: 0.4rem;
		border-radius: 0.8rem;
		border: 1px solid color-mix(in srgb, var(--rule) 85%, transparent);
		/* --surface is translucent in every palette; laid over --bg it reads as
		   raised paper instead of letting the prose show through */
		background: linear-gradient(var(--surface), var(--surface)) var(--bg);
		color: var(--text);
		font-family: var(--editor-mono, var(--font-mono));
		font-weight: 400;
		box-shadow:
			0 1.2rem 2.6rem -1rem color-mix(in srgb, var(--accent-deep) 45%, transparent),
			0 0.2rem 0.6rem rgba(0, 0, 0, 0.08);
		outline: none;
		transform-origin: top left;
		animation: format-menu-rise 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	.format-menu.flip-x { transform-origin: top right; }
	.format-menu.flip-y { transform-origin: bottom left; }
	.format-menu.flip-x.flip-y { transform-origin: bottom right; }
	@keyframes format-menu-rise {
		from { opacity: 0; transform: translateY(3px) scale(0.97); }
		to { opacity: 1; transform: none; }
	}
	@media (prefers-reduced-motion: reduce) {
		.format-menu { animation: none; }
	}
	:global(body.calm-motion) .format-menu { animation: none; }

	/* ── the two style rows ── */
	.row { display: grid; gap: 2px; }
	.row.inline { grid-template-columns: repeat(5, 1fr); }
	.row.blocks { grid-template-columns: repeat(6, 1fr); margin-top: 2px; }
	.glyph {
		height: 2.05rem;
		min-width: 0;
		display: grid;
		place-items: center;
		border: 1px solid transparent;
		border-radius: 0.45rem;
		background: none;
		color: var(--muted);
		font-family: var(--editor-body, var(--font-body));
		font-size: 0.95rem;
		line-height: 1;
		cursor: pointer;
		transition: background 0.14s ease, color 0.14s ease, border-color 0.14s ease;
	}
	.glyph.block {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.6rem;
		letter-spacing: 0.05em;
	}
	.glyph b { font-weight: 700; }
	.glyph u { text-underline-offset: 0.18em; }
	.glyph s { text-decoration-thickness: 0.08em; }
	.swatch {
		padding: 0.05em 0.3em 0.12em;
		border-radius: 0.2em;
		background: color-mix(in srgb, var(--accent) 50%, transparent);
		color: var(--text);
	}
	.glyph:hover:not(:disabled),
	.glyph:focus-visible {
		background: color-mix(in srgb, var(--accent) 20%, transparent);
		color: var(--accent-strong);
	}
	.glyph.on {
		background: color-mix(in srgb, var(--accent) 30%, transparent);
		border-color: color-mix(in srgb, var(--accent) 50%, transparent);
		color: var(--accent-strong);
	}
	.glyph:disabled { opacity: 0.35; cursor: default; }

	/* what the menu is about to act on, or what's under the pointer */
	.caption {
		min-height: 1.7rem;
		padding: 0.4rem 0.5rem 0.1rem;
		font-size: 0.56rem;
		letter-spacing: 0.08em;
		color: var(--muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.caption-excerpt {
		font-family: var(--editor-display, var(--font-display));
		font-style: italic;
		font-size: 0.82rem;
		letter-spacing: 0;
		color: var(--accent-strong);
	}

	.divider {
		height: 1px;
		margin: 0.3rem 0.35rem;
		background: color-mix(in srgb, var(--rule) 70%, transparent);
	}

	/* ── the list ── */
	.item {
		width: 100%;
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.42rem 0.55rem;
		border: 0;
		border-radius: 0.45rem;
		background: none;
		color: var(--text);
		font: inherit;
		font-size: 0.64rem;
		letter-spacing: 0.04em;
		text-align: left;
		cursor: pointer;
		transition: background 0.14s ease, color 0.14s ease;
	}
	.item:hover:not(:disabled),
	.item:focus-visible {
		background: color-mix(in srgb, var(--accent) 18%, transparent);
		color: var(--accent-strong);
	}
	.item:disabled { opacity: 0.38; cursor: default; }
	.item-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.item-label em {
		font-family: var(--editor-display, var(--font-display));
		font-style: italic;
		font-size: 0.8rem;
		letter-spacing: 0;
	}
	.item-key {
		flex: none;
		font-size: 0.56rem;
		letter-spacing: 0.06em;
		color: var(--muted);
	}
	.glyph:focus-visible,
	.item:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
	}

	.hint {
		margin: 0.3rem 0.2rem 0;
		padding: 0.45rem 0.35rem 0.15rem;
		border-top: 1px solid color-mix(in srgb, var(--rule) 50%, transparent);
		font-size: 0.52rem;
		letter-spacing: 0.03em;
		color: var(--muted);
		text-wrap: balance;
	}

	/* ── the link field ── */
	.link-form { display: grid; gap: 0.45rem; padding: 0.35rem 0.4rem 0.3rem; }
	.link-label {
		font-size: 0.52rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--muted);
	}
	.link-input {
		width: 100%;
		padding: 0.3rem 0.1rem;
		border: 0;
		border-bottom: 1px solid var(--accent);
		background: transparent;
		color: var(--text);
		font-family: var(--editor-body, var(--font-body));
		font-size: 0.9rem;
		outline: none;
		caret-color: var(--accent-deep);
	}
	.link-input:focus { border-bottom-color: var(--accent-strong); }
	.link-input[aria-invalid='true'] { border-bottom-color: #b5604e; }
	.link-error { font-size: 0.56rem; letter-spacing: 0.04em; color: #a3503f; }
	.link-actions { display: flex; justify-content: flex-end; gap: 0.35rem; margin-top: 0.15rem; }
	.link-actions button {
		padding: 0.32rem 0.75rem;
		border-radius: 100px;
		border: 1px solid color-mix(in srgb, var(--rule) 85%, transparent);
		background: none;
		color: var(--muted);
		font: inherit;
		font-size: 0.6rem;
		letter-spacing: 0.06em;
		cursor: pointer;
	}
	.link-actions .link-apply {
		border-color: transparent;
		background: var(--accent-strong);
		color: var(--bg);
	}
	.link-actions button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

	@media (pointer: coarse) {
		.glyph, .item { min-height: 44px; }
	}
</style>
