// Kept inside the shadow root so a host app's styles cannot change Faerie.
export const styles = String.raw`
:host {
  all: initial;
  --faerie-color: #98eaf5;
  --faerie-ink: #f2f6ef;
  position: fixed;
  inset: 0;
  pointer-events: none;
  font: 14px/1.5 ui-sans-serif, system-ui, sans-serif;
  color: var(--faerie-ink);
  color-scheme: dark;
}
*, *::before, *::after { box-sizing: border-box; }
:host([hidden]) { display: none !important; }
[hidden] { display: none !important; }
button { font: inherit; }
.flight {
  position: absolute;
  left: 0;
  top: 0;
  width: var(--faerie-size);
  height: var(--faerie-size);
  transition: transform 700ms cubic-bezier(.22,.8,.2,1);
  will-change: transform;
}
:host([data-state="following"]) .flight { transition-duration: 190ms; }
.orb {
  display: block;
  position: absolute;
  inset: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--faerie-color);
  cursor: pointer;
  pointer-events: auto;
  touch-action: none;
  border-radius: 50%;
  -webkit-tap-highlight-color: transparent;
}
.orb:focus-visible { outline: 2px solid var(--faerie-color); outline-offset: 10px; }
.orb::before {
  content: '';
  position: absolute;
  inset: -70%;
  border-radius: 50%;
  background: radial-gradient(circle, color-mix(in srgb, var(--faerie-color) 20%, transparent), transparent 64%);
  opacity: .8;
  animation: breathe 4s ease-in-out infinite;
  pointer-events: none;
}
.body {
  position: absolute;
  inset: 0;
  animation: hover 3.6s ease-in-out infinite;
  pointer-events: none;
}
.core {
  position: absolute;
  width: 41%;
  height: 41%;
  left: 29.5%;
  top: 29.5%;
  border-radius: 50%;
  background: radial-gradient(circle at 38% 34%, #fff 0%, #f6fffc 23%, var(--faerie-color) 65%, color-mix(in srgb, var(--faerie-color) 60%, #437bae) 100%);
  box-shadow: 0 0 8px 3px #ffffff88, 0 0 22px 8px color-mix(in srgb, var(--faerie-color) 58%, transparent), 0 0 48px 10px color-mix(in srgb, var(--faerie-color) 25%, transparent);
}
.wings { position: absolute; width: 145%; height: 135%; left: -22.5%; top: -24%; overflow: visible; }
.wing {
  fill: color-mix(in srgb, var(--faerie-color) 12%, transparent);
  stroke: color-mix(in srgb, var(--faerie-color) 65%, #ffffff);
  stroke-width: .8;
  filter: drop-shadow(0 0 3px var(--faerie-color));
  transform-box: fill-box;
  transform-origin: bottom right;
  animation: flutter 2.1s ease-in-out infinite;
}
.wing.right { transform-origin: bottom left; animation-delay: -.8s; }
.wing.small { opacity: .62; animation-duration: 1.7s; }
.vein { fill: none; stroke: var(--faerie-color); stroke-width: .45; opacity: .45; }
.dust { position: absolute; inset: 0; pointer-events: none; }
.dust i { position: absolute; width: 3px; height: 3px; background: #fff; border-radius: 50%; box-shadow: 0 0 7px 2px var(--faerie-color); opacity: 0; animation: mote 4.8s ease-in-out infinite; }
.dust i:nth-child(1) { left: 5%; top: 65%; }
.dust i:nth-child(2) { left: 82%; top: 20%; animation-delay: -.9s; }
.dust i:nth-child(3) { left: 72%; top: 86%; animation-delay: -2s; }
.dust i:nth-child(4) { left: 23%; top: 6%; animation-delay: -3.2s; }
.dust i:nth-child(5) { left: 104%; top: 55%; animation-delay: -4s; }
.dust i:nth-child(6) { left: -6%; top: 29%; animation-delay: -1.7s; }
:host([data-state="attending"]) .core { animation: beacon 2.6s ease-in-out infinite; }
:host([data-state="celebrating"]) .body { animation: delight 900ms ease-in-out 3; }
:host([data-state="celebrating"]) .dust i { animation-duration: 1.1s; }
.ring {
  position: absolute;
  border: 1px solid color-mix(in srgb, var(--faerie-color) 85%, transparent);
  border-radius: 12px;
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--faerie-color) 7%, transparent), 0 0 24px color-mix(in srgb, var(--faerie-color) 12%, transparent);
  pointer-events: none;
}
.hint {
  position: absolute;
  width: 280px;
  max-width: calc(100vw - 32px);
  max-height: calc(100dvh - 32px);
  overflow: auto;
  padding: 17px 18px 14px;
  pointer-events: auto;
  background: #19242bf5;
  border: 1px solid color-mix(in srgb, var(--faerie-color) 28%, #27343a);
  box-shadow: 0 12px 40px #0004, 0 0 30px color-mix(in srgb, var(--faerie-color) 7%, transparent);
  border-radius: 17px;
  backdrop-filter: blur(16px);
}
.hint-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 7px; }
.name { color: var(--faerie-color); font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
.close { display: grid; place-items: center; width: 28px; height: 28px; margin: -8px -9px -3px 0; background: none; border: 0; color: #b6c9cc; border-radius: 6px; cursor: pointer; font-size: 21px; line-height: 1; }
.close:hover { background: #ffffff12; color: #fff; }
.message { margin: 0; overflow-wrap: anywhere; }
.actions { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 12px; }
.actions:empty { display: none; }
.action { min-height: 34px; padding: 5px 11px; border: 1px solid #ffffff20; border-radius: 8px; color: var(--faerie-ink); background: #ffffff07; cursor: pointer; font-size: 12px; }
.action.primary { background: color-mix(in srgb, var(--faerie-color) 14%, transparent); border-color: color-mix(in srgb, var(--faerie-color) 38%, transparent); }
.action:hover { background: #ffffff16; }
button:focus-visible { outline: 2px solid var(--faerie-color); outline-offset: 3px; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
:host([data-motion="reduced"]) *, :host([data-motion="reduced"]) *::before { animation: none !important; transition: none !important; }
:host([data-motion="reduced"]) .dust { display: none; }
@media (prefers-reduced-motion: reduce) {
  :host(:not([data-motion="full"])) *, :host(:not([data-motion="full"])) *::before { animation: none !important; transition: none !important; }
}
@media (forced-colors: active) {
  .core { background: Highlight; border: 2px solid CanvasText; }
  .wing { stroke: CanvasText; }
  .ring { border: 2px solid Highlight; }
  .hint { background: Canvas; color: CanvasText; border-color: CanvasText; }
  .name, .close, .action { color: CanvasText; }
}
@keyframes hover { 0%,100% { transform: translateY(3px) rotate(-3deg); } 50% { transform: translateY(-5px) rotate(3deg); } }
@keyframes breathe { 0%,100% { opacity: .6; transform: scale(.92); } 50% { opacity: 1; transform: scale(1.08); } }
@keyframes flutter { 0%,100% { transform: rotate(-5deg) scaleX(.92); opacity: .6; } 50% { transform: rotate(4deg) scaleX(1.04); opacity: 1; } }
@keyframes mote { 0%,100% { opacity: 0; transform: translate(0,8px) scale(.5); } 35% { opacity: .85; } 75% { opacity: 0; transform: translate(5px,-18px) scale(.25); } }
@keyframes beacon { 0%,100% { filter: brightness(1); } 50% { filter: brightness(1.25); } }
@keyframes delight { 0%,100% { transform: translateY(0) rotate(0); } 35% { transform: translateY(-17px) rotate(-15deg); } 70% { transform: translateY(-7px) rotate(15deg); } }
`;
