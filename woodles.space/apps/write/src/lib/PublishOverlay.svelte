<script lang="ts">
	// 'local' (this device only) stays a distinct, honest state from 'synced'
	// (in the archive, on every device). It used to distinguish local from
	// *public*; Echoes is private now, so the honest distinction is no longer
	// about audience but about reach — and the overlay still never claims more
	// than is true.
	export type PublishStatus = 'idle' | 'local' | 'synced' | 'error';

	let { status, errorMessage = null }: { status: PublishStatus; errorMessage?: string | null } =
		$props();
	const activeState = $derived(status !== 'idle');
</script>

<div class="overlay" class:active={activeState}>
	{#if status === 'synced'}
		<p class="overlay-word">kept.</p>
		<p class="overlay-sub">in the archive, on every device</p>
	{:else if status === 'error'}
		<p class="overlay-word">kept.</p>
		<p class="overlay-sub">{errorMessage ?? "couldn't reach the archive — it's safe here"}</p>
	{:else}
		<p class="overlay-word">kept.</p>
		<p class="overlay-sub">just here, for now</p>
	{/if}
</div>

<style>
	.overlay {
		position: fixed; inset: 0;
		background: color-mix(in srgb, var(--bg) 0%, transparent);
		display: flex; flex-direction: column;
		align-items: center; justify-content: center;
		z-index: 100; pointer-events: none;
		transition: background 0.5s ease;
	}
	.overlay.active {
		background: color-mix(in srgb, var(--bg) 94%, transparent);
		pointer-events: all;
	}
	.overlay-word {
		font-family: var(--editor-display, var(--font-display));
		font-size: clamp(2.5rem, 7vw, 4.5rem);
		font-weight: 300; font-style: italic;
		color: var(--accent-strong);
		opacity: 0; transform: translateY(12px);
		transition: opacity 0.55s ease 0.35s, transform 0.55s ease 0.35s;
	}
	.overlay.active .overlay-word { opacity: 1; transform: translateY(0); }
	.overlay-sub {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.6rem; letter-spacing: 0.16em;
		text-transform: uppercase; color: var(--muted);
		opacity: 0; margin-top: 1rem;
		transition: opacity 0.4s ease 0.65s;
	}
	.overlay.active .overlay-sub { opacity: 0.5; }
</style>
