import { useCallback, useEffect, useRef, useState } from 'react';

const BITS_KEY = 'quiet-room.react-bits.v1';
const DEFAULT_BITS = Object.freeze({
  sparks: true,
  pixels: false,
  magnet: true,
  stars: true,
  glare: true,
  energy: 0.58
});

const BODY_CLASSES = {
  sparks: 'bits-sparks-on',
  pixels: 'bits-pixels-on',
  magnet: 'bits-magnet-on',
  stars: 'bits-stars-on',
  glare: 'bits-glare-on'
};

const BIT_TOGGLES = [
  ['sparks', 'flare', 'click flares'],
  ['pixels', 'trail', 'pixel trail'],
  ['magnet', 'pull', 'magnetic controls'],
  ['stars', 'star', 'star borders'],
  ['glare', 'glare', 'pointer glow']
];

export function useReactBitsSettings() {
  const [settings, setSettings] = useState(readSettings);

  useEffect(() => {
    try {
      localStorage.setItem(BITS_KEY, JSON.stringify(settings));
    } catch (_) {}
  }, [settings]);

  const toggle = useCallback((key) => {
    setSettings((current) => ({ ...current, [key]: !current[key] }));
  }, []);

  const setEnergy = useCallback((value) => {
    const energy = Math.max(0, Math.min(1, Number(value)));
    setSettings((current) => ({
      ...current,
      energy: Number.isFinite(energy) ? energy : DEFAULT_BITS.energy
    }));
  }, []);

  const reset = useCallback(() => setSettings(DEFAULT_BITS), []);

  return { settings, toggle, setEnergy, reset };
}

export function BitsOptions({ settings, toggle, setEnergy, reset }) {
  return (
    <div className="bits-options">
      <div className="bits-options-head">
        <p>bits</p>
        <button type="button" className="bits-reset" onClick={reset}>
          rest
        </button>
      </div>
      <div className="bits-toggle-grid">
        {BIT_TOGGLES.map(([key, label, ariaLabel]) => (
          <button
            key={key}
            type="button"
            className="bits-toggle"
            aria-label={ariaLabel}
            aria-pressed={String(Boolean(settings[key]))}
            onClick={() => toggle(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <label className="bits-energy">
        <span>bloom</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={settings.energy}
          aria-label="bits bloom"
          onInput={(event) => setEnergy(event.currentTarget.value)}
          onChange={(event) => setEnergy(event.target.value)}
        />
      </label>
    </div>
  );
}

export function ReactBitsEffects({ settings }) {
  useBodyBitClasses(settings);

  return (
    <>
      <GlareLayer enabled={settings.glare} energy={settings.energy} />
      <ClickSparkLayer enabled={settings.sparks} energy={settings.energy} />
      <PixelTrailLayer enabled={settings.pixels} energy={settings.energy} />
      <MagneticControls enabled={settings.magnet} energy={settings.energy} />
    </>
  );
}

function readSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(BITS_KEY) || '{}') || {};
    return {
      sparks: readBoolean(saved.sparks, DEFAULT_BITS.sparks),
      pixels: readBoolean(saved.pixels, DEFAULT_BITS.pixels),
      magnet: readBoolean(saved.magnet, DEFAULT_BITS.magnet),
      stars: readBoolean(saved.stars, DEFAULT_BITS.stars),
      glare: readBoolean(saved.glare, DEFAULT_BITS.glare),
      energy: readNumber(saved.energy, DEFAULT_BITS.energy)
    };
  } catch (_) {
    return DEFAULT_BITS;
  }
}

function readBoolean(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

function readNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return reduced;
}

function useBodyBitClasses(settings) {
  useEffect(() => {
    document.body.style.setProperty('--bits-energy', settings.energy.toFixed(2));
    document.body.style.setProperty('--bits-star-opacity', (0.34 + settings.energy * 0.42).toFixed(2));
    document.body.style.setProperty('--bits-pixel-opacity', (0.34 + settings.energy * 0.42).toFixed(2));
    document.body.style.setProperty('--bits-dock-glow', `${22 + settings.energy * 28}px`);

    Object.entries(BODY_CLASSES).forEach(([key, className]) => {
      document.body.classList.toggle(className, Boolean(settings[key]));
    });

    return () => {
      Object.values(BODY_CLASSES).forEach((className) => document.body.classList.remove(className));
      document.body.style.removeProperty('--bits-energy');
      document.body.style.removeProperty('--bits-star-opacity');
      document.body.style.removeProperty('--bits-pixel-opacity');
      document.body.style.removeProperty('--bits-dock-glow');
    };
  }, [settings]);
}

function GlareLayer({ enabled, energy }) {
  const ref = useRef(null);

  useEffect(() => {
    const layer = ref.current;
    if (!enabled || !layer) return undefined;

    const update = (x, y) => {
      layer.style.setProperty('--bits-x', `${x}px`);
      layer.style.setProperty('--bits-y', `${y}px`);
    };
    const handlePointerMove = (event) => update(event.clientX, event.clientY);

    update(window.innerWidth * 0.5, window.innerHeight * 0.42);
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, [enabled]);

  if (!enabled) return null;
  return (
    <div
      ref={ref}
      className="bits-glare"
      style={{ '--bits-glare-opacity': (0.16 + energy * 0.34).toFixed(2) }}
      aria-hidden="true"
    ></div>
  );
}

function ClickSparkLayer({ enabled, energy }) {
  const canvasRef = useRef(null);
  const sparksRef = useRef([]);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!enabled || reduced || !canvas) return undefined;

    const ctx = canvas.getContext('2d');
    let frame = 0;
    let dpr = 1;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const addSpark = (event) => {
      const count = 7 + Math.round(energy * 8);
      const radius = 18 + energy * 34;
      const now = performance.now();
      const hueStart = 230 + Math.round(energy * 70);
      for (let i = 0; i < count; i += 1) {
        sparksRef.current.push({
          x: event.clientX,
          y: event.clientY,
          angle: (Math.PI * 2 * i) / count,
          born: now,
          radius,
          hue: hueStart + i * 8
        });
      }
    };

    const draw = (time) => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      sparksRef.current = sparksRef.current.filter((spark) => {
        const age = (time - spark.born) / (460 + energy * 260);
        if (age >= 1) return false;

        const ease = 1 - Math.pow(1 - age, 2);
        const distance = spark.radius * ease;
        const length = (10 + energy * 16) * (1 - age);
        const x1 = spark.x + Math.cos(spark.angle) * distance;
        const y1 = spark.y + Math.sin(spark.angle) * distance;
        const x2 = spark.x + Math.cos(spark.angle) * (distance + length);
        const y2 = spark.y + Math.sin(spark.angle) * (distance + length);

        ctx.globalAlpha = (1 - age) * (0.55 + energy * 0.35);
        ctx.strokeStyle = `hsl(${spark.hue} 92% 84%)`;
        ctx.lineWidth = 1.2 + energy * 1.4;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        return true;
      });
      ctx.globalAlpha = 1;
      frame = requestAnimationFrame(draw);
    };

    resize();
    frame = requestAnimationFrame(draw);
    window.addEventListener('resize', resize);
    window.addEventListener('pointerdown', addSpark, { passive: true });

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointerdown', addSpark);
      sparksRef.current = [];
    };
  }, [enabled, energy, reduced]);

  if (!enabled || reduced) return null;
  return <canvas ref={canvasRef} className="bits-spark-canvas" aria-hidden="true"></canvas>;
}

