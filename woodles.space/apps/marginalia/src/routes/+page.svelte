<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { start, stop } from '$lib/state/tick';
	import { game, fmt } from '$lib/state/game.svelte';
	import { exportSave, importSave } from '$lib/state/persist';
	import Canonical from '$lib/components/Canonical.svelte';
	import Feed from '$lib/components/Feed.svelte';
	import ClickRegion from '$lib/components/ClickRegion.svelte';
	import ReadingPass from '$lib/components/rhythm/ReadingPass.svelte';
	import Dispute from '$lib/components/rhythm/Dispute.svelte';
	import ContestedPassage from '$lib/components/rhythm/ContestedPassage.svelte';
	import Recitation from '$lib/components/rhythm/Recitation.svelte';
	import ReadingRoom from '$lib/components/reading/ReadingRoom.svelte';
	import Asides from '$lib/components/Asides.svelte';
	import Whisper from '$lib/components/Whisper.svelte';
	import UpdateModal from '$lib/components/UpdateModal.svelte';
	import GeneratorList from '$lib/components/GeneratorList.svelte';
	import UpgradeShelf from '$lib/components/UpgradeShelf.svelte';
	import PracticeBar from '$lib/components/PracticeBar.svelte';
	import ResourceLine from '$lib/components/ResourceLine.svelte';

	onMount(() => start());
	onDestroy(() => stop());

	let menuOpen = $state(false);
	let importBox = $state('');
	let exportBlob = $state('');

	const canPrestige = $derived(game.canPrestige());
	const pending = $derived(game.pendingPalimpsest);

	// 250ms ticker so the contested-passage cooldown UI updates live.
	let cooldownTick = $state(Date.now());
	$effect(() => {
		const id = setInterval(() => (cooldownTick = Date.now()), 250);
		return () => clearInterval(id);
	});
	const contestedCooldownLeft = $derived.by(() => {
		void cooldownTick;
		return game.contestedCooldownLeftMs();
	});

	function doExport() {
		exportBlob = exportSave(game.toSave());
	}

	function doImport() {
		const s = importSave(importBox);
		if (s) {
			game.fromSave(s);
			game.persist();
			importBox = '';
			exportBlob = '';
			menuOpen = false;
		} else {
			exportBlob = '— could not read that as a save.';
		}
	}

	function doForget() {
		if (!canPrestige) return;
		const ok = confirm(
			`voluntary forgetting will end this run. you will gain ${pending} palimpsest layer${pending === 1 ? '' : 's'}, and the next reader will inherit them. continue?`
		);
		if (ok) game.prestige();
	}

	function doWipe() {
		const ok = confirm('a complete wipe — palimpsest and all. continue?');
		if (ok) game.hardReset();
	}
</script>

<header class="topbar">
	<a class="brand" href="/">✦ marginalia · woodles.space</a>
	<div class="tools">
		<button class="ghost" type="button" onclick={() => (menuOpen = !menuOpen)}
			>{menuOpen ? 'close' : 'menu'}</button
		>
	</div>
</header>

