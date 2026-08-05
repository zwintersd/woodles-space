<script lang="ts">
	import type { ProjectSummary } from '@woodles/incremental-core';
	import EmojiIcon from './EmojiIcon.svelte';

	/**
	 * What a visitor sees when they arrive without a game. Their own projects
	 * come from the studio's shelf on the same origin, so there is no export
	 * step between making a thing and playing it.
	 */
	interface Props {
		projects: ProjectSummary[];
		onopen: (id: string) => void;
		onexample: () => void;
		onfile: (file: File) => void;
	}

	let { projects, onopen, onexample, onfile }: Props = $props();
	let fileInput: HTMLInputElement;
</script>

<div class="picker">
	<div class="art"><EmojiIcon char="🌸" size={42} /></div>
	<h1>Bloomforge Player</h1>
	<p class="lede">Pick something to play. Games you built in the studio show up here on their own.</p>

	{#if projects.length}
		<ul class="projects">
			{#each projects as project (project.id)}
				<li>
					<button type="button" onclick={() => onopen(project.id)}>
						<span class="name">{project.title}</span>
						<span class="go" aria-hidden="true">▶</span>
					</button>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="none">
			Nothing on your shelf yet — <a href="/bloomforge">build one in the studio</a>, or try the example.
		</p>
	{/if}

	<div class="actions">
		<button class="bp-button bp-button--primary" type="button" onclick={onexample}>Play the example garden</button>
		<button class="bp-button" type="button" onclick={() => fileInput.click()}>Open a .json file</button>
	</div>

	<input
		bind:this={fileInput}
		class="sr-only"
		type="file"
		accept="application/json,.json"
		onchange={(event) => {
			const file = event.currentTarget.files?.[0];
			if (file) onfile(file);
			event.currentTarget.value = '';
		}}
	/>
</div>

<style>
	.picker {
		max-width: 460px;
		margin: min(12vh, 90px) auto;
		padding: 0 20px;
		text-align: center;
	}

	.art {
		font-size: 42px;
	}

	h1 {
		margin: 10px 0 6px;
		font-family: var(--bp-font-display);
		font-size: 30px;
		font-weight: 600;
		color: var(--bp-accent-strong);
	}

	.lede {
		margin: 0 0 22px;
		font-size: 13.5px;
		line-height: 1.6;
		color: var(--bp-ink-soft);
	}

	.projects {
		margin: 0 0 18px;
		padding: 0;
		list-style: none;
		display: grid;
		gap: 6px;
		text-align: left;
	}

	.projects button {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		padding: 12px 15px;
		border: 1px solid var(--bp-rule-strong);
		border-radius: var(--bp-radius);
		background: var(--bp-surface);
		cursor: pointer;
		transition: border-color 120ms ease, box-shadow 140ms ease;
	}

	.projects button:hover {
		border-color: var(--bp-accent);
		box-shadow: var(--bp-shadow-card);
	}

	.name {
		flex: 1;
		font-size: 13.5px;
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.go {
		color: var(--bp-accent);
		font-size: 11px;
	}

	.none {
		margin: 0 0 18px;
		font-size: 12.5px;
		color: var(--bp-muted);
		line-height: 1.55;
	}

	.none a {
		color: var(--bp-accent-strong);
	}

	.actions {
		display: grid;
		gap: 7px;
	}

	.actions :global(button) {
		justify-content: center;
		padding: 9px 14px;
		font-size: 13px;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
