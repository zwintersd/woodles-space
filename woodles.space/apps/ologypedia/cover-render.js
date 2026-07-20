/* Ologypedia — shared cover-layer rendering.
   One small module, loaded by both index.html (to render draft-card covers
   read from localStorage) and add-page.html (the static preview, the Cover
   Studio's interactive stage, and the exported <a class="card63"> markup) —
   so the shape CSS is defined exactly once. Plain script, no build step. */
window.OlogypediaCover = (function () {
  var STAR_CLIP =
    'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)';

  var SHAPES = ['circle', 'ring', 'diamond', 'star', 'blob', 'rays'];

  // Uploaded art is capped to this longest edge and re-encoded before it lands
  // as a layer — covers are small, so a 520px cap keeps the data URL light
  // enough to sit in localStorage (and inline in the exported card markup)
  // while staying crisp on the card face and in the studio stage.
  var IMAGE_MAX_DIM = 520;

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
    // Vector shapes are square (aspect-ratio 1/1); an uploaded image keeps its
    // own proportions — width drives the size, height follows from the picture.
    var box = layer.kind === 'image'
      ? 'width:' + layer.size + '%;height:auto;'
      : 'width:' + layer.size + '%;aspect-ratio:1/1;';
    return (
      'position:absolute;left:' + (layer.x * 100) + '%;top:' + (layer.y * 100) + '%;' +
      box +
      'transform:translate(-50%,-50%) rotate(' + rot + 'deg);' +
      'opacity:' + layer.opacity + ';mix-blend-mode:' + (layer.blend || 'normal') + ';' +
      (extra || '')
    );
  }

  // The inner element for an image layer: an <img> filling the wrapper, kept at
  // its natural aspect ratio, with nearest-neighbour scaling for pixel art.
  function imageInnerHTML(layer) {
    var render = layer.smooth === false ? 'pixelated' : 'auto';
    var src = String(layer.src || '').replace(/"/g, '&quot;');
    return (
      '<img class="c-layer-shape c-layer-img" src="' + src + '" alt="" draggable="false" ' +
      'style="display:block;width:100%;height:auto;image-rendering:' + render + ';">'
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
      out += l.kind === 'image'
        ? imageInnerHTML(l)
        : '<div class="c-layer-shape" style="' + shapeInnerStyle(l) + '"></div>';
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

  function newImageLayer(src, naturalW, naturalH, opts) {
    opts = opts || {};
    // Land the picture at a comfortable size, biased so a wide image doesn't
    // overflow the card. ~62% of the card width is a sensible first placement.
    var ratio = (naturalW && naturalH) ? naturalW / naturalH : 1;
    var size = ratio >= 1 ? 62 : Math.max(30, Math.round(62 * ratio));
    return {
      id: 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      kind: 'image',
      src: src,
      naturalW: naturalW || 0,
      naturalH: naturalH || 0,
      name: opts.name || 'Image',
      x: 0.5, y: 0.45,
      size: size,
      rotation: 0,
      opacity: 1,
      blend: 'normal',
      smooth: opts.smooth !== false,
      hidden: false
    };
  }

  // Read a File → a capped, re-encoded data URL plus its natural dimensions,
  // so uploaded cover art stays small enough to persist. Mirrors the bestiary
  // sprite intake: SVGs pass through untouched, small raster art is treated as
  // pixel art (nearest-neighbour), everything else is drawn onto a capped
  // canvas and exported as webp (png fallback). Returns a Promise.
  function processImageFile(file) {
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(file.type || '')) {
        reject(new Error('That file is not an image.'));
        return;
      }
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('Could not read that file.')); };
      reader.onload = function () {
        var sourceUrl = reader.result;
        if (file.type === 'image/svg+xml') {
          resolve({ src: sourceUrl, naturalW: 0, naturalH: 0, pixelated: false });
          return;
        }
        var img = new Image();
        img.onerror = function () { reject(new Error('Could not read that image.')); };
        img.onload = function () {
          var w = img.naturalWidth, h = img.naturalHeight;
          if (!w || !h) { reject(new Error('That image has no dimensions.')); return; }
          var pixelated = Math.max(w, h) <= 128;
          var scale = Math.min(1, IMAGE_MAX_DIM / Math.max(w, h));
          if (scale === 1 && pixelated) {
            resolve({ src: sourceUrl, naturalW: w, naturalH: h, pixelated: true });
            return;
          }
          var cw = Math.max(1, Math.round(w * scale));
          var ch = Math.max(1, Math.round(h * scale));
          var canvas = document.createElement('canvas');
          canvas.width = cw; canvas.height = ch;
          var ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('Canvas is unavailable.')); return; }
          ctx.imageSmoothingEnabled = !pixelated;
          ctx.drawImage(img, 0, 0, cw, ch);
          var out = canvas.toDataURL('image/webp', 0.85);
          if (out.indexOf('data:image/webp') !== 0) out = canvas.toDataURL('image/png');
          resolve({ src: out, naturalW: w, naturalH: h, pixelated: pixelated });
        };
        img.src = sourceUrl;
      };
      reader.readAsDataURL(file);
    });
  }

  return {
    SHAPES: SHAPES,
    SWATCHES: SWATCHES,
    IMAGE_MAX_DIM: IMAGE_MAX_DIM,
    shapeInnerStyle: shapeInnerStyle,
    outerStyle: outerStyle,
    imageInnerHTML: imageInnerHTML,
    layersHTML: layersHTML,
    newLayer: newLayer,
    newImageLayer: newImageLayer,
    processImageFile: processImageFile
  };
})();
