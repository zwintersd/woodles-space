<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { fly, slide, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import Topbar from '$lib/Topbar.svelte';
	import BottomBar from '$lib/BottomBar.svelte';
	import EditorToolbar from '$lib/EditorToolbar.svelte';
	import DraftsModal from '$lib/DraftsModal.svelte';
	import PocketsPanel from '$lib/PocketsPanel.svelte';
	import MarginNotesColumn from '$lib/MarginNotes.svelte';
	import SelectionPopover from '$lib/SelectionPopover.svelte';
	import Binder from '$lib/Binder.svelte';
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
	import {
		newId,
		type LayerId,
		type PocketLayer,
		type PocketNote,
		type PocketsOrder,
		type MarginNote,
		type BinderTab,
		type LayerStat,
		type MarginEntry,
		type MarginGroup
	} from '$lib/types';
	import {
		palettes,
		motifs as motifList,
		fontPairs,
		templates,
		findTemplate,
		findFont,
		findPalette,
		findMotif
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

	const nextPocketLayer = $derived<PocketLayer>(
		activeLayer === 'background' ? 'background' : 'midground'
	);

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

		// Hygge design playground passes ?palette=&motif=&font= to pre-style the editor.
		const hyggeParams = {
			palette: params.get('palette'),
			motif:   params.get('motif'),
			font:    params.get('font'),
		};
		const hasHyggeStyle = hyggeParams.palette || hyggeParams.motif || hyggeParams.font;
		if (hasHyggeStyle) {
			history.replaceState(null, '', window.location.pathname);
		}

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

		// Apply hygge-sourced style overrides after any draft is loaded.
		if (hasHyggeStyle) {
			if (hyggeParams.palette && findPalette(hyggeParams.palette).id === hyggeParams.palette) theme = hyggeParams.palette;
			if (hyggeParams.motif   && findMotif(hyggeParams.motif).id   === hyggeParams.motif)   motif = hyggeParams.motif;
			if (hyggeParams.font    && findFont(hyggeParams.font).id      === hyggeParams.font)    font  = hyggeParams.font;
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

	function selectTemplate(templateId: string) {
		const t = findTemplate(templateId);
		if (!t) return;

		const mgEmpty = isEmptyHtml(mgEl?.innerHTML ?? '');
		const bgEmpty = isEmptyHtml(bgEl?.innerHTML ?? '');
		const currentDraftIsEmpty = fgIsEmpty && !title && mgEmpty && bgEmpty && pockets.length === 0 && marginNotes.length === 0;

		if (!currentDraftIsEmpty) {
			// Auto save current draft first
			if (currentDraftId) {
				const now = new Date().toISOString();
				saveDraft(currentDraftId, {
					title, theme, motif, font,
					layers: {
						foreground: { html: fgEl?.innerHTML ?? '', updatedAt: now },
						midground: { html: mgEl?.innerHTML ?? '', updatedAt: now },
						background: { html: bgEl?.innerHTML ?? '', updatedAt: now }
					},
					annotations: { pocketNotes: pockets, marginNotes },
					content: fgEl?.innerHTML ?? '',
					savedAt: now
				});
			}
			const id = createDraftId();
			const now = new Date().toISOString();
			draftsList = [{ id, title: t.sampleTitle, updatedAt: now }, ...draftsList];
			writeIndex(draftsList);
			currentDraftId = id;
			setActiveDraftId(id);
		}

		loadIntoLayers({
			title: t.sampleTitle,
			theme: t.palette,
			motif: t.motif,
			font: t.font,
			content: t.sampleContent
		});
		updateMeta();
		scheduleMeasure(60);
		scheduleSave();

		binderOpen = null;
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

	async function onSelectTemplate(templateId: string) {
		const t = findTemplate(templateId);
		if (!t) return;

		// Check if current draft is empty
		const fgIsCurrentlyEmpty = isEmptyHtml(fgEl?.innerHTML ?? '');

		if (fgIsCurrentlyEmpty) {
			// Load directly into current draft
			loadIntoLayers({
				title: t.sampleTitle,
				theme: t.palette,
				motif: t.motif,
				font: t.font,
				content: t.sampleContent
			});
			updateMeta();
			scheduleSave();
		} else {
			// Save current draft and create new one for template
			clearTimeout(saveTimer);
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
			if (currentDraftId) {
				saveDraft(currentDraftId, draftData);
			}

			// Create new draft for template
			const newId = createDraftId();
			const newTime = new Date().toISOString();
			draftsList = [{ id: newId, title: t.sampleTitle, updatedAt: newTime }, ...draftsList];
			writeIndex(draftsList);
			currentDraftId = newId;
			setActiveDraftId(newId);

			// Load template into new draft
			title = t.sampleTitle;
			theme = t.palette;
			motif = t.motif;
			font = t.font;
			pockets = [];
			marginNotes = [];
			if (fgEl) fgEl.innerHTML = sanitizeHtml(t.sampleContent);
			if (mgEl) mgEl.innerHTML = '';
			if (bgEl) bgEl.innerHTML = '';
			stampLiveAnchors();

			updateMeta();
			scheduleSave();
		}

		binderOpen = null;
		await tick();
		scheduleMeasure(60);
	}

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
			<PocketsPanel
				{pockets}
				bind:order={pocketsOrder}
				confirmingId={confirmingPocketId}
				nextLayer={nextPocketLayer}
				onAdd={addPocket}
				onInput={onPocketInput}
				onPaste={handlePaste}
				onStartConfirmDelete={startConfirmDeletePocket}
				onCancelConfirmDelete={cancelConfirmDeletePocket}
				onConfirmDelete={confirmDeletePocket}
			/>
		{/if}
	</div>

	<MarginNotesColumn
		bind:columnEl={marginColumnEl}
		groups={visibleMarginGroups}
		confirmingId={confirmingMarginId}
		hidden={activeLayer !== 'foreground'}
		onInput={onMarginInput}
		onPaste={handlePaste}
		onStartConfirmDelete={startConfirmDeleteMargin}
		onCancelConfirmDelete={cancelConfirmDeleteMargin}
		onConfirmDelete={confirmDeleteMargin}
	/>
</div>

<SelectionPopover
	rect={selectionRect && selectionAnchorId && activeLayer === 'foreground' ? selectionRect : null}
	onAdd={() => { if (selectionAnchorId) addMarginNote(selectionAnchorId); }}
/>

<Binder
	bind:open={binderOpen}
	{activeLayer}
	{layerStats}
	{pockets}
	bind:filter={pocketsFilter}
	bind:order={pocketsOrder}
	{marginEntries}
	{templates}
	onLayerGoto={gotoLayer}
	onPocketGoto={gotoPocket}
	onMarginGoto={gotoMarginNote}
	onSelectTemplate={selectTemplate}
	onSelectTemplate={onSelectTemplate}
/>

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

	/* ── narrow screen fallback for editor-page ── */
	@media (max-width: 1100px) {
		.editor-page {
			flex-direction: column;
			align-items: center;
			gap: 0;
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


	/* anchor flash for "scroll to" feedback (the anchor lives in .doc-body
	   in the parent; the binder's gotoMarginNote adds the class there). */
	.doc-body :global(.anchor-flash) {
		background: color-mix(in srgb, var(--accent) 22%, transparent);
		transition: background 1.2s ease;
		border-radius: 3px;
	}

</style>
