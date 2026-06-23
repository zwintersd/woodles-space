<script lang="ts">
	import { onMount } from 'svelte';
	import { book } from '$lib/witch/book.svelte';
	import MiniHex from '$lib/witch/MiniHex.svelte';
	import type { BestiaryCreature } from '$lib/witch/bestiaryDb';

	type PetView = 'card' | 'hex';

	const PET_KEY = 'marginalia.arcade.activePet.v1';
	const VIEW_KEY = 'marginalia.arcade.petView.v1';

	let selectedId = $state<string | null>(null);
	let view = $state<PetView>('hex');

	const creatures = $derived(book.bestiaryCreatures.filter((c) => c.isolatedSprite ?? c.sprite));
	const selected = $derived<BestiaryCreature | null>(
		creatures.find((c) => c.id === selectedId) ?? creatures[0] ?? null
	);
	const artSrc = $derived(selected?.sprite ?? selected?.isolatedSprite ?? null);
	const kind = $derived(field(selected, 'kind') || 'Companion');
	const cost = $derived(field(selected, 'cost'));
	const power = $derived(field(selected, 'power'));
	const toughness = $derived(field(selected, 'toughness'));
	const abilities = $derived(field(selected, 'abilities'));
	const flavor = $derived(field(selected, 'flavor'));
	const foundIn = $derived(field(selected, 'foundIn'));

	function field(creature: BestiaryCreature | null, key: string): string {
		const value = (creature as Record<string, unknown> | null)?.[key];
		return value === null || value === undefined ? '' : String(value);
	}

	function persistSelection(id: string) {
		selectedId = id;
		localStorage.setItem(PET_KEY, id);
	}

	function setView(next: PetView) {
		view = next;
		localStorage.setItem(VIEW_KEY, next);
	}

	onMount(() => {
		selectedId = localStorage.getItem(PET_KEY);
		const storedView = localStorage.getItem(VIEW_KEY);
		if (storedView === 'card' || storedView === 'hex') view = storedView;
	});
</script>

