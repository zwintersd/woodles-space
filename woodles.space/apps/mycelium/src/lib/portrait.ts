/** Keep local contact backups small enough for browser storage. */
export async function readPortrait(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
    throw new Error('Choose a PNG, JPEG, WebP, or GIF portrait.');
  }
  if (file.size > 8 * 1024 * 1024) throw new Error('Choose a portrait smaller than 8 MB.');
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 800 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser could not prepare the portrait.');
    context.fillStyle = '#fff8fc';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let quality = 0.82;
    let data = canvas.toDataURL('image/jpeg', quality);
    while (data.length > 500_000 && quality > 0.3) {
      quality -= 0.1;
      data = canvas.toDataURL('image/jpeg', quality);
    }
    if (data.length > 500_000) throw new Error('This portrait is too detailed to save. Choose a smaller picture.');
    return data;
  } finally {
    bitmap.close();
  }
}
