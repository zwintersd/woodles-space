// Sprite intake. An uploaded image is drawn onto a canvas, capped to a sane
// size, and exported as a data URL so it can live in localStorage alongside the
// rest of the card. Card art is small, so a 480px cap keeps blobs light while
// staying crisp on the card face and in the editor preview.

const MAX_DIM = 480;

export type ProcessedSprite = {
	dataUrl: string;
	// true when the source is small enough to read as pixel art — we default the
	// card to nearest-neighbour scaling so it doesn't go blurry when enlarged.
	pixelated: boolean;
};

export class SpriteError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'SpriteError';
	}
}

function loadImage(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => reject(new SpriteError('could not read that image'));
		img.src = src;
	});
}

function readAsDataUrl(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = () => reject(new SpriteError('could not read that file'));
		reader.readAsDataURL(file);
	});
}

export async function processSprite(file: File): Promise<ProcessedSprite> {
	if (!file.type.startsWith('image/')) {
		throw new SpriteError('that file is not an image');
	}

	const sourceUrl = await readAsDataUrl(file);

	// SVGs are already small and scale cleanly — keep them as-is.
	if (file.type === 'image/svg+xml') {
		return { dataUrl: sourceUrl, pixelated: false };
	}

	const img = await loadImage(sourceUrl);
	const { width, height } = img;
	if (!width || !height) throw new SpriteError('that image has no dimensions');

	const pixelated = Math.max(width, height) <= 128;

	const scale = Math.min(1, MAX_DIM / Math.max(width, height));
	const w = Math.max(1, Math.round(width * scale));
	const h = Math.max(1, Math.round(height * scale));

	// Already small enough and lossless-friendly — don't re-encode pixel art.
	if (scale === 1 && pixelated) {
		return { dataUrl: sourceUrl, pixelated };
	}

	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new SpriteError('canvas is unavailable');
	ctx.imageSmoothingEnabled = !pixelated;
	ctx.drawImage(img, 0, 0, w, h);

	// Prefer webp; fall back to png if the browser declines.
	let out = canvas.toDataURL('image/webp', 0.85);
	if (!out.startsWith('data:image/webp')) out = canvas.toDataURL('image/png');
	return { dataUrl: out, pixelated };
}
