# woodles.space

Personal monorepo. One repo, all the things.

## Structure

```
woodles.space/
├── apps/
│   └── landing/        # woodles.space homepage (static HTML, no build step)
└── README.md
```

## Adding an app

Each new project gets its own folder under `apps/`. Start simple — add a build tool only when you actually need one.

```
apps/
├── landing/            # live at woodles.space
├── woodles/            # live at woodles.space/woodles or woodles.app
└── echoes/             # etc.
```

## Deployment

`apps/landing` is connected to Vercel. Root directory is set to `apps/landing`.
Pushing to `main` triggers a production deploy automatically.

Each app gets its own Vercel project when it's ready to ship.
