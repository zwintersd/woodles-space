<script lang="ts">
	import { CHEAT_CODES } from '$lib/witch/cheats';
</script>

<svelte:head>
	<title>cheats · marginalia</title>
</svelte:head>

<div class="cheats-page">
	<header class="cheats-top">
		<a class="brand" href="/marginalia">marginalia</a>
		<div class="room-title">
			<span class="room-kicker">the margin's notes</span>
			<h1>cheat codes</h1>
		</div>
	</header>

	<main class="cheats-body">
		<p class="intro">
			Open the console with <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>C</kbd>, type a code below,
			and press <kbd>Enter</kbd>. Codes are case-insensitive and most spend nothing to run.
		</p>

		<table>
			<thead>
				<tr>
					<th scope="col">code</th>
					<th scope="col">aliases</th>
					<th scope="col">effect</th>
				</tr>
			</thead>
			<tbody>
				{#each CHEAT_CODES as cheat (cheat.code)}
					<tr>
						<td class="code"><code>{cheat.code}</code></td>
						<td class="aliases">
							{#if cheat.aliases?.length}
								{#each cheat.aliases as alias (alias)}
									<code>{alias}</code>
								{/each}
							{:else}
								<span class="none">—</span>
							{/if}
						</td>
						<td>{cheat.summary}</td>
					</tr>
				{/each}
			</tbody>
		</table>

		<p class="footnote">
			Type <code>help</code> or <code>?</code> in the console to print this list in-game.
		</p>
	</main>
</div>

<style>
	.cheats-page {
		min-height: 100vh;
		padding: 1rem clamp(0.8rem, 3vw, 2rem) 3rem;
		background: var(--bg);
		display: flex;
		flex-direction: column;
		align-items: center;
	}
	.cheats-top {
		width: min(100%, 46rem);
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		padding: 0.4rem 0 1rem;
	}
	.brand {
		font-family: var(--font-ui);
		font-size: 0.7rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--periwinkle);
		text-decoration: none;
	}
	.brand:hover {
		color: var(--cyan);
	}
	.room-title {
		display: flex;
		align-items: baseline;
		gap: 0.45rem;
	}
	.room-kicker {
		font-family: var(--font-ui);
		font-size: 0.56rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--leafeon-pink);
	}
	.room-title h1 {
		margin: 0;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: clamp(1.05rem, 2.4vw, 1.4rem);
		line-height: 1;
		color: var(--cream);
	}
	.cheats-body {
		width: min(100%, 46rem);
	}
	.intro {
		margin: 0 0 1.2rem;
		font-size: 0.85rem;
		color: var(--muted);
	}
	kbd {
		font-family: var(--font-ui);
		font-size: 0.7rem;
		padding: 0.05rem 0.35rem;
		border: 1px solid var(--rule);
		border-radius: 3px;
		background: var(--panel);
		color: var(--text);
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.85rem;
	}
	thead th {
		text-align: left;
		font-family: var(--font-ui);
		font-size: 0.6rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--muted);
		padding: 0.3rem 0.6rem;
		border-bottom: 1px solid var(--rule);
	}
	tbody td {
		vertical-align: top;
		padding: 0.55rem 0.6rem;
		border-bottom: 1px solid var(--rule);
		color: var(--text);
	}
	td.code code {
		color: var(--cyan);
	}
	td.aliases {
		display: table-cell;
	}
	td.aliases code {
		display: block;
		margin-bottom: 0.2rem;
	}
	td.aliases code:last-child {
		margin-bottom: 0;
	}
	.aliases .none {
		color: var(--muted);
	}
	code {
		font-family: var(--font-counter);
		font-size: 0.9em;
	}
	.footnote {
		margin-top: 1.2rem;
		font-size: 0.78rem;
		color: var(--muted);
	}
</style>
