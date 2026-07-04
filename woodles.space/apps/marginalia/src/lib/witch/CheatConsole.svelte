<script lang="ts">
	import { tick } from 'svelte';
	import { book } from './book.svelte';
	import { applyMarginaliaCheat } from './cheats';

	let open = $state(false);
	let command = $state('');
	let feedback = $state('');
	let tone = $state<'ok' | 'bad'>('ok');
	let inputEl: HTMLInputElement | undefined = $state();

	async function openConsole() {
		open = true;
		await tick();
		inputEl?.focus();
		inputEl?.select();
	}

	function closeConsole() {
		open = false;
		command = '';
	}

	function handleWindowKeydown(event: KeyboardEvent) {
		if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'c') {
			event.preventDefault();
			open ? closeConsole() : void openConsole();
			return;
		}
		if (open && event.key === 'Escape') {
			event.preventDefault();
			closeConsole();
		}
	}

	function runCheat() {
		const result = applyMarginaliaCheat(command, book);
		feedback = result.message;
		tone = result.ok ? 'ok' : 'bad';
		if (result.ok) command = '';
	}

	function handleInputKeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter') return;
		event.preventDefault();
		runCheat();
	}
</script>

<svelte:window onkeydown={handleWindowKeydown} />

{#if open}
	<form class="cheat-console" role="search" aria-label="Marginalia cheat console" onsubmit={(event) => {
		event.preventDefault();
		runCheat();
	}}>
		<label>
			<span>cheat</span>
			<input
				bind:this={inputEl}
				bind:value={command}
				autocomplete="off"
				autocapitalize="off"
				spellcheck="false"
				placeholder="code"
				onkeydown={handleInputKeydown}
			/>
		</label>
		{#if feedback}
			<p class:bad={tone === 'bad'}>{feedback}</p>
		{/if}
	</form>
{/if}

<style>
	.cheat-console {
		position: fixed;
		top: 0.72rem;
		left: 0.72rem;
		z-index: 120;
		width: min(23rem, calc(100vw - 1.44rem));
		border: 1px solid rgba(108, 229, 232, 0.55);
		border-radius: 3px;
		background: rgba(14, 14, 40, 0.92);
		box-shadow:
			0 8px 28px rgba(0, 0, 0, 0.28),
			0 0 18px rgba(108, 229, 232, 0.12);
		padding: 0.35rem;
	}
	label {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		gap: 0.4rem;
	}
	span {
		font-family: var(--font-ui);
		font-size: 0.58rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--cyan);
	}
	input {
		min-width: 0;
		height: 1.7rem;
		border: 1px solid rgba(154, 150, 201, 0.38);
		border-radius: 2px;
		background: rgba(245, 242, 232, 0.94);
		color: #171739;
		font-family: var(--font-counter);
		font-size: 1rem;
		padding: 0 0.42rem;
		outline: none;
	}
	input:focus {
		border-color: var(--leafeon-pink);
		box-shadow: 0 0 0 2px rgba(240, 143, 184, 0.18);
	}
	p {
		margin: 0.35rem 0 0;
		color: var(--cream);
		font-family: var(--font-ui);
		font-size: 0.64rem;
		letter-spacing: 0.08em;
		line-height: 1.35;
	}
	p.bad {
		color: var(--leafeon-pink);
	}
</style>
