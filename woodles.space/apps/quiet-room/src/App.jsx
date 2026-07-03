import { useEffect, useState } from 'react';
import { MeshGradient } from '@paper-design/shaders-react';
import { initQuietRoom } from './quietRoomEngine.js';
import { BitsOptions, ReactBitsEffects, useReactBitsSettings } from './ReactBitsOptions.jsx';

const PAPER_SHADER_EVENT = 'quiet-room:paper-shader';
const PAPER_WEBGL_OPTIONS = {
  alpha: true,
  antialias: false,
  premultipliedAlpha: false,
  powerPreference: 'low-power'
};

const DEFAULT_SHADER = {
  colors: ['#b6a4ff', '#e2d4ff', '#b0a0ff', '#c9bfee', '#0b0913'],
  distortion: 0.44,
  swirl: 0.75,
  grainMixer: 0.13,
  grainOverlay: 0.1,
  fit: 'cover',
  rotation: -0.72,
  scale: 1.34,
  originX: 0.5,
  originY: 0.58,
  offsetX: -0.004,
  offsetY: 0.002,
  speed: 0.16
};

const TONE_CONTROLS = [
  ['linger', 't-linger', '0.25', 'how long each note rings out'],
  ['reverb', 't-reverb', '0.5', 'reverberant space'],
  ['glide', 't-glide', '0.25', 'how slowly the pitch bends'],
  ['tone', 't-tone', '0.4', 'brightness of the reed']
];

const LIGHT_CONTROLS = [
  ['wash', 'v-wash', '0.55', 'paper shader wash'],
  ['warp', 'v-warp', '0.44', 'paper shader warp'],
  ['grain', 'v-grain', '0.34', 'paper shader grain'],
  ['drift', 'v-drift', '0.42', 'paper shader drift'],
  ['zoom', 'v-zoom', '0.46', 'paper shader zoom'],
  ['spark', 'v-spark', '0.52', 'click spark intensity'],
  ['trail', 'v-trail', '0.36', 'cursor trail intensity']
];

export default function QuietRoomApp() {
  const bits = useReactBitsSettings();

  useEffect(() => initQuietRoom(), []);

  return (
    <>
      <canvas id="room"></canvas>
      <PaperShaderLayer />
      <ReactBitsEffects settings={bits.settings} />
      <div className="vignette"></div>
      <canvas id="spark-layer" aria-hidden="true"></canvas>
      <div id="veil"></div>

      <div className="stage">
        <h1 className="title">quiet room</h1>
        <p className="hint">move to look &middot; hold &amp; drag to play</p>
      </div>

      <a className="home" href="/" title="back to woodles" aria-label="back to woodles.space">
        &#8617;
      </a>

      <p className="mood-name" id="mood-name"></p>

      <RangePanel
        id="tones"
        className="tones"
        titleClassName="tones-title"
        title="the voice"
        ariaLabel="tone controls"
        rows={TONE_CONTROLS}
        rowClassName="tone-row"
      />

      <LightPanel bits={bits} />
      <ControlDock />
      <Fallback />
    </>
  );
}

function PaperShaderLayer() {
  const [shader, setShader] = useState(
    () => window.__quietRoomPaperShader || DEFAULT_SHADER
  );

  useEffect(() => {
    const handleShaderUpdate = (event) => {
      setShader((current) => ({ ...current, ...event.detail }));
    };

    window.addEventListener(PAPER_SHADER_EVENT, handleShaderUpdate);
    return () => window.removeEventListener(PAPER_SHADER_EVENT, handleShaderUpdate);
  }, []);

  return (
    <div id="paper-shader" aria-hidden="true" data-paper-shader>
      <MeshGradient
        {...shader}
        width="100%"
        height="100%"
        minPixelRatio={1}
        maxPixelCount={1920 * 1080}
        webGlContextAttributes={PAPER_WEBGL_OPTIONS}
      />
    </div>
  );
}

