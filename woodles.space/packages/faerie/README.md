# Faerie

`@woodles/faerie` is a small glowing companion that can point out something on
screen, offer a helpful hint, follow the pointer, or celebrate a moment. Its
orb, wings, glow, and movements are original browser artwork. It is a reusable
browser ES module with no framework dependency, app integration, or stored
state. The calling app decides what deserves attention and when.

The standalone playground lives in `playground/`. From the workspace root,
run `node e2e/support/site-server.mjs`, then open
`http://127.0.0.1:4173/packages/faerie/playground/` to try the different
behaviors. Nothing in the playground connects Faerie to an existing Woodle.

## Create a companion

```js
import { createFaerie } from '@woodles/faerie';

const faerie = createFaerie({
  container: document.body,
  tone: 'moonlight',
  motion: 'auto',
  size: 56,
});

faerie.attend(document.querySelector('[data-save]'), {
  message: 'Your changes are ready to save.',
  action: {
    label: 'Save changes',
    onSelect: () => saveChanges(),
  },
});

// Remove the companion and its listeners when the owning view is destroyed.
faerie.destroy();
```

Call `createFaerie()` after the page mounts in a browser; importing the module
itself is safe during server rendering. It mounts into `document.body` by
default. `container` may be any connected HTML element without a transformed
ancestor; the overlay uses viewport coordinates. An optional numeric `zIndex`
controls its overlay layer. `tone`
accepts `moonlight`, `lilac`, `rose`, or `leaf`. `size` accepts 40–88 CSS pixels.
`motion: 'auto'` respects the browser's reduced-motion preference; `'reduced'`
always uses quiet movement.

## Behaviors

| Method | Behavior |
| --- | --- |
| `attend(target, options)` | Move beside a target, mark its location, and optionally show a hint. |
| `say(message, options)` | Speak from the resting location. |
| `celebrate(message?)` | Briefly brighten and celebrate, optionally with a message. |
| `follow(enabled = true)` | Follow the pointer; `false` returns to rest. |
| `rest()` | Clear the current cue and hint and return to the resting location. |
| `hide()` / `show()` | Hide Faerie or show it at rest. |
| `configure(options)` | Update `tone`, `motion`, or `size` without creating another companion. |
| `destroy()` | Remove Faerie, cancel timers, and detach its listeners. |

An `attend` target can be an `HTMLElement`, a viewport point `{ x, y }`, a CSS
selector, or a callback returning an element, point, or `null`. A callback is
useful when a control is replaced during rendering. Selector and element
targets are resolved as the view changes. Missing, disconnected, or offscreen
targets safely return Faerie to rest. `attend()` returns `true` when the cue
is displayed and `false` when its target is unavailable.

`attend` accepts `{ message, placement, scroll, action, duration }`. `placement`
is `auto`, `top`, `right`, `bottom`, or `left`; Faerie falls back when the
requested side cannot fit. `scroll` defaults to `false`; opt in to bring an
element into view. `duration` is milliseconds. `say` accepts `{ duration,
action }`. An `action` has `{ label, onSelect }`; selecting it calls `onSelect()`.

Hints render as plain text. Faerie leaves the page's keyboard focus alone.
Its optional action and dismiss controls are ordinary keyboard-accessible
buttons. An element containing a focusable control also offers an explicit
“Focus target” button. Target highlighting is visual, and hints are announced
politely to screen readers. When a selected hint action advances to another
hint, focus stays on the new action. Dismissing a focused hint returns focus
to the orb. The app still owns its controls, navigation, and
decisions about when a cue is appropriate. Reduced motion removes animated
flight, wing, glow, and sparkle effects while keeping the same cues available.

Click the resting orb for a hello; click it again or press Escape to rest.
Dragging it changes its resting perch for this instance. No settings or
perches are written to browser storage.

## State and events

`faerie.state` is read-only and is one of `idle`, `attending`, `speaking`,
`following`, `celebrating`, or `hidden`. `faerie.element` is the mounted HTML
host and exposes the current state through its `data-state` attribute.

The host dispatches `faerie-statechange` as a `CustomEvent` with
`detail: { state }`. It also emits `faerie-dismiss` when a hint is dismissed
and `faerie-action` when its action is selected. These events let a future
host respond without coupling the companion to that app's model.

```js
faerie.element.addEventListener('faerie-statechange', (event) => {
  console.log(event.detail.state);
});
```

## Placement helper

`src/placement.js` exports the pure `placeFaerie(rect, viewport, options = {})`
helper used by the browser runtime. `rect` has `left`, `top`, `right`, and
`bottom` edges in viewport CSS pixels; `width` and `height` are optional and
are not used. A point uses identical left/right and top/bottom edges.
`viewport` has positive `width` and `height`.

The defaults are `{ size: 56, gap: 24, padding: 16, placement: 'auto',
bubbleWidth: 280, bubbleHeight: 130 }`. The returned object has
`{ x, y, bubbleX, bubbleY, placement, visible }`: `x`/`y` are the orb center,
and `bubbleX`/`bubbleY` are the hint's top-left corner. Automatic placement
considers the available space on all four sides; hint placement avoids
covering the target when room permits. A requested side is honored when the
orb fits, otherwise placement falls back. Partially visible targets use
their visible portion. Entirely offscreen targets return `visible: false`
with finite, bounded coordinates. Points on viewport edges count as visible.

For an unusually small viewport, render the orb at
`min(size, viewport.width, viewport.height)` and use padding
`min(padding, max(0, (min(viewport.width, viewport.height) - renderedSize) / 2))`.
The hint width and height are capped at the viewport minus twice that
padding. Passing zero for either hint dimension creates a cue without a
hint. Scrollable hint content belongs to the renderer.

Nonfinite or nonnumeric required values throw `TypeError`. Unordered target
edges, nonpositive viewport or orb dimensions, negative gaps/padding/hint
dimensions, and unsupported placement names throw `RangeError`. The helper
does not mutate its inputs.

Run the geometry checks with `pnpm --filter @woodles/faerie test`, or
`node --test src/*.test.js` from this package.
