<script lang="ts">
	import InfoTip from '../InfoTip.svelte';
	import { GLOSSARY } from '../glossary.js';

	/**
	 * Free-text labels, comma-separated in the box and a `string[] | undefined`
	 * in the def — `undefined` rather than `[]` once the last one is cleared,
	 * so an untagged entity round-trips instead of picking up a stray empty
	 * array no author ever asked for.
	 *
	 * Commits on blur/Enter rather than every keystroke: reformatting the
	 * joined string mid-comma would fight the cursor.
	 */
	interface Props {
		tags: string[] | undefined;
		onchange: (tags: string[] | undefined) => void;
		id?: string;
	}

	let { tags, onchange, id }: Props = $props();

	function commit(value: string): void {
		const parsed = value
			.split(',')
			.map((tag) => tag.trim())
			.filter(Boolean);
		onchange(parsed.length ? parsed : undefined);
	}
</script>

<div class="bf-field">
	<span class="bf-field-label">
		<label for={id ?? 'bf-tags'}>Tags</label>
		<InfoTip text={GLOSSARY.tags} />
	</span>
	<input
		id={id ?? 'bf-tags'}
		class="bf-input"
		type="text"
		placeholder="devotional, ..."
		value={(tags ?? []).join(', ')}
		onchange={(e) => commit(e.currentTarget.value)}
	/>
</div>
