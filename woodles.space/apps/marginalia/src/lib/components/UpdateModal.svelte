<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { game } from '$lib/state/game.svelte';
	import { updates, CURRENT_VERSION } from '$lib/content/updates';

	const lastSeen = $derived(game.lastSeenVersion);

	function isNew(version: string): boolean {
		if (lastSeen === null) return true;
		return version > lastSeen;
	}

	function dismiss() {
		game.dismissUpdateModal();
	}

	function onKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape') dismiss();
	}
</script>

<svelte:window on:keydown={onKeyDown} />

<div
	class="backdrop"
	role="dialog"
	aria-modal="true"
	aria-label="what's new"
	transition:fade={{ duration: 180 }}
>
	<button class="backdrop-hit" type="button" onclick={dismiss} aria-label="dismiss"></button>
	<section class="modal" transition:fly={{ y: 12, duration: 220 }}>
		<header>
			<span class="version">{CURRENT_VERSION}</span>
			<h2>marginalia · what's new</h2>
			<button class="dismiss" type="button" onclick={dismiss} aria-label="close">×</button>
		</header>

		<div class="scroll">
			{#each updates as u, i (u.version)}
				<article class="entry" class:fresh={isNew(u.version)}>
					<header class="entry-head">
						<span class="entry-version">{u.version}</span>
						<h3>{u.title}</h3>
						{#if isNew(u.version)}<span class="badge">new</span>{/if}
					</header>
					<ul>
						{#each u.notes as n (n)}
							<li>{n}</li>
						{/each}
					</ul>
					{#if i < updates.length - 1}
						<hr aria-hidden="true" />
					{/if}
				</article>
			{/each}
		</div>

		<footer>
			<button class="primary" type="button" onclick={dismiss}>— continue reading —</button>
		</footer>
	</section>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 1100;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.2rem;
		background: rgba(0, 0, 0, 0.55);
		backdrop-filter: blur(2px);
	}

	.backdrop-hit {
		position: absolute;
		inset: 0;
		background: transparent;
		border: none;
		padding: 0;
		cursor: pointer;
	}

	.modal {
		position: relative;
		max-width: 38rem;
		width: 100%;
		max-height: min(82vh, 44rem);
		display: flex;
		flex-direction: column;
		background: var(--panel);
		border: 1px solid var(--rule);
		border-radius: 4px;
		box-shadow: 0 12px 40px rgba(0, 0, 0, 0.55);
		font-family: var(--font-body);
		color: var(--text);
		overflow: hidden;
	}

	.modal > header {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		padding: 0.9rem 1rem;
		border-bottom: 1px solid var(--rule);
	}

	.version {
		font-family: var(--font-counter);
		font-size: 0.78rem;
		color: var(--periwinkle);
		padding: 0.05rem 0.4rem;
		border: 1px solid var(--rule);
		border-radius: 3px;
	}

	.modal h2 {
		margin: 0;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 1.1rem;
		color: var(--cream);
		flex: 1;
	}

	.dismiss {
		background: none;
		border: none;
		color: var(--rule);
		font-size: 1.1rem;
		line-height: 1;
		cursor: pointer;
		padding: 0 0.4rem;
	}

	.dismiss:hover {
		color: var(--leafeon-pink);
	}

	.scroll {
		overflow-y: auto;
		padding: 0.4rem 1rem 0.6rem;
	}

	.entry {
		padding: 0.8rem 0;
	}

	.entry-head {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		margin-bottom: 0.35rem;
	}

	.entry-version {
		font-family: var(--font-counter);
		font-size: 0.74rem;
		color: var(--muted);
	}

	.entry h3 {
		margin: 0;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 1rem;
		color: var(--cream);
		flex: 1;
	}

	.entry.fresh h3 {
		color: var(--leafeon-pink);
	}

	.badge {
		font-family: var(--font-ui);
		font-size: 0.62rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--bg);
		background: var(--leafeon-pink);
		padding: 0.08rem 0.4rem;
		border-radius: 3px;
	}

	.entry ul {
		margin: 0;
		padding-left: 1.2rem;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.entry li {
		font-size: 0.92rem;
		line-height: 1.45;
		color: var(--text);
	}

	hr {
		border: 0;
		border-top: 1px dashed var(--rule);
		margin: 0.9rem 0 0;
	}

	.modal > footer {
		padding: 0.7rem 1rem;
		border-top: 1px solid var(--rule);
		display: flex;
		justify-content: center;
	}

	.primary {
		font-family: var(--font-display);
		font-size: 1rem;
		color: var(--cream);
		background: var(--panel-accent);
		border: 1px solid var(--rule);
		border-radius: 3px;
		padding: 0.35rem 0.7rem;
		cursor: pointer;
	}

	.primary:hover {
		border-color: var(--periwinkle);
		color: var(--periwinkle);
	}

	@media (max-width: 540px) {
		.modal { max-height: 92vh; }
	}
</style>
