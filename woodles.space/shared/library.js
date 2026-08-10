// woodles.space · shared library · v1
// the source of truth for what palettes, motifs, font pairings, and
// templates exist. consumed by:
//   - apps/palette, apps/motifs, apps/scaffold (showcases)
//   - apps/write (pickers + ?template= loading)
//   - apps/letter (rendering published letters)
// keep this module free of UI — just data.

export const palettes = [
	{ id: 'cream', name: 'cream', desc: 'warm · daylight' },
	{ id: 'dawn', name: 'dawn', desc: 'pink · early morning' },
	{ id: 'dusk', name: 'dusk', desc: 'indigo · evening' },
	{ id: 'midnight', name: 'midnight', desc: 'electric · late hours' },
	{ id: 'forest', name: 'forest', desc: 'moss · grounded' },
	{ id: 'terracotta', name: 'terracotta', desc: 'clay · sun-baked' },
	{ id: 'inkwell', name: 'inkwell', desc: 'navy · letterhead' },
	{ id: 'typewriter', name: 'typewriter', desc: 'sepia · drafts' },
	{ id: 'paper', name: 'paper', desc: 'monochrome · ink' },
	{ id: 'blossom', name: 'blossom', desc: 'petal pink · spring' },
	{ id: 'sugar', name: 'sugar', desc: 'candy bright · loud' },
	{ id: 'fog', name: 'fog', desc: 'blue-grey · overcast' },
	{ id: 'glacier', name: 'glacier', desc: 'ice blue · cold hours' },
	{ id: 'signal', name: 'signal', desc: 'high contrast · legible' },
	{ id: 'amber', name: 'amber', desc: 'ember · after midnight' }
];

export const motifs = [
	{ id: 'blobs', name: 'blobs', desc: 'drifting color · grain' },
	{ id: 'aurora', name: 'aurora', desc: 'sweeping ribbons · no grain' },
	{ id: 'mist', name: 'mist', desc: 'breathing particles · grain' },
	{ id: 'paper', name: 'paper', desc: 'grain · vignette' },
	{ id: 'clean', name: 'clean', desc: 'nothing' }
];

// font pairings reference --font-* custom properties from shared/fonts.css.
// `body` is for prose; `display` is for headings/title; `mono` for chrome.
export const fontPairs = [
	{
		id: 'classic',
		name: 'classic',
		desc: 'cormorant + lora',
		display: "var(--font-display)",
		body: "var(--font-body)",
		mono: "var(--font-mono)"
	},
	{
		id: 'optical',
		name: 'optical',
		desc: 'fraunces + lora',
		display: "var(--font-optical)",
		body: "var(--font-body)",
		mono: "var(--font-mono)"
	},
	{
		id: 'modern',
		name: 'modern',
		desc: 'jakarta + space grotesk',
		display: "var(--font-sans)",
		body: "var(--font-sans)",
		mono: "var(--font-geometric)"
	},
	{
		id: 'fell',
		name: 'fell',
		desc: 'IM fell · old print',
		display: "var(--font-fell)",
		body: "var(--font-fell)",
		mono: "var(--font-mono)"
	},
	{
		id: 'pixel',
		name: 'pixel',
		desc: 'coral pixels · datatype',
		display: "var(--font-pixel)",
		body: "var(--font-pixel)",
		mono: "var(--font-data)"
	},
	{
		id: 'ancient',
		name: 'ancient',
		desc: 'amarna · archival',
		display: "var(--font-ancient)",
		body: "var(--font-ancient)",
		mono: "var(--font-mono)"
	},
	{
		id: 'gothic',
		name: 'gothic',
		desc: 'special gothic · jakarta',
		display: "var(--font-gothic)",
		body: "var(--font-sans)",
		mono: "var(--font-geometric)"
	},
	{
		id: 'glaze',
		name: 'glaze',
		desc: 'kalnia glaze · lora',
		display: "var(--font-glaze)",
		body: "var(--font-body)",
		mono: "var(--font-mono)"
	}
];

