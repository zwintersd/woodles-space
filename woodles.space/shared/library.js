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
	{ id: 'paper', name: 'paper', desc: 'monochrome · ink' }
];

export const motifs = [
	{ id: 'blobs', name: 'blobs', desc: 'drifting color · grain' },
	{ id: 'aurora', name: 'aurora', desc: 'wide saturation' },
	{ id: 'mist', name: 'mist', desc: 'scattered particles' },
	{ id: 'paper', name: 'paper', desc: 'grain only' },
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
	}
];

// templates are { palette, motif, font, sample } presets. /scaffold renders
// a grid of these and links each tile to /write?template=<id>. /write reads
// the param, applies the tokens, and seeds the editor with sample content.
export const templates = [
	{
		id: 'love-letter',
		name: 'love letter',
		desc: 'a soft, slow note',
		palette: 'cream',
		motif: 'blobs',
		font: 'classic',
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
		sampleTitle: 'log entry · 042',
		sampleContent:
			'<p>signal acquired. moon is waxing. tea is cold.</p>' +
			'<p>writing this down so I can find it later.</p>'
	}
];

// helpers consumers use to default safely when a token is unknown.
export function findPalette(id) {
	return palettes.find((p) => p.id === id) || palettes[0];
}
export function findMotif(id) {
	return motifs.find((m) => m.id === id) || motifs[0];
}
export function findFont(id) {
	return fontPairs.find((f) => f.id === id) || fontPairs[0];
}
export function findTemplate(id) {
	return templates.find((t) => t.id === id) || null;
}
