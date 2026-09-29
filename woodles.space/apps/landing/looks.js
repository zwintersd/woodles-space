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
    type: ['classic', 'fell', 'modern'],
    shape: ['soft', 'crisp'],
    material: ['glass', 'paper', 'flat'],
    motion: ['float', 'snappy', 'still'],
    ground: ['aura', 'still', 'confetti', 'ruled', 'sprinkles', 'bloom', 'plain'],
    weather: ['sparkles', 'none']
  };
  var BASE = { type: 'classic', shape: 'soft', material: 'glass', motion: 'float', ground: 'aura', weather: 'sparkles' };
  /* only what differs from BASE. the rest of THEMES.md's table lands as
     its values do; until then a theme looks the way it always has. */
  var LOOKS = {
    blossom:    { ground: 'bloom' },
    sugar:      { ground: 'sprinkles' },
    typewriter: { type: 'fell', shape: 'crisp', material: 'paper', motion: 'snappy', ground: 'ruled', weather: 'none' },
    signal:     { type: 'modern', shape: 'crisp', material: 'flat', motion: 'snappy', ground: 'plain', weather: 'none' }
  };
  /* classic's faces come with the page; the others load when first used */
  var FONTS = {
    fell: 'family=IM+Fell+DW+Pica:ital@0;1',
    modern: 'family=Plus+Jakarta+Sans:wght@300;400;500&family=Space+Grotesk:wght@300;400;500'
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
    if (out.material === 'glass' && (mq('(prefers-reduced-transparency: reduce)') || mq('(prefers-contrast: more)')))
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
    return look;
  }

  migrate();
  apply();
  window.woodlesLooks = {
    THEMES: THEMES, AXES: AXES, VALUES: VALUES,
    lookOf: lookOf, resolve: resolve, read: read, write: write, apply: apply
  };
})();
