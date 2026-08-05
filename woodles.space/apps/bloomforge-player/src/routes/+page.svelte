<script lang="ts">
	import { onMount } from 'svelte';
	import {
		describeEffect,
		GameDefParseError,
		nameLookup,
		parseGameDef,
		type ProjectSummary
	} from '@woodles/incremental-core';
	import BuyCard from '$lib/BuyCard.svelte';
	import Chronicle from '$lib/Chronicle.svelte';
	import CurrencyBar from '$lib/CurrencyBar.svelte';
	import GamePicker from '$lib/GamePicker.svelte';
	import PrestigePanel from '$lib/PrestigePanel.svelte';
	import { currencyById } from '$lib/format.js';
	import { formatDuration, game } from '$lib/game.svelte.js';
	import { exampleGame, lastPlayed, listProjects, loadProject } from '$lib/library.js';

	let projects = $state<ProjectSummary[]>([]);
	let notice = $state<string | null>(null);
	let confirmingRestart = $state(false);

	const names = $derived(game.def ? nameLookup(game.def) : (id: string) => id);

	onMount(() => {
		projects = listProjects();

		// `?game=<project id>` is what the studio's Play button hands over. It
		// names a project on this origin rather than carrying a def in the URL,
		// so a link can't go stale against an edited game.
		const wanted = new URLSearchParams(location.search).get('game');
		if (wanted) {
			const def = loadProject(wanted);
			if (def) game.open(def);
			else notice = 'That game is not on this device.';
		} else {
			// Otherwise pick up whatever was open last. A reload in the middle of a
			// session should land you back in your game, not at the shelf.
			const resumed = lastPlayed();
			if (resumed) game.open(resumed);
		}

		const onHide = () => game.save();
		const onVisibility = () => {
			if (document.visibilityState === 'hidden') game.save();
		};
		window.addEventListener('pagehide', onHide);
		document.addEventListener('visibilitychange', onVisibility);
		return () => {
			window.removeEventListener('pagehide', onHide);
			document.removeEventListener('visibilitychange', onVisibility);
			game.save();
			game.pause();
		};
	});

	async function openFile(file: File): Promise<void> {
		try {
			game.open(parseGameDef(await file.text()).def);
			notice = null;
		} catch (error) {
			notice = error instanceof GameDefParseError ? error.message : 'That file could not be read.';
		}
	}

	function generatorDetail(id: string): string {
		const generator = game.def?.generators.find((entry) => entry.id === id);
		if (!generator) return '';
		const produces = currencyById(game.def, generator.producesCurrencyId);
		// What one level is worth, which is the number the buy decision turns on.
		// The card shows the *current* total rate separately, once you own some.
		return `${generator.baseRate} ${produces?.name ?? 'units'} per second at level 1`;
	}

	function upgradeDetail(id: string): string {
		const upgrade = game.def?.upgrades.find((entry) => entry.id === id);
		if (!upgrade) return '';
		if (upgrade.description) return upgrade.description;
		return upgrade.effects.map((effect) => describeEffect(effect, names)).join(' · ') || 'does nothing yet';
	}
</script>

