<script lang="ts">
	import '@shared/homesuiteTheme.css';
	import { onMount } from 'svelte';
	import { entityHref } from '@woodles/app-manifest';
	import { HANDOFF_TARGETS, type HandoffTarget } from '@woodles/handoff';
	import type { Capture } from '@extension/protocol.js';
	import { PanelBridge } from '$lib/bridge.svelte';
	import { GLANCE_KEYS, ago, greeting, readGlance, type Glance } from '$lib/glance';
	import { keep, keepableFromCapture, keepableFromCard, prettyUrl, titleFor, type Keepable } from '$lib/keep';

	/**
	 * `open` names the one thing that was kept, where the receiver can be
	 * opened on it — Thinking About's entry takes the handoff's id, and holds
	 * a link to it until the arrival has landed.
	 */
	const TARGETS: Record<HandoffTarget, { verb: string; place: string; href: string; open?: (id: string) => string }> = {
		write: { verb: 'keep in write', place: 'write', href: '/write' },
		whiteboard: { verb: 'pin to a board', place: 'a board', href: '/whiteboard' },
		'thinking-about': {
			verb: 'add to thinking about',
			place: 'thinking about',
			href: '/thinking-about',
			open: (id) => entityHref('thinking-about', 'entry', id)
		}
	};

	const bridge = new PanelBridge(receive);
	/** Capture ids already kept on this visit, so a redelivery is acknowledged and not re-sent. */
	const handled = new Set<string>();

	let glance = $state<Glance | null>(null);
	let now = $state(new Date());
	let note = $state('');
	let withPage = $state(true);
	let notice = $state<{ text: string; href?: string; tone: 'kept' | 'trouble' } | null>(null);

	let attached = $derived(withPage && bridge.inPanel ? bridge.page : null);
	let ready = $derived(keepableFromCard(note, attached) !== null);
	let newTab = $derived(bridge.inPanel ? '_blank' : undefined);
	let waitingTotal = $derived(glance ? Object.values(glance.waiting).reduce((sum, n) => sum + n, 0) : 0);

	// A new page beside the panel is offered fresh, even if the last one was set aside.
	$effect(() => {
		void bridge.page?.url;
		withPage = true;
	});

	function refresh() {
		glance = readGlance();
	}

	function announce(item: Keepable, target: HandoffTarget, ok: boolean, id?: string) {
		const { place, href, open } = TARGETS[target];
		notice = ok
			? {
					text: `kept “${shorten(titleFor(item))}” for ${place}. it’ll be waiting when you open it.`,
					href: open && id ? open(id) : href,
					tone: 'kept'
				}
			: { text: 'couldn’t keep that — this browser’s storage refused it. nothing was lost from the page.', tone: 'trouble' };
	}

	/** A capture from the page menu: kept straight away, the menu item already said where. */
	function receive(capture: Capture): boolean {
		if (handled.has(capture.id)) return true;
		const item = keepableFromCapture(capture);
		const result = keep(item, capture.target, { id: capture.id });
		if (result.ok) handled.add(capture.id);
		if (!result.duplicate) announce(item, capture.target, result.ok, capture.id);
		refresh();
		return result.ok;
	}

	function keepCard(target: HandoffTarget) {
		const item = keepableFromCard(note, attached);
		if (!item) return;
		const result = keep(item, target);
		announce(item, target, result.ok, result.duplicate ? undefined : result.handoff.id);
		if (result.ok) note = '';
		refresh();
	}

	function shorten(text: string): string {
		return text.length > 48 ? text.slice(0, 47) + '…' : text;
	}

	function hostOf(url: string): string {
		return prettyUrl(url).split('/')[0];
	}

	const KIND_LABEL: Record<string, string> = { document: 'document', board: 'board', collection: 'collection' };

	onMount(() => {
		refresh();
		const stop = bridge.start();
		const clock = setInterval(() => (now = new Date()), 30_000);
		// The queues drain, HomeSuite republishes, landing mints — all in other tabs.
		const onStorage = (event: StorageEvent) => {
			if (event.key === null || GLANCE_KEYS.includes(event.key)) refresh();
		};
		const onFocus = () => refresh();
		window.addEventListener('storage', onStorage);
		window.addEventListener('focus', onFocus);
		return () => {
			stop();
			clearInterval(clock);
			window.removeEventListener('storage', onStorage);
			window.removeEventListener('focus', onFocus);
		};
	});
