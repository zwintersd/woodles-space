<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { fly, slide, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import Topbar from '$lib/Topbar.svelte';
	import BottomBar from '$lib/BottomBar.svelte';
	import EditorToolbar from '$lib/EditorToolbar.svelte';
	import DraftsModal from '$lib/DraftsModal.svelte';
	import DraftPromptModal from '$lib/DraftPromptModal.svelte';
	import PocketsPanel from '$lib/PocketsPanel.svelte';
	import MarginNotesColumn from '$lib/MarginNotes.svelte';
	import SelectionPopover from '$lib/SelectionPopover.svelte';
	import Binder from '$lib/Binder.svelte';
	import PublishOverlay, { type PublishStatus } from '$lib/PublishOverlay.svelte';
	import EchoesSyncPanel from '$lib/EchoesSyncPanel.svelte';
	import Liquid from '$lib/Liquid.svelte';
	import { emptyBoard, itemCount, type LiquidBoard } from '$lib/liquid';
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
		saveLettersList,
		newLetterId,
		writePublishedLegacy,
		type StoredLetter
	} from '$lib/letters';
	import { syncState, initSync, flushSync, publishMentionsLocally } from '$lib/sync.svelte';
	import { hasPassphrase, SyncError } from '@woodles/sync';
	import ReferencePicker from '$lib/ReferencePicker.svelte';
	import {
		referenceHref,
		refreshReferenceSources,
		shelfSource,
		type ReferenceCandidate,
		type Sigil
	} from '$lib/references.svelte';
	import {
		caretRect,
		insertReferenceAtCaret,
		readTrigger,
		textBeforeCaret,
		type ReferenceTrigger
	} from '$lib/referenceTrigger';
	import {
		bootstrap as bootstrapDrafts,
		createDraftId,
		cycleDraftStatus,
		listDrafts,
		loadDraft as loadDraftBody,
		saveDraft,
		removeDraftBody,
		setActiveDraftId,
		clearActiveDraftId,
		statusesFor,
		textToHtml,
		upsertIndex,
		writeIndex,
		type DraftIndexItem,
		type DraftBody
	} from '$lib/drafts';
	import { backlinkCounts as backlinkCountsFor } from '$lib/backlinks';
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
		WRITING_KINDS,
		kindSpec,
		coerceKind,
		coerceGoal,
		parseGoalInput,
		type WritingKind
	} from '$lib/kinds';
	import {
		DEFAULT_VIEW_PREFS,
		assignLayer,
		isLayerVisible,
		loadViewPrefs,
		pageOrder,
		saveViewPrefs,
		sideOf,
		type PageSide,
		type ViewMode,
		type ViewPrefs
	} from '$lib/spread';
	import {
		palettes,
		motifs as motifList,
		fontPairs,
		templates,
		findTemplate,
		findFont,
		findPalette,
		findMotif,
		isValidCustomPalette,
		decodeCustomPalette,
		customPaletteTokens,
		CUSTOM_PALETTE_CSS_VARS
	} from '@shared/library.js';

	// Declared in the manifest as write's addressableBy — a `#` reference to
	// another draft resolves to `/write?draft=<id>` (see references.svelte.ts's
	// draft source and REFERENCES.md).
	const DRAFT_PARAM = 'draft';

	const LAYER_IDS: LayerId[] = ['foreground', 'midground', 'background'];
	const LAYER_LABELS: Record<LayerId, string> = {
		foreground: 'fg',
		midground: 'mg',
		background: 'bg'
	};
	const LAYER_TITLES: Record<LayerId, string> = {
		foreground: 'foreground — the prose',
		midground: 'midground — thinking and working notes',
		background: 'background — the impulse'
	};

	let title = $state('');
	let theme = $state('cream');
	let motif = $state('blobs');
	let font = $state('classic');
	// Set only when theme === 'custom' — a palette mixed in Hygge rather than
	// picked, carrying the nine roles shared/palette.css defines for every
	// named theme. The effect below is the one place that enforces "only
	// non-null when theme is 'custom'", so nothing else has to remember to
	// clear it when the theme changes some other way (template, revisit,
	// the palette picker).
	let customPalette = $state<Record<string, string> | null>(null);
	$effect(() => {
		if (theme !== 'custom' && customPalette) customPalette = null;
	});

	// What this draft is becoming — letter, essay, story, poem, note. The
	// editor dresses itself for the kind; switching is free and loses nothing.
	let kind = $state<WritingKind>('letter');
	// Carried from captures/handoffs that arrived with tags. Not edited here
	// (yet), but never dropped on save — they make the drafts list searchable.
	let tags = $state<string[]>([]);
	// Optional word goal for the foreground — how a story gets to 50,000.
	let goal = $state<number | null>(null);
	// Liquid's board, in place of the three layers, when kind is 'list'.
	let liquidBoard = $state<LiquidBoard>(emptyBoard());

	const activeKindSpec = $derived(kindSpec(kind));
	const isListKind = $derived(kind === 'list');
	const liquidItemCount = $derived(itemCount(liquidBoard));

	// How the desk is laid out: one page, or the notebook open to two.
	let view = $state<ViewPrefs>(DEFAULT_VIEW_PREFS);
	const isSpread = $derived(view.mode === 'spread');

	let fgEl: HTMLDivElement | undefined = $state();
	let mgEl: HTMLDivElement | undefined = $state();
	let bgEl: HTMLDivElement | undefined = $state();
	let titleEl: HTMLTextAreaElement | undefined = $state();
	let editorPageEl: HTMLDivElement | undefined = $state();
	let editorWrapEl: HTMLDivElement | undefined = $state();
	let marginColumnEl: HTMLElement | undefined = $state();
	let wrapObserver: ResizeObserver | undefined;

	let activeLayer = $state<LayerId>('foreground');
	// In a spread the foreground can be on screen while you type on the other
	// page, so "is the prose showing" is a different question from "is it focused".
	const foregroundVisible = $derived(isLayerVisible(view, activeLayer, 'foreground'));
	let saveStatus = $state<'saved' | 'saving'>('saved');
	let wordCount = $state(0);
	let bold = $state(false);
	let italic = $state(false);
	let underline = $state(false);
	let publishing = $state(false);
	let publishStatus = $state<PublishStatus>('idle');
	let publishErrorMessage = $state<string | null>(null);
	let fgIsEmpty = $state(true);
	let syncOpen = $state(false);

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
	// A transient confirmation pill — announced once when a draft arrived here
	// from another app, or after "save & close" tucks the current one away.
	let notice = $state('');
	let noticeTimer: ReturnType<typeof setTimeout> | undefined;
	let draftsOpen = $state(false);
	let promptOpen = $state(false);
	// Recomputed only when the index itself changes — both walk every draft's
	// stored body, so they stay out of anything that runs per keystroke.
	const draftBacklinkCounts = $derived(backlinkCountsFor(draftsList));
	const draftStatuses = $derived(statusesFor(draftsList));

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
		customPalette?: Record<string, string>;
		kind?: string;
		tags?: string[];
		goal?: number;
		layers?: Partial<Record<LayerId, { html?: string }>>;
		content?: string;
		annotations?: { pocketNotes?: PocketNote[]; marginNotes?: MarginNote[] };
		liquid?: LiquidBoard;
	}) {
		title = d.title || '';
		if (d.theme) theme = d.theme;
		if (d.motif) motif = d.motif;
		if (d.font) font = d.font;
		if (d.theme === 'custom' && isValidCustomPalette(d.customPalette)) {
			customPalette = d.customPalette as Record<string, string>;
		}
		kind = coerceKind(d.kind);
		tags = Array.isArray(d.tags) ? d.tags.filter((t) => typeof t === 'string') : [];
		goal = coerceGoal(d.goal);
		liquidBoard = d.liquid ?? emptyBoard();
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
		void initSync();
		// The shelf names what `#` can reach. Local first (instant, same
		// origin), then the server so it works on a device where Thinking
		// About has never been opened.
		shelfSource.loadLocal();
		void refreshReferenceSources();

		try {
			document.execCommand('defaultParagraphSeparator', false, 'p');
		} catch (e) {}

		try {
			const order = localStorage.getItem(POCKETS_ORDER_KEY);
			if (order === 'newest' || order === 'oldest') pocketsOrder = order;
		} catch (e) {
			// ignore
		}

		view = loadViewPrefs();
		// A spread opens with the prose under the cursor, not the notes.
		if (view.mode === 'spread') activeLayer = view.recto;

		const params = new URLSearchParams(window.location.search);
		const tid = params.get('template');
		const replyId = params.get('reply');
		const revisitId = params.get('revisit');

		// Hygge design playground passes ?palette=&motif=&font= to pre-style the
		// editor. The mixer's "use in write" sends ?custom= instead of ?palette=
		// — a mixed palette rather than a named one — see the theme effect above.
		const hyggeParams = {
			palette: params.get('palette'),
			motif:   params.get('motif'),
			font:    params.get('font'),
			custom:  params.get('custom'),
		};
		const hasHyggeStyle = hyggeParams.palette || hyggeParams.motif || hyggeParams.font || hyggeParams.custom;
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
					kind: t.kind,
					content: t.sampleContent
				});
				updateMeta();
				hydrated = true;
				scheduleSave();
				scheduleMeasure();
				window.addEventListener('resize', onResize);
				document.addEventListener('selectionchange', onSelectionChange);
				watchWrapWidth();
				return;
			}
		}

		// Echoes' revisit tab sends a published letter's id back here so it can
		// be picked up as prose again. It becomes its own new draft — the
		// published letter (and whatever's public) is left untouched, so
		// revisiting is never destructive.
		if (revisitId) {
			// Strip the param immediately so a later reload of this same tab
			// can't spawn a second draft from the same letter.
			history.replaceState(null, '', window.location.pathname);
			const letters = loadLettersList();
			const source = findLetter(letters, revisitId);
			if (source) {
				const id = createDraftId();
				const now = new Date().toISOString();
				saveDraft(id, {
					title: source.title,
					theme: source.theme,
					motif: source.motif,
					font: source.font,
					...(source.theme === 'custom' && source.customPalette
						? { customPalette: source.customPalette }
						: {}),
					layers: source.layers,
					annotations: source.annotations,
					content: source.content,
					savedAt: now
				});
				const index = upsertIndex(listDrafts(), id, source.title || '', now);
				writeIndex(index);
				setActiveDraftId(id);
				draftsList = index;
				currentDraftId = id;
				if (source.replyTo) {
					replyTo = source.replyTo;
					replyToTitle = findLetter(letters, source.replyTo)?.title || 'untitled letter';
				}
				loadIntoLayers(source);
				updateMeta();
				hydrated = true;
				scheduleMeasure();
				window.addEventListener('resize', onResize);
				document.addEventListener('selectionchange', onSelectionChange);
				watchWrapWidth();
				return;
			}
			// If the letter is gone, fall through to the normal draft bootstrap.
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
		const notices: string[] = [];
		if (boot.notebookImports > 0) {
			notices.push(
				boot.notebookImports === 1
					? 'notebook retired — its one capture is now a draft here'
					: `notebook retired — its ${boot.notebookImports} captures are now drafts here`
			);
		}
		if (boot.sporesImports > 0) {
			notices.push(
				boot.sporesImports === 1
					? 'spores retired — its one entry is now a draft here'
					: `spores retired — its ${boot.sporesImports} entries are now drafts here`
			);
		}
		if (boot.handoffs > 0) {
			notices.push(
				boot.handoffs === 1
					? 'opened something sent here from elsewhere'
					: `opened the newest of ${boot.handoffs} things sent here — the rest are in drafts`
			);
		}
		if (notices.length > 0) notice = notices.join(' · ');

		if (boot.body) {
			try {
				loadIntoLayers(boot.body);
			} catch (e) {
				// ignore corrupt drafts
			}
		}

		// A `#` reference to another draft, followed here (see references.svelte.ts).
		// Stripped immediately, same reasoning as revisitId above.
		const draftParam = params.get(DRAFT_PARAM);
		if (draftParam && draftsList.some((d) => d.id === draftParam)) {
			history.replaceState(null, '', window.location.pathname);
			loadDraft(draftParam);
		}

		// Apply hygge-sourced style overrides after any draft is loaded.
		if (hasHyggeStyle) {
			if (hyggeParams.custom) {
				const decoded = decodeCustomPalette(hyggeParams.custom);
				if (decoded) {
					theme = 'custom';
					customPalette = decoded;
				}
			} else if (hyggeParams.palette && findPalette(hyggeParams.palette).id === hyggeParams.palette) {
				theme = hyggeParams.palette;
			}
			if (hyggeParams.motif   && findMotif(hyggeParams.motif).id   === hyggeParams.motif)   motif = hyggeParams.motif;
			if (hyggeParams.font    && findFont(hyggeParams.font).id      === hyggeParams.font)    font  = hyggeParams.font;
		}

		updateMeta();
		hydrated = true;
		scheduleMeasure();

		window.addEventListener('resize', onResize);
		document.addEventListener('selectionchange', onSelectionChange);
		watchWrapWidth();
	});

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			window.removeEventListener('resize', onResize);
			document.removeEventListener('selectionchange', onSelectionChange);
		}
		wrapObserver?.disconnect();
		clearTimeout(noticeTimer);
	});

	function onResize() {
		scheduleMeasure(80);
		autosizeTitle();
	}

	// The title is a textarea so long titles wrap instead of scrolling out of
	// view; it still behaves like a single-line field (see the Enter guard
	// below), so its height has to be driven manually from content.
	function autosizeTitle() {
		if (!titleEl) return;
		titleEl.style.height = 'auto';
		titleEl.style.height = titleEl.scrollHeight + 'px';
	}

	// A wrapped title's height depends on how wide it is, and the width is
	// animated — `.editor-wrap` transitions `max-width` when the view or the
	// layer changes. Measuring once after the change reads a mid-transition
	// width and leaves the title clipped, so track the width instead of
	// guessing when it settles. Watching the *wrap* rather than the title is
	// what keeps this from looping: autosizing changes the title's height,
	// which never changes the wrap's width, and the guard drops the rest.
	function watchWrapWidth() {
		if (typeof ResizeObserver === 'undefined' || !editorWrapEl) return;
		let lastWidth = editorWrapEl.clientWidth;
		wrapObserver = new ResizeObserver((entries) => {
			const width = entries[0]?.contentRect.width ?? 0;
			if (width === lastWidth) return;
			lastWidth = width;
			autosizeTitle();
		});
		wrapObserver.observe(editorWrapEl);
	}

	function onTitleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') e.preventDefault();
	}

	$effect(() => {
		if (typeof document === 'undefined') return;
		// A custom palette sets its roles as inline properties, which beat
		// anything shared/palette.css's [data-theme] blocks would otherwise
		// supply — but only for as long as they're there, so switching back to
		// a named theme has to clear them first or they'd keep winning.
		if (theme === 'custom' && customPalette) {
			document.body.dataset.theme = 'custom';
			const { vars, colorScheme } = customPaletteTokens(customPalette);
			for (const [key, value] of Object.entries(vars)) {
				document.body.style.setProperty(key, value);
			}
			document.body.style.colorScheme = colorScheme;
		} else {
			for (const key of CUSTOM_PALETTE_CSS_VARS) document.body.style.removeProperty(key);
			document.body.style.removeProperty('color-scheme');
			document.body.dataset.theme = theme;
		}
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
		if (typeof document === 'undefined') return;
		document.body.classList.toggle('calm-motion', view.calmMotion);
	});

	$effect(() => {
		if (typeof localStorage === 'undefined') return;
		try {
			localStorage.setItem(POCKETS_ORDER_KEY, pocketsOrder);
		} catch (e) {
			// ignore
		}
	});

	$effect(() => {
		if (hydrated) saveViewPrefs(view);
	});

	// Opening or closing the notebook changes every page height at once.
	$effect(() => {
		void view.mode;
		void view.verso;
		void view.recto;
		void view.ruled;
		scheduleMeasure(60);
	});

	function setViewMode(mode: ViewMode) {
		if (mode === view.mode) return;
		view = { ...view, mode };
		// Leaving a spread, keep reading whichever page you were in; entering
		// one, make sure the page you were on is actually open.
		if (mode === 'spread' && !isLayerVisible(view, activeLayer, activeLayer)) {
			view = assignLayer(view, 'recto', activeLayer);
		}
		scheduleMeasure(60);
	}

	async function setPageLayer(side: PageSide, layer: LayerId) {
		view = assignLayer(view, side, layer);
		await tick();
		elFor(layer)?.focus();
		activeLayer = layer;
		updateMeta();
		updateToolbarState();
		scheduleMeasure(60);
	}

	// Focus decides which layer is "active" in a spread — the toolbar, the word
	// count, and publish all follow the page your cursor is actually in.
	function onLayerFocus(layer: LayerId) {
		if (activeLayer === layer) return;
		activeLayer = layer;
		selectionRect = null;
		updateMeta();
		updateToolbarState();
	}

	$effect(() => {
		void title;
		// Wait for the bind:value DOM write to land before measuring —
		// programmatic title changes (draft load, templates) update the
		// textarea's value through this same flush, and reading scrollHeight
		// before it lands measures the stale content.
		tick().then(autosizeTitle);
	});

	function updateMeta() {
		const el = elFor(activeLayer);
		const text = el?.textContent || '';
		wordCount = text.trim().split(/\s+/).filter((w) => w.length).length;
		fgIsEmpty = isEmptyHtml(fgEl?.innerHTML ?? '');
	}

	// One snapshot shape, built in one place — scheduleSave, loadDraft, and
	// onSelectTemplate all persist through this.
	function currentDraftBody(now: string): DraftBody {
		return {
			title, theme, motif, font, kind,
			...(theme === 'custom' && customPalette ? { customPalette } : {}),
			...(tags.length > 0 ? { tags } : {}),
			...(goal !== null ? { goal } : {}),
			...(isListKind ? { liquid: liquidBoard } : {}),
			layers: {
				foreground: { html: fgEl?.innerHTML ?? '', updatedAt: now },
				midground: { html: mgEl?.innerHTML ?? '', updatedAt: now },
				background: { html: bgEl?.innerHTML ?? '', updatedAt: now }
			},
			annotations: { pocketNotes: pockets, marginNotes },
			content: fgEl?.innerHTML ?? '',
			savedAt: now
		};
	}

	function scheduleSave() {
		if (!hydrated) return;
		if (publishing) return;
		saveStatus = 'saving';
		clearTimeout(saveTimer);
		saveTimer = setTimeout(() => {
			try {
				const now = new Date().toISOString();
				if (currentDraftId) {
					saveDraft(currentDraftId, currentDraftBody(now));
					draftsList = upsertIndex(draftsList, currentDraftId, title, now, { kind, tags });
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
		void customPalette;
		void kind;
		void goal;
		void liquidBoard;
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
		// In a spread, asking for a layer that isn't open brings it onto the
		// right-hand page rather than doing nothing.
		if (isSpread && !isLayerVisible(view, activeLayer, next)) {
			view = assignLayer(view, 'recto', next);
		} else if (next === activeLayer) {
			return;
		}
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
			saveDraft(currentDraftId, currentDraftBody(new Date().toISOString()));
		}

		currentDraftId = id;
		setActiveDraftId(id);

		title = '';
		pockets = [];
		marginNotes = [];
		kind = 'letter';
		tags = [];
		goal = null;
		// "public" is an explicit, per-letter act — it must never carry over
		// to a different letter just because the checkbox was left checked.
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

	// The explicit "tuck this away and start fresh" gesture. loadDraft() (via
	// newDraft() below) already flushes the current draft's body to storage
	// before switching — but only scheduleSave's debounce keeps the drafts
	// *index* entry (title, kind, tags) in step with what's on the page, so a
	// close that lands inside that 700ms window needs its own flush of the
	// index too, or the drafts list would show the title as it was a moment ago.
	function saveAndClose() {
		if (currentDraftId) {
			const now = new Date().toISOString();
			draftsList = upsertIndex(draftsList, currentDraftId, title, now, { kind, tags });
			writeIndex(draftsList);
		}
		newDraft();
		notice = 'tucked away in drafts — here’s a new page';
		clearTimeout(noticeTimer);
		noticeTimer = setTimeout(() => {
			notice = '';
		}, 3200);
	}

	// A model's answer, appended to whatever is already in the foreground —
	// same insertion point as pasting, and never a silent replace of prose
	// already there. See DraftPromptModal.svelte.
	function insertPromptDraft(text: string) {
		if (!fgEl) return;
		const html = textToHtml(text);
		fgEl.innerHTML = isEmptyHtml(fgEl.innerHTML) ? html : fgEl.innerHTML + html;
		stampLiveAnchors();
		updateMeta();
		scheduleSave();
		fgVersion += 1;
	}

	function cycleStatus(id: string, e: Event) {
		e.stopPropagation();
		draftsList = cycleDraftStatus(draftsList, id);
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

	async function publish() {
		publishing = true;
		publishStatus = 'local';
		publishErrorMessage = null;
		clearTimeout(saveTimer);
		const issue = incrementIssue();
		try {
			const now = new Date().toISOString();
			const fgHtml = stampAnchorsHtml(sanitizeHtml(fgEl?.innerHTML ?? ''));
			const mgHtml = sanitizeHtml(mgEl?.innerHTML ?? '');
			const bgHtml = sanitizeHtml(bgEl?.innerHTML ?? '');
			const cleanedPockets = pockets.map((p) => ({ ...p, html: sanitizeHtml(p.html) }));
			const cleanedMargins = marginNotes.map((m) => ({ ...m, html: sanitizeHtml(m.html) }));
			const letter: StoredLetter = {
				id: newLetterId(),
				title: title.trim() || activeKindSpec.untitled,
				theme,
				motif,
				font,
				...(theme === 'custom' && customPalette ? { customPalette } : {}),
				issue,
				publishedAt: now,
				layers: {
					foreground: { html: fgHtml, updatedAt: now },
					midground: { html: mgHtml, updatedAt: now },
					background: { html: bgHtml, updatedAt: now }
				},
				annotations: { pocketNotes: cleanedPockets, marginNotes: cleanedMargins },
				content: fgHtml,
				replyTo: replyTo ?? null
			};
			// loadLettersList() must run before writePublishedLegacy() below:
			// on a browser with no LETTERS_KEY yet, it migrates whatever is
			// currently in the legacy slot into the list (see letters.ts). If
			// the legacy slot already held *this* letter, that migration would
			// re-discover it and the spread below would duplicate it. Reading
			// old state first, then writing, keeps the two straight.
			const allLetters = [...loadLettersList(), letter];
			saveLettersList(allLetters);
			// legacy single-slot write-through so older viewer code paths still
			// see "the latest letter".
			writePublishedLegacy(letter);

			if (currentDraftId) {
				removeDraftBody(currentDraftId);
				draftsList = draftsList.filter((d) => d.id !== currentDraftId);
				writeIndex(draftsList);
				clearActiveDraftId();
			}

			// The ledger is derived, so it is rebuilt from the archive on every
			// save — not only when connected. Without this, what you wrote about
			// would reach the other apps only after a sync, and never at all on a
			// device that has no passphrase. Same local-mirror-always,
			// push-when-connected split every other ledger uses.
			publishMentionsLocally();

			// The archive is local first and always succeeds. Pushing it to the
			// server is a second, optional step that only needs a connected
			// passphrase — there is no per-letter opt-in any more, because
			// there is no audience but you (HANDOFF.md §3).
			if (hasPassphrase()) {
				try {
					await flushSync();
					publishStatus = 'synced';
				} catch (err) {
					publishStatus = 'error';
					publishErrorMessage =
						err instanceof SyncError ? err.message : "couldn't reach the archive — it's safe here";
				}
			}
		} catch (e) {
			// ignore
		}
		setTimeout(() => {
			window.location.href = '/letter';
		}, 1800);
	}

	// A goal is invited, never imposed — same gesture as insertLink's prompt.
	function setGoal() {
		const raw = prompt('word goal for the foreground (blank to clear):', goal === null ? '' : String(goal));
		if (raw === null) return;
		goal = parseGoalInput(raw);
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
		updateReferenceTrigger();
	}

	// ── references: # a thing you're thinking about, @ a day ──────────
	let picker = $state<ReferencePicker>();
	let refSigil = $state<Sigil | null>(null);
	let refQuery = $state('');
	let refX = $state(0);
	let refY = $state(0);
	let refTrigger: ReferenceTrigger | null = null;
	// Set when Escape dismissed a trigger, so it stays dismissed until the
	// caret moves off it rather than reopening on the next keystroke.
	let refDismissed: string | null = null;

	function closeReferencePicker(dismiss = false) {
		if (dismiss && refTrigger) refDismissed = refSigil + refTrigger.query;
		refSigil = null;
		refQuery = '';
		refTrigger = null;
	}

	function updateReferenceTrigger() {
		const before = textBeforeCaret();
		const trigger = before === null ? null : readTrigger(before);
		if (!trigger) {
			refDismissed = null;
			closeReferencePicker();
			return;
		}
		if (refDismissed === trigger.sigil + trigger.query) return;
		refDismissed = null;

		refTrigger = trigger;
		refSigil = trigger.sigil;
		refQuery = trigger.query;
		const rect = caretRect();
		if (rect) {
			refX = rect.x;
			refY = rect.y;
		}
	}

	function pickReference(candidate: ReferenceCandidate) {
		if (!refTrigger) return;
		const href = referenceHref(candidate.app, candidate.kind, candidate.id);
		const inserted = insertReferenceAtCaret(candidate, refTrigger, href);
		closeReferencePicker();
		if (!inserted) return;
		// The layers *are* the storage between saves, so a programmatic edit
		// has to go through the same save path a keystroke would.
		updateMeta();
		stampLiveAnchors();
		scheduleSave();
		fgVersion += 1;
	}

	function onEditorKeydown(event: KeyboardEvent) {
		if (picker?.handleKey(event)) {
			event.preventDefault();
			if (event.key === 'Escape') closeReferencePicker(true);
		}
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
				kind: t.kind,
				content: t.sampleContent
			});
			updateMeta();
			scheduleSave();
		} else {
			// Save current draft and create new one for template
			clearTimeout(saveTimer);
			if (currentDraftId) {
				saveDraft(currentDraftId, currentDraftBody(new Date().toISOString()));
			}

			// Create new draft for template
			const newId = createDraftId();
			const newTime = new Date().toISOString();
			const templateKind = coerceKind(t.kind);
			draftsList = [
				{ id: newId, title: t.sampleTitle, updatedAt: newTime, kind: templateKind },
				...draftsList
			];
			writeIndex(draftsList);
			currentDraftId = newId;
			setActiveDraftId(newId);

			// Load template into new draft
			title = t.sampleTitle;
			theme = t.palette;
			motif = t.motif;
			font = t.font;
			kind = templateKind;
			tags = [];
			goal = null;
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

{#snippet pageHead(layer: LayerId)}
	{@const side = sideOf(view, layer)}
	<div class="page-head" class:verso={side === 'verso'}>
		<div class="page-layers" role="group" aria-label="{side === 'verso' ? 'left' : 'right'} page layer">
			{#each LAYER_IDS as id}
				<button
					class="page-layer-btn"
					class:on={id === layer}
					aria-pressed={id === layer}
					title={LAYER_TITLES[id]}
					onclick={() => side && setPageLayer(side, id)}>{LAYER_LABELS[id]}</button
				>
			{/each}
		</div>
	</div>
{/snippet}

{#snippet pageFoot(layer: LayerId)}
	{@const side = sideOf(view, layer)}
	{@const stat = layerStats.find((s) => s.id === layer)}
	<p class="page-foot" class:verso={side === 'verso'}>
		<span class="page-foot-name">{layer}</span>
		<span class="page-foot-count">{stat?.words ?? 0}</span>
	</p>
{/snippet}

<div class="motif-grain"></div>
<div class="motif-blob motif-blob-1"></div>
<div class="motif-blob motif-blob-2"></div>
<div class="motif-blob motif-blob-3"></div>
<div class="motif-blob motif-blob-4"></div>

<Topbar
	{activeLayer}
	layerIds={LAYER_IDS}
	layerLabels={LAYER_LABELS}
	viewMode={view.mode}
	onViewChange={setViewMode}
	bind:draftsOpen
	bind:pocketsOpen
	pocketsCount={pockets.length}
	bind:syncOpen
	syncConnected={syncState.connected}
	bind:promptOpen
	{isListKind}
	onLayerChange={setActiveLayer}
	onSaveAndClose={saveAndClose}
/>

<DraftsModal
	bind:open={draftsOpen}
	drafts={draftsList}
	{currentDraftId}
	backlinkCounts={draftBacklinkCounts}
	statuses={draftStatuses}
	onSelect={loadDraft}
	onCreate={newDraft}
	onDelete={deleteDraft}
	onCycleStatus={cycleStatus}
/>

<DraftPromptModal
	bind:open={promptOpen}
	defaultTopic={title.trim() || activeKindSpec.untitled}
	onInsert={insertPromptDraft}
/>

{#if syncOpen}
	<EchoesSyncPanel onclose={() => (syncOpen = false)} />
{/if}

<ReferencePicker
	bind:this={picker}
	sigil={refSigil}
	query={refQuery}
	x={refX}
	y={refY}
	onpick={pickReference}
	onclose={() => closeReferencePicker(true)}
/>

<PublishOverlay status={publishStatus} errorMessage={publishErrorMessage} />

{#if notice}
	<p class="handoff-notice" aria-live="polite">
		{notice}
		<button type="button" onclick={() => (notice = '')} aria-label="dismiss">×</button>
	</p>
{/if}

<div class="editor-page" data-layer={activeLayer} data-view={view.mode} bind:this={editorPageEl}>
	<div class="editor-wrap" data-layer={activeLayer} data-view={view.mode} bind:this={editorWrapEl}>
		{#if replyTo && replyToTitle}
			<a class="reply-breadcrumb" href="/letter?id={replyTo}" title="back to source letter">
				<span class="reply-breadcrumb-eyebrow">in reply to</span>
				<span class="reply-breadcrumb-title">{replyToTitle}</span>
				<span class="reply-breadcrumb-arrow" aria-hidden="true">↗</span>
			</a>
		{/if}
		<div class="kind-row">
			<div class="kind-switch" role="tablist" aria-label="kind of writing">
				{#each WRITING_KINDS as k}
					<button
						class="kind-btn"
						class:active={kind === k}
						role="tab"
						aria-selected={kind === k}
						onclick={() => (kind = k)}
						title={kindSpec(k).moment}>{kindSpec(k).label}</button
					>
				{/each}
			</div>
				{#if !isSpread && !isListKind}
				<span class="kind-eyebrow">· {activeLayer}</span>
			{/if}
		</div>
		<textarea
			bind:this={titleEl}
			bind:value={title}
			oninput={scheduleSave}
			onkeydown={onTitleKeydown}
			class="doc-title"
			rows="1"
			placeholder={activeKindSpec.untitled}
			spellcheck="true"
			autocomplete="off"
		></textarea>

		{#if activeLayer === 'foreground' && !isListKind}
			<EditorToolbar {bold} {italic} {underline} onCommand={exec} onInsertLink={insertLink} />
		{/if}

		<!-- The three layers are never unmounted, kind switch included: each
		     contenteditable holds its own content between saves (that's what
		     scheduleSave reads), so switching to Liquid hides this block with
		     CSS rather than removing it — unmounting fgEl here would empty it
		     by the time the next debounced save fired. -->
		<div class="pages" data-view={view.mode} class:hidden={isListKind}>
			{#if isSpread}
				<div class="spine" aria-hidden="true"></div>
			{/if}

			<div
				class="page"
				class:hidden={!isLayerVisible(view, activeLayer, 'foreground')}
				class:focused={activeLayer === 'foreground'}
				style="order: {pageOrder(view, 'foreground')}"
			>
				{#if isSpread}
					{@render pageHead('foreground')}
				{/if}
				<div
					bind:this={fgEl}
					class="doc-body layer-foreground"
					class:ruled={view.ruled}
					contenteditable="true"
					spellcheck="true"
					data-placeholder={activeKindSpec.placeholders.foreground}
					aria-label="foreground content"
					oninput={onFgInput}
					onpaste={handlePaste}
					onfocus={() => onLayerFocus('foreground')}
					onkeydown={onEditorKeydown}
					onkeyup={(e) => { updateToolbarState(); if (!e.isComposing) updateReferenceTrigger(); }}
					onmouseup={updateToolbarState}
					role="textbox"
					tabindex="0"
				></div>
				{#if isSpread}
					{@render pageFoot('foreground')}
				{/if}
			</div>

			<div
				class="page"
				class:hidden={!isLayerVisible(view, activeLayer, 'midground')}
				class:focused={activeLayer === 'midground'}
				style="order: {pageOrder(view, 'midground')}"
			>
				{#if isSpread}
					{@render pageHead('midground')}
				{/if}
				<div
					bind:this={mgEl}
					class="doc-body layer-midground"
					class:ruled={view.ruled}
					contenteditable="true"
					spellcheck="true"
					data-placeholder={activeKindSpec.placeholders.midground}
					aria-label="midground content"
					oninput={() => { updateMeta(); scheduleSave(); fgVersion += 1; }}
					onpaste={handlePaste}
					onfocus={() => onLayerFocus('midground')}
					role="textbox"
					tabindex="0"
				></div>
				{#if isSpread}
					{@render pageFoot('midground')}
				{/if}
			</div>

			<div
				class="page"
				class:hidden={!isLayerVisible(view, activeLayer, 'background')}
				class:focused={activeLayer === 'background'}
				style="order: {pageOrder(view, 'background')}"
			>
				{#if isSpread}
					{@render pageHead('background')}
				{/if}
				<div
					bind:this={bgEl}
					class="doc-body layer-background"
					class:ruled={view.ruled}
					contenteditable="true"
					spellcheck="true"
					data-placeholder={activeKindSpec.placeholders.background}
					aria-label="background content"
					oninput={() => { updateMeta(); scheduleSave(); fgVersion += 1; }}
					onpaste={handlePaste}
					onfocus={() => onLayerFocus('background')}
					role="textbox"
					tabindex="0"
				></div>
				{#if isSpread}
					{@render pageFoot('background')}
				{/if}
			</div>
		</div>

		{#if isListKind}
			<div class="liquid-wrap">
				<Liquid bind:board={liquidBoard} />
			</div>
		{/if}

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
		hidden={!foregroundVisible || isListKind}
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
	onSelectTemplate={onSelectTemplate}
/>

<BottomBar
	{saveStatus}
	{wordCount}
	{goal}
	onSetGoal={setGoal}
	bind:theme
	bind:motif
	bind:font
	ruled={view.ruled}
	onRuledChange={(ruled) => (view = { ...view, ruled })}
	calmMotion={view.calmMotion}
	onCalmMotionChange={(calmMotion) => (view = { ...view, calmMotion })}
	{palettes}
	motifs={motifList}
	fonts={fontPairs}
	{foregroundVisible}
	{fgIsEmpty}
	{isListKind}
	{liquidItemCount}
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
	/* shared/motifs.css already stops the ambient drift for anyone whose OS
	   asks for reduced motion; this is the explicit override beside it, for
	   whoever wants it off regardless of what their OS says. */
	:global(body.calm-motion .motif-blob),
	:global(body.calm-motion .motif-grain) {
		animation-duration: 0.01ms !important;
		animation-iteration-count: 1 !important;
		transition: none !important;
	}
	/* base type scale — % keeps it relative to the reader's browser font size,
	   so every rem in the app scales from here (and large-text prefs are honored) */
	:global(html) { font-size: 112.5%; }
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
		gap: clamp(1.25rem, 1.5vw, 2.5rem);
		padding-top: 0;
	}
	/* editor-wrap is a true flex-filling item (basis 0, grow 1): it claims
	   *everything* left over after the margin column and gap take their
	   share, whatever that happens to be at the current window size — no
	   vw-percentage guessing that can undershoot on an ordinary laptop, and
	   no arithmetic that can overflow it. max-width is only a sanity ceiling
	   so a giant monitor doesn't stretch prose into unreadable line lengths. */
	.editor-wrap {
		flex: 1 1 0%;
		min-width: 0;
		max-width: 1100px;
		padding: 84px clamp(1.5rem, 5vw, 2.5rem) 96px;
		transition: max-width 0.3s ease;
	}
	.editor-wrap[data-view='page'][data-layer='midground'] { max-width: 960px; }
	.editor-wrap[data-view='page'][data-layer='background'] { max-width: 840px; }
	/* an open notebook needs room for two pages and still has to leave the
	   margin column beside it on an ordinary laptop */
	.editor-wrap[data-view='spread'] { max-width: 1900px; }

	/* ── the pages ── */
	.pages { position: relative; }
	.pages.hidden { display: none; }
	.liquid-wrap { position: relative; }
	.pages[data-view='spread'] {
		display: grid;
		grid-template-columns: 1fr 1fr;
		align-items: stretch;
	}
	.page { display: flex; flex-direction: column; min-width: 0; }
	.page.hidden { display: none; }
	.pages[data-view='spread'] .page {
		background: color-mix(in srgb, var(--surface) 55%, transparent);
		border: 1px solid color-mix(in srgb, var(--rule) 45%, transparent);
		padding: 1.1rem 1.5rem 0.7rem;
		transition: background 0.25s ease, border-color 0.25s ease;
	}
	/* the two halves meet at the spine: outer corners round, inner ones don't */
	.pages[data-view='spread'] .page:nth-child(2) { border-radius: 10px 3px 3px 10px; }
	.pages[data-view='spread'] .page:nth-child(3) { border-radius: 3px 10px 10px 3px; }
	.pages[data-view='spread'] .page.focused {
		background: color-mix(in srgb, var(--surface) 85%, transparent);
		border-color: color-mix(in srgb, var(--accent) 30%, transparent);
	}
	.pages[data-view='spread'] .page .doc-body { flex: 1; min-height: 46vh; }
	/* One ruling across the whole spread, like real paper: the layers keep
	   their own type sizes but share a line box, so both pages rule to the
	   same rhythm and every line still lands on a rule. (Page view keeps each
	   layer's own tighter leading — there is no facing page to agree with.) */
	.pages[data-view='spread'] .doc-body {
		line-height: 1.995rem;
		--rule-step: 1.995rem;
	}

	/* the gutter — paper falling away toward the fold */
	.spine {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 50%;
		width: 40px;
		transform: translateX(-20px);
		order: 2;
		pointer-events: none;
		z-index: 1;
		background: linear-gradient(
			to right,
			transparent 0%,
			color-mix(in srgb, var(--rule) 18%, transparent) 35%,
			color-mix(in srgb, var(--rule) 55%, transparent) 50%,
			color-mix(in srgb, var(--rule) 18%, transparent) 65%,
			transparent 100%
		);
	}

	.page-head {
		display: flex;
		margin-bottom: 0.7rem;
		opacity: 0.75;
		transition: opacity 0.2s ease;
	}
	.page-head.verso { justify-content: flex-start; }
	.page-head:not(.verso) { justify-content: flex-end; }
	.page:hover .page-head, .page.focused .page-head { opacity: 1; }
	.page-layers { display: flex; gap: 2px; }
	.page-layer-btn {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.52rem;
		letter-spacing: 0.14em;
		text-transform: lowercase;
		color: var(--muted);
		background: none;
		border: 1px solid transparent;
		padding: 2px 7px;
		border-radius: 4px;
		cursor: pointer;
		opacity: 0.55;
		transition: color 0.18s ease, background 0.18s ease, border-color 0.18s ease, opacity 0.18s ease;
	}
	.page-layer-btn:hover { opacity: 1; color: var(--accent-strong); }
	.page-layer-btn.on {
		color: var(--accent-strong);
		opacity: 1;
		background: color-mix(in srgb, var(--accent) 18%, transparent);
		border-color: color-mix(in srgb, var(--accent) 35%, transparent);
	}

	/* the outer corners, where a page number would sit on real paper */
	.page-foot {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		margin-top: 0.9rem;
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.5rem;
		letter-spacing: 0.16em;
		text-transform: lowercase;
		color: var(--muted);
		opacity: 0.4;
	}
	/* the count sits at the outer corner, where a page number would, while the
	   pair still reads left-to-right on both pages */
	.page-foot.verso { flex-direction: row-reverse; justify-content: flex-end; }
	.page-foot:not(.verso) { justify-content: flex-end; }
	.page-foot-count { font-variant-numeric: tabular-nums; }

	/* ruled paper. the step is the line box exactly — font-size × line-height,
	   both fixed per layer — so a rule lands under every line whatever font
	   the template picked. */
	.doc-body.ruled {
		background-image: repeating-linear-gradient(
			to bottom,
			transparent 0,
			transparent calc(var(--rule-step) - 1px),
			color-mix(in srgb, var(--rule) 50%, transparent) calc(var(--rule-step) - 1px),
			color-mix(in srgb, var(--rule) 50%, transparent) var(--rule-step)
		);
		background-origin: content-box;
		background-clip: content-box;
	}

	@media (max-width: 1100px) {
		/* the notebook lies flat: pages stack, spine goes away, and the
		   verso/recto mirroring stops — stacked pages have no outer edge */
		.pages[data-view='spread'] { grid-template-columns: 1fr; gap: 1rem; }
		.spine { display: none; }
		.pages[data-view='spread'] .page:nth-child(2),
		.pages[data-view='spread'] .page:nth-child(3) { border-radius: 8px; }
		.pages[data-view='spread'] .page .doc-body { min-height: 32vh; }
		.page-head, .page-head.verso { justify-content: flex-start; }
		.page-foot, .page-foot.verso { flex-direction: row; justify-content: flex-start; }
	}

	/* ── narrow screen fallback for editor-page ── */
	@media (max-width: 1100px) {
		.editor-page {
			flex-direction: column;
			align-items: center;
			gap: 0;
		}
	}

	/* the kind row: what this draft is becoming, plus the layer eyebrow */
	.kind-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 1rem;
		flex-wrap: wrap;
	}
	.kind-switch {
		display: flex;
		align-items: center;
		gap: 2px;
	}
	.kind-btn {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.58rem;
		letter-spacing: 0.16em;
		text-transform: lowercase;
		color: var(--muted);
		background: none;
		border: 1px solid transparent;
		padding: 3px 8px;
		border-radius: 4px;
		cursor: pointer;
		opacity: 0.5;
		transition: color 0.18s ease, background 0.18s ease, border-color 0.18s ease, opacity 0.18s ease;
	}
	.kind-btn:hover { opacity: 0.9; color: var(--accent-strong); }
	.kind-btn.active {
		color: var(--accent-strong);
		opacity: 1;
		background: color-mix(in srgb, var(--accent) 22%, transparent);
		border-color: color-mix(in srgb, var(--accent) 40%, transparent);
	}
	.kind-eyebrow {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.58rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--muted);
		opacity: 0.45;
	}

	/* a draft that arrived from another app, announced once on load */
	.handoff-notice {
		position: fixed;
		left: 50%;
		bottom: 4.5rem;
		z-index: 40;
		transform: translateX(-50%);
		display: inline-flex;
		align-items: center;
		gap: 0.65rem;
		max-width: min(28rem, calc(100vw - 2rem));
		padding: 8px 14px;
		border-radius: 100px;
		border: 1px solid var(--rule);
		background: color-mix(in srgb, var(--surface) 92%, transparent);
		color: var(--text);
		font-size: 0.8rem;
		box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);
	}
	.handoff-notice button {
		border: none;
		background: none;
		color: inherit;
		opacity: 0.6;
		font-size: 1rem;
		line-height: 1;
		cursor: pointer;
	}
	.handoff-notice button:hover {
		opacity: 1;
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
		overflow-wrap: break-word;
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
		display: block;
		resize: none;
		overflow: hidden;
		overflow-wrap: break-word;
	}
	.doc-title::placeholder { color: var(--muted); opacity: 0.28; }

	/* A reference reads as prose first and a link second — it is a word you
	   wrote, faintly marked as pointing somewhere. Styled off the data
	   attribute so the sanitize allowlist stays three attributes wide and
	   never has to open `class`. */
	.doc-body :global(a[data-ref-id]) {
		text-decoration: none;
		border-bottom: 1px dotted color-mix(in srgb, currentColor 45%, transparent);
		cursor: pointer;
	}

	.doc-body :global(a[data-ref-id]:hover) {
		border-bottom-color: currentColor;
	}

	.doc-body, .doc-body :global(*) {
		font-family: var(--editor-body, var(--font-body));
	}
	.doc-body :global(h1), .doc-body :global(h2), .doc-body :global(h3) {
		font-family: var(--editor-display, var(--font-display));
	}
	.doc-body {
		font-size: 1.05rem;
		line-height: 1.9;
		--rule-step: 1.995rem; /* 1.05 × 1.9 */
		color: var(--text);
		min-height: 52vh;
		outline: none;
		caret-color: var(--accent-deep);
	}
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

	.layer-midground {
		font-size: 0.98rem; line-height: 1.78; color: var(--muted);
		--rule-step: 1.7444rem; /* 0.98 × 1.78 */
	}
	.layer-background {
		font-size: 0.9rem; line-height: 1.7; color: var(--muted);
		opacity: 0.78; font-style: italic;
		--rule-step: 1.53rem; /* 0.9 × 1.7 */
	}


	/* anchor flash for "scroll to" feedback (the anchor lives in .doc-body
	   in the parent; the binder's gotoMarginNote adds the class there). */
	.doc-body :global(.anchor-flash) {
		background: color-mix(in srgb, var(--accent) 22%, transparent);
		transition: background 1.2s ease;
		border-radius: 3px;
	}

</style>
