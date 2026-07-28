import vercel from '../../vercel.json';

export const publishedRoutes = vercel.rewrites
	.map((rewrite) => rewrite.source)
	.filter((source) => !source.includes(':path*') && !source.match(/\.[a-z0-9]+$/i));