</script>

<svelte:head>
	<title>companion — woodles.space</title>
</svelte:head>

<main class="companion" class:in-panel={bridge.inPanel}>
	<header class="top">
		<span class="tile" aria-hidden="true">
			<svg viewBox="0 0 24 24"><path d="M12 3.5l1.9 6.6 6.6 1.9-6.6 1.9-1.9 6.6-1.9-6.6-6.6-1.9 6.6-1.9z" /></svg>
		</span>
		<div>
			<h1>{greeting(now.getHours())}.</h1>
			<p class="when">
				{now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
				· {now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
			</p>
		</div>
	</header>

	<section class="card keep" aria-labelledby="keep-heading">
		<h2 id="keep-heading">keep</h2>

		{#if bridge.inPanel && bridge.page}
			{#if withPage}
				<div class="page-chip">
					<span class="page-initial" aria-hidden="true">{hostOf(bridge.page.url).slice(0, 1)}</span>
					<span class="page-text">
						<span class="page-title">{bridge.page.title}</span>
						<span class="page-host">{hostOf(bridge.page.url)}</span>
					</span>
					<button type="button" class="quiet" onclick={() => (withPage = false)} aria-label="Keep without this page">×</button>
				</div>
			{:else}
				<button type="button" class="link-button" onclick={() => (withPage = true)}>
					+ with {shorten(bridge.page.title)}
				</button>
			{/if}
		{/if}

		<label class="sr-only" for="keep-note">{attached ? 'a line about this page' : 'a thought to keep'}</label>
		<textarea
			id="keep-note"
			bind:value={note}
			rows="3"
			placeholder={attached ? 'a line about why — or leave it blank' : 'a thought, before it goes'}
		></textarea>

		<div class="actions">
			{#each HANDOFF_TARGETS as target, i (target)}
				<button type="button" class:primary={i === 0} disabled={!ready} onclick={() => keepCard(target)}>{TARGETS[target].verb}</button>
			{/each}
		</div>

		{#if notice}
			<p class="notice" class:trouble={notice.tone === 'trouble'} role="status">
				{notice.text}
				{#if notice.href}<a href={notice.href} target={newTab} rel="noopener">open it</a>{/if}
			</p>
		{/if}

		{#if bridge.inPanel}
			<p class="hint">or right-click anything on a page — a line, a link, an image — and keep it from there.</p>
		{/if}
	</section>

	{#if glance}
		<section class="card" aria-labelledby="waiting-heading">
			<h2 id="waiting-heading">waiting</h2>
			{#if waitingTotal === 0}
				<p class="empty">nothing waiting. everything kept has been filed.</p>
			{:else}
				<ul class="rows">
					{#each Object.entries(TARGETS) as [target, { place, href }] (target)}
						{@const count = glance.waiting[target as HandoffTarget]}
						{#if count > 0}
							<li>
								<a class="row" {href} target={newTab} rel="noopener">
									<span class="count">{count}</span>
									<span>for {place}</span>
									<span class="go" aria-hidden="true">→</span>
								</a>
							</li>
						{/if}
					{/each}
				</ul>
				<p class="hint">they’re filed the next time you open each one.</p>
			{/if}
		</section>

		<section class="card" aria-labelledby="lately-heading">
			<h2 id="lately-heading">lately</h2>
			{#if glance.recent && glance.recent.items.length > 0}
				<ul class="rows">
					{#each glance.recent.items as item (item.href)}
						<li>
							<a class="row" href={item.href} target={newTab} rel="noopener">
								<span class="kind kind-{item.kind}">{KIND_LABEL[item.kind] ?? item.kind}</span>
								<span class="row-title">{item.title}</span>
								<span class="row-when">{ago(item.updatedAt, now)}</span>
							</a>
						</li>
					{/each}
				</ul>
				{#if glance.recent.publishedAt}
					<p class="hint">as HomeSuite last saw it, {ago(glance.recent.publishedAt, now)}.</p>
				{/if}
			{:else}
				<p class="empty">
					open <a href="/homesuite" target={newTab} rel="noopener">HomeSuite</a> once, and the last few
					things you touched will sit here.
				</p>
			{/if}
		</section>

		<section class="card" aria-labelledby="life-heading">
			<h2 id="life-heading">life points</h2>
			{#if glance.life}
				<p class="life">
					<span class="life-n">{glance.life.balance}</span>
					<span class="life-rank">{glance.life.rank}</span>
				</p>
				{#if glance.life.next}
					<div class="track" aria-hidden="true"><span style="width: {Math.round(glance.life.progress * 100)}%"></span></div>
					<p class="hint">{glance.life.next.at - glance.life.earned} more to {glance.life.next.name}.</p>
				{/if}
			{:else}
				<p class="empty">none yet. they’re earned by being away — a point for every whole minute.</p>
			{/if}
			<a class="step-away" href="/" target={newTab} rel="noopener">step away for a bit →</a>
		</section>
	{/if}

	<footer class="foot">
		{#if bridge.version}
			<p>woodles for Chrome {bridge.version} · everything here stays in this browser.</p>
		{:else if !bridge.inPanel}
			<p>
				this page is made to sit in Chrome’s side panel, beside whatever you’re reading. load
				<code>apps/companion/extension</code> as an unpacked extension to put it there.
			</p>
		{/if}
	</footer>
</main>

<style>
	:global(body) {
		margin: 0;
		background: var(--hs-page);
		color: var(--hs-ink);
		font-family: var(--font-sans);
	}

	.companion {
		box-sizing: border-box;
		max-width: 520px;
		margin: 0 auto;
		padding: 20px 16px 28px;
		display: grid;
		gap: 14px;
	}

	.in-panel {
		padding-top: 16px;
	}

	.top {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.tile {
		flex: none;
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: 12px;
		background: linear-gradient(140deg, var(--lavender, #c9bfee), var(--peach, #f5c8a8));
	}

	.tile svg {
		width: 22px;
		height: 22px;
		fill: #fffaf6;
	}

	h1 {
		margin: 0;
		font: 400 1.45rem/1.15 var(--font-optical);
		color: var(--hs-ink);
	}

	.when {
		margin: 2px 0 0;
		font-size: 0.8rem;
		color: var(--hs-muted);
	}

	.card {
		background: var(--hs-raised);
		border: 1px solid var(--hs-line);
		border-radius: 14px;
		padding: 14px;
		display: grid;
		gap: 10px;
		min-width: 0;
	}

	h2 {
		margin: 0;
		font: 600 0.72rem/1 var(--font-sans);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--hs-muted);
	}

	.page-chip {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 8px 8px 10px;
		border-radius: 10px;
		background: var(--hs-sunk);
		min-width: 0;
	}

	.page-initial {
		flex: none;
		display: grid;
		place-items: center;
		width: 26px;
		height: 26px;
		border-radius: 8px;
		background: var(--hs-accent-soft);
		color: var(--hs-accent-text);
		font: 600 0.8rem/1 var(--font-sans);
		text-transform: uppercase;
	}

	.page-text {
		display: grid;
		min-width: 0;
		flex: 1;
	}

	.page-title,
	.row-title {
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.page-title {
		font-size: 0.88rem;
		color: var(--hs-ink);
	}

	.page-host {
		font-size: 0.74rem;
		color: var(--hs-muted);
	}

	textarea {
		box-sizing: border-box;
		width: 100%;
		resize: vertical;
		min-height: 64px;
		padding: 9px 10px;
		border: 1px solid var(--hs-line);
		border-radius: 10px;
		background: var(--hs-field);
		color: var(--hs-ink);
		font: 0.92rem/1.45 var(--font-body);
	}

	textarea::placeholder {
		color: var(--hs-muted);
		font-style: italic;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	button {
		padding: 8px 14px;
		border: 1px solid var(--hs-line-strong);
		border-radius: 999px;
		background: var(--hs-raised);
		color: var(--hs-ink-soft);
		font: 500 0.84rem/1 var(--font-sans);
		cursor: pointer;
	}

	button:hover:not(:disabled) {
		background: var(--hs-hover);
	}

	button.primary {
		background: var(--hs-accent);
		border-color: var(--hs-accent);
		color: var(--hs-on-accent);
	}

	button.primary:hover:not(:disabled) {
		background: var(--hs-accent-hover);
	}

	button:disabled {
		opacity: 0.5;
		cursor: default;
	}

	button.quiet {
		flex: none;
		padding: 4px 9px;
		border: 0;
		background: transparent;
		font-size: 1.05rem;
		color: var(--hs-muted);
	}

	.link-button {
		justify-self: start;
		padding: 0;
		border: 0;
		background: none;
		color: var(--hs-accent-text);
		font-size: 0.82rem;
	}

	.link-button:hover:not(:disabled) {
		background: none;
		text-decoration: underline;
	}

	:is(button, a, textarea):focus-visible {
		outline: 2px solid var(--hs-focus);
		outline-offset: 2px;
	}

	.notice {
		margin: 0;
		padding: 9px 11px;
		border-radius: 10px;
		background: var(--hs-info-bg);
		color: var(--hs-info-ink);
		font-size: 0.84rem;
		line-height: 1.45;
	}

	.notice.trouble {
		background: var(--hs-danger-bg);
		color: var(--hs-danger-ink);
	}

	.notice a {
		color: inherit;
		font-weight: 600;
	}

	.hint,
	.empty {
		margin: 0;
		font-size: 0.8rem;
		line-height: 1.45;
		color: var(--hs-muted);
	}

	.empty {
		font-family: var(--font-body);
		font-style: italic;
		font-size: 0.86rem;
		color: var(--hs-ink-soft);
	}

	a {
		color: var(--hs-accent-text);
	}

	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 2px;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 7px 8px;
		margin: 0 -8px;
		border-radius: 8px;
		color: var(--hs-ink);
		text-decoration: none;
		font-size: 0.88rem;
		min-width: 0;
	}

	.row:hover {
		background: var(--hs-hover);
	}

	.row-title {
		flex: 1;
		min-width: 0;
	}

	.row-when {
		flex: none;
		font-size: 0.74rem;
		color: var(--hs-muted);
	}

	.count {
		min-width: 1.6em;
		padding: 3px 6px;
		border-radius: 999px;
		background: var(--hs-accent-soft);
		color: var(--hs-accent-text);
		font: 600 0.78rem/1 var(--font-sans);
		text-align: center;
	}

	.go {
		margin-left: auto;
		color: var(--hs-muted);
	}

	.kind {
		flex: none;
		padding: 3px 7px;
		border-radius: 6px;
		font-size: 0.68rem;
		font-weight: 600;
	}

	.kind-document {
		background: var(--hs-document-bg);
		color: var(--hs-document-ink);
	}

	.kind-board {
		background: var(--hs-board-bg);
		color: var(--hs-board-ink);
	}

	.kind-collection {
		background: var(--hs-collection-bg);
		color: var(--hs-collection-ink);
	}

	.life {
		margin: 0;
		display: flex;
		align-items: baseline;
		gap: 10px;
	}

	.life-n {
		font: 400 2rem/1 var(--font-optical);
		color: var(--hs-ink);
	}

	.life-rank {
		font: italic 0.95rem/1 var(--font-body);
		color: var(--hs-ink-soft);
	}

	.track {
		height: 6px;
		border-radius: 999px;
		background: var(--hs-sunk);
		overflow: hidden;
	}

	.track span {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: var(--hs-accent-light);
	}

	.step-away {
		justify-self: start;
		font-size: 0.86rem;
		text-decoration: none;
	}

	.step-away:hover {
		text-decoration: underline;
	}

	.foot p {
		margin: 0;
		font-size: 0.76rem;
		line-height: 1.5;
		color: var(--hs-muted);
		text-align: center;
	}

	code {
		font: 0.74rem var(--font-mono);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
</style>
