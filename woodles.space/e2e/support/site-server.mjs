import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const port = Number(process.env.E2E_PORT || 4173);
const vercel = JSON.parse(await readFile(path.join(root, 'vercel.json'), 'utf8'));

const contentTypes = new Map([
	['.css', 'text/css; charset=utf-8'],
	['.gif', 'image/gif'],
	['.html', 'text/html; charset=utf-8'],
	['.ico', 'image/x-icon'],
	['.jpeg', 'image/jpeg'],
	['.jpg', 'image/jpeg'],
	['.js', 'text/javascript; charset=utf-8'],
	['.json', 'application/json; charset=utf-8'],
	['.map', 'application/json; charset=utf-8'],
	['.mjs', 'text/javascript; charset=utf-8'],
	['.png', 'image/png'],
	['.svg', 'image/svg+xml'],
	['.webm', 'video/webm'],
	['.webp', 'image/webp'],
	['.woff', 'font/woff'],
	['.woff2', 'font/woff2']
]);

function applyRewrite(pathname) {
	for (const rewrite of vercel.rewrites) {
		const wildcard = rewrite.source.endsWith('/:path*');
		if (wildcard) {
			const prefix = rewrite.source.slice(0, -7);
			if (pathname !== prefix && !pathname.startsWith(`${prefix}/`)) continue;
			const rest = pathname.slice(prefix.length).replace(/^\//, '');
			return rewrite.destination.replace(':path*', rest);
		}
		if (pathname === rewrite.source) return rewrite.destination;
	}
	return pathname;
}

function resolveRewrite(pathname) {
	let resolved = pathname;
	for (let i = 0; i < 5; i += 1) {
		const next = applyRewrite(resolved);
		if (next === resolved) break;
		resolved = next;
	}
	return resolved;
}

function safeFilePath(pathname) {
	const relative = decodeURIComponent(pathname).replace(/^\/+/, '');
	const candidate = path.resolve(root, relative);
	if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) return null;
	return candidate;
}

async function sendFile(res, pathname, method) {
	let filePath = safeFilePath(resolveRewrite(pathname));
	if (!filePath) return false;

	try {
		const info = await stat(filePath);
		if (info.isDirectory()) filePath = path.join(filePath, 'index.html');
		const body = method === 'HEAD' ? null : await readFile(filePath);
		res.writeHead(200, {
			'content-type': contentTypes.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream',
			'cache-control': 'no-store'
		});
		res.end(body);
		return true;
	} catch {
		return false;
	}
}

const server = createServer(async (req, res) => {
	const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);

	if (url.pathname === '/api/public' && req.method === 'GET') {
		res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
		res.end(JSON.stringify({ blob: null, version: 0, publishedAt: null }));
		return;
	}

	if (url.pathname.startsWith('/api/')) {
		res.writeHead(401, { 'content-type': 'application/json; charset=utf-8' });
		res.end(JSON.stringify({ error: 'not available in the local integration server' }));
		return;
	}

	if (req.method !== 'GET' && req.method !== 'HEAD') {
		res.writeHead(405, { allow: 'GET, HEAD' });
		res.end('method not allowed');
		return;
	}

	if (await sendFile(res, url.pathname, req.method)) return;
	res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
	res.end(`not found: ${url.pathname}`);
});

server.listen(port, '127.0.0.1', () => {
	console.log(`woodles.space integration server listening on http://127.0.0.1:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
	process.on(signal, () => server.close(() => process.exit(0)));
}
