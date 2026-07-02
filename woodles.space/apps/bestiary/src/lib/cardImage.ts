// Saving a card (or just its art) as a PNG. The framed card is real DOM/CSS —
// blend modes, color-mix, data-URL textures, web fonts — so it's rasterised
// with modern-screenshot (the library encapsulates the fiddly bits of cloning
// a node into an SVG/foreignObject and embedding fonts). The art-only path is
// a plain canvas round-trip of the stored sprite, so it needs no library and
// normalises webp → png.
//
// The library is imported lazily inside the handlers so this module — and the
// editor that imports it — stay safe to load during static prerender.

// Turn a creature's name into a tidy, safe download filename.
export function slugFilename(name: string, suffix: string, ext: string): string {
	const base =
		name
			.trim()
			.toLowerCase()
			.normalize('NFKD')
			.replace(/[̀-ͯ]/g, '') // drop combining diacritical marks
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '') || 'creature';
	return `${base}${suffix}.${ext}`;
}

function triggerDownload(href: string, filename: string): void {
	const a = document.createElement('a');
	a.href = href;
	a.download = filename;
	a.click();
}

function downloadBlob(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	triggerDownload(url, filename);
	// give the click a tick before reclaiming the object URL
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function loadImage(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error('could not read the art'));
		img.src = src;
	});
}

// let any web fonts settle so a title renders in its real face before rasterising
async function waitForFonts(): Promise<void> {
	if (typeof document !== 'undefined' && document.fonts?.ready) {
		try {
			await document.fonts.ready;
		} catch {
			// non-fatal — fall back to whatever's loaded
		}
	}
}

// Rasterise a card node to a PNG and download it. `scale` multiplies the node's
// CSS pixels — 2 over a 640px-wide stage gives a crisp ~1280px card.
export async function exportCardPng(node: HTMLElement, name: string, scale = 2): Promise<void> {
	await waitForFonts();
	const { domToBlob } = await import('modern-screenshot');
	const blob = await domToBlob(node, { scale, type: 'image/png' });
	if (blob) downloadBlob(blob, slugFilename(name, '', 'png'));
}

// Rasterise a card node to a PNG data URL — for embedding directly (the
// bestiary publish flow's card image) rather than triggering a download.
export async function renderCardDataUrl(node: HTMLElement, scale = 2): Promise<string> {
	await waitForFonts();
	const { domToPng } = await import('modern-screenshot');
	return domToPng(node, { scale });
}

// Download just the creature's art (the flattened sprite) as a PNG. Same-origin
// data URL → no canvas taint; the round-trip normalises webp to png.
export async function exportArtPng(sprite: string, name: string): Promise<void> {
	const img = await loadImage(sprite);
	const canvas = document.createElement('canvas');
	canvas.width = img.naturalWidth || img.width || 1;
	canvas.height = img.naturalHeight || img.height || 1;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('canvas is unavailable');
	ctx.drawImage(img, 0, 0);
	await new Promise<void>((resolve) => {
		canvas.toBlob((blob) => {
			if (blob) downloadBlob(blob, slugFilename(name, '-art', 'png'));
			resolve();
		}, 'image/png');
	});
}
