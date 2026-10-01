/* woodles.space · landing looks — see THEMES.md
   a theme is a preset over six axes. the palette is the theme itself
   (data-theme, from shared/palette.css); the other five are attributes on
   <html> that select the landing's own --desk-* token blocks.

   a classic script, loaded blocking in <head>, because it has to set every
   attribute before first paint; it leaves its api on window.woodlesLooks for
   the page's module.

   storage: woodles-theme holds the palette id (apps/animations shares it).
   woodles-look holds { over, held }: `over` is what someone set by hand,
   `held` is the form the ❄ button kept when it stepped the colors on.
   resolving goes base → the theme's look → held → over. */
(function () {
  var THEMES = ['cream','dawn','dusk','terracotta','midnight','forest','paper','inkwell','typewriter','blossom','sugar','fog','glacier','signal','amber'];
  var AXES = ['type', 'shape', 'material', 'motion', 'ground', 'weather'];
  var VALUES = {
    type: ['classic', 'optical', 'modern', 'fell', 'gothic', 'glaze', 'pixel'],
    shape: ['soft', 'round', 'crisp', 'square'],
    material: ['glass', 'paper', 'flat', 'glow'],
    motion: ['float', 'snappy', 'bouncy', 'still'],
    ground: ['aura', 'still', 'confetti', 'ruled', 'sprinkles', 'bloom', 'scanlines', 'plain'],
    weather: ['sparkles', 'stars', 'petals', 'snow', 'embers', 'none']
  };
  var BASE = { type: 'classic', shape: 'soft', material: 'glass', motion: 'float', ground: 'aura', weather: 'sparkles' };
  /* Each palette has a complete landing look. Keep this map local to the
     homepage; woodles-theme remains the shared palette id. */
  var LOOKS = {
    cream:      { type: 'classic', shape: 'soft', material: 'glass', motion: 'float',  ground: 'aura',      weather: 'sparkles' },
    dawn:       { type: 'optical', shape: 'soft', material: 'glass', motion: 'float',  ground: 'aura',      weather: 'sparkles' },
    dusk:       { type: 'classic', shape: 'soft', material: 'glass', motion: 'float',  ground: 'aura',      weather: 'stars' },
    terracotta: { type: 'gothic',  shape: 'round', material: 'paper', motion: 'float',  ground: 'aura',      weather: 'none' },
    midnight:   { type: 'modern',  shape: 'soft', material: 'glow',  motion: 'float',  ground: 'aura',      weather: 'stars' },
    forest:     { type: 'optical', shape: 'soft', material: 'paper', motion: 'float',  ground: 'aura',      weather: 'none' },
    paper:      { type: 'classic', shape: 'crisp', material: 'flat',  motion: 'snappy', ground: 'plain',     weather: 'none' },
    inkwell:    { type: 'fell',    shape: 'crisp', material: 'paper', motion: 'float',  ground: 'ruled',     weather: 'stars' },
    typewriter: { type: 'fell',    shape: 'crisp', material: 'paper', motion: 'snappy', ground: 'ruled',     weather: 'none' },
    blossom:    { type: 'glaze',   shape: 'round',material: 'glass', motion: 'float',  ground: 'bloom',     weather: 'petals' },
    sugar:      { type: 'modern',  shape: 'round',material: 'glass', motion: 'bouncy', ground: 'sprinkles', weather: 'sparkles' },
    fog:        { type: 'modern',  shape: 'soft', material: 'glass', motion: 'still',  ground: 'still',     weather: 'none' },
    glacier:    { type: 'modern',  shape: 'crisp',material: 'glass', motion: 'float',  ground: 'aura',      weather: 'snow' },
    signal:     { type: 'modern',  shape: 'crisp',material: 'flat',  motion: 'snappy', ground: 'plain',     weather: 'none' },
    amber:      { type: 'pixel',   shape: 'crisp',material: 'glow',  motion: 'snappy', ground: 'scanlines', weather: 'embers' }
  };
  /* classic and Field Notes' faces come with the page; other look families
     load when first used. */
  var FONTS = {
    optical: 'family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,600;1,9..144,300;1,9..144,400',
    modern: 'family=Plus+Jakarta+Sans:wght@300;400;500&family=Space+Grotesk:wght@300;400;500',
    gothic: 'family=Special+Gothic+Condensed+One',
    glaze: 'family=Kalnia+Glaze:wght@100;200;300;400;500;600;700',
    pixel: 'family=Coral+Pixels'
  };
  var KEY = 'woodles-look';

  function clean(obj) {
    var out = {};
    if (!obj || typeof obj !== 'object') return out;
    AXES.forEach(function (a) { if (VALUES[a].indexOf(obj[a]) >= 0) out[a] = obj[a]; });
    return out;
  }
  function read() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY)) || {};
      return { over: clean(s.over), held: clean(s.held) };
    } catch (e) { return { over: {}, held: {} }; }
  }
  function write(state) {
    try { localStorage.setItem(KEY, JSON.stringify({ over: state.over, held: state.held })); } catch (e) {}
  }
  /* the prefs that were really this: a wallpaper other than the default is
     a ground someone chose; sparkles off is no weather. moved once. */
  function migrate() {
    try {
      var raw = localStorage.getItem('woodles-desk');
      if (!raw) return;
      var desk = JSON.parse(raw);
      if (!desk || !('wallpaper' in desk || 'sparkles' in desk)) return;
      var state = read();
      if (desk.wallpaper && desk.wallpaper !== 'aura' && VALUES.ground.indexOf(desk.wallpaper) >= 0 && !state.over.ground)
        state.over.ground = desk.wallpaper;
      if (desk.sparkles === false && !state.over.weather) state.over.weather = 'none';
      delete desk.wallpaper; delete desk.sparkles;
      write(state);
      localStorage.setItem('woodles-desk', JSON.stringify(desk));
    } catch (e) {}
  }
  function mq(q) { try { return matchMedia(q).matches; } catch (e) { return false; } }
  function lookOf(theme) {
    var out = {};
    AXES.forEach(function (a) { out[a] = BASE[a]; });
    var own = LOOKS[theme] || {};
    for (var k in own) out[k] = own[k];
    return out;
  }
  function resolve(theme, state) {
    var out = lookOf(theme);
    state = state || read();
    for (var h in state.held) out[h] = state.held[h];
    for (var o in state.over) out[o] = state.over[o];
    /* the system's word beats anyone's choice */
    if (mq('(prefers-reduced-motion: reduce)')) { out.motion = 'still'; out.weather = 'none'; }
    if (mq('(prefers-contrast: more)') ||
        ((out.material === 'glass' || out.material === 'glow') && mq('(prefers-reduced-transparency: reduce)')))
      out.material = 'flat';
    return out;
  }
  var loaded = {};
  function loadFonts(type) {
    if (!FONTS[type] || loaded[type]) return;
    loaded[type] = true;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?' + FONTS[type] + '&display=swap';
    document.head.appendChild(link);
  }
  function currentTheme() {
    var t = null;
    try { t = localStorage.getItem('woodles-theme'); } catch (e) {}
    if (THEMES.indexOf(t) < 0) t = mq('(prefers-color-scheme: dark)') ? 'dusk' : 'cream';
    return t;
  }
  /* sets data-theme and every axis; returns the resolved look */
  function apply(theme) {
    var root = document.documentElement;
    theme = theme || currentTheme();
    var look = resolve(theme);
    root.setAttribute('data-theme', theme);
    AXES.forEach(function (a) { root.setAttribute('data-' + a, look[a]); });
    loadFonts(look.type);
    if (typeof window.woodlesRenderWeather === 'function') window.woodlesRenderWeather(look.weather);
    return look;
  }

  migrate();
  apply();
  window.woodlesLooks = {
    THEMES: THEMES, AXES: AXES, VALUES: VALUES,
    lookOf: lookOf, resolve: resolve, read: read, write: write, apply: apply
  };
})();
