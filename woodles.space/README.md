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

Each app gets its own Vercel project. Set the root directory to `apps/<name>` and the framework to SvelteKit.

`apps/landing` deploys to `woodles.space`. Pushing to `main` triggers production automatically.
