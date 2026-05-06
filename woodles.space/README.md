# woodles.space

Personal monorepo. One repo, all the things.

## Structure

```
woodles.space/
├── apps/
│   ├── landing/        # woodles.space homepage (static HTML, no build step)
│   ├── fonts/          # font viewer (static HTML, no build step)
│   └── woodles/        # SvelteKit app
├── packages/           # shared code (components, utils) — add when needed
├── package.json        # workspace root
├── pnpm-workspace.yaml
└── README.md
```

## Package manager

This repo uses [pnpm workspaces](https://pnpm.io/workspaces). Install everything from the `woodles.space/` root:

```sh
pnpm install
```

## Adding an app

Static apps (no build step) just drop a folder under `apps/`. For a new SvelteKit app:

```sh
cd woodles.space
pnpm dlx sv create apps/<name>
pnpm install
```

## Running an app locally

```sh
cd apps/<name>
pnpm dev
```

## Deployment

`woodles.space` is served by a single Vercel project that ships every static
app from this directory. `apps/landing` is the homepage; `apps/fonts`,
`apps/write`, and `apps/letter` mount at `/fonts`, `/write`, `/letter` via the
rewrites in `vercel.json`. Pushing to `main` triggers production automatically.

The SvelteKit app under `apps/woodles/` is **not** part of this deployment yet
— it has its own build step and is intended for a separate Vercel project (or
a follow-up unification once it has real routes).

### Required Vercel project settings

Misconfiguring these is the most common cause of `/fonts`, `/write`, and
`/letter` returning 404. The repo nests the project one level deep
(`woodles-space/woodles.space/`), so the dashboard defaults are wrong.

| Setting             | Value                | Why                                                                      |
| ------------------- | -------------------- | ------------------------------------------------------------------------ |
| Root Directory      | `woodles.space`      | Without this, Vercel never reads `vercel.json` and serves the repo root. |
| Framework Preset    | Other / None         | Auto-detects SvelteKit from `apps/woodles/` and drops the static apps.   |
| Build Command       | (empty / overridden) | `vercel.json` sets `buildCommand: ""` — leave the dashboard override off.|
| Install Command     | (empty / overridden) | `vercel.json` sets `installCommand: ""` — skip workspace install.        |
| Output Directory    | `.`                  | Set in `vercel.json`; nothing to build.                                  |
| Node.js Version     | any LTS              | No build runs, so the version doesn't matter.                            |

`vercel.json` declares `framework: null`, empty build/install commands, and
explicit rewrites for each app — these defend against the dashboard
auto-detecting SvelteKit, but they only take effect once Vercel actually
*finds* `vercel.json`, which requires the Root Directory above.

### When `/fonts` 404s — checklist

1. **Open the latest deployment in Vercel.** Look at "Source" → confirm
   `vercel.json` is listed at the project root. If it isn't, the Root
   Directory setting is wrong.
2. **Check the build logs.** If they mention `vite build`, `@sveltejs/kit`,
   or "Detected framework: SvelteKit", the framework preset is overriding
   `vercel.json`. Force it to "Other".
3. **Confirm `apps/fonts/index.html` is in the deployed output.** Visit
   `https://woodles.space/apps/fonts/index.html` directly — if that 404s,
   the file isn't being shipped (build step swallowed it). If it loads,
   the rewrite is the problem.
4. **Verify `/shared/fonts.css` loads** (`curl -I`). If it 404s, the deploy
   is rooted at the wrong directory.
5. **Force a clean redeploy** after changing settings — Vercel caches
   previous output and won't pick up new rewrites until a new commit lands
   or you redeploy manually with "Use existing Build Cache" off.
6. **Subdomains vs paths.** `woodles.space/fonts` is a path (handled here).
   `fonts.woodles.space` would be a subdomain, which would need its own
   Vercel project + DNS record and is **not** what this repo configures.