<aside class="pet-panel" aria-label="active pet">
	<header class="pet-head">
		<p>active pet</p>
		<h2>{selected?.name || 'no pet yet'}</h2>
	</header>

	{#if creatures.length > 0}
		<label class="pet-select">
			<span>choose companion</span>
			<select
				value={selected?.id ?? ''}
				onchange={(event) => persistSelection((event.target as HTMLSelectElement).value)}
			>
				{#each creatures as creature (creature.id)}
					<option value={creature.id}>{creature.name || '(unnamed)'}</option>
				{/each}
			</select>
		</label>

		<div class="view-toggle" aria-label="pet display mode">
			<button class:active={view === 'hex'} onclick={() => setView('hex')}>hex</button>
			<button class:active={view === 'card'} onclick={() => setView('card')}>card</button>
		</div>

		<div class="pet-stage mode-{view}">
			{#if view === 'hex'}
				<div class="hex-stand">
					<MiniHex creature={selected} />
				</div>
			{:else}
				<article class="pet-card">
					<header class="card-title">
						<h3>{selected?.name || 'Unnamed Creature'}</h3>
						{#if cost}<span>{cost}</span>{/if}
					</header>
					<div class="card-art" class:empty={!artSrc}>
						{#if artSrc}
							<img
								src={artSrc}
								alt={selected?.name ?? ''}
								class:pixelated={selected?.pixelated}
								draggable="false"
							/>
						{:else}
							<span>awaiting art</span>
						{/if}
					</div>
					<div class="type-line">
						<span>{selected?.domain}</span>
						<span>{kind}</span>
					</div>
					<div class="rules-box">
						{#if abilities}
							<p>{abilities}</p>
						{:else}
							<p class="muted">quiet for now</p>
						{/if}
						{#if flavor}
							<em>{flavor}</em>
						{/if}
					</div>
					<footer class="card-foot">
						<span>{foundIn || 'the margins'}</span>
						{#if power || toughness}
							<strong>{power || 0}/{toughness || 0}</strong>
						{/if}
					</footer>
				</article>
			{/if}
		</div>

		<p class="pet-note">
			This one sits beside the arcade while you take little focus sets.
		</p>
	{:else}
		<div class="empty-pet">
			<div class="empty-orb" aria-hidden="true"></div>
			<p>Paint or import a Bestiary card with art, then come back to choose a companion.</p>
			<a href="/bestiary">open bestiary</a>
		</div>
	{/if}
</aside>

<style>
	.pet-panel {
		position: sticky;
		top: 1rem;
		align-self: start;
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		border: 1px solid var(--rule);
		border-radius: 6px;
		background:
			linear-gradient(180deg, rgba(61, 45, 77, 0.84), rgba(45, 45, 95, 0.92)),
			var(--panel);
		padding: 1rem;
		box-shadow: 0 18px 40px rgba(11, 11, 32, 0.28);
		min-width: 0;
	}
	.pet-head {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}
	.pet-head p,
	.pet-select span {
		font-family: var(--font-ui);
		font-size: 0.62rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--periwinkle);
		margin: 0;
	}
	.pet-head h2 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 1.45rem;
		line-height: 1.05;
		color: var(--cream);
		margin: 0;
	}
	.pet-select {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}
	.pet-select select {
		width: 100%;
		font-family: var(--font-ui);
		font-size: 0.76rem;
		color: var(--cream);
		background: var(--bg);
		border: 1px solid var(--rule);
		border-radius: 4px;
		padding: 0.45rem 0.55rem;
	}
	.view-toggle {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1px;
		overflow: hidden;
		border: 1px solid var(--rule);
		border-radius: 4px;
		background: var(--rule);
	}
	.view-toggle button {
		font-family: var(--font-ui);
		font-size: 0.68rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--muted);
		background: var(--panel);
		padding: 0.45rem 0.5rem;
	}
	.view-toggle button.active {
		color: var(--cyan);
		background: var(--panel-accent);
	}
	.pet-stage {
		display: grid;
		place-items: center;
		min-height: 18rem;
	}
	.pet-stage.mode-hex {
		min-height: 14rem;
	}
	.hex-stand {
		transform: scale(1.72);
		transform-origin: center;
	}
	.pet-card {
		width: min(100%, 17.5rem);
		aspect-ratio: 63 / 88;
		display: flex;
		flex-direction: column;
		gap: 0.42rem;
		padding: 0.7rem;
		border: 2px solid rgba(245, 242, 232, 0.28);
		border-radius: 8px;
		background:
			linear-gradient(160deg, rgba(240, 143, 184, 0.18), rgba(108, 229, 232, 0.12)),
			#f5f2e8;
		color: var(--ink);
		box-shadow: 0 12px 26px rgba(10, 10, 28, 0.32);
	}
	.card-title,
	.type-line,
	.card-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.45rem;
		border: 1px solid rgba(26, 26, 62, 0.18);
		border-radius: 5px;
		background: rgba(255, 255, 255, 0.42);
		padding: 0.28rem 0.45rem;
	}
	.card-title h3 {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-family: var(--font-display);
		font-size: 1rem;
		line-height: 1.05;
		font-weight: 400;
		margin: 0;
	}
	.card-title span,
	.card-foot strong {
		display: grid;
		place-items: center;
		min-width: 1.55rem;
		height: 1.55rem;
		border-radius: 999px;
		font-family: var(--font-counter);
		background: var(--leafeon-pink);
		color: var(--cream);
	}
	.card-art {
		flex: 1;
		min-height: 0;
		display: grid;
		place-items: center;
		overflow: hidden;
		border: 1px solid rgba(26, 26, 62, 0.18);
		border-radius: 5px;
		background:
			radial-gradient(circle at 50% 25%, rgba(108, 229, 232, 0.22), transparent 58%),
			rgba(26, 26, 62, 0.08);
	}
	.card-art img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.card-art img.pixelated {
		image-rendering: pixelated;
		object-fit: contain;
	}
	.card-art.empty span {
		font-family: var(--font-ui);
		font-size: 0.7rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: rgba(26, 26, 62, 0.48);
	}
	.type-line {
		font-family: var(--font-ui);
		font-size: 0.66rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: rgba(26, 26, 62, 0.7);
	}
	.rules-box {
		min-height: 4.6rem;
		border: 1px solid rgba(26, 26, 62, 0.16);
		border-radius: 5px;
		background: rgba(255, 255, 255, 0.46);
		padding: 0.45rem 0.55rem;
		overflow: hidden;
	}
	.rules-box p,
	.rules-box em {
		display: block;
		margin: 0;
		font-size: 0.76rem;
		line-height: 1.32;
	}
	.rules-box em {
		margin-top: 0.35rem;
		color: rgba(26, 26, 62, 0.64);
	}
	.rules-box .muted {
		color: rgba(26, 26, 62, 0.48);
		font-style: italic;
	}
	.card-foot {
		font-family: var(--font-ui);
		font-size: 0.62rem;
		color: rgba(26, 26, 62, 0.62);
	}
	.card-foot span {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.pet-note,
	.empty-pet p {
		font-family: var(--font-body);
		font-style: italic;
		font-size: 0.82rem;
		color: var(--muted);
		text-align: center;
		margin: 0;
	}
	.empty-pet {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.8rem;
		padding: 1.4rem 0.3rem;
	}
	.empty-orb {
		width: 7rem;
		aspect-ratio: 1;
		border-radius: 50%;
		border: 1px solid var(--rule);
		background:
			radial-gradient(circle at 50% 42%, rgba(108, 229, 232, 0.16), transparent 34%),
			var(--bg);
	}
	.empty-pet a {
		font-family: var(--font-ui);
		font-size: 0.7rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--cyan);
		text-decoration: none;
	}

	@media (max-width: 900px) {
		.pet-panel {
			position: static;
		}
		.pet-stage {
			min-height: 15rem;
		}
		.hex-stand {
			transform: scale(1.45);
		}
	}
</style>