function PixelTrailLayer({ enabled, energy }) {
  const canvasRef = useRef(null);
  const trailRef = useRef([]);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!enabled || reduced || !canvas) return undefined;

    const ctx = canvas.getContext('2d');
    let frame = 0;
    let dpr = 1;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const addPoint = (event) => {
      const now = performance.now();
      const amount = 1 + Math.round(energy * 3);
      for (let i = 0; i < amount; i += 1) {
        trailRef.current.push({
          x: event.clientX + (Math.random() - 0.5) * 10,
          y: event.clientY + (Math.random() - 0.5) * 10,
          born: now,
          size: 3 + Math.random() * (4 + energy * 7),
          hue: 210 + Math.random() * 90
        });
      }
      trailRef.current = trailRef.current.slice(-160);
    };

    const draw = (time) => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      trailRef.current = trailRef.current.filter((point) => {
        const age = (time - point.born) / (680 + energy * 720);
        if (age >= 1) return false;

        const lift = age * (10 + energy * 22);
        const size = point.size * (1 - age * 0.55);
        ctx.globalAlpha = (1 - age) * (0.18 + energy * 0.42);
        ctx.fillStyle = `hsl(${point.hue} 82% 78%)`;
        ctx.fillRect(point.x - size / 2, point.y - lift - size / 2, size, size);
        return true;
      });
      ctx.globalAlpha = 1;
      frame = requestAnimationFrame(draw);
    };

    resize();
    frame = requestAnimationFrame(draw);
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', addPoint, { passive: true });

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', addPoint);
      trailRef.current = [];
    };
  }, [enabled, energy, reduced]);

  if (!enabled || reduced) return null;
  return <canvas ref={canvasRef} className="bits-pixel-canvas" aria-hidden="true"></canvas>;
}

function MagneticControls({ enabled, energy }) {
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (!enabled || reduced) return undefined;

    let frame = 0;
    let pointer = null;
    const selector = '.ctl, .play-action, .bits-toggle, .bits-reset';

    const clear = () => {
      document.querySelectorAll(selector).forEach((target) => {
        target.style.removeProperty('--magnet-x');
        target.style.removeProperty('--magnet-y');
      });
    };

    const apply = () => {
      frame = 0;
      if (!pointer) return;
      const reach = 84 + energy * 82;
      const pull = 7 + energy * 13;
      document.querySelectorAll(selector).forEach((target) => {
        const rect = target.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = pointer.x - cx;
        const dy = pointer.y - cy;
        const distance = Math.hypot(dx, dy);
        if (distance > reach) {
          target.style.setProperty('--magnet-x', '0px');
          target.style.setProperty('--magnet-y', '0px');
          return;
        }
        const force = Math.pow(1 - distance / reach, 1.7);
        target.style.setProperty('--magnet-x', `${dx * force * pull * 0.018}px`);
        target.style.setProperty('--magnet-y', `${dy * force * pull * 0.018}px`);
      });
    };

    const move = (event) => {
      pointer = { x: event.clientX, y: event.clientY };
      if (!frame) frame = requestAnimationFrame(apply);
    };

    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerleave', clear);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerleave', clear);
      clear();
    };
  }, [enabled, energy, reduced]);

  return null;
}
