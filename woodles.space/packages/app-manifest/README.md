# app manifest contract

`@woodles/app-manifest` is the canonical inventory of deployable Woodles apps.
It is browser-importable JavaScript with checked JSDoc plus TypeScript
declarations, so the static landing page and typed workspace consumers read the
same source.

The manifest owns:

- app id, display name, public path, and aliases;
- static, SvelteKit, or external app shape;
- source and output directories plus entry file;
- stable, growing, incubator, or private maturity;
- landing visibility, tile copy/order, default pins, and featured fallback;
- landing sub-surfaces such as Marginalia's Reading Room.

It does not own app feature descriptions, design tokens, icons, or special
asset routing. Those stay with the app or landing page. Contract tests verify
that Vercel's explicit rewrites and every Svelte `paths.base` agree with the
manifest.

## adding or moving an app

1. Add or update its record in `src/index.js`.
2. Add its Vercel rewrites. SvelteKit apps must also set the same public path in
   `svelte.config.js` and continue writing to `dist/`.
3. If it appears on landing, add landing metadata to the record and add an icon
   using the record's `tileId` in `apps/landing/index.html`.
4. Run `pnpm --filter @woodles/app-manifest check` and
   `pnpm --filter @woodles/app-manifest test`.

The tests fail on an unmanifested app directory, missing route, wrong output
destination, base-path drift, missing static entrypoint, or landing tile without
artwork.
