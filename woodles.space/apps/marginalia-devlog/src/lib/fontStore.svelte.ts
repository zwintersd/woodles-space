export interface FontOption {
	key: string;
	label: string;
	cssVar: string;
	category: 'serif' | 'sans' | 'mono' | 'display';
}

export const FONTS: FontOption[] = [
	{ key: 'lora',      label: 'Lora',                        cssVar: '--font-body',      category: 'serif'   },
	{ key: 'cormorant', label: 'Cormorant Garamond',           cssVar: '--font-display',   category: 'serif'   },
	{ key: 'fraunces',  label: 'Fraunces',                     cssVar: '--font-optical',   category: 'serif'   },
	{ key: 'fell',      label: 'IM Fell DW Pica',              cssVar: '--font-fell',      category: 'serif'   },
	{ key: 'glaze',     label: 'Kalnia Glaze',                 cssVar: '--font-glaze',     category: 'display' },
	{ key: 'jakarta',   label: 'Plus Jakarta Sans',            cssVar: '--font-sans',      category: 'sans'    },
	{ key: 'grotesk',   label: 'Space Grotesk',                cssVar: '--font-geometric', category: 'sans'    },
	{ key: 'dmmono',    label: 'DM Mono',                      cssVar: '--font-mono',      category: 'mono'    },
	{ key: 'gothic',    label: 'Special Gothic',               cssVar: '--font-gothic',    category: 'display' },
	{ key: 'datatype',  label: 'Datatype',                     cssVar: '--font-data',      category: 'mono'    },
	{ key: 'amarna',    label: 'Amarna',                       cssVar: '--font-ancient',   category: 'display' },
	{ key: 'pixels',    label: 'Coral Pixels',                 cssVar: '--font-pixel',     category: 'display' },
];

const STORAGE_KEY = 'woodles_devlog_font';

function loadKey(): string {
	try {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved && FONTS.some((f) => f.key === saved)) return saved;
	} catch { /* ssr / private mode */ }
	return 'lora';
}

let _key = $state(loadKey());
const _current = $derived(FONTS.find((f) => f.key === _key) ?? FONTS[0]);
const _cssValue = $derived(`var(${_current.cssVar})`);

function select(key: string): void {
	_key = key;
	try { localStorage.setItem(STORAGE_KEY, key); } catch { /* ignore */ }
}

export const fontStore = {
	get key()      { return _key; },
	get current()  { return _current; },
	get cssValue() { return _cssValue; },
	select,
};
