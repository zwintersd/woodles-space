<script lang="ts">
	import { devlog } from '$lib/devlog.svelte';
	import EntryList from '$lib/EntryList.svelte';
	import EntryEditor from '$lib/EntryEditor.svelte';

	$effect(() => {
		if (devlog.view === 'entry' && !devlog.currentEntry) {
			devlog.closeEntry();
		}
	});
</script>

{#if devlog.view === 'list'}
	<EntryList />
{:else if devlog.view === 'entry' && devlog.currentEntry}
	<EntryEditor entry={devlog.currentEntry} />
{/if}
