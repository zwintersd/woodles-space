# woodles for Chrome

the shell half of the companion: a side panel that frames
[woodles.space/companion](https://woodles.space/companion), and a page menu
that keeps things into Write or a board. the why is in
[`../DESIGN.md`](../DESIGN.md).

## install

1. open `chrome://extensions` and turn on **developer mode**.
2. **load unpacked** → choose this directory (`apps/companion/extension`).
3. pin it, then click it — or press <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>W</kbd>.

Chrome 116 or newer. after pulling a change to anything in this directory,
press the reload arrow on its card in `chrome://extensions`; changes to the
page (`../src`) arrive with the site and need nothing.

## what's here

| file | job |
| --- | --- |
| `manifest.json` | permissions, the panel, the shortcut |
| `background.js` | opens the panel; turns a page-menu click into a pending capture |
| `panel.html`, `panel.js`, `panel.css` | the frame, the bridge, and what shows while the site loads or can't |
| `protocol.js` | the message contract, shared with the page — also imported by `../src` |
| `icons/` | rendered from the same tile as the page's header |

## working on it

`protocol.js` is tested from the page's suite: `pnpm --filter companion test`.
the rest touches `chrome.*` and isn't. `COMPANION_ORIGIN` in `protocol.js`
must match `host_permissions` in `manifest.json` — a test holds them together.
