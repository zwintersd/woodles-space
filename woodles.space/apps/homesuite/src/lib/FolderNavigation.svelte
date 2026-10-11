<script lang="ts">
	import { onMount } from 'svelte';
	import FolderIcon from './FolderIcon.svelte';
	import { folderTree, type FolderLibrary } from './folders';
	let { library, location, unfiledCount, onOpen, onCreate, onActions } = $props<{
		library: FolderLibrary;
		location: string | null;
		unfiledCount: number;
		onOpen: (id: string | null) => void;
		onCreate: () => void;
		onActions: (id: string, event: MouseEvent) => void;
	}>();
	const tree = $derived(folderTree(library));
	let navigationOpen = $state(true);
	onMount(() => {
		const compact = window.matchMedia('(max-width: 700px)');
		const update = () => { navigationOpen = !compact.matches; };
		update(); compact.addEventListener('change', update);
		return () => compact.removeEventListener('change', update);
	});
</script>

<details class="folder-navigation" bind:open={navigationOpen}>
	<summary>Folders <span>{library.folders.length} <b aria-hidden="true">⌄</b></span></summary>
	<nav aria-label="Folder navigation">
		<button class="folder-nav-link" class:active={location === null} aria-current={location === null ? 'page' : undefined} onclick={() => onOpen(null)}><span aria-hidden="true">✳</span>All files</button>
		<button class="folder-nav-link" class:active={location === 'root'} aria-current={location === 'root' ? 'page' : undefined} onclick={() => onOpen('root')}><span aria-hidden="true">·</span>Unfiled <small>{unfiledCount}</small></button>
		<div class="folder-tree">
			{#each tree as row (row.folder.id)}
				<div class="folder-nav-row" style:--folder-depth={Math.min(row.depth, 4)}>
					<button class="folder-nav-link" class:active={location === row.folder.id} aria-current={location === row.folder.id ? 'page' : undefined} title={row.path} onclick={() => onOpen(row.folder.id)}><FolderIcon /><span class="folder-nav-name">{row.folder.name}</span></button>
					<button class="folder-nav-actions" aria-label={`Folder actions for ${row.folder.name}`} aria-haspopup="menu" onclick={(event) => onActions(row.folder.id, event)}>⋯</button>
				</div>
			{:else}
				<p class="folder-nav-empty">Give related things a place.</p>
			{/each}
		</div>
		<button class="folder-new-link" onclick={onCreate}>＋ New folder</button>
	</nav>
</details>