{#if !game.def}
	<GamePicker
		{projects}
		onopen={(id) => {
			const def = loadProject(id);
			if (def) game.open(def);
			else notice = 'That game could not be opened.';
		}}
		onexample={() => game.open(exampleGame())}
		onfile={openFile}
	/>
	{#if notice}<p class="notice" role="status">{notice}</p>{/if}
{:else if game.fault}
	<div class="fault">
		<h1>This game can't run</h1>
		<p>{game.fault}</p>
		<a class="bp-button" href="/bloomforge">Fix it in the studio</a>
	</div>
{:else}
	<div class="game">
		<header>
			<div class="title">
				<h1>{game.def.meta.title}</h1>
				<span class="clock">{formatDuration(game.elapsed)}</span>
			</div>
			<div class="tools">
				<span class="saved">{game.savedAt ? 'Progress saved' : 'New game'}</span>
				{#if confirmingRestart}
					<button
						class="bp-button danger"
						type="button"
						onclick={() => {
							game.restart();
							confirmingRestart = false;
						}}
					>
						Erase and start over
					</button>
					<button class="bp-button" type="button" onclick={() => (confirmingRestart = false)}>Cancel</button>
				{:else}
					<button
						class="bp-button"
						type="button"
						onclick={() => {
							game.close();
							projects = listProjects();
						}}>Games</button
					>
					<button class="bp-button" type="button" onclick={() => (confirmingRestart = true)}>Start over</button>
				{/if}
				<a class="bp-button" href="/bloomforge">Studio</a>
			</div>
		</header>

		<CurrencyBar />

		<div class="columns">
			<section class="shop">
				<h2>Garden</h2>
				<div class="cards">
					{#each game.generators as item (item.id)}
						<BuyCard {item} kind="generator" icon="🌱" detail={generatorDetail(item.id)} onbuy={(id) => game.buyGenerator(id)} />
					{/each}
				</div>

				{#if game.upgrades.length}
					<div class="upgrades-head">
						<h2>Upgrades</h2>
						{#if game.unequippedUpgradeCount > 0}
							<span class="unequipped-count">{game.unequippedUpgradeCount} left unequipped</span>
						{/if}
					</div>
					<div class="cards">
						{#each game.upgrades as item (item.id)}
							<div class="upgrade-row">
								<BuyCard {item} kind="upgrade" icon="✨" detail={upgradeDetail(item.id)} onbuy={(id) => game.buyUpgrade(id)} />
								{#if item.equipped !== undefined}
									<button
										class="bp-button equip-toggle"
										type="button"
										aria-pressed={item.equipped}
										onclick={() => (item.equipped ? game.unequipUpgrade(item.id) : game.equipUpgrade(item.id))}
									>
										{item.equipped ? '✓ Equipped' : 'Unequipped'}
									</button>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</section>

			<aside class="side">
				<PrestigePanel />
				<Chronicle />
			</aside>
		</div>
	</div>
{/if}

<style>
	.game {
		max-width: 1120px;
		margin: 0 auto;
		padding: 20px 20px 60px;
		display: grid;
		gap: 16px;
	}

	header {
		display: flex;
		align-items: center;
		gap: 16px;
		flex-wrap: wrap;
	}

	.title {
		display: flex;
		align-items: baseline;
		gap: 10px;
		flex: 1;
		min-width: 0;
	}

	h1 {
		margin: 0;
		font-family: var(--bp-font-display);
		font-size: 26px;
		font-weight: 600;
		color: var(--bp-accent-strong);
	}

	.clock {
		font-size: 12px;
		color: var(--bp-faint);
		font-variant-numeric: tabular-nums;
	}

	.tools {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.saved {
		font-size: 11px;
		color: var(--bp-faint);
		margin-right: 4px;
	}

	.tools :global(a.bp-button) {
		text-decoration: none;
	}

	.danger:hover {
		background: var(--bp-danger-soft);
		border-color: var(--bp-danger);
		color: var(--bp-danger);
	}

	.columns {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(260px, 340px);
		gap: 22px;
		align-items: start;
	}

	h2 {
		margin: 4px 0 8px;
		font-family: var(--bp-font-display);
		font-size: 17px;
		font-weight: 600;
		color: var(--bp-ink-soft);
	}

	.upgrades-head {
		display: flex;
		align-items: baseline;
		gap: 8px;
	}

	.upgrades-head h2 {
		margin-right: auto;
	}

	.unequipped-count {
		font-size: 11px;
		font-weight: 600;
		color: var(--bp-accent-strong);
	}

	.upgrade-row {
		display: flex;
		align-items: stretch;
		gap: 6px;
	}

	.upgrade-row :global(.card) {
		flex: 1;
		min-width: 0;
	}

	.equip-toggle {
		flex: none;
		align-self: center;
		font-size: 11px;
		padding: 6px 10px;
		white-space: nowrap;
	}

	.cards {
		display: grid;
		gap: 7px;
		margin-bottom: 14px;
	}

	.side {
		display: grid;
		gap: 20px;
		align-content: start;
	}

	.fault {
		max-width: 460px;
		margin: min(14vh, 100px) auto;
		padding: 0 20px;
		text-align: center;
	}

	.fault h1 {
		font-size: 24px;
		color: var(--bp-danger);
	}

	.fault p {
		margin: 8px 0 18px;
		font-size: 13px;
		line-height: 1.55;
		color: var(--bp-ink-soft);
	}

	.fault :global(a.bp-button) {
		text-decoration: none;
	}

	.notice {
		max-width: 460px;
		margin: 0 auto;
		padding: 10px 20px;
		text-align: center;
		font-size: 12.5px;
		color: var(--bp-danger);
	}

	@media (max-width: 860px) {
		.columns {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