{#if menuOpen}
	<div class="menu">
		<div class="menu-section">
			<h4>about</h4>
			<button
				class="ghost"
				onclick={() => {
					game.openUpdateModal();
					menuOpen = false;
				}}>what's new</button>
		</div>
		<div class="menu-section">
			<h4>save</h4>
			<button class="ghost" onclick={doExport}>export current save</button>
			{#if exportBlob}
				<textarea readonly rows="3">{exportBlob}</textarea>
			{/if}
			<label>
				<span>paste a save to import:</span>
				<textarea bind:value={importBox} rows="3"></textarea>
			</label>
			<button class="ghost" onclick={doImport} disabled={!importBox.trim()}>import</button>
		</div>
		<div class="menu-section danger">
			<h4>danger</h4>
			<button class="ghost danger" onclick={doWipe}>wipe everything</button>
		</div>
	</div>
{/if}

<main>
	<Canonical />

	<section class="reading">
		{#if game.hasUpgrade('reading_pass')}
			<ReadingPass />
		{:else}
			<ClickRegion />
		{/if}
		{#if game.hasUpgrade('dispute')}
			<Dispute />
		{/if}
		{#if game.hasUpgrade('contested_passage')}
			<div class="contested-trigger">
				<button
					class="contested-button"
					type="button"
					disabled={!game.canBeginContestedPassage()}
					onclick={() => game.beginContestedPassage()}
				>
					— begin a contested passage —
				</button>
				{#if contestedCooldownLeft > 0}
					<span class="contested-meta">
						next reading available in
						<span class="num">{Math.ceil(contestedCooldownLeft / 1000)}s</span>
					</span>
				{:else}
					<span class="contested-meta muted">
						a passage is ready. catch the helpful glyphs and dodge the censor's pen.
					</span>
				{/if}
				{#if game.canonicalCitations.length > 0}
					<span class="contested-meta tiny">
						citations gathered: <span class="num">{game.canonicalCitations.length}</span>
					</span>
				{/if}
			</div>
		{/if}
		{#if game.clicksEver >= 8}
			<Asides />
		{/if}
		<ResourceLine />
		<Feed />
	</section>

	{#if game.hasUpgrade('reading_for_stars')}
		<ReadingRoom />
	{/if}

	<hr class="rule" />

	<section class="cols">
		<GeneratorList />
		<div class="col-right">
			<UpgradeShelf />
			<PracticeBar />
		</div>
	</section>

	<hr class="rule" />

	<section class="prestige">
		<h3>voluntary forgetting</h3>
		{#if canPrestige}
			<p class="line">
				your reading has diverged enough to lapse into apocrypha. let it. the next reader will
				inherit <span class="num">{fmt(pending)}</span> further layer{pending === 1 ? '' : 's'} of
				palimpsest.
			</p>
			<button class="forget" onclick={doForget}>— let this lapse —</button>
		{:else}
			<p class="line muted">
				not yet. accumulate recensions until your reading is its own tradition. then forget it.
			</p>
		{/if}
	</section>

	<footer>
		<p>
			a text-based incremental about reading something into existence.
			<a href="/">return to woodles.space ✦</a>
		</p>
	</footer>
</main>

{#if game.contestedActive}
	<ContestedPassage />
{/if}

{#if game.recitationActive}
	<Recitation />
{/if}

{#if game.updateModalOpen}
	<UpdateModal />
{/if}

<Whisper />

<style>
	.topbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.7rem 1.2rem;
		border-bottom: 1px solid var(--rule);
		background: var(--bg);
	}
	.brand {
		font-family: var(--font-ui);
		font-size: 0.78rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--periwinkle);
		text-decoration: none;
	}
	.brand:hover {
		color: var(--leafeon-pink);
	}
	.tools .ghost {
		font-family: var(--font-ui);
		color: var(--periwinkle);
		font-size: 0.78rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}
	.tools .ghost:hover {
		color: var(--cyan);
	}
	.menu {
		max-width: 38rem;
		margin: 0 auto;
		padding: 1rem 1.2rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		border-bottom: 1px solid var(--rule);
	}
	.menu h4 {
		font-family: var(--font-ui);
		text-transform: uppercase;
		letter-spacing: 0.18em;
		font-size: 0.74rem;
		color: var(--periwinkle);
		margin: 0 0 0.5rem;
	}
	.menu-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.menu textarea {
		width: 100%;
		background: var(--panel);
		color: var(--text);
		border: 1px solid var(--rule);
		border-radius: 3px;
		font-family: var(--font-counter);
		font-size: 1rem;
		padding: 0.4rem;
		resize: vertical;
	}
	.menu .ghost {
		font-family: var(--font-ui);
		color: var(--cream);
		text-align: left;
		padding: 0.4rem 0;
	}
	.menu .ghost:hover {
		color: var(--leafeon-pink);
	}
	.menu .ghost.danger {
		color: var(--print-pink);
	}
	main {
		max-width: 60rem;
		margin: 0 auto;
		padding: 0 0 4rem;
	}
	.reading {
		max-width: 44rem;
		margin: 0 auto;
		padding: 0.8rem 0;
	}
	.rule {
		border: 0;
		border-top: 1px solid var(--rule);
		max-width: 56rem;
		margin: 1.5rem auto;
	}
	.cols {
		display: grid;
		grid-template-columns: 1.1fr 1fr;
		gap: 1.2rem;
		max-width: 56rem;
		margin: 0 auto;
	}
	.col-right {
		display: flex;
		flex-direction: column;
		gap: 1.2rem;
	}
	@media (max-width: 760px) {
		.cols {
			grid-template-columns: 1fr;
		}
	}
	.prestige {
		max-width: 44rem;
		margin: 0 auto;
		padding: 0 1rem;
		text-align: center;
	}
	.prestige h3 {
		font-family: var(--font-display);
		color: var(--print-pink);
		font-weight: 400;
		letter-spacing: 0.04em;
		font-size: 1.2rem;
		margin: 0 0 0.4rem;
	}
	.line {
		font-family: var(--font-body);
		color: var(--text);
		max-width: 36rem;
		margin: 0 auto 0.6rem;
	}
	.line.muted {
		color: var(--muted);
		font-style: italic;
	}
	.num {
		font-family: var(--font-counter);
		color: var(--leafeon-pink);
		font-size: 1.05em;
	}
	.forget {
		font-family: var(--font-display);
		font-size: 1.1rem;
		color: var(--cream);
		padding: 0.4rem 0.6rem;
		border: 1px solid var(--rule);
		border-radius: 3px;
		background: var(--panel-accent);
	}
	.forget:hover {
		border-color: var(--print-pink);
		color: var(--print-pink);
	}
	footer {
		margin-top: 3rem;
		padding: 0 1rem;
		text-align: center;
		font-family: var(--font-ui);
		font-size: 0.78rem;
		color: var(--muted);
	}
	footer a {
		color: var(--periwinkle);
	}

	/* ── contested-passage trigger ───────────────────────────────────────── */
	.contested-trigger {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.3rem;
		margin: 0.6rem 0 0.4rem;
	}
	.contested-button {
		font-family: var(--font-display);
		font-size: 1rem;
		color: var(--cream);
		background: var(--panel-accent);
		border: 1px solid var(--rule);
		border-radius: 3px;
		padding: 0.35rem 0.7rem;
	}
	.contested-button:hover:not(:disabled) {
		border-color: var(--leafeon-pink);
		color: var(--leafeon-pink);
	}
	.contested-button:disabled {
		color: var(--muted);
		cursor: not-allowed;
	}
	.contested-meta {
		font-family: var(--font-ui);
		font-size: 0.78rem;
		color: var(--muted);
	}
	.contested-meta.muted {
		font-style: italic;
	}
	.contested-meta.tiny {
		font-size: 0.7rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--rule);
	}
	.contested-meta .num {
		font-family: var(--font-counter);
		color: var(--cyan);
	}

	@media print {
		:global(.marginalia-root) {
			background: var(--cream);
			color: var(--ink);
		}
		main {
			background: var(--cream);
			color: var(--ink);
		}
		.topbar,
		.tools,
		.menu,
		footer,
		.prestige .forget {
			display: none;
		}
	}
</style>
