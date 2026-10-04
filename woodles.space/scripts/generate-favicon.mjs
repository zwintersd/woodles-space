// Run from the repository root: node scripts/generate-favicon.mjs
// The SVG is the source of truth; Chromium supplies consistent antialiasing.
import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const svg = await readFile(new URL('favicon.svg', root), 'utf8');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const renders = await page.evaluate(async (source) => {
    const image = new Image();
    image.src = `data:image/svg+xml;base64,${btoa(source)}`;
    await image.decode();
    return [16, 32, 48, 180, 256].map(size => {
      const large = document.createElement('canvas');
      large.width = large.height = size * 4;
      large.getContext('2d').drawImage(image, 0, 0, large.width, large.height);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const context = canvas.getContext('2d');
      context.imageSmoothingQuality = 'high';
      context.drawImage(large, 0, 0, size, size);
      return { size, png: canvas.toDataURL('image/png').split(',')[1] };
    });
  }, svg);

  const icons = renders.filter(({ size }) => size <= 48);
  const header = Buffer.alloc(6 + icons.length * 16);
  header.writeUInt16LE(1, 2); // ICO
  header.writeUInt16LE(icons.length, 4);
  let offset = header.length;
  const payloads = icons.map(({ size, png }, index) => {
    const data = Buffer.from(png, 'base64');
    const entry = 6 + index * 16;
    header[entry] = header[entry + 1] = size;
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(data.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
    return data;
  });
  await writeFile(new URL('favicon.ico', root), Buffer.concat([header, ...payloads]));
  for (const [size, name] of [[180, 'apple-touch-icon.png'], [256, 'shared/woodles-mark.png']]) {
    await writeFile(new URL(name, root), Buffer.from(renders.find(r => r.size === size).png, 'base64'));
  }
  console.log('Generated favicon.ico (16/32/48), apple-touch-icon.png (180), shared/woodles-mark.png (256).');
} finally {
  await browser.close();
}