function LightPanel({ bits }) {
  return (
    <div className="light-panel" id="light-panel" role="group" aria-label="light controls" aria-hidden="true">
      <p className="light-title">the light</p>
      <div className="mood-strip" id="mood-strip" role="group" aria-label="moods"></div>
      {LIGHT_CONTROLS.map(([label, id, value, ariaLabel]) => (
        <RangeRow
          key={id}
          label={label}
          id={id}
          value={value}
          ariaLabel={ariaLabel}
          className="light-row"
        />
      ))}
      <div className="play-actions">
        <ActionButton id="v-pulse" title="pulse" ariaLabel="pulse the light">
          <circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none" />
          <path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2" />
          <path d="M6 6l1.6 1.6M16.4 16.4L18 18M18 6l-1.6 1.6M7.6 16.4L6 18" />
        </ActionButton>
        <ActionButton id="v-shuffle" title="shuffle" ariaLabel="shuffle the room">
          <path d="M4 7h3.2c2.9 0 4.2 10 7.2 10H20" />
          <path d="M4 17h3.2c1.1 0 2-1.4 2.8-3" />
          <path d="M16.8 4.5 20 7l-3.2 2.5M16.8 14.5 20 17l-3.2 2.5" />
        </ActionButton>
        <ActionButton id="v-reset" title="reset" ariaLabel="reset the light">
          <path d="M5.6 8.2A7.2 7.2 0 1 1 5 15.2" />
          <path d="M5.6 4.8v3.4H9" />
        </ActionButton>
      </div>
      <BitsOptions {...bits} />
    </div>
  );
}

function RangePanel({ id, className, titleClassName, title, ariaLabel, rows, rowClassName }) {
  return (
    <div className={className} id={id} role="group" aria-label={ariaLabel} aria-hidden="true">
      <p className={titleClassName}>{title}</p>
      {rows.map(([label, inputId, value, inputAriaLabel]) => (
        <RangeRow
          key={inputId}
          label={label}
          id={inputId}
          value={value}
          ariaLabel={inputAriaLabel}
          className={rowClassName}
        />
      ))}
    </div>
  );
}

function RangeRow({ label, id, value, ariaLabel, className }) {
  return (
    <label className={className}>
      <span>{label}</span>
      <input
        type="range"
        id={id}
        min="0"
        max="1"
        step="0.01"
        defaultValue={value}
        aria-label={ariaLabel}
      />
    </label>
  );
}

function ActionButton({ id, title, ariaLabel, children }) {
  return (
    <button className="play-action" id={id} type="button" title={title} aria-label={ariaLabel}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {children}
      </svg>
    </button>
  );
}

function ControlDock() {
  return (
    <nav className="dock" id="dock" aria-label="quiet room controls">
      <button className="ctl" id="sound" type="button" aria-pressed="false" title="sound on / off" aria-label="toggle sound">
        <svg id="sound-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z" fill="currentColor" stroke="none" />
          <path className="wave" d="M15.5 9.2a4 4 0 0 1 0 5.6" />
          <path className="wave" d="M18 6.8a7.4 7.4 0 0 1 0 10.4" />
        </svg>
      </button>
      <button className="ctl" id="tune" type="button" aria-pressed="false" title="tone" aria-label="tone controls">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
          <path d="M6 4v6M6 14v6M12 4v3M12 11v9M18 4v9M18 17v3" />
          <circle cx="6" cy="12" r="1.7" fill="currentColor" stroke="none" />
          <circle cx="12" cy="9" r="1.7" fill="currentColor" stroke="none" />
          <circle cx="18" cy="15" r="1.7" fill="currentColor" stroke="none" />
        </svg>
      </button>
      <button className="ctl" id="light" type="button" aria-pressed="false" title="light" aria-label="light controls">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none" />
          <path d="M12 3.8v2.3M12 17.9v2.3M3.8 12h2.3M17.9 12h2.3" />
          <path d="M6.2 6.2l1.6 1.6M16.2 16.2l1.6 1.6M17.8 6.2l-1.6 1.6M7.8 16.2l-1.6 1.6" />
        </svg>
      </button>
      <span className="dock-sep"></span>
      <button className="ctl" id="mood" type="button" title="shift the light" aria-label="next mood">
        <span className="mood-dot" id="mood-dot"></span>
      </button>
      <button className="ctl" id="still" type="button" aria-pressed="false" title="hold still" aria-label="toggle motion">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="7.5" />
          <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
        </svg>
      </button>
      <span className="dock-sep"></span>
      <button className="ctl" id="fs" type="button" title="full screen" aria-label="toggle full screen">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9" />
          <path d="M20 9V5.5A1.5 1.5 0 0 0 18.5 4H15" />
          <path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20H9" />
          <path d="M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15" />
        </svg>
      </button>
    </nav>
  );
}

function Fallback() {
  return (
    <div id="fallback">
      <div className="inner">
        <h1>quiet room</h1>
        <p id="fallback-msg">
          this room is drawn with WebGL, and your browser couldn't open a canvas.
          try a recent Chrome, Safari, or Firefox &mdash; or return to{' '}
          <a href="/">woodles.space</a>.
        </p>
      </div>
    </div>
  );
}