// templates are { palette, motif, font, sample } presets. /scaffold renders
// a grid of these and links each tile to /write?template=<id>. /write reads
// the param, applies the tokens, and seeds the editor with sample content.
// `kind` names the kind of writing each one starts (write's kinds.ts);
// consumers that don't know about kinds can ignore it.
export const templates = [
	{
		id: 'love-letter',
		name: 'love letter',
		desc: 'a soft, slow note',
		palette: 'cream',
		motif: 'blobs',
		font: 'classic',
		kind: 'letter',
		sampleTitle: 'a small thing for you',
		sampleContent:
			'<p>my dearest,</p>' +
			'<p>I have been turning this over for a while now, the way you ' +
			'do with a stone you find on a walk — picking it up, putting it ' +
			'down, picking it up again.</p>' +
			'<p>here is what I want to say.</p>'
	},
	{
		id: 'manifesto',
		name: 'manifesto',
		desc: 'declarative · bold',
		palette: 'paper',
		motif: 'paper',
		font: 'modern',
		kind: 'essay',
		sampleTitle: 'a position',
		sampleContent:
			'<h1>this is what we will not do.</h1>' +
			'<p>we will not pretend that the easy thing is the right thing. ' +
			'we will not flatten the work to make it scale. we will not ' +
			'optimize for the metric instead of the meaning.</p>' +
			'<h2>this is what we will do.</h2>' +
			'<ul><li>show up early.</li><li>say the quiet part out loud.</li>' +
			'<li>leave the room better.</li></ul>'
	},
	{
		id: 'poem',
		name: 'poem',
		desc: 'centered · narrow',
		palette: 'cream',
		motif: 'mist',
		font: 'optical',
		kind: 'poem',
		sampleTitle: 'untitled, in the margin',
		sampleContent:
			'<p>the light is at a strange angle this morning.</p>' +
			'<p>I think the trees are surprised.</p>' +
			'<blockquote>so much depends, still, on what you noticed first.</blockquote>'
	},
	{
		id: 'postcard',
		name: 'postcard',
		desc: 'short · evening',
		palette: 'dusk',
		motif: 'aurora',
		font: 'classic',
		kind: 'letter',
		sampleTitle: 'from somewhere',
		sampleContent:
			'<p>arrived late, found the place by the river you mentioned. ' +
			'the food was bad and the wine was worse. I loved every minute.</p>' +
			'<p>more soon. — z</p>'
	},
	{
		id: 'eulogy',
		name: 'eulogy',
		desc: 'reverent · spacious',
		palette: 'paper',
		motif: 'paper',
		font: 'fell',
		kind: 'essay',
		sampleTitle: 'what to say',
		sampleContent:
			'<p>I keep thinking about a thing she said, years ago, that I ' +
			'did not understand at the time and still do not, fully — and ' +
			'that has somehow become more true.</p>' +
			'<p>she said: <em>the work is to keep paying attention.</em></p>'
	},
	{
		id: 'transmission',
		name: 'transmission',
		desc: 'pixel · data',
		palette: 'dusk',
		motif: 'aurora',
		font: 'pixel',
		kind: 'note',
		sampleTitle: 'log entry · 042',
		sampleContent:
			'<p>signal acquired. moon is waxing. tea is cold.</p>' +
			'<p>writing this down so I can find it later.</p>'
	},
	{
		id: 'opening-scene',
		name: 'opening scene',
		desc: 'fiction · a door opens',
		palette: 'midnight',
		motif: 'aurora',
		font: 'fell',
		kind: 'story',
		sampleTitle: 'the house that was not on the map',
		sampleContent:
			'<p>The door had been painted shut for thirty years, which is why ' +
			'Merit was surprised to find it open.</p>' +
			'<p>Not ajar. Open — the way a mouth is open in the middle of a ' +
			'sentence, waiting for you to catch up.</p>' +
			'<p>She put down the box of her mother&rsquo;s books and listened.</p>'
	},
	{
		id: 'essay',
		name: 'essay',
		desc: 'a case, made carefully',
		palette: 'inkwell',
		motif: 'clean',
		font: 'modern',
		kind: 'essay',
		sampleTitle: 'in defense of the detour',
		sampleContent:
			'<h1>The claim.</h1>' +
			'<p>State it plainly, in one sentence, before you earn it.</p>' +
			'<h2>The evidence.</h2>' +
			'<p>Three things you can point at. If you can only point at two, ' +
			'say so — the reader can smell a stretched third.</p>' +
			'<h2>The counterargument you owe an answer.</h2>' +
			'<p>The strongest version of it, not the convenient one.</p>' +
			'<h2>What follows.</h2>' +
			'<p>If the claim is true, what should anyone do differently on Tuesday?</p>'
	}
];

// helpers consumers use to default safely when a token is unknown.
/** @param {string} id */
export function findPalette(id) {
	return palettes.find((p) => p.id === id) || palettes[0];
}
/** @param {string} id */
export function findMotif(id) {
	return motifs.find((m) => m.id === id) || motifs[0];
}
/** @param {string} id */
export function findFont(id) {
	return fontPairs.find((f) => f.id === id) || fontPairs[0];
}
/** @param {string} id */
export function findTemplate(id) {
	return templates.find((t) => t.id === id) || null;
}

