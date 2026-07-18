/* Ologypedia — shared cover-layer rendering.
   One small module, loaded by both index.html (to render draft-card covers
   read from localStorage) and add-page.html (the static preview, the Cover
   Studio's interactive stage, and the exported <a class="card63"> markup) —
   so the shape CSS is defined exactly once. Plain script, no build step. */
window.OlogypediaCover = (function () {
  var STAR_CLIP =
    'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)';

  var SHAPES = ['circle', 'ring', 'diamond', 'star', 'blob', 'rays'];

  var SWATCHES = [
    { id: 'rose-deep', hex: '#8C3B4A' },
    { id: 'rose-dust', hex: '#C77C8E' },
    { id: 'blush', hex: '#F7DFE3' },
    { id: 'lavender', hex: '#EAE0F2' },
    { id: 'gold', hex: '#C9A66B' },
    { id: 'sage', hex: '#8FA37E' },
    { id: 'ink', hex: '#3D2B2B' },
    { id: 'paper-edge', hex: '#F3E6D9' }
  ];

  function shapeInnerStyle(layer) {
    var color = layer.color || '#8C3B4A';
    switch (layer.kind) {
      case 'ring':
        return (
          'width:100%;height:100%;border-radius:50%;background:transparent;' +
          'box-sizing:border-box;border:' + (layer.thickness || 10) + 'px solid ' + color + ';'
        );
      case 'diamond':
        return 'width:100%;height:100%;background:' + color + ';';
      case 'star':
        return 'width:100%;height:100%;background:' + color + ';clip-path:' + STAR_CLIP + ';';
      case 'blob':
        return (
          'width:100%;height:100%;background:' + color +
          ';border-radius:58% 42% 63% 37% / 41% 58% 42% 59%;filter:blur(1px);'
        );
      case 'rays':
        return (
          'width:100%;height:100%;border-radius:50%;background:repeating-conic-gradient(from 0deg, ' +
          color + ' 0deg 8deg, transparent 8deg 30deg);'
        );
      default: // circle
        return 'width:100%;height:100%;border-radius:50%;background:' + color + ';';
    }
  }

  function outerStyle(layer, extra) {
    var rot = (layer.rotation || 0) + (layer.kind === 'diamond' ? 45 : 0);
    return (
      'position:absolute;left:' + (layer.x * 100) + '%;top:' + (layer.y * 100) + '%;' +
      'width:' + layer.size + '%;aspect-ratio:1/1;' +
      'transform:translate(-50%,-50%) rotate(' + rot + 'deg);' +
      'opacity:' + layer.opacity + ';mix-blend-mode:' + (layer.blend || 'normal') + ';' +
      (extra || '')
    );
  }

  // Static, non-interactive markup — used for the preview, the exported
  // <a class="card63"> HTML, and drafts rendered on the front-door deck.
  function layersHTML(layers) {
    if (!layers || !layers.length) return '';
    var visible = layers.filter(function (l) { return !l.hidden; });
    if (!visible.length) return '';
    var out = '<div class="c-layers">';
    visible.forEach(function (l) {
      out += '<div class="c-layer" style="' + outerStyle(l, 'pointer-events:none;') + '">';
      out += '<div class="c-layer-shape" style="' + shapeInnerStyle(l) + '"></div>';
      out += '</div>';
    });
    out += '</div>';
    return out;
  }

  function newLayer(kind) {
    return {
      id: 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      kind: kind,
      color: '#8C3B4A',
      x: 0.5, y: 0.4,
      size: 46,
      rotation: 0,
      opacity: 0.55,
      blend: 'normal',
      thickness: 10,
      hidden: false
    };
  }

  return {
    SHAPES: SHAPES,
    SWATCHES: SWATCHES,
    shapeInnerStyle: shapeInnerStyle,
    outerStyle: outerStyle,
    layersHTML: layersHTML,
    newLayer: newLayer
  };
})();
