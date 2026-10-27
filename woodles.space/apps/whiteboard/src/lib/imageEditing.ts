export type ImageEdits = {
	rotation: number;
	shape: 'rectangle' | 'rounded' | 'ellipse' | 'diamond';
	crop: { left: number; top: number; right: number; bottom: number };
};

export function defaultImageEdits(): ImageEdits {
	return { rotation: 0, shape: 'rounded', crop: { left: 0, top: 0, right: 0, bottom: 0 } };
}

export function validImageEdits(value: unknown): value is ImageEdits {
	if (!value || typeof value !== 'object') return false;
	const edits = value as ImageEdits;
	return Number.isFinite(edits.rotation) && Math.abs(edits.rotation) <= 180 &&
		['rectangle', 'rounded', 'ellipse', 'diamond'].includes(edits.shape) && !!edits.crop &&
		['left', 'top', 'right', 'bottom'].every((edge) => {
			const amount = edits.crop[edge as keyof ImageEdits['crop']];
			return Number.isFinite(amount) && amount >= 0 && amount <= 90;
		}) && edits.crop.left + edits.crop.right <= 90 && edits.crop.top + edits.crop.bottom <= 90;
}

/** Rotate into a full bounding box first, then crop that box. Source pixels stay intact. */
export function imageViewport(aspectRatio: number, edits: ImageEdits) {
	const sourceWidth = aspectRatio * 1000;
	const sourceHeight = 1000;
	const angle = edits.rotation * Math.PI / 180;
	const width = Math.abs(sourceWidth * Math.cos(angle)) + Math.abs(sourceHeight * Math.sin(angle));
	const height = Math.abs(sourceWidth * Math.sin(angle)) + Math.abs(sourceHeight * Math.cos(angle));
	const croppedWidth = width * (1 - (edits.crop.left + edits.crop.right) / 100);
	const croppedHeight = height * (1 - (edits.crop.top + edits.crop.bottom) / 100);
	return { sourceWidth, sourceHeight, width, height, aspectRatio: croppedWidth / croppedHeight,
		viewBox: `${width * edits.crop.left / 100} ${height * edits.crop.top / 100} ${croppedWidth} ${croppedHeight}` };
}