// ── custom palettes ──────────────────────────────────────────────────
// A ninth-and-a-half kind of theme, alongside the named ones above: a
// palette someone mixed rather than picked. `theme: 'custom'` on a draft
// or letter pairs with a `customPalette` object carrying these nine roles
// — the same ones shared/palette.css defines for every named theme — as
// hex strings. Consumers (write, letter) apply them as inline custom
// properties instead of a `data-theme` lookup; Hygge's mixer is the only
// producer, via `encodeCustomPalette`.

export const CUSTOM_PALETTE_ROLES = [
	'bg',
	'text',
	'muted',
	'lavender',
	'aqua',
	'peach',
	'lilac',
	'lapis',
	'plum'
];

// Every custom property a resolved custom palette can set on an element —
// used to clear a previous custom theme before applying a named one, so
// an inline override never outlives the palette that set it.
export const CUSTOM_PALETTE_CSS_VARS = [
	'--bg',
	'--text',
	'--muted',
	'--lavender',
	'--aqua',
	'--peach',
	'--lilac',
	'--cream',
	'--lapis',
	'--plum',
	'--accent',
	'--accent-soft',
	'--accent-warm',
	'--accent-strong',
	'--accent-deep',
	'--surface',
	'--rule'
];

/** @param {unknown} value */
function isHex6(value) {
	return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}

/** @param {unknown} value */
export function isValidCustomPalette(value) {
	if (!value || typeof value !== 'object') return false;
	return CUSTOM_PALETTE_ROLES.every((key) => isHex6(/** @type {any} */ (value)[key]));
}

/** @param {string} hex */
function hexToRgbTriple(hex) {
	return [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)].map((h) => parseInt(h, 16));
}

/** @param {string} hex */
function relativeLuminance(hex) {
	const [r, g, b] = hexToRgbTriple(hex).map((v) => {
		const c = v / 255;
		return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Nine hex roles, packed into a URL-safe 54-character string — no
 * separators needed, since every role is a fixed 6 hex digits. This is
 * what Hygge's "use in write" link puts in `?custom=`.
 * @param {Record<string,string>} roles
 * @returns {string | null}
 */
export function encodeCustomPalette(roles) {
	if (!isValidCustomPalette(roles)) return null;
	return CUSTOM_PALETTE_ROLES.map((key) => roles[key].slice(1).toLowerCase()).join('');
}

/** @param {string} code */
export function decodeCustomPalette(code) {
	if (typeof code !== 'string' || code.length !== CUSTOM_PALETTE_ROLES.length * 6) return null;
	if (!/^[0-9a-f]+$/i.test(code)) return null;
	/** @type {Record<string,string>} */
	const roles = {};
	CUSTOM_PALETTE_ROLES.forEach((key, i) => {
		roles[key] = '#' + code.slice(i * 6, i * 6 + 6).toLowerCase();
	});
	return roles;
}

/**
 * The nine roles, expanded into the full set of custom properties a named
 * theme's `[data-theme]` block would define — `--cream` mirrors `--bg`
 * and the `--accent-*` aliases mirror their source colors, exactly like
 * every block in shared/palette.css does. `--surface` and `--rule` are
 * derived rather than asked for, the same "don't make the mixer tag
 * everything" reasoning that lets background be the only required role.
 * @param {Record<string,string>} roles
 */
export function customPaletteTokens(roles) {
	const [br, bg_, bb] = hexToRgbTriple(roles.bg);
	const [ar, ag, ab] = hexToRgbTriple(roles.lavender);
	return {
		vars: {
			'--bg': roles.bg,
			'--text': roles.text,
			'--muted': roles.muted,
			'--lavender': roles.lavender,
			'--aqua': roles.aqua,
			'--peach': roles.peach,
			'--lilac': roles.lilac,
			'--cream': roles.bg,
			'--lapis': roles.lapis,
			'--plum': roles.plum,
			'--accent': roles.lavender,
			'--accent-soft': roles.aqua,
			'--accent-warm': roles.peach,
			'--accent-strong': roles.lapis,
			'--accent-deep': roles.plum,
			'--surface': `rgba(${br}, ${bg_}, ${bb}, 0.74)`,
			'--rule': `rgba(${ar}, ${ag}, ${ab}, 0.24)`
		},
		colorScheme: relativeLuminance(roles.bg) < 0.5 ? 'dark' : 'light'
	};
}
