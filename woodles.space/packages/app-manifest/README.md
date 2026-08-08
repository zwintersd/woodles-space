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
- landing sub-surfaces such as Marginalia's Reading Room;
- which record kinds an app can be opened on (`addressableBy`), and the URL
  that opens one (`entityHref`).

It does not own app feature descriptions, design tokens, icons, or special
asset routing. Those stay with the app or landing page. Contract tests verify
that Vercel's explicit rewrites and every Svelte `paths.base` agree with the
manifest.

## addressing a record in another app

`primaryDestination(app)` gives an app's entry file. `entityHref(appId, kind,
id)` gives the URL that opens **one record inside** it, as
`<publicPath>?<kind>=<id>` with the id encoded:

```js
entityHref('bloomforge-player', 'game', projectId); // → /play?game=<id>
canAddress('bloomforge-player', 'game'); // → true
```

An app is addressable only by the kinds it lists in `addressableBy`, and
`entityHref` throws on an unknown app or an undeclared kind — the manifest is
static data, so neither is a runtime condition a caller could recover from,
and a thrown error names the bug at the call site instead of rendering
`href="null"`. Use `canAddress` where the pair isn't known at author time.

**Adding an addressable kind:** list it in the app's `addressableBy`, then
read that query parameter in the app itself. A contract test asserts the
second half — a declared kind the app never reads fails the suite, the same
way a route that disagrees with `vercel.json` does. The point is that a link
between apps resolves through the record that owns the path rather than being
a hardcoded string; see [REFERENCES.md](../../REFERENCES.md) for why that
distinction earned a vocabulary.

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
