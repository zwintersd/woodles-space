# companion

woodles.space, kept beside the web. a Chrome extension opens the site's own
`/companion` page in the browser's side panel, so the thing you're reading and
the place you keep things sit next to each other.

## what it's for

three moments the site couldn't reach, because they happen somewhere else on
the web:

- **keeping.** a line, a link, an image, a whole page. the handoff spine
  (`@woodles/handoff`) was built for this — *put it anywhere, move it later*
  (CONVERGENCE.md §3) — and the companion is its first sender from outside
  the site. right-click → *keep in write* or *pin to a board*, or the keep
  card in the panel, with a line of your own.
- **noticing what's waiting.** handoffs sitting in Write's and Whiteboard's
  queues, and the six things HomeSuite last listed.
- **stepping away.** the Life Points balance and rank, and a door to the
  homepage's break widget.

what it deliberately isn't: a reading tracker, a bookmark manager, a feed.
it sees the tab you're on only while the panel is open, keeps nothing you
don't hand it, sends nothing to a server, and never mints Life Points —
landing is that ledger's one writer.

## the shape: a thin shell around a page the site already serves

| half | where | ships as |
| --- | --- | --- |
| shell | `extension/` | Chrome extension, MV3, no build — load unpacked |
| page | `src/` | SvelteKit at `/companion`, deployed with the site |

the shell is a frame, a message bridge, and a page-menu handler. everything
that touches woodles.space data is in the page. why the line falls there:

1. **storage.** every ledger the companion reads and every queue it writes is
   woodles.space localStorage. an extension page is its own origin and sees
   none of it. a frame of woodles.space does — and Chrome exempts a frame
   inside an extension page from storage partitioning when the extension
   holds host permission for the framed site, so it reads the *same*
   localStorage a woodles.space tab does. no sync, no passphrase, no copy.
2. **imports.** the page imports `@woodles/handoff`, `@woodles/life-points`,
   `@woodles/app-manifest`, and `shared/homesuiteRecent.js` like any other
   app, so no ledger format is hand-rolled in the extension — the
   `apps/letter` case `@woodles/life-points` names as the awkward one.
3. **shipping.** the page deploys on every push; the extension only needs
   reloading when the protocol changes. the half that changes most lives
   where change is free.

the cost: the panel needs the network to draw anything. it says so rather
than showing a blank frame, and nothing kept from the page menu while
offline is lost (see "capture").

## the protocol

`extension/protocol.js` — plain browser JS with checked JSDoc. the extension
loads it as a file; the page imports it through Vite (`@extension` alias)
and svelte-check reads its types. one definition, nothing to pin.

messages are `{ protocol: 'woodles-companion', v: 1, kind, … }` over
`postMessage`. a different protocol or version is ignored, not
half-understood.

| kind | from → to | carries |
| --- | --- | --- |
| `ready` | page → shell | nothing — "listening"; sent on every load |
| `hello` | shell → page | the extension's version |
| `page` | shell → page | `{ title, url }` of the active tab, or null |
| `capture` | shell → page | something kept from the page menu |
| `captured` | page → shell | a capture id; the shell forgets it |

**trust.** the page takes messages only from `window.parent` at a
`chrome-extension://` origin; the shell only from its frame at
`https://woodles.space`. neither is the security boundary — partitioning is.
a website or another extension that frames `/companion` without host
permission for woodles.space gets a partitioned localStorage, so anything it
coaxes the page into writing lands in a sandbox no woodles.space tab ever
reads. an extension *with* that permission can already script the site; the
frame gives it nothing new. the checks are about a message being what it
claims to be.

**urls.** only http(s) survives `safeUrl`. a `javascript:` link right-clicked
on some page would otherwise ride into Write as an `href`. Write's sanitizer
drops it too; checking twice is cheap.

## capture

1. a page-menu click reaches `background.js`, which opens the panel **first**
   — `sidePanel.open` only works inside the click's gesture, and an `await`
   ahead of it loses the gesture — then writes the capture to
   `chrome.storage.session` under its own key (`capture:<id>`), so adding one
   and acknowledging another never race on a shared value.
2. the panel delivers pending captures on `ready` and on every storage change,
   so it doesn't matter which arrives first.
3. the page sends each as a handoff whose id **is** the capture id, and skips
   an id already in the queue. a lost acknowledgement costs a redelivery,
   never a duplicate.
4. only then does it post `captured`, and the shell removes the key. session
   storage clears when the browser closes; anything still pending then was
   never written anywhere, which is the honest end for it.

the most specific thing right-clicked wins: a selection over the link it sits
in, a link over the image inside it, any of those over the page.

**per receiver.** the two ingests differ, so the handoffs do:

- Write drops `source` when it makes a draft, so the body carries the link
  back itself — HTML, a quote as `<blockquote>`, a link as `<a>`, through
  Write's own sanitizer.
- Whiteboard files a plain-text card and appends `source.href` itself, so the
  page's url stays out of the body or the card says it twice.

## the panel

narrow-first — Chrome's side panel runs about 320–500 px. top to bottom:

- **greeting** — the homepage widget's words for the hour.
- **keep** — the page beside the panel as a chip (× sets it aside), a line of
  your own, *keep in write* / *pin to a board*. with no page, a thought on
  its own.
- **waiting** — per-receiver counts, linking to each; opening one files them.
- **lately** — HomeSuite's recent six, "as HomeSuite last saw it", because the
  ledger is only as fresh as its writer.
- **life points** — balance, rank, the way to the next, *step away*.

links open in a new tab when in the panel, so the frame stays on
`/companion`. opened directly, the page works the same minus the page chip,
and says how to put it in the panel.

the ledgers redraw on `storage` events and on focus — a queue drains in
another tab, HomeSuite republishes, landing mints.

## permissions

| permission | why |
| --- | --- |
| `sidePanel` | the panel |
| `contextMenus` | keep / pin from the page menu |
| `tabs` | the active tab's title and url, for the chip. read only while the panel is open, never stored |
| `storage` | captures waiting for the page, in session storage |
| `https://woodles.space/*` | the unpartitioned frame (see "the shape"). nothing scripts the site |

no content scripts, no `<all_urls>`, no `scripting`. `incognito` is
`not_allowed`: a private window is the wrong place for something whose whole
job is remembering.

## not yet

- **a nudge to step away** after a long stretch. it needs time-on-screen,
  which is the tracking this design refuses; better asked by Carillon's bell
  than counted by the browser.
- **Thinking About as a receiver.** "reading" is the obvious column for a web
  page, but Thinking About isn't on `HANDOFF_TARGETS`. that's a handoff-spine
  change and an ingest in Thinking About, not a companion change.
- **spending Life Points.** nothing spends yet. when something does, it
  publishes its own spend ledger (`@woodles/life-points`), and `readGlance`
  passes that ledger to `lifePointsBalance` alongside landing's.
- **the Chrome Web Store.** unpacked until the shape settles. the store
  wants a privacy policy and a pinned extension key.
- **other devices.** everything here is this browser's localStorage, the same
  promise the handoff spine makes.
