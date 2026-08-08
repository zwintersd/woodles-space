<script lang="ts">
	// "Draft it with a prompt" — Write's own use of @woodles/spellcraft's
	// brief, the one piece of Ologypedia's studio and Spores' Garden worth
	// keeping once both retired into Write: assemble a prompt from a topic,
	// paste it into any model, paste the answer back in. Nothing here calls
	// a model — the human carries both directions, same as everywhere else
	// this pattern appears in the workspace.
	import { fade, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { buildBrief, ingestDraft } from '@woodles/spellcraft';
	import { htmlToText } from '@woodles/text';

	let {
		open = $bindable(),
		defaultTopic,
		onInsert
	}: {
		open: boolean;
		defaultTopic: string;
		onInsert: (text: string) => void;
	} = $props();

	let topic = $state('');
	let context = $state('');
	let diagnosis = $state(false);
	let prompt = $state('');
	let pasted = $state('');
	let copied = $state(false);

	$effect(() => {
		if (open) {
			topic = defaultTopic;
			context = '';
			diagnosis = false;
			prompt = '';
			pasted = '';
		}
	});

	function assemble() {
		prompt = buildBrief({
			topic: topic.trim() || defaultTopic,
			context: context.trim(),
			diagnosis
		});
	}

	async function copyPrompt() {
		try {
			await navigator.clipboard.writeText(prompt);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch {
			// Clipboard access can be denied — the textarea is still selectable.
		}
	}

	function insert() {
		const text = ingestDraft(pasted, htmlToText);
		if (!text.trim()) return;
		onInsert(text);
		open = false;
	}
</script>

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="prompt-overlay" transition:fade={{ duration: 240 }} onclick={() => (open = false)}>
		<div
			class="prompt-modal"
			onclick={(e) => e.stopPropagation()}
			transition:fly={{ y: 8, duration: 320, easing: cubicOut }}
		>
			<div class="prompt-header">
				<h2 class="prompt-title">draft it with a prompt</h2>
				<button class="prompt-close" onclick={() => (open = false)} aria-label="close">×</button>
			</div>
			<div class="prompt-body">
				<label class="prompt-field">
					<span>topic</span>
					<input type="text" bind:value={topic} placeholder={defaultTopic} />
				</label>
				<label class="prompt-field">
					<span>your own relationship to it (optional)</span>
					<input type="text" bind:value={context} placeholder="e.g. I grow it on my windowsill" />
				</label>
				<label class="prompt-checkbox">
					<input type="checkbox" bind:checked={diagnosis} />
					<span>this topic is a diagnosis or health condition</span>
				</label>
				<button class="prompt-btn" onclick={assemble}>assemble prompt</button>

				{#if prompt}
					<label class="prompt-field">
						<span>paste this into any model</span>
						<textarea class="prompt-textarea" readonly value={prompt}></textarea>
					</label>
					<button class="prompt-btn" onclick={copyPrompt}>{copied ? 'copied' : 'copy'}</button>

					<label class="prompt-field">
						<span>paste its answer back</span>
						<textarea
							class="prompt-textarea"
							placeholder="paste the model's answer here"
							bind:value={pasted}
						></textarea>
					</label>
					<button class="prompt-btn prompt-btn-primary" onclick={insert} disabled={!pasted.trim()}>
						insert into the foreground
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.prompt-overlay {
		position: fixed; inset: 0;
		background: color-mix(in srgb, var(--bg) 60%, transparent);
		backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
		z-index: 100; display: flex; align-items: flex-start; justify-content: center;
		padding-top: 8vh;
	}
	.prompt-modal {
		background: var(--surface); border: 1px solid var(--rule); border-radius: 12px;
		width: 100%; max-width: 480px;
		box-shadow: 0 12px 40px color-mix(in srgb, var(--bg) 80%, transparent);
		overflow: hidden; display: flex; flex-direction: column; max-height: 82vh;
	}
	.prompt-header {
		display: flex; align-items: center; justify-content: space-between;
		padding: 1.2rem 1.4rem; border-bottom: 1px dashed var(--rule);
	}
	.prompt-title {
		font-family: var(--editor-mono, var(--font-mono)); font-size: 0.75rem;
		letter-spacing: 0.15em; text-transform: lowercase; color: var(--accent-strong); font-weight: 400;
	}
	.prompt-close {
		background: none; border: none; font-size: 1.1rem; color: var(--muted);
		cursor: pointer; padding: 0.3rem;
	}
	.prompt-body {
		padding: 1rem 1.4rem 1.4rem; overflow-y: auto;
		display: flex; flex-direction: column; gap: 0.7rem;
	}
	.prompt-field {
		display: flex; flex-direction: column; gap: 0.3rem;
		font-family: var(--editor-mono, var(--font-mono)); font-size: 0.6rem;
		letter-spacing: 0.08em; color: var(--muted);
	}
	.prompt-field input,
	.prompt-textarea {
		font-family: var(--editor-mono, var(--font-mono)); font-size: 0.68rem;
		color: var(--text); background: transparent;
		border: 1px solid var(--rule); border-radius: 6px; padding: 6px 10px;
	}
	.prompt-textarea { min-height: 7rem; resize: vertical; }
	.prompt-field input:focus, .prompt-textarea:focus { outline: none; border-color: var(--accent); }
	.prompt-checkbox {
		display: flex; align-items: center; gap: 0.5rem;
		font-family: var(--editor-mono, var(--font-mono)); font-size: 0.6rem; color: var(--muted);
	}
	.prompt-btn {
		align-self: flex-start;
		font-family: var(--editor-mono, var(--font-mono)); font-size: 0.6rem;
		letter-spacing: 0.1em; text-transform: lowercase; color: var(--accent-strong);
		background: none; border: 1px solid var(--rule); border-radius: 100px;
		padding: 6px 14px; cursor: pointer;
		transition: background 0.18s ease, border-color 0.18s ease;
	}
	.prompt-btn:hover { border-color: var(--accent); }
	.prompt-btn:disabled { opacity: 0.5; cursor: default; }
	.prompt-btn-primary {
		color: var(--bg); background: var(--accent-strong); border-color: var(--accent-strong);
	}
	.prompt-btn-primary:hover { background: var(--accent-deep); }
</style>
