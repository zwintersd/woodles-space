import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = path.dirname(fileURLToPath(import.meta.url));
const sharedDir = path.resolve(appDir, '../../shared');
const sharedContentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'application/javascript; charset=utf-8']
]);

function sharedAssetsPlugin() {
  const serveShared = (req, res, next) => {
    const requestedPath = decodeURIComponent((req.url || '').split('?')[0]).replace(/^\/+/, '');
    const filePath = path.resolve(sharedDir, requestedPath);
    const relativePath = path.relative(sharedDir, filePath);

    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      next();
      return;
    }

    const contentType = sharedContentTypes.get(path.extname(filePath));
    if (contentType) res.setHeader('Content-Type', contentType);

    fs.createReadStream(filePath)
      .on('error', next)
      .pipe(res);
  };

  return {
    name: 'quiet-room-shared-assets',
    configureServer(server) {
      server.middlewares.use('/shared', serveShared);
    },
    configurePreviewServer(server) {
      server.middlewares.use('/shared', serveShared);
    }
  };
}

export default defineConfig({
  base: '/quiet-room/',
  plugins: [react(), sharedAssetsPlugin()]
});
