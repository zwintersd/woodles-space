<script lang="ts">
	import { book } from './book.svelte';
	import type { Worldspace } from './worldShape';

	let { worldspace }: { worldspace: Worldspace } = $props();

	const name = $derived(worldspace === 'shallows' ? 'the shallows' : worldspace);

	function enter() {
		book.enterWorldspace(worldspace);
	}

	function keepShaping() {
		book.markWorldspaceSeen(worldspace);
	}
</script>

<section class="unlock" aria-label="new worldspace unlocked">
	<div class="unlock-art" aria-hidden="true">
		<span class="sun"></span>
		<span class="water"></span>
		<span class="sand one"></span>
		<span class="sand two"></span>
	</div>
	<div class="unlock-copy">
		<span class="kicker">new worldspace unlocked</span>
		<h3>{name}</h3>
		<p>
			the floor has gathered enough of itself to become a place. water still rules
			here, but now it has edges, beds, and little shelves where other lives can
			begin to negotiate with it.
		</p>
		<ul>
			<li>feature cards can settle into dense sediment</li>
			<li>spawn weights begin to favor shelter, bottom, and mineral tags</li>
			<li>land and sky life can now appear when their conditions are written</li>
		</ul>
		<div class="actions">
			<button class="primary" onclick={enter}>enter {name}</button>
			<button onclick={keepShaping}>keep shaping water</button>
		</div>
	</div>
</section>

<style>
	.unlock {
		position: relative;
		overflow: hidden;
		border: 1px solid rgba(108, 229, 232, 0.38);
		border-radius: 4px;
		background:
			linear-gradient(120deg, rgba(26, 26, 62, 0.92), rgba(45, 45, 95, 0.82)),
			var(--panel);
		display: grid;
		grid-template-columns: minmax(8rem, 14rem) 1fr;
		gap: 1rem;
		padding: 0.85rem;
		box-shadow: 0 0 24px rgba(108, 229, 232, 0.08);
	}
	.unlock-art {
		position: relative;
		min-height: 9rem;
		border: 1px solid rgba(154, 150, 201, 0.22);
		border-radius: 3px;
		overflow: hidden;
		background:
			linear-gradient(#273f71 0 38%, rgba(108, 229, 232, 0.32) 38% 100%),
			var(--bg);
	}
	.sun {
		position: absolute;
		top: 1rem;
		right: 1.4rem;
		width: 2rem;
		aspect-ratio: 1;
		border-radius: 50%;
		background: rgba(245, 242, 232, 0.42);
		box-shadow: 0 0 22px rgba(240, 143, 184, 0.36);
	}
	.water {
		position: absolute;
		inset: 38% 0 0;
		background:
			linear-gradient(rgba(108, 229, 232, 0.26), rgba(154, 150, 201, 0.42)),
			repeating-linear-gradient(
				180deg,
				rgba(245, 242, 232, 0.08) 0 1px,
				transparent 1px 18px
			);
	}
	.sand {
		position: absolute;
		left: 12%;
		right: 18%;
		bottom: 1.4rem;
		height: 1.4rem;
		border-radius: 50%;
		background: rgba(214, 186, 146, 0.58);
		filter: blur(0.5px);
	}
	.sand.two {
		left: 42%;
		right: 7%;
		bottom: 2.45rem;
		height: 0.8rem;
		opacity: 0.72;
	}
	.unlock-copy {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}
	.kicker {
		font-family: var(--font-ui);
		font-size: 0.66rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--cyan);
	}
	h3 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 1.55rem;
		color: var(--cream);
		margin: 0;
	}
	p {
		font-family: var(--font-body);
		color: var(--muted);
		font-size: 0.9rem;
		margin: 0;
		max-width: 42rem;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}
	li {
		font-family: var(--font-ui);
		font-size: 0.68rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--periwinkle);
		border: 1px solid var(--rule);
		border-radius: 999px;
		padding: 0.25rem 0.45rem;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.15rem;
	}
	button {
		font-family: var(--font-ui);
		font-size: 0.74rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--cream);
		border: 1px solid var(--rule);
		border-radius: 3px;
		padding: 0.4rem 0.65rem;
	}
	button:hover {
		border-color: var(--periwinkle);
		color: var(--periwinkle);
	}
	.primary {
		border-color: var(--cyan);
		color: var(--cyan);
		background: rgba(108, 229, 232, 0.08);
	}
	@media (max-width: 680px) {
		.unlock {
			grid-template-columns: 1fr;
		}
		.unlock-art {
			min-height: 7rem;
		}
	}
</style>
