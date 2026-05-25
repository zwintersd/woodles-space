<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { fly, slide, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import Topbar from '$lib/Topbar.svelte';
	import BottomBar from '$lib/BottomBar.svelte';
	import EditorToolbar from '$lib/EditorToolbar.svelte';
	import DraftsModal from '$lib/DraftsModal.svelte';
	import PublishOverlay from '$lib/PublishOverlay.svelte';
	import {
		ANCHOR_BLOCK_SELECTOR,
		sanitizeHtml,
		ensureAnchorsOn,
		stampAnchorsHtml,
		isEmptyHtml,
		stripTags,
		countWords,
		previewText
	} from '$lib/htmlTools';
	import { POCKETS_ORDER_KEY } from '$lib/storage';
	import {
		findLetter,
		incrementIssue,
		loadLettersList,
		writePublishedLegacy,
		type StoredLetter
	} from '$lib/letters';
	import {
		bootstrap as bootstrapDrafts,
		createDraftId,
		listDrafts,
		loadDraft as loadDraftBody,
		saveDraft,
		removeDraftBody,
		setActiveDraftId,
		clearActiveDraftId,
		upsertIndex,
		writeIndex,
		type DraftIndexItem,
		type DraftBody
	} from '$lib/drafts';
	import type { LayerId, PocketLayer, PocketNote, MarginNote } from '$lib/types';
	import {
		palettes,
		motifs as motifList,
		fontPairs,
		findTemplate,
		findFont
	} from '@shared/library.js';

	const LAYER_IDS: LayerId[] = ['foreground', 'midground', 'background'];
	const LAYER_LABELS: Record<LayerId, string> = {
		foreground: 'fg',
		midground: 'mg',
		background: 'bg'
	};
	const LAYER_PLACEHOLDERS: Record<LayerId, string> = {
		foreground: 'Begin writing your letter…',
		midground: 'thinking, working notes, what shaped this…',
		background: 'the impulse. the thing only you know.'
	};
	type PocketsOrder = 'oldest' | 'newest';

	let title = $state('');
	let theme = $state('cream');
	let motif = $state('blobs');
	let font = $state('classic');

	let fgEl: HTMLDivElement | undefined = $state();
	let mgEl: HTMLDivElement | undefined = $state();
	let bgEl: HTMLDivElement | undefined = $state();
	let titleEl: HTMLInputElement | undefined = $state();
	let editorPageEl: HTMLDivElement | undefined = $state();
	let marginColumnEl: HTMLElement | undefined = $state();

	let activeLayer = $state<LayerId>('foreground');
	let saveStatus = $state<'saved' | 'saving'>('saved');
	let wordCount = $state(0);
	let bold = $state(false);
	let italic = $state(false);
	let underline = $state(false);
	let publishing = $state(false);
	let fgIsEmpty = $state(true);

	let pockets = $state<PocketNote[]>([]);
	let pocketsOpen = $state(false);
	let pocketsOrder = $state<PocketsOrder>('oldest');
	let confirmingPocketId = $state<string | null>(null);
	let pocketConfirmTimer: ReturnType<typeof setTimeout> | undefined;

	let marginNotes = $state<MarginNote[]>([]);
	let confirmingMarginId = $state<string | null>(null);
	let marginConfirmTimer: ReturnType<typeof setTimeout> | undefined;
	let anchorOffsets = $state<Record<string, number>>({});
	// FG version counter — bumped on FG input so binder previews recompute.
	let fgVersion = $state(0);

	type BinderTab = 'layers' | 'pockets' | 'notes';
	let binderOpen = $state<BinderTab | null>(null);
	let pocketsFilter = $state<'all' | PocketLayer>('all');

	// Multi-doc reply context — set from ?reply=<id> URL param. When set,
	// the draft autosaves under that source's draft slot, and on publish
	// the new letter has replyTo set so it appears in the source's
	// "Responses" section.
	let replyTo = $state<string | null>(null);
	let replyToTitle = $state<string | null>(null);
	const draftKey = $derived<string>(replyTo ?? 'new');

	let selectionRect = $state<{ top: number; left: number; width: number } | null>(null);
	let selectionAnchorId = $state<string | null>(null);

	let saveTimer: ReturnType<typeof setTimeout> | undefined;
	let measureTimer: ReturnType<typeof setTimeout> | undefined;
	let hydrated = $state(false);

	let draftsList = $state<DraftIndexItem[]>([]);
	let currentDraftId = $state<string | null>(null);
	let draftsOpen = $state(false);

	const sortedPockets = $derived(
		pocketsOrder === 'oldest'
			? [...pockets].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
			: [...pockets].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
	);

	const nextPocketLayer = $derived<PocketLayer>(
		activeLayer === 'background' ? 'background' : 'midground'
	);

	type MarginGroup = { anchorId: string; offsetTop: number; notes: MarginNote[] };
	const visibleMarginGroups = $derived.by<MarginGroup[]>(() => {
		const groups = new Map<string, MarginNote[]>();
		for (const note of marginNotes) {
			if (!Object.prototype.hasOwnProperty.call(anchorOffsets, note.anchorId)) continue;
			const arr = groups.get(note.anchorId) ?? [];
			arr.push(note);
			groups.set(note.anchorId, arr);
		}
		return [...groups.entries()]
			.map(([anchorId, notes]) => ({
				anchorId,
				offsetTop: anchorOffsets[anchorId] ?? 0,
				notes: notes.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt))
			}))
			.sort((a, b) => a.offsetTop - b.offsetTop);
	});

	function elFor(layer: LayerId): HTMLDivElement | undefined {
		return layer === 'foreground' ? fgEl : layer === 'midground' ? mgEl : bgEl;
	}

	function handlePaste(e: ClipboardEvent) {
		const data = e.clipboardData;
		if (!data) return;
		const html = data.getData('text/html');
		const text = data.getData('text/plain');
		e.preventDefault();
		if (html) {
			const cleaned = sanitizeHtml(html);
			document.execCommand('insertHTML', false, cleaned);
		} else if (text) {
			document.execCommand('insertText', false, text);
		}
	}

	function stampLiveAnchors() {
		if (!fgEl) return;
		ensureAnchorsOn(fgEl.querySelectorAll(ANCHOR_BLOCK_SELECTOR));
	}

	// ── multi-doc storage ──
	function loadIntoLayers(d: {
		title?: string;
		theme?: string;
		motif?: string;
		font?: string;
		layers?: Partial<Record<LayerId, { html?: string }>>;
		content?: string;
		annotations?: { pocketNotes?: PocketNote[]; marginNotes?: MarginNote[] };
	}) {
		title = d.title || '';
		if (d.theme) theme = d.theme;
		if (d.motif) motif = d.motif;
		if (d.font) font = d.font;
		const layers = d.layers ?? {};
		const fgHtml = sanitizeHtml(layers.foreground?.html ?? d.content ?? '');
		const mgHtml = sanitizeHtml(layers.midground?.html ?? '');
		const bgHtml = sanitizeHtml(layers.background?.html ?? '');
		if (fgEl) fgEl.innerHTML = fgHtml;
		if (mgEl) mgEl.innerHTML = mgHtml;
		if (bgEl) bgEl.innerHTML = bgHtml;
		stampLiveAnchors();
		const notes = d.annotations?.pocketNotes;
		pockets = Array.isArray(notes)
			? notes.map((n) => ({
					...n,
					layer: n.layer === 'background' ? 'background' : 'midground',
					html: sanitizeHtml(n.html ?? '')
				}))
			: [];
		const margins = d.annotations?.marginNotes;
		marginNotes = Array.isArray(margins)
			? margins.map((n) => ({
					...n,
					html: sanitizeHtml(n.html ?? '')
				}))
			: [];
	}

	onMount(() => {
		try {
			document.execCommand('defaultParagraphSeparator', false, 'p');
		} catch (e) {}

		try {
			const order = localStorage.getItem(POCKETS_ORDER_KEY);
			if (order === 'newest' || order === 'oldest') pocketsOrder = order;
		} catch (e) {
			// ignore
		}

		const params = new URLSearchParams(window.location.search);
		const tid = params.get('template');
		const replyId = params.get('reply');

		if (tid) {
			const t = findTemplate(tid);
			if (t) {
				loadIntoLayers({
					title: t.sampleTitle,
					theme: t.palette,
					motif: t.motif,
					font: t.font,
					content: t.sampleContent
				});
				updateMeta();
				history.replaceState(null, '', window.location.pathname);
				hydrated = true;
				scheduleSave();
				scheduleMeasure();
				window.addEventListener('resize', onResize);
				document.addEventListener('selectionchange', onSelectionChange);
				return;
			}
		}

		if (replyId) {
			const letters = loadLettersList();
			const source = findLetter(letters, replyId);
			if (source) {
				replyTo = replyId;
				replyToTitle = source.title || 'untitled letter';
			}
			// If source missing, replyTo stays null; we fall back to the 'new' draft.
		}

		const boot = bootstrapDrafts();
		draftsList = boot.drafts;
		currentDraftId = boot.activeId;

		if (boot.body) {
			try {
				loadIntoLayers(boot.body);
			} catch (e) {
				// ignore corrupt drafts
			}
		}
		updateMeta();
		hydrated = true;
		scheduleMeasure();

		window.addEventListener('resize', onResize);
		document.addEventListener('selectionchange', onSelectionChange);
	});

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			window.removeEventListener('resize', onResize);
			document.removeEventListener('selectionchange', onSelectionChange);
		}
	});

	function onResize() {
		scheduleMeasure(80);
	}

	$effect(() => {
		if (typeof document === 'undefined') return;
		document.body.dataset.theme = theme;
		Array.from(document.body.classList).forEach((c) => {
			if (c.startsWith('motif-') && !c.startsWith('motif-blob') && c !== 'motif-grain') {
				document.body.classList.remove(c);
			}
		});
		document.body.classList.add('motif-' + motif);
		const f = findFont(font);
		document.body.style.setProperty('--editor-display', f.display);
		document.body.style.setProperty('--editor-body', f.body);
		document.body.style.setProperty('--editor-mono', f.mono);
		// font/motif/palette can change body heights; remeasure.
		scheduleMeasure(60);
	});

	$effect(() => {
		if (typeof localStorage === 'undefined') return;
		try {
			localStorage.setItem(POCKETS_ORDER_KEY, pocketsOrder);
		} catch (e) {
			// ignore
		}
	});

	function updateMeta() {
		const el = elFor(activeLayer);
		const text = el?.textContent || '';
		wordCount = text.trim().split(/\s+/).filter((w) => w.length).length;
		fgIsEmpty = isEmptyHtml(fgEl?.innerHTML ?? '');
	}

	function scheduleSave() {
		if (!hydrated) return;
		if (publishing) return;
		saveStatus = 'saving';
		clearTimeout(saveTimer);
		saveTimer = setTimeout(() => {
			try {
				const now = new Date().toISOString();
				const draftData = {
					title, theme, motif, font,
					layers: {
						foreground: { html: fgEl?.innerHTML ?? '', updatedAt: now },
						midground: { html: mgEl?.innerHTML ?? '', updatedAt: now },
						background: { html: bgEl?.innerHTML ?? '', updatedAt: now }
					},
					annotations: { pocketNotes: pockets, marginNotes },
					content: fgEl?.innerHTML ?? '',
					savedAt: now
				};
				if (currentDraftId) {
					saveDraft(currentDraftId, draftData);
					draftsList = upsertIndex(draftsList, currentDraftId, title, now);
					writeIndex(draftsList);
				}
			} catch (e) {
				// ignore quota / disabled storage
			}
			saveStatus = 'saved';
		}, 700);
	}

	$effect(() => {
		void theme;
		void motif;
		void font;
		if (hydrated) scheduleSave();
	});

	function scheduleMeasure(delay = 30) {
		clearTimeout(measureTimer);
		measureTimer = setTimeout(() => {
			requestAnimationFrame(measureAnchors);
		}, delay);
	}

	function measureAnchors() {
		if (!fgEl || !marginColumnEl) return;
		const colTop = marginColumnEl.getBoundingClientRect().top;
		const next: Record<string, number> = {};
		fgEl.querySelectorAll('[data-anchor]').forEach((el) => {
			const id = el.getAttribute('data-anchor');
			if (!id) return;
			const r = (el as HTMLElement).getBoundingClientRect();
			next[id] = r.top - colTop;
		});
		anchorOffsets = next;
	}

	async function setActiveLayer(next: LayerId) {
		if (next === activeLayer) return;
		activeLayer = next;
		selectionRect = null;
		await tick();
		const el = elFor(next);
		el?.focus();
		updateMeta();
		if (next === 'foreground') {
			updateToolbarState();
			scheduleMeasure(40);
		}
	}

	function exec(cmd: string, val: string | null = null) {
		if (activeLayer !== 'foreground') return;
		document.execCommand(cmd, false, val ?? undefined);
		fgEl?.focus();
		updateToolbarState();
	}

	function insertLink() {
		const url = prompt('URL:');
		if (url) exec('createLink', url);
	}

	function updateToolbarState() {
		if (activeLayer !== 'foreground') {
			bold = italic = underline = false;
			return;
		}
		bold = document.queryCommandState('bold');
		italic = document.queryCommandState('italic');
		underline = document.queryCommandState('underline');
	}

	function loadDraft(id: string) {
		if (id === currentDraftId) {
			draftsOpen = false;
			return;
		}
		clearTimeout(saveTimer);
		if (currentDraftId) {
			const now = new Date().toISOString();
			const draftData: DraftBody = {
				title, theme, motif, font,
				layers: {
					foreground: { html: fgEl?.innerHTML ?? '', updatedAt: now },
					midground: { html: mgEl?.innerHTML ?? '', updatedAt: now },
					background: { html: bgEl?.innerHTML ?? '', updatedAt: now }
				},
				annotations: { pocketNotes: pockets, marginNotes },
				content: fgEl?.innerHTML ?? '',
				savedAt: now
			};
			saveDraft(currentDraftId, draftData);
		}

		currentDraftId = id;
		setActiveDraftId(id);

		title = '';
		pockets = [];
		marginNotes = [];
		if (fgEl) fgEl.innerHTML = '';
		if (mgEl) mgEl.innerHTML = '';
		if (bgEl) bgEl.innerHTML = '';

		const body = loadDraftBody(id);
		if (body) loadIntoLayers(body);

		updateMeta();
		scheduleMeasure(60);
		draftsOpen = false;
	}

	function newDraft() {
		const id = createDraftId();
		const now = new Date().toISOString();
		draftsList = [{ id, title: '', updatedAt: now }, ...draftsList];
		writeIndex(draftsList);
		loadDraft(id);
	}

	function deleteDraft(id: string, e: Event) {
		e.stopPropagation();
		if (draftsList.length === 1 && id === currentDraftId) {
			title = '';
			if (fgEl) fgEl.innerHTML = '';
			if (mgEl) mgEl.innerHTML = '';
			if (bgEl) bgEl.innerHTML = '';
			pockets = [];
			marginNotes = [];
			scheduleSave();
			return;
		}

		removeDraftBody(id);
		draftsList = draftsList.filter((d) => d.id !== id);
		writeIndex(draftsList);

		if (id === currentDraftId) {
			const next = [...draftsList].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
			if (next) {
				loadDraft(next.id);
				draftsOpen = true;
			}
		}
	}

	function publish() {
		publishing = true;
		clearTimeout(saveTimer);
		const issue = incrementIssue();
		try {
			const now = new Date().toISOString();
			const fgHtml = stampAnchorsHtml(sanitizeHtml(fgEl?.innerHTML ?? ''));
			const mgHtml = sanitizeHtml(mgEl?.innerHTML ?? '');
			const bgHtml = sanitizeHtml(bgEl?.innerHTML ?? '');
			const cleanedPockets = pockets.map((p) => ({ ...p, html: sanitizeHtml(p.html) }));
			const cleanedMargins = marginNotes.map((m) => ({ ...m, html: sanitizeHtml(m.html) }));
			writePublishedLegacy({
				title: title.trim() || 'untitled letter',
				theme,
				motif,
				font,
				issue,
				publishedAt: now,
				layers: {
					foreground: { html: fgHtml, updatedAt: now },
					midground: { html: mgHtml, updatedAt: now },
					background: { html: bgHtml, updatedAt: now }
				},
				annotations: { pocketNotes: cleanedPockets, marginNotes: cleanedMargins },
				content: fgHtml
			});
			if (currentDraftId) {
				removeDraftBody(currentDraftId);
				draftsList = draftsList.filter((d) => d.id !== currentDraftId);
				writeIndex(draftsList);
				clearActiveDraftId();
			}
		} catch (e) {
			// ignore
		}
		setTimeout(() => {
			window.location.href = '/letter';
		}, 1800);
	}

	// ── pocket notes ──
	function newId(prefix: string) {
		return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
	}

	async function addPocket() {
		if (!pocketsOpen) pocketsOpen = true;
		const now = new Date().toISOString();
		const note: PocketNote = {
			id: newId('p'),
			html: '',
			layer: nextPocketLayer,
			createdAt: now,
			updatedAt: now
		};
		pockets = [...pockets, note];
		scheduleSave();
		await tick();
		const el = document.querySelector<HTMLElement>('[data-pocket-body="' + note.id + '"]');
		el?.focus();
	}

	function pocketBody(node: HTMLElement, html: string) {
		node.innerHTML = html ?? '';
		return {};
	}

	function onPocketInput(id: string, e: Event) {
		const html = (e.currentTarget as HTMLElement).innerHTML;
		const idx = pockets.findIndex((p) => p.id === id);
		if (idx < 0) return;
		const now = new Date().toISOString();
		pockets[idx] = { ...pockets[idx], html, updatedAt: now };
		scheduleSave();
	}

	function startConfirmDeletePocket(id: string) {
		confirmingPocketId = id;
		clearTimeout(pocketConfirmTimer);
		pocketConfirmTimer = setTimeout(() => {
			if (confirmingPocketId === id) confirmingPocketId = null;
		}, 3000);
	}
	function cancelConfirmDeletePocket() {
		confirmingPocketId = null;
		clearTimeout(pocketConfirmTimer);
	}
	function confirmDeletePocket(id: string) {
		pockets = pockets.filter((p) => p.id !== id);
		confirmingPocketId = null;
		clearTimeout(pocketConfirmTimer);
		scheduleSave();
	}

	function flipPocketsOrder() {
		pocketsOrder = pocketsOrder === 'oldest' ? 'newest' : 'oldest';
	}

	function pocketLayerLabel(layer: PocketLayer) {
		return layer === 'midground' ? 'mg' : 'bg';
	}

	// ── margin notes ──
	function onFgInput() {
		updateMeta();
		stampLiveAnchors();
		scheduleSave();
		scheduleMeasure();
		fgVersion += 1;
	}

	function onSelectionChange() {
		if (typeof window === 'undefined') return;
		if (activeLayer !== 'foreground') {
			selectionRect = null;
			selectionAnchorId = null;
			return;
		}
		const sel = window.getSelection();
		if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
			selectionRect = null;
			selectionAnchorId = null;
			return;
		}
		const range = sel.getRangeAt(0);
		const container =
			range.commonAncestorContainer.nodeType === Node.TEXT_NODE
				? range.commonAncestorContainer.parentElement
				: (range.commonAncestorContainer as Element);
		if (!fgEl || !container || !fgEl.contains(container)) {
			selectionRect = null;
			selectionAnchorId = null;
			return;
		}
		// Walk up to find the data-anchor block.
		let block: Element | null = container;
		while (block && block !== fgEl) {
			if (block instanceof HTMLElement && block.hasAttribute('data-anchor')) break;
			block = block.parentElement;
		}
		if (!block || block === fgEl) {
			selectionRect = null;
			selectionAnchorId = null;
			return;
		}
		const r = range.getBoundingClientRect();
		if (r.width === 0 && r.height === 0) {
			selectionRect = null;
			selectionAnchorId = null;
			return;
		}
		selectionAnchorId = (block as HTMLElement).getAttribute('data-anchor');
		selectionRect = { top: r.top + window.scrollY, left: r.left + window.scrollX, width: r.width };
	}

	async function addMarginNote(anchorId: string) {
		const now = new Date().toISOString();
		const note: MarginNote = {
			id: newId('m'),
			anchorId,
			html: '',
			createdAt: now,
			updatedAt: now
		};
		marginNotes = [...marginNotes, note];
		selectionRect = null;
		selectionAnchorId = null;
		scheduleSave();
		await tick();
		measureAnchors();
		const el = document.querySelector<HTMLElement>('[data-margin-id="' + note.id + '"]');
		el?.focus();
	}

	function marginBody(node: HTMLElement, html: string) {
		node.innerHTML = html ?? '';
		return {};
	}

	function onMarginInput(id: string, e: Event) {
		const html = (e.currentTarget as HTMLElement).innerHTML;
		const idx = marginNotes.findIndex((m) => m.id === id);
		if (idx < 0) return;
		const now = new Date().toISOString();
		marginNotes[idx] = { ...marginNotes[idx], html, updatedAt: now };
		scheduleSave();
	}

	function startConfirmDeleteMargin(id: string) {
		confirmingMarginId = id;
		clearTimeout(marginConfirmTimer);
		marginConfirmTimer = setTimeout(() => {
			if (confirmingMarginId === id) confirmingMarginId = null;
		}, 3000);
	}
	function cancelConfirmDeleteMargin() {
		confirmingMarginId = null;
		clearTimeout(marginConfirmTimer);
	}
	function confirmDeleteMargin(id: string) {
		marginNotes = marginNotes.filter((m) => m.id !== id);
		confirmingMarginId = null;
		clearTimeout(marginConfirmTimer);
		scheduleSave();
		scheduleMeasure();
	}

	// ── binder ──

	type LayerStat = { id: LayerId; words: number; preview: string; isEmpty: boolean };
	const layerStats = $derived.by<LayerStat[]>(() => {
		void fgVersion;
		const items: LayerStat[] = [];
		const sources: Record<LayerId, string> = {
			foreground: fgEl?.innerHTML ?? '',
			midground: mgEl?.innerHTML ?? '',
			background: bgEl?.innerHTML ?? ''
		};
		for (const id of LAYER_IDS) {
			const html = sources[id];
			items.push({
				id,
				words: countWords(html),
				preview: previewText(html),
				isEmpty: isEmptyHtml(html)
			});
		}
		return items;
	});

	const filteredPockets = $derived.by(() => {
		const arr = pocketsFilter === 'all' ? pockets : pockets.filter((p) => p.layer === pocketsFilter);
		return pocketsOrder === 'oldest'
			? [...arr].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
			: [...arr].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
	});

	type MarginEntry = { id: string; anchorId: string; preview: string; passage: string };
	const marginEntries = $derived.by<MarginEntry[]>(() => {
		void fgVersion;
		const out: MarginEntry[] = [];
		for (const m of marginNotes) {
			const block = fgEl?.querySelector('[data-anchor="' + m.anchorId + '"]');
			if (!block) continue; // skip orphans
			out.push({
				id: m.id,
				anchorId: m.anchorId,
				preview: previewText(m.html, 70) || '(empty note)',
				passage: previewText(block.textContent ?? '', 90)
			});
		}
		return out.sort((a, b) => a.anchorId.localeCompare(b.anchorId));
	});

	function toggleBinder(tab: BinderTab) {
		binderOpen = binderOpen === tab ? null : tab;
	}
	function closeBinder() {
		binderOpen = null;
	}
	function onBinderKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && binderOpen) {
			binderOpen = null;
		}
	}

	async function gotoLayer(layer: LayerId) {
		await setActiveLayer(layer);
	}
	async function gotoPocket(id: string, layer: PocketLayer) {
		// Open the inside cover panel and scroll/focus the matching note.
		if (!pocketsOpen) pocketsOpen = true;
		await tick();
		const el = document.querySelector<HTMLElement>('[data-pocket-body="' + id + '"]');
		if (!el) return;
		el.scrollIntoView({ behavior: 'smooth', block: 'center' });
		el.focus();
	}
	async function gotoMarginNote(id: string, anchorId: string) {
		// Margin notes only render on fg; switch first.
		if (activeLayer !== 'foreground') await setActiveLayer('foreground');
		await tick();
		const block = fgEl?.querySelector<HTMLElement>('[data-anchor="' + anchorId + '"]');
		if (block) {
			block.scrollIntoView({ behavior: 'smooth', block: 'center' });
			block.classList.add('anchor-flash');
			setTimeout(() => block.classList.remove('anchor-flash'), 1200);
		}
		await tick();
		measureAnchors();
		await tick();
		const noteEl = document.querySelector<HTMLElement>('[data-margin-id="' + id + '"]');
		noteEl?.focus();
	}

	$effect(() => {
		if (typeof window === 'undefined') return;
		window.addEventListener('keydown', onBinderKeydown);
		return () => window.removeEventListener('keydown', onBinderKeydown);
	});
</script>

<div class="motif-grain"></div>
<div class="motif-blob motif-blob-1"></div>
<div class="motif-blob motif-blob-2"></div>
<div class="motif-blob motif-blob-3"></div>
<div class="motif-blob motif-blob-4"></div>

<Topbar
	{activeLayer}
	layerIds={LAYER_IDS}
	layerLabels={LAYER_LABELS}
	bind:draftsOpen
	bind:pocketsOpen
	pocketsCount={pockets.length}
	onLayerChange={setActiveLayer}
/>

<DraftsModal
	bind:open={draftsOpen}
	drafts={draftsList}
	{currentDraftId}
	onSelect={loadDraft}
	onCreate={newDraft}
	onDelete={deleteDraft}
/>

<PublishOverlay active={publishing} />

<div class="editor-page" data-layer={activeLayer} bind:this={editorPageEl}>
	<div class="editor-wrap" data-layer={activeLayer}>
		{#if replyTo && replyToTitle}
			<a class="reply-breadcrumb" href="/letter?id={replyTo}" title="back to source letter">
				<span class="reply-breadcrumb-eyebrow">in reply to</span>
				<span class="reply-breadcrumb-title">{replyToTitle}</span>
				<span class="reply-breadcrumb-arrow" aria-hidden="true">↗</span>
			</a>
		{/if}
		<p class="doc-eyebrow">echoes · {activeLayer}</p>
		<input
			bind:this={titleEl}
			bind:value={title}
			oninput={scheduleSave}
			class="doc-title"
			type="text"
			placeholder="untitled letter"
			spellcheck="true"
			autocomplete="off"
		/>

		{#if activeLayer === 'foreground'}
			<EditorToolbar {bold} {italic} {underline} onCommand={exec} onInsertLink={insertLink} />
		{/if}

		<div
			bind:this={fgEl}
			class="doc-body layer-foreground"
			class:hidden={activeLayer !== 'foreground'}
			contenteditable="true"
			spellcheck="true"
			data-placeholder={LAYER_PLACEHOLDERS.foreground}
			oninput={onFgInput}
			onpaste={handlePaste}
			onkeyup={updateToolbarState}
			onmouseup={updateToolbarState}
			role="textbox"
			tabindex="0"
		></div>

		<div
			bind:this={mgEl}
			class="doc-body layer-midground"
			class:hidden={activeLayer !== 'midground'}
			contenteditable="true"
			spellcheck="true"
			data-placeholder={LAYER_PLACEHOLDERS.midground}
			oninput={() => { updateMeta(); scheduleSave(); fgVersion += 1; }}
			onpaste={handlePaste}
			role="textbox"
			tabindex="0"
		></div>

		<div
			bind:this={bgEl}
			class="doc-body layer-background"
			class:hidden={activeLayer !== 'background'}
			contenteditable="true"
			spellcheck="true"
			data-placeholder={LAYER_PLACEHOLDERS.background}
			oninput={() => { updateMeta(); scheduleSave(); fgVersion += 1; }}
			onpaste={handlePaste}
			role="textbox"
			tabindex="0"
		></div>

		{#if pocketsOpen}
			<section
				class="pockets-panel"
				aria-label="pockets"
				transition:slide={{ duration: 320, easing: cubicOut }}
			>
				<div class="pockets-divider" aria-hidden="true"></div>
				<div class="pockets-header">
					<span class="pockets-eyebrow">inside cover</span>
					<button class="pockets-order" onclick={flipPocketsOrder} title="flip ordering">
						{pocketsOrder === 'oldest' ? 'oldest first ↓' : 'newest first ↑'}
					</button>
				</div>
				<div class="pockets-list">
					{#each sortedPockets as note (note.id)}
						<div
							class="pocket-card pocket-card-{note.layer}"
							in:fly={{ y: 8, duration: 240, easing: cubicOut }}
							out:fly={{ y: -4, duration: 160, easing: cubicOut }}
						>
							<span class="pocket-layer-chip" title="{note.layer} pocket">{pocketLayerLabel(note.layer)}</span>
							<div
								class="pocket-body"
								contenteditable="true"
								spellcheck="true"
								use:pocketBody={note.html}
								oninput={(e) => onPocketInput(note.id, e)}
								onpaste={handlePaste}
								data-pocket-body={note.id}
								data-placeholder="…"
								role="textbox"
								tabindex="0"
							></div>
							<div class="pocket-controls">
								{#if confirmingPocketId === note.id}
									<button class="pocket-confirm"
										onclick={() => confirmDeletePocket(note.id)}
										onblur={cancelConfirmDeletePocket}>remove?</button>
								{:else}
									<button class="pocket-x"
										onclick={() => startConfirmDeletePocket(note.id)}
										title="remove this pocket"
										aria-label="remove pocket note">×</button>
								{/if}
							</div>
						</div>
					{/each}
					{#if pockets.length === 0}
						<p class="pockets-empty">a quiet place. tuck a thought in.</p>
					{/if}
				</div>
				<button class="pocket-add" onclick={addPocket} title="add a {nextPocketLayer} pocket">
					<span class="pocket-add-plus">+</span>
					<span class="pocket-add-label">{nextPocketLayer} pocket</span>
				</button>
			</section>
		{/if}
	</div>

	<aside
		class="margin-column"
		class:hidden={activeLayer !== 'foreground'}
		bind:this={marginColumnEl}
		aria-label="margin notes"
	>
		{#each visibleMarginGroups as group (group.anchorId)}
			<div class="margin-group" style:top="{group.offsetTop}px">
				{#each group.notes as note (note.id)}
					<div
						class="margin-note"
						in:fly={{ y: 6, duration: 220, easing: cubicOut }}
						out:fly={{ y: -3, duration: 140, easing: cubicOut }}
					>
						<span class="margin-anchor-ref" title="anchored to {group.anchorId}">{group.anchorId}</span>
						<div
							class="margin-body"
							contenteditable="true"
							spellcheck="true"
							use:marginBody={note.html}
							oninput={(e) => onMarginInput(note.id, e)}
							onpaste={handlePaste}
							data-margin-id={note.id}
							data-placeholder="margin note…"
							role="textbox"
							tabindex="0"
						></div>
						<div class="margin-controls">
							{#if confirmingMarginId === note.id}
								<button class="margin-confirm"
									onclick={() => confirmDeleteMargin(note.id)}
									onblur={cancelConfirmDeleteMargin}>remove?</button>
							{:else}
								<button class="margin-x"
									onclick={() => startConfirmDeleteMargin(note.id)}
									title="remove margin note"
									aria-label="remove margin note">×</button>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/each}
	</aside>
</div>

{#if selectionRect && selectionAnchorId && activeLayer === 'foreground'}
	<div
		class="selection-popover"
		style:top="{selectionRect.top - 38}px"
		style:left="{selectionRect.left + selectionRect.width / 2}px"
	>
		<button
			class="selection-popover-btn"
			onmousedown={(e) => {
				e.preventDefault();
				if (selectionAnchorId) addMarginNote(selectionAnchorId);
			}}
			title="add margin note"
		>+ note</button>
	</div>
{/if}

<!-- ── binder: right-edge tabs + slide-in panel ── -->
<div class="binder-tabs" role="tablist" aria-label="binder">
	{#each ['layers', 'pockets', 'notes'] as tab (tab)}
		<button
			class="binder-tab"
			class:active={binderOpen === tab}
			role="tab"
			aria-selected={binderOpen === tab}
			onclick={() => toggleBinder(tab as BinderTab)}
			title={tab}
		>
			<span class="binder-tab-label">{tab}</span>
		</button>
	{/each}
</div>

<aside
	class="binder-panel"
	class:open={binderOpen !== null}
	aria-hidden={binderOpen === null}
	role="region"
>
	{#if binderOpen === 'layers'}
		<header class="binder-header">
			<span class="binder-header-eyebrow">binder</span>
			<span class="binder-header-title">layers</span>
		</header>
		<div class="binder-body">
			{#each layerStats as stat (stat.id)}
				<button
					class="binder-row layer-row"
					class:active={activeLayer === stat.id}
					onclick={() => gotoLayer(stat.id)}
					title="edit {stat.id}"
				>
					<span class="binder-row-head">
						<span class="binder-row-name">{stat.id}</span>
						<span class="binder-row-meta">{stat.words} word{stat.words === 1 ? '' : 's'}</span>
					</span>
					<span class="binder-row-preview" class:dim={stat.isEmpty}>
						{stat.isEmpty ? 'empty' : stat.preview}
					</span>
				</button>
			{/each}
		</div>
	{/if}

	{#if binderOpen === 'pockets'}
		<header class="binder-header">
			<span class="binder-header-eyebrow">binder</span>
			<span class="binder-header-title">pockets · {pockets.length}</span>
		</header>
		<div class="binder-controls">
			<div class="binder-filter">
				{#each ['all', 'midground', 'background'] as f (f)}
					<button
						class="binder-filter-btn"
						class:active={pocketsFilter === f}
						onclick={() => (pocketsFilter = f as 'all' | PocketLayer)}
					>{f === 'all' ? 'all' : f === 'midground' ? 'mg' : 'bg'}</button>
				{/each}
			</div>
			<button class="binder-sort" onclick={flipPocketsOrder} title="flip ordering">
				{pocketsOrder === 'oldest' ? 'oldest ↓' : 'newest ↑'}
			</button>
		</div>
		<div class="binder-body">
			{#if filteredPockets.length === 0}
				<p class="binder-empty">nothing here.</p>
			{:else}
				{#each filteredPockets as note (note.id)}
					<button
						class="binder-row pocket-row pocket-row-{note.layer}"
						onclick={() => gotoPocket(note.id, note.layer)}
						title="open in inside cover"
					>
						<span class="binder-row-head">
							<span class="binder-chip">{pocketLayerLabel(note.layer)}</span>
						</span>
						<span class="binder-row-preview" class:dim={isEmptyHtml(note.html)}>
							{isEmptyHtml(note.html) ? '(empty)' : previewText(note.html, 110)}
						</span>
					</button>
				{/each}
			{/if}
		</div>
	{/if}

	{#if binderOpen === 'notes'}
		<header class="binder-header">
			<span class="binder-header-eyebrow">binder</span>
			<span class="binder-header-title">margin notes · {marginEntries.length}</span>
		</header>
		<div class="binder-body">
			{#if marginEntries.length === 0}
				<p class="binder-empty">no margin notes yet.</p>
			{:else}
				{#each marginEntries as entry (entry.id)}
					<button
						class="binder-row margin-row"
						onclick={() => gotoMarginNote(entry.id, entry.anchorId)}
						title="scroll to {entry.anchorId}"
					>
						<span class="binder-row-head">
							<span class="binder-chip binder-chip-anchor">{entry.anchorId}</span>
						</span>
						<span class="binder-row-passage">{entry.passage || '(passage missing)'}</span>
						<span class="binder-row-preview">{entry.preview}</span>
					</button>
				{/each}
			{/if}
		</div>
	{/if}
</aside>

<BottomBar
	{saveStatus}
	{wordCount}
	bind:theme
	bind:motif
	bind:font
	{palettes}
	motifs={motifList}
	fonts={fontPairs}
	{activeLayer}
	{fgIsEmpty}
	onPublish={publish}
/>

<style>
	:global(*),
	:global(*::before),
	:global(*::after) {
		box-sizing: border-box;
		margin: 0;
		padding: 0;
	}
	:global(html), :global(body) { height: 100%; }
	:global(body) {
		background: var(--bg);
		color: var(--text);
		font-family: var(--editor-mono, var(--font-mono));
		font-weight: 300;
		min-height: 100vh;
		overflow-x: hidden;
		position: relative;
		transition: background 0.3s ease, color 0.3s ease;
	}

	.editor-page {
		position: relative;
		z-index: 2;
		display: flex;
		justify-content: center;
		align-items: flex-start;
		gap: 2.4rem;
		padding-top: 0;
	}
	.editor-wrap {
		max-width: 680px;
		width: 100%;
		padding: 84px clamp(1.5rem, 5vw, 2.5rem) 96px;
		flex-shrink: 0;
		transition: max-width 0.3s ease;
	}
	.editor-wrap[data-layer='midground'] { max-width: 600px; }
	.editor-wrap[data-layer='background'] { max-width: 540px; }

	.margin-column {
		position: relative;
		width: 280px;
		flex-shrink: 0;
		padding-top: 84px;
		padding-bottom: 96px;
		min-height: 100vh;
	}
	.margin-column.hidden { visibility: hidden; }

	.margin-group {
		position: absolute;
		left: 0;
		right: 0;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		transition: top 0.18s ease;
	}
	.margin-note {
		position: relative;
		padding: 0.7rem 2rem 0.7rem 0.9rem;
		border: 1px solid var(--rule);
		border-radius: 6px;
		background: color-mix(in srgb, var(--surface) 50%, transparent);
		transition: border-color 0.22s ease, background 0.22s ease, box-shadow 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	.margin-note:focus-within {
		border-color: color-mix(in srgb, var(--accent) 45%, transparent);
		background: color-mix(in srgb, var(--surface) 80%, transparent);
		box-shadow: 0 1px 0 color-mix(in srgb, var(--accent) 18%, transparent);
	}
	.margin-anchor-ref {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.48rem;
		letter-spacing: 0.16em;
		text-transform: lowercase;
		color: var(--muted);
		opacity: 0.45;
		display: block;
		margin-bottom: 0.35rem;
	}
	.margin-body {
		font-family: var(--editor-body, var(--font-body));
		font-size: 0.86rem;
		line-height: 1.55;
		color: var(--muted);
		font-style: italic;
		outline: none;
		caret-color: var(--accent-deep);
		min-height: 1.2em;
	}
	.margin-body :global(*) { font-family: var(--editor-body, var(--font-body)); }
	.margin-body :global(strong) { font-weight: 600; font-style: italic; }
	.margin-body :global(em) { font-style: normal; }
	.margin-body:empty::before {
		content: attr(data-placeholder);
		color: var(--muted);
		opacity: 0.3;
		pointer-events: none;
	}
	.margin-controls {
		position: absolute;
		top: 0.25rem;
		right: 0.35rem;
	}
	.margin-x {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.78rem;
		line-height: 1;
		color: var(--muted);
		background: none;
		border: none;
		padding: 3px 6px;
		border-radius: 50%;
		cursor: pointer;
		opacity: 0.3;
		transition: color 0.18s ease, background 0.18s ease, opacity 0.18s ease, transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	.margin-x:hover {
		opacity: 0.95;
		color: var(--accent-strong);
		background: color-mix(in srgb, var(--accent) 18%, transparent);
		transform: rotate(90deg);
	}
	.margin-confirm {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.5rem;
		letter-spacing: 0.12em;
		text-transform: lowercase;
		color: var(--accent-strong);
		background: color-mix(in srgb, var(--accent) 25%, transparent);
		border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
		padding: 2px 8px;
		border-radius: 12px;
		cursor: pointer;
		font-style: italic;
		transition: background 0.2s ease, border-color 0.2s ease;
	}
	.margin-confirm:hover {
		background: color-mix(in srgb, var(--accent) 40%, transparent);
		border-color: var(--accent-strong);
	}

	/* selection popover */
	.selection-popover {
		position: absolute;
		z-index: 50;
		transform: translateX(-50%);
		animation: pop-rise 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	@keyframes pop-rise {
		from { opacity: 0; transform: translateX(-50%) translateY(4px) scale(0.96); }
		to   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
	}
	.selection-popover-btn {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.58rem;
		letter-spacing: 0.14em;
		text-transform: lowercase;
		color: var(--bg);
		background: var(--accent-strong);
		border: none;
		padding: 6px 14px;
		border-radius: 100px;
		cursor: pointer;
		box-shadow: 0 4px 14px color-mix(in srgb, var(--accent-deep) 35%, transparent);
		transition: background 0.18s ease, transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	.selection-popover-btn:hover {
		background: var(--accent-deep);
		transform: translateY(-1px);
	}

	/* ── narrow screen fallback for margin column ── */
	@media (max-width: 1100px) {
		.editor-page {
			flex-direction: column;
			align-items: center;
			gap: 0;
		}
		.margin-column {
			width: 100%;
			max-width: 680px;
			min-height: 0;
			padding-top: 0;
			padding-bottom: 1rem;
		}
		.margin-column.hidden { display: none; visibility: visible; }
		.margin-group {
			position: static;
			margin: 0 clamp(1.5rem, 5vw, 2.5rem) 0.6rem;
		}
	}

	.doc-eyebrow {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.58rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--muted);
		opacity: 0.45;
		margin-bottom: 1rem;
	}

	.reply-breadcrumb {
		display: inline-flex;
		align-items: baseline;
		gap: 0.65rem;
		margin-bottom: 1.1rem;
		text-decoration: none;
		padding: 6px 12px;
		border-radius: 100px;
		border: 1px solid var(--rule);
		background: color-mix(in srgb, var(--surface) 40%, transparent);
		transition: opacity 0.2s ease, border-color 0.2s ease, background 0.2s ease, transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	.reply-breadcrumb:hover {
		border-color: color-mix(in srgb, var(--accent) 40%, transparent);
		background: color-mix(in srgb, var(--accent) 10%, transparent);
		transform: translateY(-1px);
	}
	.reply-breadcrumb-eyebrow {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.5rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--muted);
		opacity: 0.55;
	}
	.reply-breadcrumb-title {
		font-family: var(--editor-display, var(--font-display));
		font-style: italic;
		color: var(--accent-strong);
		font-size: 0.95rem;
		max-width: 22em;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.reply-breadcrumb-arrow {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.7rem;
		color: var(--accent-strong);
		opacity: 0.7;
	}

	.doc-title {
		font-family: var(--editor-display, var(--font-display));
		font-size: clamp(2rem, 6vw, 3.4rem);
		font-weight: 300;
		font-style: italic;
		color: var(--accent-strong);
		background: none;
		border: none;
		outline: none;
		width: 100%;
		padding: 0;
		margin-bottom: 2.4rem;
		caret-color: var(--accent-deep);
		line-height: 1.1;
	}
	.doc-title::placeholder { color: var(--muted); opacity: 0.28; }

	.doc-body, .doc-body :global(*) {
		font-family: var(--editor-body, var(--font-body));
	}
	.doc-body :global(h1), .doc-body :global(h2), .doc-body :global(h3) {
		font-family: var(--editor-display, var(--font-display));
	}
	.doc-body {
		font-size: 1.05rem;
		line-height: 1.9;
		color: var(--text);
		min-height: 52vh;
		outline: none;
		caret-color: var(--accent-deep);
	}
	.doc-body.hidden { display: none; }
	.doc-body:empty::before {
		content: attr(data-placeholder);
		color: var(--muted);
		opacity: 0.3;
		pointer-events: none;
		font-style: italic;
	}
	.doc-body :global(h1) {
		font-size: 2rem; font-weight: 300; color: var(--accent-strong);
		line-height: 1.15; margin: 1.8em 0 0.4em;
	}
	.doc-body :global(h2) {
		font-size: 1.35rem; font-weight: 300; font-style: italic;
		color: var(--accent-deep); line-height: 1.2; margin: 1.4em 0 0.35em;
	}
	.doc-body :global(p) { margin-bottom: 1em; }
	.doc-body :global(p:last-child) { margin-bottom: 0; }
	.doc-body :global(blockquote) {
		border-left: 2px solid var(--accent);
		padding: 0.1em 0 0.1em 1.2em;
		margin: 1.3em 0;
		font-style: italic;
		color: var(--muted);
	}
	.doc-body :global(ul), .doc-body :global(ol) { padding-left: 1.4em; margin: 0.8em 0; }
	.doc-body :global(li) { margin-bottom: 0.2em; }
	.doc-body :global(a) {
		color: var(--accent-strong);
		text-decoration: none;
		border-bottom: 1px solid color-mix(in srgb, var(--accent-strong) 22%, transparent);
	}
	.doc-body :global(a:hover) { border-bottom-color: var(--accent-strong); }
	.doc-body :global(strong) { font-weight: 600; }
	.doc-body :global(em) { font-style: italic; }

	.layer-midground { font-size: 0.98rem; line-height: 1.78; color: var(--muted); }
	.layer-background {
		font-size: 0.9rem; line-height: 1.7; color: var(--muted);
		opacity: 0.78; font-style: italic;
	}

	/* ── pockets panel ── */
	.pockets-panel { margin-top: 3.2rem; padding-top: 0; }
	.pockets-divider {
		height: 1px;
		width: 100%;
		background: linear-gradient(90deg, transparent 0%, var(--rule) 18%,
			color-mix(in srgb, var(--accent) 35%, transparent) 50%,
			var(--rule) 82%, transparent 100%);
		opacity: 0.7;
		margin-bottom: 1.4rem;
	}
	.pockets-header {
		display: flex; align-items: baseline; justify-content: space-between;
		margin-bottom: 1.2rem;
	}
	.pockets-eyebrow {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.58rem; letter-spacing: 0.22em;
		text-transform: uppercase; color: var(--muted); opacity: 0.55;
	}
	.pockets-order {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.55rem; letter-spacing: 0.14em;
		text-transform: lowercase; color: var(--muted);
		background: none; border: 1px dashed transparent;
		padding: 3px 8px; border-radius: 4px; cursor: pointer;
		opacity: 0.55;
		transition: color 0.18s ease, border-color 0.18s ease, opacity 0.18s ease, transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	.pockets-order:hover {
		opacity: 0.95; color: var(--accent-strong);
		border-color: color-mix(in srgb, var(--accent) 35%, transparent);
		transform: translateY(-1px);
	}
	.pockets-list { display: flex; flex-direction: column; gap: 0.9rem; }
	.pockets-empty {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.65rem; letter-spacing: 0.08em;
		color: var(--muted); opacity: 0.4;
		font-style: italic;
		padding: 1.2rem 0.4rem;
		text-align: center;
	}
	.pocket-card {
		position: relative;
		padding: 0.95rem 2.4rem 0.95rem 1.1rem;
		border: 1px solid var(--rule);
		border-radius: 8px;
		background: color-mix(in srgb, var(--surface) 55%, transparent);
		transition: border-color 0.22s ease, background 0.22s ease, box-shadow 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	.pocket-card:focus-within {
		border-color: color-mix(in srgb, var(--accent) 45%, transparent);
		background: color-mix(in srgb, var(--surface) 80%, transparent);
		box-shadow: 0 1px 0 color-mix(in srgb, var(--accent) 18%, transparent);
	}
	.pocket-card-background {
		background: color-mix(in srgb, var(--surface) 35%, transparent);
		border-style: dashed;
		opacity: 0.92;
	}
	.pocket-layer-chip {
		position: absolute;
		top: 0.5rem; left: 0.55rem;
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.5rem; letter-spacing: 0.16em;
		text-transform: lowercase;
		color: var(--muted);
		background: color-mix(in srgb, var(--surface) 90%, transparent);
		padding: 1px 5px; border-radius: 6px;
		opacity: 0.6; pointer-events: none;
	}
	.pocket-card-background .pocket-layer-chip {
		color: var(--accent-deep); opacity: 0.7;
	}
	.pocket-body {
		font-family: var(--editor-body, var(--font-body));
		font-size: 0.96rem; line-height: 1.65;
		color: var(--text);
		outline: none; caret-color: var(--accent-deep);
		min-height: 1.5em;
		margin-top: 0.6rem;
	}
	.pocket-body :global(*) { font-family: var(--editor-body, var(--font-body)); }
	.pocket-card-background .pocket-body {
		font-style: italic; color: var(--muted); font-size: 0.92rem;
	}
	.pocket-body:empty::before {
		content: attr(data-placeholder);
		color: var(--muted); opacity: 0.35;
		pointer-events: none; font-style: italic;
	}
	.pocket-body :global(strong) { font-weight: 600; }
	.pocket-body :global(em) { font-style: italic; }
	.pocket-controls { position: absolute; top: 0.4rem; right: 0.5rem; }
	.pocket-x {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.85rem; line-height: 1;
		color: var(--muted);
		background: none; border: none;
		padding: 4px 7px; border-radius: 50%;
		cursor: pointer; opacity: 0.35;
		transition: color 0.18s ease, background 0.18s ease, opacity 0.18s ease, transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	.pocket-x:hover {
		opacity: 0.95; color: var(--accent-strong);
		background: color-mix(in srgb, var(--accent) 18%, transparent);
		transform: rotate(90deg);
	}
	.pocket-confirm {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.55rem; letter-spacing: 0.12em;
		text-transform: lowercase;
		color: var(--accent-strong);
		background: color-mix(in srgb, var(--accent) 25%, transparent);
		border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
		padding: 3px 10px; border-radius: 12px;
		cursor: pointer; font-style: italic;
		transition: background 0.2s ease, border-color 0.2s ease, transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	.pocket-confirm:hover {
		background: color-mix(in srgb, var(--accent) 40%, transparent);
		border-color: var(--accent-strong);
		transform: translateY(-1px);
	}
	.pocket-add {
		display: inline-flex; align-items: center; gap: 0.55em;
		margin-top: 1.1rem;
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.6rem; letter-spacing: 0.16em;
		text-transform: lowercase;
		color: var(--muted);
		background: none; border: 1px dashed var(--rule);
		padding: 8px 16px; border-radius: 100px;
		cursor: pointer; opacity: 0.7;
		transition: color 0.22s ease, border-color 0.22s ease, background 0.22s ease, opacity 0.22s ease, transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	.pocket-add:hover {
		color: var(--accent-strong);
		border-color: color-mix(in srgb, var(--accent) 50%, transparent);
		background: color-mix(in srgb, var(--accent) 10%, transparent);
		opacity: 1;
		transform: translateY(-1px);
	}
	.pocket-add-plus { font-size: 0.85rem; line-height: 1; font-weight: 400; }

	/* ── binder ── */
	.binder-tabs {
		position: fixed;
		right: 0;
		top: 50%;
		transform: translateY(-50%);
		display: flex;
		flex-direction: column;
		gap: 4px;
		z-index: 30;
	}
	.binder-tab {
		writing-mode: vertical-rl;
		transform: rotate(180deg);
		padding: 12px 6px;
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.55rem;
		letter-spacing: 0.18em;
		text-transform: lowercase;
		color: var(--muted);
		background: var(--surface);
		backdrop-filter: blur(18px);
		-webkit-backdrop-filter: blur(18px);
		border: 1px solid var(--rule);
		border-right: none;
		border-radius: 6px 0 0 6px;
		cursor: pointer;
		opacity: 0.75;
		transition: color 0.22s ease, background 0.22s ease, border-color 0.22s ease, opacity 0.22s ease, transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1), padding-right 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	.binder-tab:hover {
		opacity: 1;
		color: var(--accent-strong);
	}
	.binder-tab.active {
		color: var(--accent-strong);
		opacity: 1;
		background: color-mix(in srgb, var(--accent) 22%, var(--surface) 78%);
		border-color: color-mix(in srgb, var(--accent) 40%, transparent);
		padding-right: 10px;
	}
	.binder-tab-label { display: inline-block; }

	.binder-panel {
		position: fixed;
		top: 42px;
		bottom: 46px;
		right: 32px;
		width: min(360px, calc(100vw - 64px));
		background: var(--surface);
		backdrop-filter: blur(22px);
		-webkit-backdrop-filter: blur(22px);
		border-left: 1px solid var(--rule);
		z-index: 25;
		display: flex;
		flex-direction: column;
		transform: translateX(calc(100% + 32px));
		transition: transform 0.34s cubic-bezier(0.34, 1.36, 0.64, 1), box-shadow 0.34s ease;
		box-shadow: none;
	}
	.binder-panel.open {
		transform: translateX(0);
		box-shadow: -10px 0 36px color-mix(in srgb, var(--accent-deep) 16%, transparent);
	}

	.binder-header {
		padding: 1.1rem 1.2rem 0.75rem;
		border-bottom: 1px solid var(--rule);
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.binder-header-eyebrow {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.5rem;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: var(--muted);
		opacity: 0.55;
	}
	.binder-header-title {
		font-family: var(--editor-display, var(--font-display));
		font-size: 1.25rem;
		font-weight: 300;
		font-style: italic;
		color: var(--accent-strong);
	}

	.binder-controls {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.7rem 1.2rem 0.6rem;
		border-bottom: 1px solid var(--rule);
	}
	.binder-filter { display: inline-flex; gap: 2px; }
	.binder-filter-btn {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.52rem;
		letter-spacing: 0.14em;
		text-transform: lowercase;
		color: var(--muted);
		background: none;
		border: 1px solid transparent;
		padding: 3px 8px;
		border-radius: 4px;
		cursor: pointer;
		opacity: 0.55;
		transition: color 0.18s ease, background 0.18s ease, border-color 0.18s ease, opacity 0.18s ease;
	}
	.binder-filter-btn:hover { opacity: 0.95; color: var(--accent-strong); }
	.binder-filter-btn.active {
		color: var(--accent-strong);
		opacity: 1;
		background: color-mix(in srgb, var(--accent) 22%, transparent);
		border-color: color-mix(in srgb, var(--accent) 40%, transparent);
	}
	.binder-sort {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.52rem;
		letter-spacing: 0.14em;
		text-transform: lowercase;
		color: var(--muted);
		background: none;
		border: 1px dashed transparent;
		padding: 3px 8px;
		border-radius: 4px;
		cursor: pointer;
		opacity: 0.6;
		transition: color 0.18s ease, border-color 0.18s ease, opacity 0.18s ease, transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	.binder-sort:hover {
		opacity: 0.95;
		color: var(--accent-strong);
		border-color: color-mix(in srgb, var(--accent) 35%, transparent);
		transform: translateY(-1px);
	}

	.binder-body {
		flex: 1;
		overflow-y: auto;
		padding: 0.7rem 1.2rem 1.4rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.binder-empty {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.6rem;
		letter-spacing: 0.1em;
		color: var(--muted);
		opacity: 0.4;
		font-style: italic;
		padding: 1rem 0.4rem;
		text-align: center;
	}

	.binder-row {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		padding: 0.7rem 0.85rem;
		border: 1px solid var(--rule);
		border-radius: 6px;
		background: color-mix(in srgb, var(--surface) 30%, transparent);
		text-align: left;
		cursor: pointer;
		transition: border-color 0.2s ease, background 0.2s ease, transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
		font-family: var(--editor-mono, var(--font-mono));
	}
	.binder-row:hover {
		border-color: color-mix(in srgb, var(--accent) 40%, transparent);
		background: color-mix(in srgb, var(--surface) 70%, transparent);
		transform: translateY(-1px);
	}
	.binder-row.active {
		border-color: color-mix(in srgb, var(--accent) 60%, transparent);
		background: color-mix(in srgb, var(--accent) 12%, var(--surface) 88%);
	}
	.binder-row-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.binder-row-name {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.6rem;
		letter-spacing: 0.16em;
		text-transform: lowercase;
		color: var(--accent-strong);
	}
	.binder-row.active .binder-row-name { color: var(--accent-deep); }
	.binder-row-meta {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.5rem;
		letter-spacing: 0.1em;
		color: var(--muted);
		opacity: 0.6;
	}
	.binder-row-preview {
		font-family: var(--editor-body, var(--font-body));
		font-size: 0.78rem;
		line-height: 1.45;
		color: var(--muted);
		font-style: italic;
	}
	.binder-row-preview.dim { opacity: 0.4; }
	.binder-row-passage {
		font-family: var(--editor-body, var(--font-body));
		font-size: 0.74rem;
		line-height: 1.4;
		color: var(--text);
		opacity: 0.85;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.binder-chip {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.5rem;
		letter-spacing: 0.16em;
		text-transform: lowercase;
		color: var(--muted);
		background: color-mix(in srgb, var(--surface) 90%, transparent);
		padding: 1px 5px;
		border-radius: 6px;
		opacity: 0.7;
	}
	.binder-chip-anchor { color: var(--accent-deep); }

	.pocket-row-background { border-style: dashed; }
	.pocket-row-background .binder-row-preview { opacity: 0.7; }

	/* anchor flash for "scroll to" feedback */
	.doc-body :global(.anchor-flash) {
		background: color-mix(in srgb, var(--accent) 22%, transparent);
		transition: background 1.2s ease;
		border-radius: 3px;
	}

	@media (max-width: 700px) {
		.binder-panel {
			right: 28px;
			width: calc(100vw - 56px);
		}
	}
</style>
