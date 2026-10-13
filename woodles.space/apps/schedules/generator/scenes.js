// Illustrated banners for some themes, drawn for a 320×170 box like the
// original ticket scene. Constant markup only: nothing here comes from a plan.
// Moving parts carry sc-* classes; scenes.css animates them when motion is on.
// apps/schedules/SCENES.md is the style reference and process for adding one.
window.ScheduleScenes = (() => {
  'use strict';
  const range = (count) => Array.from({ length: count }, (_, index) => index);
  const svg = (name, body) => '<svg class="scene-art scene-' + name + '" viewBox="0 0 320 170" aria-hidden="true" focusable="false">' + body + '</svg>';
  const sparkle = (x, y, size, fill, delay) => {
    const i = size * .28;
    return '<path class="sc-twinkle" style="animation-delay:' + delay + 's" fill="' + fill + '" d="M' + x + ' ' + (y - size) + 'L' + (x + i) + ' ' + (y - i) + 'L' + (x + size) + ' ' + y + 'L' + (x + i) + ' ' + (y + i) +
      'L' + x + ' ' + (y + size) + 'L' + (x - i) + ' ' + (y + i) + 'L' + (x - size) + ' ' + y + 'L' + (x - i) + ' ' + (y - i) + 'Z"/>';
  };

  // Ground and water strips fade out at both ends instead of stopping square.
  const faded = (name, body) => '<defs><linearGradient id="sc-fade-' + name + '-g"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".14" stop-color="#fff"/><stop offset=".86" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
    '<mask id="sc-fade-' + name + '" maskUnits="userSpaceOnUse" x="0" y="0" width="320" height="170"><rect width="320" height="170" fill="url(#sc-fade-' + name + '-g)"/></mask></defs><g mask="url(#sc-fade-' + name + ')">' + body + '</g>';

  function trainWheel(cx, cy, r) {
    return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#14284a" stroke="#e7b84a" stroke-width="3"/>' +
      '<g class="sc-spin"><path d="M' + (cx - r + 4) + ' ' + cy + 'H' + (cx + r - 4) + 'M' + cx + ' ' + (cy - r + 4) + 'V' + (cy + r - 4) + '" stroke="#e7b84a" stroke-width="2.5" stroke-linecap="round"/></g>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="3" fill="#e7b84a"/>';
  }

  const trains = svg('trains',
    // sleepers and rail
    faded('rails', '<path d="' + range(19).map((index) => 'M' + (index * 18 - 2) + ' 150h11v6h-11z').join('') + '" fill="#6b4426"/>' +
      '<path d="M0 149H320" stroke="#2b1d16" stroke-width="3.5"/>') +
    // smoke
    '<g fill="#fff">' + [[270, 46, 9, 0], [254, 30, 12, .6], [230, 18, 14, 1.2]].map(([x, y, r, delay]) => '<circle class="sc-puff" style="animation-delay:' + delay + 's" cx="' + x + '" cy="' + y + '" r="' + r + '" opacity=".9"/>').join('') + '</g>' +
    '<g class="sc-bob">' +
      // carriage
      '<rect x="26" y="68" width="118" height="11" rx="5" fill="#14284a"/>' +
      '<rect x="30" y="76" width="110" height="52" rx="8" fill="#2f7d4f" stroke="#14284a" stroke-width="3"/>' +
      [42, 72, 102].map((x) => '<rect x="' + x + '" y="86" width="22" height="18" rx="4" fill="#fff4cf" stroke="#14284a" stroke-width="2.5"/>').join('') +
      '<rect x="30" y="111" width="110" height="5" fill="#e7b84a"/>' +
      '<rect x="36" y="126" width="100" height="6" rx="3" fill="#14284a"/>' +
      '<path d="M140 127h12" stroke="#14284a" stroke-width="5" stroke-linecap="round"/>' +
      // locomotive
      '<rect x="146" y="63" width="54" height="11" rx="5" fill="#14284a"/>' +
      '<rect x="150" y="70" width="46" height="58" rx="5" fill="#f4c542" stroke="#14284a" stroke-width="3"/>' +
      '<rect x="159" y="80" width="27" height="21" rx="4" fill="#cfe8ff" stroke="#14284a" stroke-width="3"/>' +
      '<rect x="194" y="88" width="90" height="40" rx="11" fill="#1f3a68" stroke="#14284a" stroke-width="3"/>' +
      '<path d="M220 88v40M250 88v40" stroke="#e7b84a" stroke-width="4"/>' +
      '<path d="M226 88a10 10 0 0 1 20 0z" fill="#e7b84a" stroke="#14284a" stroke-width="2.5"/>' +
      '<rect x="262" y="66" width="14" height="23" fill="#14284a"/><rect x="257" y="59" width="24" height="9" rx="3" fill="#14284a"/>' +
      '<circle cx="287" cy="99" r="6" fill="#ffe58a" stroke="#14284a" stroke-width="2.5"/>' +
      '<path d="M282 120l20 22h-20z" fill="#e7b84a" stroke="#14284a" stroke-width="2.5" stroke-linejoin="round"/>' +
      '<rect x="150" y="124" width="134" height="8" rx="3" fill="#14284a"/>' +
      '<path d="M218 138H250" stroke="#e7b84a" stroke-width="3.5" stroke-linecap="round"/>' +
    '</g>' +
    trainWheel(52, 139, 9) + trainWheel(118, 139, 9) + trainWheel(172, 132, 16) + trainWheel(218, 136, 12) + trainWheel(250, 136, 12) + trainWheel(276, 140, 8));

  const dinosaurs = svg('dinosaurs',
    faded('hills', '<path d="M0 152Q70 132 150 146T320 140V170H0Z" fill="#1d4a19" opacity=".55"/>') +
    // volcano
    '<g fill="#efe7da">' + [[100, 52, 8, 0], [110, 36, 11, .8], [124, 20, 13, 1.6]].map(([x, y, r, delay]) => '<circle class="sc-puff" style="animation-delay:' + delay + 's" cx="' + x + '" cy="' + y + '" r="' + r + '" opacity=".85"/>').join('') + '</g>' +
    '<path d="M30 152L86 68h28l56 84z" fill="#6b4a3a" stroke="#3d2a20" stroke-width="3" stroke-linejoin="round"/>' +
    '<path d="M86 68h28l-6 9q-4 22-8 6-3 18-8 2-2 10-6-17z" fill="#ff7a2f" stroke="#c4421f" stroke-width="2" stroke-linejoin="round"/>' +
    // ferns
    '<g fill="none" stroke="#9bd36a" stroke-width="4" stroke-linecap="round">' +
      '<path d="M18 152q-2-22 10-34M18 152q8-18 24-22M18 152q-10-14-16-30"/><path d="M302 152q2-22-8-34M302 152q-8-16-22-20M302 152q10-12 16-26"/></g>' +
    // egg
    '<ellipse cx="160" cy="141" rx="10" ry="12" fill="#fff3d6" stroke="#3d2a20" stroke-width="2.5"/><circle cx="157" cy="137" r="2.5" fill="#7ab55c"/><circle cx="163" cy="145" r="2" fill="#7ab55c"/>' +
    // brontosaurus
    '<g class="sc-sway"><path d="M190 110C164 110 146 124 122 130C150 136 170 132 194 128Z" fill="#f2a541" stroke="#3d2a20" stroke-width="3" stroke-linejoin="round"/></g>' +
    [196, 214, 240, 258].map((x) => '<rect x="' + x + '" y="126" width="15" height="25" rx="6" fill="#e5902c" stroke="#3d2a20" stroke-width="3"/>').join('') +
    '<ellipse cx="230" cy="114" rx="46" ry="25" fill="#f2a541" stroke="#3d2a20" stroke-width="3"/>' +
    '<path d="M196 122q34 16 70 0" fill="none" stroke="#ffd58a" stroke-width="6" stroke-linecap="round"/>' +
    '<g fill="#e07b24"><circle cx="216" cy="102" r="5"/><circle cx="236" cy="96" r="4"/><circle cx="246" cy="108" r="3.5"/></g>' +
    '<g class="sc-nod"><path d="M256 102C272 88 270 58 282 44" fill="none" stroke="#3d2a20" stroke-width="22" stroke-linecap="round"/>' +
      '<path d="M256 102C272 88 270 58 282 44" fill="none" stroke="#f2a541" stroke-width="16" stroke-linecap="round"/>' +
      '<ellipse cx="290" cy="40" rx="17" ry="12" fill="#f2a541" stroke="#3d2a20" stroke-width="3"/>' +
      '<circle cx="294" cy="36" r="2.8" fill="#2b1d12"/><path d="M296 45q5 3 9-1" fill="none" stroke="#2b1d12" stroke-width="2.2" stroke-linecap="round"/>' +
      '<circle cx="286" cy="45" r="3.5" fill="#ff9f7a" opacity=".8"/></g>');

  const rainbow = ['#ff6b8b', '#ffa94d', '#ffe066', '#69db7c', '#74c0fc', '#b197fc'];
  const cloud = (x, y, stroke = '#8a5cc2', scale = 1, fill = '#fff') => {
    const n = (value) => +(value * scale).toFixed(1);
    return '<path d="M' + (x - n(26)) + ' ' + y + 'a' + n(12) + ' ' + n(12) + ' 0 0 1 ' + n(8) + ' ' + n(-20) + 'a' + n(15) + ' ' + n(15) + ' 0 0 1 ' + n(28) + ' ' + n(-4) +
      'a' + n(12) + ' ' + n(12) + ' 0 0 1 ' + n(16) + ' ' + n(12) + 'a' + n(10) + ' ' + n(10) + ' 0 0 1 0 ' + n(12) + 'z" fill="' + fill + '" stroke="' + stroke + '" stroke-width="2.5" stroke-linejoin="round"/>';
  };
  const unicorns = svg('unicorns',
    rainbow.map((color, index) => '<path d="M' + (24 + index * 11) + ' 150a' + (86 - index * 11) + ' ' + (86 - index * 11) + ' 0 0 1 ' + (172 - index * 22) + ' 0" fill="none" stroke="' + color + '" stroke-width="11"/>').join('') +
    cloud(34, 154) + cloud(196, 154) +
    sparkle(40, 30, 9, '#fff6b0', 0) + sparkle(150, 18, 7, '#fff', .7) + sparkle(304, 22, 10, '#fff6b0', 1.4) + sparkle(120, 64, 5, '#fff', 2.1) +
    '<g class="sc-nod">' +
      // mane behind the head
      [[270, 70, 13, '#ff7eb6'], [286, 86, 14, '#b57bff'], [296, 106, 14, '#6fd6d6'], [302, 128, 15, '#ff7eb6'], [306, 150, 14, '#b57bff']].map(([x, y, r, fill]) => '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + fill + '" stroke="#6b3fa0" stroke-width="2.5"/>').join('') +
      '<path d="M300 170C300 128 292 100 276 84C266 74 256 66 242 66C226 66 214 74 206 86C200 94 197 104 203 110C209 116 220 115 227 111L236 106C240 120 238 146 232 170Z" fill="#fff" stroke="#6b3fa0" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M254 72l9-26 9 30z" fill="#fff" stroke="#6b3fa0" stroke-width="3" stroke-linejoin="round"/><path d="M259 70l4-14 4 16z" fill="#ffc2dc"/>' +
      '<path d="M234 72l-10-42 24 36z" fill="#ffd36e" stroke="#6b3fa0" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M231 60l9-3M228 49l8-3M226 39l6-2" stroke="#d99a2b" stroke-width="2" stroke-linecap="round"/>' +
      '<circle cx="248" cy="70" r="10" fill="#ff7eb6" stroke="#6b3fa0" stroke-width="2.5"/>' +
      '<path d="M222 88q7 7 14 0" fill="none" stroke="#3d2350" stroke-width="3" stroke-linecap="round"/><path d="M224 92l-3 4M229 94v4M234 92l3 4" stroke="#3d2350" stroke-width="2" stroke-linecap="round"/>' +
      '<circle cx="220" cy="102" r="6" fill="#ffb3cf"/><circle cx="207" cy="101" r="2" fill="#6b3fa0"/>' +
    '</g>');

  const space = svg('space',
    [[24, 30], [70, 18], [140, 24], [300, 140], [120, 150], [16, 96], [176, 70], [306, 70]].map(([x, y], index) => '<circle class="sc-twinkle" style="animation-delay:' + index * .4 + 's" cx="' + x + '" cy="' + y + '" r="' + (index % 3 ? 1.8 : 2.6) + '" fill="#fff"/>').join('') +
    sparkle(108, 46, 7, '#ffe58a', .3) + sparkle(290, 108, 8, '#fff', 1.1) +
    '<path d="M28 30a14 14 0 1 0 14 22a11 11 0 1 1-14-22z" fill="#ffe58a"/>' +
    // ringed planet
    '<ellipse cx="74" cy="112" rx="58" ry="13" transform="rotate(-14 74 112)" fill="none" stroke="#ffd98a" stroke-width="5"/>' +
    '<circle cx="74" cy="112" r="32" fill="#f2a65a" stroke="#2a1f6b" stroke-width="3"/>' +
    '<path d="M46 100q28 8 56-4M44 118q30 8 60-4" fill="none" stroke="#e07b39" stroke-width="5" stroke-linecap="round"/>' +
    '<path d="M17.7 126A58 13 -14 0 0 130.3 98" fill="none" stroke="#ffd98a" stroke-width="5" stroke-linecap="round"/>' +
    // trail and rocket
    '<path d="M150 168q20-40 54-58" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="2 9" stroke-linecap="round" opacity=".55"/>' +
    '<g class="sc-bob"><g transform="rotate(35 220 84)">' +
      '<path class="sc-flicker" d="M206 112q14 40 28 0z" fill="#ffb43b"/><path class="sc-flicker" d="M212 112q8 24 16 0z" fill="#fff1a6"/>' +
      '<path d="M204 92l-17 27 17-7zM236 92l17 27-17-7z" fill="#ff5d73" stroke="#2a3170" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M220 30c16 16 20 48 18 82h-36c-2-34 2-66 18-82z" fill="#f4f6ff" stroke="#2a3170" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M220 30c6 6 11 14 14 24h-28c3-10 8-18 14-24z" fill="#ff5d73" stroke="#2a3170" stroke-width="3" stroke-linejoin="round"/>' +
      '<circle cx="220" cy="72" r="10" fill="#6cc3ff" stroke="#2a3170" stroke-width="4"/><path d="M215 68a6 6 0 0 1 6-3" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>' +
    '</g></g>');

  const construction = svg('construction',
    faded('dirt', '<rect x="0" y="150" width="320" height="20" fill="#6b4426"/><path d="M0 150H320" stroke="#4a2e18" stroke-width="3"/>') +
    '<path d="M86 151q36-34 74 0z" fill="#8a5a32" stroke="#4a2e18" stroke-width="3" stroke-linejoin="round"/>' +
    '<g fill="#a87447"><circle cx="104" cy="140" r="3"/><circle cx="128" cy="132" r="3.5"/><circle cx="142" cy="143" r="2.5"/></g>' +
    // cones
    [[30, 1], [60, .8]].map(([x, scale]) => '<g transform="translate(' + x + ' 151) scale(' + scale + ')"><rect x="-14" y="-5" width="28" height="5" rx="2" fill="#1c1f24"/><path d="M-9-5L-3-38h6l6 33z" fill="#ff7a1a" stroke="#1c1f24" stroke-width="2.5" stroke-linejoin="round"/><path d="M-6.5-17h13M-5-28h10" stroke="#fff" stroke-width="4"/></g>').join('') +
    // excavator
    '<g class="sc-dig">' +
      '<path d="M226 108L172 58" stroke="#1c1f24" stroke-width="17" stroke-linecap="round"/><path d="M226 108L172 58" stroke="#ff9f1a" stroke-width="11" stroke-linecap="round"/>' +
      '<path d="M172 58L144 98" stroke="#1c1f24" stroke-width="15" stroke-linecap="round"/><path d="M172 58L144 98" stroke="#ff9f1a" stroke-width="9" stroke-linecap="round"/>' +
      '<path d="M206 98l-26-22" stroke="#9aa3ad" stroke-width="5" stroke-linecap="round"/>' +
      '<circle cx="172" cy="58" r="5" fill="#1c1f24"/>' +
      '<path d="M130 92h26l-3 20-24 6q-10-12 1-26z" fill="#3b3f46" stroke="#1c1f24" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M130 118l-3 6M138 116l-2 6M146 114l-1 6" stroke="#1c1f24" stroke-width="3" stroke-linecap="round"/>' +
    '</g>' +
    '<rect x="194" y="102" width="88" height="30" rx="5" fill="#ff9f1a" stroke="#1c1f24" stroke-width="3"/>' +
    '<path d="M236 104V68h34l12 22v14z" fill="#ff9f1a" stroke="#1c1f24" stroke-width="3" stroke-linejoin="round"/>' +
    '<path d="M243 98V75h22l9 17v6z" fill="#bfe6ff" stroke="#1c1f24" stroke-width="2.5" stroke-linejoin="round"/>' +
    '<path d="M200 112h30" stroke="#1c1f24" stroke-width="3" stroke-dasharray="6 5"/>' +
    '<circle cx="230" cy="64" r="5" fill="#ffd400" stroke="#1c1f24" stroke-width="2.5"/>' +
    '<rect x="180" y="132" width="112" height="19" rx="9.5" fill="#2b2e33" stroke="#1c1f24" stroke-width="3"/>' +
    '<g class="sc-roll">' + range(6).map((index) => '<circle cx="' + (192 + index * 17.6) + '" cy="141.5" r="5.5" fill="#8b929b" stroke="#1c1f24" stroke-width="2"/>').join('') + '</g>');

  const fish = (x, y, fill, delay) => '<g class="sc-swim" style="animation-delay:' + delay + 's"><path d="M' + (x + 14) + ' ' + y + 'l12-8v16z" fill="' + fill + '" stroke="#0b3d52" stroke-width="2.5" stroke-linejoin="round"/><ellipse cx="' + x + '" cy="' + y + '" rx="16" ry="10" fill="' + fill + '" stroke="#0b3d52" stroke-width="2.5"/><circle cx="' + (x - 7) + '" cy="' + (y - 2) + '" r="2.2" fill="#0b3d52"/><path d="M' + (x + 2) + ' ' + (y - 8) + 'v16" stroke="#fff" stroke-width="3" opacity=".7"/></g>';
  const wave = (y, fill, extra) => '<path ' + extra + ' d="M-40 ' + y + range(10).map(() => 'q20-12 40 0').join('') + 'V170H-40Z" fill="' + fill + '"/>';
  const ocean = svg('ocean',
    range(5).map((index) => '<circle class="sc-rise" style="animation-delay:' + index * .7 + 's" cx="' + [40, 120, 300, 150, 72][index] + '" cy="' + [110, 60, 70, 30, 40][index] + '" r="' + [5, 4, 6, 3, 4][index] + '" fill="none" stroke="#e6fbff" stroke-width="2.5"/>').join('') +
    fish(60, 72, '#ff9f43', 0) + fish(108, 112, '#ffd43b', 1.2) +
    faded('back-wave', wave(136, '#0a5f80', 'class="sc-wave-back" opacity=".55"')) +
    '<g class="sc-bob">' +
      '<g class="sc-spout" fill="none" stroke="#e6fbff" stroke-width="4" stroke-linecap="round"><path d="M200 74q-2-26-22-34M200 74q2-28 22-36M200 74V34"/></g>' +
      '<g fill="#e6fbff" class="sc-spout"><circle cx="174" cy="40" r="3"/><circle cx="226" cy="36" r="3"/><circle cx="200" cy="28" r="3"/></g>' +
      '<path d="M150 112C150 84 190 70 230 76C262 80 280 98 286 112C298 104 306 92 312 84C314 100 308 116 296 124C304 128 310 136 312 146C300 140 290 136 282 132C262 146 226 150 196 146C166 142 150 130 150 112Z" fill="#3b6fb6" stroke="#0b3d52" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M157 121C172 138 212 146 252 140C230 132 190 130 157 121Z" fill="#cfe4ff"/>' +
      '<path d="M212 126c-5 12 3 22 13 18-4-6-6-12-13-18z" fill="#2c5a99" stroke="#0b3d52" stroke-width="2.5" stroke-linejoin="round"/>' +
      '<circle cx="178" cy="102" r="3.2" fill="#0b3d52"/><path d="M160 114q8 6 18 4" fill="none" stroke="#0b3d52" stroke-width="2.5" stroke-linecap="round"/>' +
      '<circle cx="186" cy="114" r="4.5" fill="#ff9fb6" opacity=".8"/>' +
    '</g>' +
    faded('front-wave', wave(148, '#0b4f6c', 'class="sc-wave-front"')));

  const ink = (color) => ' stroke="' + color + '" stroke-width="3" stroke-linejoin="round"';
  const flag = (x, y, fill, stroke) => '<path d="M' + x + ' ' + (y + 16) + 'V' + y + '" stroke="' + stroke + '" stroke-width="2.5" stroke-linecap="round"/>' +
    '<path class="sc-flag" d="M' + (x + 1) + ' ' + y + 'h20l-5 6 5 6h-20z" fill="' + fill + '"' + ink(stroke) + '/>';

  const pirates = svg('pirates',
    '<circle cx="40" cy="34" r="15" fill="#fff3c4"/><circle cx="35" cy="30" r="3" fill="#f2dc9a"/><circle cx="45" cy="40" r="2.5" fill="#f2dc9a"/>' +
    [[86, 22], [130, 40], [160, 14], [306, 30], [100, 60]].map(([x, y], index) => '<circle class="sc-twinkle" style="animation-delay:' + index * .5 + 's" cx="' + x + '" cy="' + y + '" r="1.8" fill="#fff"/>').join('') +
    faded('pirate-back-wave', wave(134, '#3d7ea6', 'class="sc-wave-back" opacity=".5"')) +
    // treasure island
    '<path d="M2 152q56-58 116 0z" fill="#f2d38b"' + ink('#5a3a1a') + '/>' +
    '<path d="M68 126q-2-24 6-44" fill="none" stroke="#5a3a1a" stroke-width="8" stroke-linecap="round"/><path d="M68 126q-2-24 6-44" fill="none" stroke="#a0662f" stroke-width="4" stroke-linecap="round"/>' +
    '<g fill="#3fa34d"' + ink('#1f5a28') + '><path d="M74 82q-24-6-34 8q16-10 34-8z"/><path d="M74 82q-12-22-30-20q20 4 30 20z"/><path d="M74 82q10-22 30-18q-20 2-30 18z"/><path d="M74 82q26-4 34 12q-14-12-34-12z"/></g>' +
    '<g transform="translate(26 116)"><rect width="24" height="16" rx="2" fill="#a0522d"' + ink('#5a3a1a') + '/><path d="M0 6h24" stroke="#ffd43b" stroke-width="3"/><path d="M-1 1q13-11 26 0z" fill="#8b4513"' + ink('#5a3a1a') + '/><rect x="9" y="4" width="6" height="7" rx="1" fill="#ffd43b"' + ink('#5a3a1a') + '/></g>' +
    '<g fill="#ffd43b"' + ink('#8a5a00') + '><circle cx="56" cy="130" r="4"/><circle cx="63" cy="133" r="3.5"/></g>' +
    // ship
    '<g class="sc-rock">' +
      '<path d="M296 104l18-14" stroke="#5a3a1a" stroke-width="4" stroke-linecap="round"/>' +
      '<rect x="218" y="30" width="6" height="84" rx="2" fill="#5a3a1a"/>' +
      flag(222, 18, '#1c1c1c', '#1c1c1c') + '<circle cx="233" cy="24" r="2.6" fill="#fff"/>' +
      '<path d="M226 46l68 56h-62z" fill="#f4ead2"' + ink('#3a2410') + '/>' +
      '<path class="sc-billow" d="M184 40h70q12 26 0 54h-70q10-27 0-54z" fill="#fff8e6"' + ink('#3a2410') + '/>' +
      '<g fill="#3a2410"><circle cx="219" cy="62" r="9"/><rect x="213" y="68" width="12" height="7" rx="2"/></g><g fill="#fff8e6"><circle cx="215.5" cy="61" r="2.6"/><circle cx="222.5" cy="61" r="2.6"/></g>' +
      '<path d="M206 82l26 6M232 82l-26 6" stroke="#3a2410" stroke-width="3.5" stroke-linecap="round"/>' +
      '<path d="M144 104l32 8h96l30-14-14 40q-64 14-126 0z" fill="#8b5a2b"' + ink('#3a2410') + '/>' +
      '<path d="M156 124h132M160 134h120" stroke="#6b4423" stroke-width="2.5"/>' +
      [192, 214, 236, 258].map((x) => '<circle cx="' + x + '" cy="118" r="4" fill="#ffe08a"' + ink('#3a2410') + '/>').join('') +
    '</g>' +
    faded('pirate-front-wave', wave(146, '#1d5f86', 'class="sc-wave-front"')));

  const burst = (cx, cy, outer, inner, points) => range(points * 2).map((index) => {
    const angle = Math.PI * index / points - Math.PI / 2;
    const radius = index % 2 ? inner : outer;
    return (index ? 'L' : 'M') + (cx + Math.cos(angle) * radius).toFixed(1) + ' ' + (cy + Math.sin(angle) * radius).toFixed(1);
  }).join('') + 'Z';
  const heroes = svg('heroes',
    '<path class="sc-pulse" d="' + burst(222, 80, 74, 52, 12) + '" fill="#ffd43b"' + ink('#1c1c1c') + '/>' +
    '<path d="' + burst(222, 80, 50, 36, 12) + '" fill="#fff3a6"/>' +
    faded('city', '<g fill="#14214d">' + [[0, 120, 26], [28, 104, 22], [52, 128, 30], [84, 96, 24], [110, 116, 20], [132, 108, 28], [162, 126, 22], [186, 112, 26], [214, 132, 30], [246, 106, 24], [272, 122, 22], [296, 110, 24]].map(([x, y, w]) => '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + (170 - y) + '"/>').join('') + '</g>' +
      '<g fill="#ffe066">' + [[6, 128], [34, 112], [40, 124], [60, 136], [90, 104], [96, 118], [138, 116], [146, 130], [192, 120], [252, 114], [258, 128], [302, 118]].map(([x, y]) => '<rect x="' + x + '" y="' + y + '" width="5" height="6" rx="1"/>').join('') + '</g>') +
    '<path d="M62 22l-14 26h12l-8 24 24-32h-13l9-18z" fill="#ffd43b"' + ink('#1c1c1c') + '/>' +
    '<g stroke="#fff" stroke-width="3.5" stroke-linecap="round" class="sc-zoom"><path d="M110 64h34M100 82h40M114 100h30"/></g>' +
    '<g class="sc-bob">' +
      '<path class="sc-cape" d="M228 70c-26-8-48 0-70-10 12 18 4 32 16 40 18-4 34-8 54-14z" fill="#e03131"' + ink('#1c1c1c') + '/>' +
      '<rect x="176" y="71" width="14" height="16" rx="6" fill="#e03131"' + ink('#1c1c1c') + '/>' +
      '<rect x="186" y="72" width="30" height="14" rx="7" fill="#1c7ed6"' + ink('#1c1c1c') + '/>' +
      '<rect x="208" y="67" width="48" height="24" rx="12" fill="#1c7ed6"' + ink('#1c1c1c') + '/>' +
      '<path d="M213 67v24" stroke="#ffd43b" stroke-width="5"/>' +
      '<path d="' + burst(236, 79, 7, 3, 5) + '" fill="#ffd43b" stroke="#1c1c1c" stroke-width="1.5" stroke-linejoin="round"/>' +
      '<rect x="250" y="84" width="34" height="11" rx="5.5" fill="#1c7ed6"' + ink('#1c1c1c') + '/>' +
      '<circle cx="290" cy="89" r="7.5" fill="#f4c49c"' + ink('#1c1c1c') + '/>' +
      '<circle cx="266" cy="68" r="15" fill="#f4c49c"' + ink('#1c1c1c') + '/>' +
      '<path d="M251 66a15 15 0 0 1 29-5q-8-5-15-1-7-4-14 6z" fill="#3b2a20"' + ink('#1c1c1c') + '/>' +
      '<rect x="253" y="64" width="27" height="8" rx="4" fill="#e03131" stroke="#1c1c1c" stroke-width="2"/>' +
      '<circle cx="262" cy="68" r="2" fill="#fff"/><circle cx="274" cy="68" r="2" fill="#fff"/>' +
      '<path d="M264 76q4 3 8 0" fill="none" stroke="#1c1c1c" stroke-width="2" stroke-linecap="round"/>' +
    '</g>');

  const gear = (cx, cy, radius, teeth, fill, spin) => {
    const d = range(teeth * 4).map((index) => {
      const angle = (Math.PI * 2 * (index - .5)) / (teeth * 4);
      const r = index % 4 < 2 ? radius : radius * .78;
      return (index ? 'L' : 'M') + (cx + Math.cos(angle) * r).toFixed(1) + ' ' + (cy + Math.sin(angle) * r).toFixed(1);
    }).join('') + 'Z';
    return '<g class="' + spin + '"><path d="' + d + '" fill="' + fill + '"' + ink('#1e293b') + '/><circle cx="' + cx + '" cy="' + cy + '" r="' + radius * .3 + '" fill="#334155"' + ink('#1e293b') + '/></g>';
  };
  const robots = svg('robots',
    faded('robot-floor', '<rect x="0" y="152" width="320" height="18" fill="#1e293b" opacity=".45"/><path d="M0 152H320" stroke="#94a3b8" stroke-width="2"/>') +
    gear(64, 108, 30, 10, '#94a3b8', 'sc-spin') + gear(112, 76, 19, 8, '#fbbf24', 'sc-spin-rev') + gear(40, 56, 13, 7, '#5eead4', 'sc-spin-rev') +
    // drone
    '<g class="sc-bob"><ellipse cx="150" cy="30" rx="16" ry="9" fill="#e2e8f0"' + ink('#1e293b') + '/><circle cx="150" cy="30" r="4" fill="#22d3ee"/>' +
      '<path d="M136 24l-6-6M164 24l6-6" stroke="#1e293b" stroke-width="2.5"/><ellipse class="sc-flicker" cx="128" cy="17" rx="9" ry="2.5" fill="#94a3b8"/><ellipse class="sc-flicker" cx="172" cy="17" rx="9" ry="2.5" fill="#94a3b8"/></g>' +
    // robot
    '<path d="M230 36V22" stroke="#1e293b" stroke-width="3"/><circle class="sc-blink" cx="230" cy="18" r="5.5" fill="#ff6b6b"' + ink('#1e293b') + '/>' +
    '<rect x="193" y="48" width="9" height="18" rx="3" fill="#94a3b8"' + ink('#1e293b') + '/><rect x="258" y="48" width="9" height="18" rx="3" fill="#94a3b8"' + ink('#1e293b') + '/>' +
    '<rect x="200" y="34" width="60" height="46" rx="11" fill="#e2e8f0"' + ink('#1e293b') + '/>' +
    '<circle cx="218" cy="54" r="8" fill="#22d3ee"' + ink('#1e293b') + '/><circle cx="242" cy="54" r="8" fill="#22d3ee"' + ink('#1e293b') + '/>' +
    '<circle cx="215" cy="51" r="2.5" fill="#fff"/><circle cx="239" cy="51" r="2.5" fill="#fff"/>' +
    '<path d="M219 68q11 8 22 0" fill="none" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>' +
    '<circle cx="208" cy="66" r="4" fill="#fda4af" opacity=".8"/><circle cx="252" cy="66" r="4" fill="#fda4af" opacity=".8"/>' +
    '<rect x="222" y="80" width="16" height="6" fill="#94a3b8"' + ink('#1e293b') + '/>' +
    '<rect x="182" y="90" width="12" height="34" rx="6" fill="#94a3b8"' + ink('#1e293b') + '/><circle cx="188" cy="128" r="7" fill="#cbd5e1"' + ink('#1e293b') + '/>' +
    '<g class="sc-wave-arm"><rect x="266" y="58" width="12" height="36" rx="6" fill="#94a3b8"' + ink('#1e293b') + '/><circle cx="272" cy="54" r="8" fill="#cbd5e1"' + ink('#1e293b') + '/></g>' +
    '<rect x="208" y="132" width="14" height="16" fill="#94a3b8"' + ink('#1e293b') + '/><rect x="238" y="132" width="14" height="16" fill="#94a3b8"' + ink('#1e293b') + '/>' +
    '<rect x="201" y="145" width="26" height="8" rx="4" fill="#334155"' + ink('#1e293b') + '/><rect x="233" y="145" width="26" height="8" rx="4" fill="#334155"' + ink('#1e293b') + '/>' +
    '<rect x="194" y="84" width="72" height="50" rx="11" fill="#fb923c"' + ink('#1e293b') + '/>' +
    '<rect x="210" y="94" width="40" height="28" rx="6" fill="#1e293b"/>' +
    [['#ff6b6b', 0], ['#4ade80', .4], ['#fde047', .8]].map(([fill, delay], index) => '<circle class="sc-blink" style="animation-delay:' + delay + 's" cx="' + (220 + index * 10) + '" cy="102" r="3.2" fill="' + fill + '"/>').join('') +
    '<path d="M217 114h26" stroke="#22d3ee" stroke-width="3" stroke-linecap="round" stroke-dasharray="4 4"/>');

  const tower = (x, y, width, wall, roof, flagFill) => '<rect x="' + x + '" y="' + y + '" width="' + width + '" height="' + (150 - y) + '" fill="' + wall + '"' + ink('#6b2150') + '/>' +
    '<path d="M' + (x - 5) + ' ' + y + 'L' + (x + width / 2) + ' ' + (y - 40) + 'L' + (x + width + 5) + ' ' + y + 'z" fill="' + roof + '"' + ink('#6b2150') + '/>' +
    flag(x + width / 2, y - 56, flagFill, '#6b2150') +
    '<path d="M' + (x + width / 2 - 5) + ' ' + (y + 24) + 'v-6a5 5 0 0 1 10 0v6z" fill="#ffd43b"' + ink('#6b2150') + '/>';
  const princesses = svg('princesses',
    faded('meadow', '<path d="M0 156Q80 138 160 150T320 146V170H0Z" fill="#f9a8d4" opacity=".55"/>') +
    sparkle(30, 30, 8, '#fff6b0', 0) + sparkle(150, 22, 6, '#fff', .8) + sparkle(312, 64, 7, '#fff6b0', 1.6) + sparkle(24, 120, 5, '#fff', 2.2) +
    '<g fill="#ff8fc8"' + ink('#6b2150') + '><path class="sc-twinkle" d="M150 60c-4-6-12-2-9 4l9 8 9-8c3-6-5-10-9-4z"/><path class="sc-twinkle" style="animation-delay:1.2s" d="M128 120c-3-5-10-2-8 3l8 7 8-7c2-5-5-8-8-3z"/></g>' +
    // castle
    tower(222, 66, 30, '#fde2f0', '#8a4fc4', '#ffd43b') +
    '<rect x="190" y="88" width="94" height="62" fill="#fde2f0"' + ink('#6b2150') + '/>' +
    '<path d="' + range(7).map((index) => 'M' + (192 + index * 14) + ' 88v-8h8v8').join('') + '" fill="#fde2f0"' + ink('#6b2150') + '/>' +
    '<path d="M224 150v-24a13 13 0 0 1 26 0v24z" fill="#8a4fc4"' + ink('#6b2150') + '/><path d="M237 113v37" stroke="#6b2150" stroke-width="2"/>' +
    '<path d="M202 112v-8a6 6 0 0 1 12 0v8zM260 112v-8a6 6 0 0 1 12 0v8z" fill="#ffd43b"' + ink('#6b2150') + '/>' +
    tower(168, 74, 28, '#f8c8e0', '#b0307a', '#7fd1ff') + tower(278, 74, 28, '#f8c8e0', '#b0307a', '#7fd1ff') +
    // crown
    '<g class="sc-bob">' +
      '<path d="M54 98l4-34 16 16 14-26 14 26 16-16 4 34z" fill="#ffd43b"' + ink('#8a5a00') + '/>' +
      '<rect x="52" y="94" width="72" height="12" rx="4" fill="#ffc21a"' + ink('#8a5a00') + '/>' +
      '<g' + ink('#8a5a00').replace('stroke-width="3"', 'stroke-width="2"') + '><circle cx="58" cy="62" r="4.5" fill="#ff8fc8"/><circle cx="88" cy="52" r="5" fill="#7fd1ff"/><circle cx="118" cy="62" r="4.5" fill="#ff8fc8"/>' +
        '<circle cx="70" cy="100" r="3.5" fill="#4dabf7"/><circle cx="88" cy="100" r="4" fill="#e64980"/><circle cx="106" cy="100" r="3.5" fill="#51cf66"/></g>' +
    '</g>');

  // An outlined limb or tail: the ink stroke, then the fill 6 units narrower.
  const tube = (d, outline, fill, width) => '<path d="' + d + '" fill="none" stroke="' + outline + '" stroke-width="' + width + '" stroke-linecap="round"/>' +
    '<path d="' + d + '" fill="none" stroke="' + fill + '" stroke-width="' + (width - 6) + '" stroke-linecap="round"/>';
  const blush = (points, r, fill = '#ff9fb6') => points.map(([x, y]) => '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + fill + '" opacity=".8"/>').join('');
  const heart = (x, y, size, fill, stroke, extra = '') => {
    const s = size / 14;
    const n = (value) => +(value * s).toFixed(1);
    return '<path ' + extra + ' d="M' + x + ' ' + (y + n(8)) + 'c' + n(-8) + ' ' + n(-6) + ' ' + n(-14) + ' ' + n(-10) + ' ' + n(-14) + ' ' + n(-16) + 'c0 ' + n(-4) + ' ' + n(3) + ' ' + n(-7) + ' ' + n(7) + ' ' + n(-7) +
      'c' + n(3) + ' 0 ' + n(5) + ' ' + n(2) + ' ' + n(7) + ' ' + n(4) + 'c' + n(2) + ' ' + n(-2) + ' ' + n(4) + ' ' + n(-4) + ' ' + n(7) + ' ' + n(-4) + 'c' + n(4) + ' 0 ' + n(7) + ' ' + n(3) + ' ' + n(7) + ' ' + n(7) +
      'c0 ' + n(6) + ' ' + n(-6) + ' ' + n(10) + ' ' + n(-14) + ' ' + n(16) + 'z" fill="' + fill + '" stroke="' + stroke + '" stroke-width="2.5" stroke-linejoin="round"/>';
  };

  const paw = (x, y, angle) => '<g transform="rotate(' + angle + ' ' + x + ' ' + y + ')"><ellipse cx="' + x + '" cy="' + (y + 4) + '" rx="6.5" ry="5.5"/>' +
    [[-7, -3], [-3, -8], [3, -8], [7, -3]].map(([dx, dy]) => '<circle cx="' + (x + dx) + '" cy="' + (y + dy) + '" r="2.6"/>').join('') + '</g>';
  const bone = '<circle cx="46" cy="138" r="5"/><circle cx="46" cy="146" r="5"/><circle cx="72" cy="138" r="5"/><circle cx="72" cy="146" r="5"/><rect x="46" y="137" width="26" height="10"/>';
  const pets = svg('pets',
    faded('rug', '<rect x="0" y="150" width="320" height="20" fill="#7a2420" opacity=".4"/>') +
    '<g fill="#fff" opacity=".4">' + paw(22, 96, 30) + paw(44, 72, 40) + paw(76, 62, 50) + paw(94, 34, 50) + '</g>' +
    // bone and yarn
    '<g transform="rotate(-8 59 142)"><g fill="#4a2614" stroke="#4a2614" stroke-width="6" stroke-linejoin="round">' + bone + '</g><g fill="#fff6e5">' + bone + '</g></g>' +
    '<path d="M126 142q10 8 22 2t20-4" fill="none" stroke="#7c83fd" stroke-width="3" stroke-linecap="round"/>' +
    '<circle cx="112" cy="134" r="16" fill="#7c83fd"' + ink('#4a2614') + '/>' +
    '<path d="M99 126q12 4 16 22M103 121q16 0 24 16M97 138q14-4 28 4" fill="none" stroke="#c3c7ff" stroke-width="2.5" stroke-linecap="round"/>' +
    // bed, back half
    '<ellipse cx="236" cy="118" rx="78" ry="24" fill="#3d7cc9"' + ink('#4a2614') + '/>' +
    '<ellipse cx="236" cy="118" rx="64" ry="15" fill="#a5d0f5" stroke="#4a2614" stroke-width="2.5"/>' +
    '<g class="sc-wag">' + tube('M292 104q16-4 18-22', '#4a2614', '#fff3e0', 12) + '</g>' +
    '<ellipse cx="206" cy="120" rx="26" ry="15" fill="#9aa6b8"' + ink('#4a2614') + '/>' +
    '<ellipse cx="270" cy="114" rx="27" ry="24" fill="#fff3e0"' + ink('#4a2614') + '/>' +
    // kitten
    '<path d="M184 90L183 70L198 79ZM203 78L217 70L218 90Z" fill="#9aa6b8"' + ink('#4a2614') + '/><path d="M187 84v-8l6 4zM209 80l5-4 1 8z" fill="#ffb3cf"/>' +
    '<circle cx="200" cy="96" r="19" fill="#9aa6b8"' + ink('#4a2614') + '/>' +
    '<path d="M196 79v6M201 78v7M206 79v6" stroke="#6c788c" stroke-width="2.5" stroke-linecap="round"/>' +
    '<path d="M188 96q4-4 8 0M204 96q4-4 8 0M196 105q2 2 4 0q2 2 4 0M182 101h-8M183 105l-7 2M218 101h8M217 105l7 2" fill="none" stroke="#2a160b" stroke-width="2.2" stroke-linecap="round"/>' +
    '<path d="M197.5 101h5l-2.5 2.5z" fill="#ff8fa3" stroke="#ff8fa3" stroke-width="1.5" stroke-linejoin="round"/>' + blush([[189, 103], [211, 103]], 3.5) +
    // puppy
    '<path d="M252 56C238 58 234 80 240 94C244 100 252 98 252 90C252 80 256 68 258 60ZM284 56C298 58 302 80 296 94C292 100 284 98 284 90C284 80 280 68 278 60Z" fill="#b8692f"' + ink('#4a2614') + '/>' +
    '<circle cx="268" cy="72" r="24" fill="#fff3e0"' + ink('#4a2614') + '/><circle cx="277" cy="68" r="8" fill="#e0a46a"/>' +
    '<circle cx="259" cy="70" r="3" fill="#2a160b"/><circle cx="277" cy="70" r="3" fill="#2a160b"/>' +
    '<ellipse cx="268" cy="84" rx="11" ry="8" fill="#fffaf2" stroke="#4a2614" stroke-width="2.5"/>' +
    '<path d="M266 89h4v3a2 2 0 0 1-4 0z" fill="#ff8fa3"/><path d="M263 79h10q0 5-5 7q-5-2-5-7z" fill="#2a160b"/>' +
    '<path d="M262 88q3 3 6 0q3 3 6 0" fill="none" stroke="#2a160b" stroke-width="2" stroke-linecap="round"/>' + blush([[252, 82], [284, 82]], 4) +
    // bed, front rim, and paws over it
    '<path d="M158 118C158 140 190 152 236 152C282 152 314 140 314 118C304 132 276 138 236 138C196 138 168 132 158 118Z" fill="#3d7cc9"' + ink('#4a2614') + '/>' +
    '<path d="M174 138Q236 156 298 138" fill="none" stroke="#a5d0f5" stroke-width="2.5" stroke-dasharray="4 5" stroke-linecap="round"/>' +
    '<g' + ink('#4a2614') + '><ellipse cx="194" cy="137" rx="7" ry="5" fill="#9aa6b8"/><ellipse cx="214" cy="138" rx="7" ry="5" fill="#9aa6b8"/><ellipse cx="257" cy="137" rx="8" ry="6" fill="#fff3e0"/><ellipse cx="283" cy="137" rx="8" ry="6" fill="#fff3e0"/></g>' +
    '<g class="sc-sway">' + tube('M182 124q-18 0-20-16', '#4a2614', '#9aa6b8', 10) + '</g>' +
    heart(232, 46, 14, '#ff8fb1', '#4a2614', 'class="sc-rise"') + heart(208, 34, 9, '#ffc2d4', '#4a2614', 'class="sc-rise" style="animation-delay:1.6s"'));

  const sunRays = (cx, cy, inner, outer, count, color) => '<g class="sc-glow" stroke="' + color + '" stroke-width="5" stroke-linecap="round">' + range(count).map((index) => {
    const angle = Math.PI * 2 * index / count;
    return '<path d="M' + (cx + Math.cos(angle) * inner).toFixed(1) + ' ' + (cy + Math.sin(angle) * inner).toFixed(1) + 'L' + (cx + Math.cos(angle) * outer).toFixed(1) + ' ' + (cy + Math.sin(angle) * outer).toFixed(1) + '"/>';
  }).join('') + '</g>';
  const horseHead = '<circle cx="246" cy="76" r="21"/><path d="M234 58L192 98L212 118L250 96Z"/><ellipse cx="204" cy="106" rx="17" ry="14"/>';
  const horses = svg('horses',
    sunRays(42, 38, 21, 28, 8, '#ffe066') + '<circle cx="42" cy="38" r="15" fill="#ffd43b"/>' +
    '<g class="sc-drift">' + cloud(134, 46, '#3b2414', .9) + '</g>' +
    faded('pasture', '<path d="M0 150Q80 138 160 146T320 142V170H0Z" fill="#6b8e23" opacity=".85"/>') +
    // hay bale
    '<path d="M36 110l-4-9M46 110l2-10M70 110l-2-9M98 110l4-9" stroke="#f4c95d" stroke-width="3" stroke-linecap="round"/>' +
    '<rect x="24" y="108" width="86" height="42" rx="10" fill="#f4c95d"' + ink('#3b2414') + '/>' +
    '<path d="M32 120h10M58 118h12M88 122h12M34 136h8M62 134h12M90 138h10M66 126h8" stroke="#d49a2a" stroke-width="2.5" stroke-linecap="round"/>' +
    '<path d="M50 109v40M84 109v40" stroke="#a0522d" stroke-width="3"/>' +
    // horse neck and mane, behind the fence
    '<g transform="translate(0 6)">' +
      '<path d="M232 84L262 50C284 66 298 100 302 150H244C246 120 240 100 232 84Z" fill="#f6e3c0"' + ink('#3b2414') + '/>' +
      '<g fill="#6b3f1d"' + ink('#3b2414') + '>' + [[266, 52], [280, 68], [290, 88], [297, 110], [301, 132]].map(([x, y]) => '<circle cx="' + x + '" cy="' + y + '" r="9"/>').join('') + '</g>' +
      '<path d="M264 52C280 66 293 92 299 140" fill="none" stroke="#6b3f1d" stroke-width="12" stroke-linecap="round"/>' +
    '</g>' +
    // fence, then grass over the foot of the neck
    '<g fill="#fdf6ea"' + ink('#3b2414') + '><rect x="124" y="104" width="194" height="10" rx="3"/><rect x="124" y="122" width="194" height="10" rx="3"/><rect x="124" y="140" width="194" height="9" rx="3"/><rect x="134" y="96" width="12" height="56" rx="2"/><rect x="298" y="96" width="12" height="56" rx="2"/></g>' +
    faded('pasture-front', '<path d="M0 156Q80 146 160 152T320 150V170H0Z" fill="#6b8e23"/>') +
    // horse head, chin on the top rail
    '<g transform="translate(0 6)"><g class="sc-nuzzle">' +
      '<path d="M238 58L241 38L254 54ZM253 60L263 41L266 62Z" fill="#f6e3c0"' + ink('#3b2414') + '/><path d="M243 52l1-8 5 6zM258 56l4-8 1 9z" fill="#e8b8a0"/>' +
      '<g fill="#3b2414" stroke="#3b2414" stroke-width="6" stroke-linejoin="round">' + horseHead + '</g><g fill="#f6e3c0">' + horseHead + '</g>' +
      '<path d="M234 58C226 70 212 84 202 96C204 99 209 100 211 97C220 86 232 72 241 62Z" fill="#fffaf2"/>' +
      '<ellipse cx="204" cy="106" rx="15" ry="11" fill="#f2c9a8"/>' +
      '<path d="M248 52q-10 3-13 13q8-1 13-7q1 6-1 10q9-5 8-15z" fill="#6b3f1d" stroke="#3b2414" stroke-width="2.5" stroke-linejoin="round"/>' +
      '<circle cx="238" cy="72" r="3.2" fill="#2b1a0e"/><path d="M234 67l-3-3" stroke="#2b1a0e" stroke-width="2" stroke-linecap="round"/>' +
      '<ellipse cx="197" cy="103" rx="2.4" ry="3" fill="#2b1a0e"/>' +
      '<path d="M200 113q6 3 12-1" fill="none" stroke="#2b1a0e" stroke-width="2.5" stroke-linecap="round"/>' + blush([[234, 90]], 5) +
    '</g></g>');

  const daisy = (x, y, delay) => '<g class="sc-tilt" style="animation-delay:' + delay + 's">' + tube('M' + x + ' 152V' + y, '#1d3a12', '#7cc35a', 8) +
    '<path d="M' + x + ' ' + (y + 22) + 'q10-10 18-4q-8 8-18 4z" fill="#7cc35a" stroke="#1d3a12" stroke-width="2" stroke-linejoin="round"/>' +
    '<g fill="#fff" stroke="#1d3a12" stroke-width="2">' + range(8).map((index) => '<circle cx="' + (x + Math.cos(index * Math.PI / 4) * 8).toFixed(1) + '" cy="' + (y + Math.sin(index * Math.PI / 4) * 8).toFixed(1) + '" r="5.5"/>').join('') +
    '<circle cx="' + x + '" cy="' + y + '" r="5.5" fill="#ffd43b"/></g></g>';
  const bugs = svg('bugs',
    faded('garden', '<path d="M0 152Q80 142 160 150T320 146V170H0Z" fill="#174d1a" opacity=".55"/>') +
    // bee and its loop
    '<path d="M96 30q26 26 46 4" fill="none" stroke="#fff" stroke-width="2.5" stroke-dasharray="2 7" stroke-linecap="round" opacity=".6"/>' +
    '<g class="sc-bob" style="animation-delay:.6s"><ellipse cx="150" cy="28" rx="6" ry="4" fill="#fff" opacity=".9" stroke="#1d3a12" stroke-width="2"/><ellipse cx="160" cy="27" rx="6" ry="4" fill="#fff" opacity=".9" stroke="#1d3a12" stroke-width="2"/>' +
      '<ellipse cx="154" cy="38" rx="11" ry="8" fill="#ffd43b" stroke="#1d3a12" stroke-width="2.5"/><path d="M152 31v14M158 31v14" stroke="#1d3a12" stroke-width="3"/><circle cx="147" cy="36" r="1.8" fill="#1d3a12"/></g>' +
    // butterfly
    '<g class="sc-bob"><g class="sc-flap" stroke="#1d3a12" stroke-width="2.5" stroke-linejoin="round">' +
      '<path d="M84 62C70 40 52 42 54 58C56 70 72 70 84 64ZM84 62C98 40 116 42 114 58C112 70 96 70 84 64Z" fill="#ff8fc8"/>' +
      '<path d="M84 66C70 70 60 82 68 88C76 92 82 80 84 68ZM84 66C98 70 108 82 100 88C92 92 86 80 84 68Z" fill="#ffd84a"/>' +
      '<g fill="#fff" stroke="none"><circle cx="66" cy="56" r="3.5"/><circle cx="102" cy="56" r="3.5"/></g></g>' +
      '<rect x="81" y="50" width="6" height="30" rx="3" fill="#3b2a4d"/><path d="M83 51q-4-8-10-9M85 51q4-8 10-9" fill="none" stroke="#3b2a4d" stroke-width="2" stroke-linecap="round"/></g>' +
    daisy(26, 112, 0) + daisy(52, 124, .8) + daisy(124, 120, 1.6) +
    // leaf and ladybird
    '<path d="M314 150C302 108 248 84 158 90C186 132 244 154 314 150Z" fill="#a3e06a"' + ink('#1d3a12') + '/>' +
    '<path d="M306 144C268 118 214 100 168 92M282 128l8-18M270 122l-6 16M182 98l8-10" fill="none" stroke="#62a83a" stroke-width="3" stroke-linecap="round"/>' +
    '<path d="M224 120l-3 7M240 121v7M256 120l3 7" stroke="#1d3a12" stroke-width="3" stroke-linecap="round"/>' +
    '<path d="M214 120a30 32 0 0 1 60 0z" fill="#ef3b3b"' + ink('#1d3a12') + '/><path d="M244 88v32" stroke="#1d3a12" stroke-width="2.5"/>' +
    '<g fill="#2a1f2e">' + [[229, 106, 5.5], [259, 106, 5.5], [237, 96, 3.5], [251, 96, 3.5], [234, 115, 3], [254, 115, 3]].map(([x, y, r]) => '<circle cx="' + x + '" cy="' + y + '" r="' + r + '"/>').join('') + '</g>' +
    '<path d="M207 102q-4-10-12-12M215 100q2-10 10-14" fill="none" stroke="#1d3a12" stroke-width="2.5" stroke-linecap="round"/><circle cx="195" cy="90" r="3" fill="#2a1f2e"/><circle cx="225" cy="86" r="3" fill="#2a1f2e"/>' +
    '<circle cx="212" cy="112" r="13" fill="#2a1f2e"' + ink('#1d3a12') + '/>' +
    '<circle cx="206" cy="109" r="3.6" fill="#fff"/><circle cx="217" cy="109" r="3.6" fill="#fff"/><circle cx="206" cy="110" r="1.8" fill="#2a1f2e"/><circle cx="217" cy="110" r="1.8" fill="#2a1f2e"/>' + blush([[203, 116], [221, 116]], 2.4) +
    '<path d="M205 117q5 4 10 0" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>');

  const jungleBush = '<circle cx="262" cy="146" r="11"/><circle cx="280" cy="138" r="15"/><circle cx="301" cy="140" r="14"/><circle cx="313" cy="148" r="8"/><rect x="254" y="144" width="64" height="10" rx="4"/>';
  const jungle = svg('jungle',
    faded('bush', '<path d="M0 156Q16 136 38 146Q58 128 82 144Q104 132 124 148Q150 134 170 150Q196 136 220 148Q248 132 272 146Q296 134 320 150V170H0Z" fill="#0c3a1b" opacity=".6"/>') +
    // leaves hanging from the canopy
    '<g' + ink('#2d2410') + '><path d="M10 0C30 14 34 36 26 52C12 40 6 20 10 0Z" fill="#4caf50"/><path d="M34 0C52 10 60 28 56 44C42 34 34 18 34 0Z" fill="#66bb6a"/><path d="M0 16C14 26 18 44 12 60C2 50 0 36 0 16Z" fill="#66bb6a"/></g>' +
    '<path d="M11 4Q24 24 25 46M36 4Q48 20 54 38" fill="none" stroke="#2e7d32" stroke-width="2" stroke-linecap="round"/>' +
    // monkey on a vine
    '<g class="sc-swing">' + tube('M104 0C98 18 110 34 104 58', '#2d2410', '#7cb342', 8) +
      '<path d="M104 16q12-8 18 0q-10 6-18 0zM105 36q-12-8-18 0q10 6 18 0z" fill="#7cb342" stroke="#2d2410" stroke-width="2" stroke-linejoin="round"/>' +
      tube('M114 98C118 84 112 68 106 60', '#2d2410', '#8b5a2b', 12) +
      tube('M114 120C134 124 140 108 132 98C128 94 122 98 126 102', '#2d2410', '#8b5a2b', 10) +
      tube('M98 120C94 128 94 134 96 140', '#2d2410', '#8b5a2b', 12) + tube('M110 120C114 128 116 134 112 140', '#2d2410', '#8b5a2b', 12) +
      '<ellipse cx="104" cy="108" rx="14" ry="17" fill="#8b5a2b"' + ink('#2d2410') + '/><ellipse cx="104" cy="112" rx="8" ry="10" fill="#f3c99b"/>' +
      tube('M94 100C86 106 84 114 86 120', '#2d2410', '#8b5a2b', 12) +
      '<g fill="#f3c99b" stroke="#2d2410" stroke-width="2.5"><circle cx="105" cy="58" r="5"/><circle cx="86" cy="121" r="5"/><circle cx="96" cy="141" r="5"/><circle cx="112" cy="141" r="5"/></g>' +
      '<g fill="#8b5a2b"' + ink('#2d2410') + '><circle cx="86" cy="82" r="7"/><circle cx="118" cy="82" r="7"/></g><g fill="#f3c99b"><circle cx="86" cy="82" r="3.5"/><circle cx="118" cy="82" r="3.5"/></g>' +
      '<circle cx="102" cy="84" r="16" fill="#8b5a2b"' + ink('#2d2410') + '/>' +
      '<path d="M90 87C90 79 96 77 102 81C108 77 114 79 114 87C114 96 108 100 102 100C96 100 90 96 90 87Z" fill="#f3c99b" stroke="#2d2410" stroke-width="2"/>' +
      '<circle cx="97" cy="86" r="2.4" fill="#2d2410"/><circle cx="107" cy="86" r="2.4" fill="#2d2410"/><path d="M98 93q4 3 8 0" fill="none" stroke="#2d2410" stroke-width="2.2" stroke-linecap="round"/>' + blush([[93, 93], [111, 93]], 2.6) +
    '</g>' +
    // giraffe
    tube('M288 140C286 120 266 102 238 86', '#2d2410', '#f7c948', 30) +
    '<g fill="#c8742c">' + [[284, 150, 6], [295, 138, 4.5], [279, 128, 5.5], [272, 112, 4], [262, 106, 5], [250, 94, 4]].map(([x, y, r]) => '<circle cx="' + x + '" cy="' + y + '" r="' + r + '"/>').join('') + '</g>' +
    '<g class="sc-nuzzle">' +
      tube('M222 66l-3-14M232 68l3-14', '#2d2410', '#f7c948', 9) + '<g fill="#a0522d" stroke="#2d2410" stroke-width="2.5"><circle cx="219" cy="51" r="4.5"/><circle cx="235" cy="53" r="4.5"/></g>' +
      '<path d="M238 72q14-8 22-2q-10 8-22 2z" fill="#f7c948" stroke="#2d2410" stroke-width="2.5" stroke-linejoin="round"/>' +
      '<ellipse cx="220" cy="76" rx="24" ry="17" transform="rotate(-15 220 76)" fill="#f7c948"' + ink('#2d2410') + '/>' +
      '<circle cx="232" cy="82" r="4" fill="#c8742c"/>' +
      '<ellipse cx="198" cy="86" rx="14" ry="12" fill="#ffe3a3"' + ink('#2d2410') + '/>' +
      '<circle cx="192" cy="82" r="1.8" fill="#2d2410"/><circle cx="199" cy="80" r="1.8" fill="#2d2410"/><circle cx="220" cy="72" r="3" fill="#2d2410"/>' +
      '<path d="M190 92q5 4 10 1" fill="none" stroke="#2d2410" stroke-width="2.2" stroke-linecap="round"/>' + blush([[211, 85]], 4) +
    '</g>' +
    // a bush and palm fronds hide where the neck comes up
    '<g class="sc-tilt"' + ink('#2d2410') + '><path d="M290 146C266 116 232 112 206 122C236 120 262 130 290 146Z" fill="#5cb85c"/><path d="M292 146C300 114 310 100 318 94C318 118 308 134 292 146Z" fill="#7cc35a"/></g>' +
    '<g fill="#2d2410" stroke="#2d2410" stroke-width="6" stroke-linejoin="round">' + jungleBush + '</g><g fill="#3f8f3a">' + jungleBush + '</g>' +
    '<path d="M266 140q6-6 12-4M290 132q8-6 14-2" fill="none" stroke="#5cb85c" stroke-width="2.5" stroke-linecap="round"/>');

  const dragonSpikes = range(6).map((index) => {
    const at = (angle, grow) => (246 + Math.cos(angle) * 52 * grow).toFixed(1) + ' ' + (116 + Math.sin(angle) * 32 * grow).toFixed(1);
    const angle = (-150 + index * 22) * Math.PI / 180;
    return 'M' + at(angle - .12, 1) + 'L' + at(angle, 1.28) + 'L' + at(angle + .12, 1) + 'Z';
  }).join('');
  const dragons = svg('dragons',
    '<path d="M140 14a13 13 0 1 0 13 20a10 10 0 1 1-13-20z" fill="#fff3c4"/>' +
    [[20, 30], [60, 18], [104, 26], [196, 34], [304, 58], [176, 66], [14, 86]].map(([x, y], index) => '<circle class="sc-twinkle" style="animation-delay:' + index * .4 + 's" cx="' + x + '" cy="' + y + '" r="' + (index % 3 ? 1.8 : 2.4) + '" fill="#fff"/>').join('') +
    faded('dragon-hills', '<path d="M0 152Q60 140 120 148T320 140V170H0Z" fill="#0b3f2c" opacity=".6"/><path d="M150 152C170 124 210 116 250 118C290 120 312 132 320 142V152Z" fill="#2a8a58"/>') +
    // castle
    '<g fill="#c9c2e0"' + ink('#2b1747') + '><rect x="38" y="74" width="50" height="76"/><path d="' + range(4).map((index) => 'M' + (38 + index * 14) + ' 74v-9h8v9').join('') + '"/>' +
      '<rect x="88" y="100" width="26" height="50"/><path d="M90 100v-8h8v8M104 100v-8h8v8"/></g>' +
    '<path d="M44 90h10M70 86h10M46 118h8M76 122h8M94 138h8" stroke="#a59bc7" stroke-width="2.5" stroke-linecap="round"/>' +
    '<path d="M53 150v-20a10 10 0 0 1 20 0v20z" fill="#6d28d9"' + ink('#2b1747') + '/>' +
    '<path d="M58 104v-8a5 5 0 0 1 10 0v8zM97 126v-7a4 4 0 0 1 8 0v7z" fill="#ffd43b"' + ink('#2b1747') + '/>' +
    flag(63, 49, '#ffd43b', '#2b1747') +
    // smoke rings
    '<g fill="none" stroke="#efe9ff" stroke-width="3.5">' + [[146, 100, 5, 0], [132, 78, 7, 1], [116, 54, 9, 2]].map(([x, y, r, delay]) => '<circle class="sc-puff" style="animation-delay:' + delay + 's" cx="' + x + '" cy="' + y + '" r="' + r + '"/>').join('') + '</g>' +
    // dragon, curled up asleep
    '<g class="sc-breathe">' +
      '<path d="M236 92C240 70 262 60 286 64C280 72 280 80 284 88C274 86 268 92 268 100Z" fill="#5cc27a"' + ink('#2b1747') + '/>' +
      '<path d="' + dragonSpikes + '" fill="#ffb347" stroke="#2b1747" stroke-width="2.5" stroke-linejoin="round"/>' +
      '<ellipse cx="246" cy="116" rx="52" ry="32" fill="#9be38a"' + ink('#2b1747') + '/>' +
      '<path d="M204 128C220 146 270 150 294 128" fill="none" stroke="#fff3b8" stroke-width="7" stroke-linecap="round"/>' +
      '<ellipse cx="274" cy="124" rx="18" ry="14" fill="#9be38a" stroke="#2b1747" stroke-width="2.5"/>' +
      tube('M290 128C306 148 274 156 240 151', '#2b1747', '#9be38a', 18) +
      '<path d="M242 151L229 143L222 151L229 159Z" fill="#ffb347" stroke="#2b1747" stroke-width="2.5" stroke-linejoin="round"/>' +
    '</g>' +
    '<path d="M186 102l2-14 9 11zM200 101l7-12 4 13z" fill="#fff3b8" stroke="#2b1747" stroke-width="2.5" stroke-linejoin="round"/>' +
    '<ellipse cx="190" cy="120" rx="27" ry="21" fill="#9be38a"' + ink('#2b1747') + '/>' +
    '<ellipse cx="166" cy="126" rx="15" ry="12" fill="#9be38a"' + ink('#2b1747') + '/>' +
    '<circle cx="158" cy="121" r="1.8" fill="#2b1747"/><circle cx="164" cy="120" r="1.8" fill="#2b1747"/>' +
    '<path d="M180 112q6 5 12 0M156 132q6 4 12 1" fill="none" stroke="#2b1747" stroke-width="2.6" stroke-linecap="round"/>' + blush([[196, 126]], 5) +
    '<g fill="#9be38a"' + ink('#2b1747') + '><ellipse cx="184" cy="143" rx="9" ry="6"/><ellipse cx="204" cy="144" rx="9" ry="6"/></g>');

  function carWheel(cx, cy, r) {
    return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#2b2e33"' + ink('#1b1e25') + '/><circle cx="' + cx + '" cy="' + cy + '" r="' + r * .55 + '" fill="#ced4da" stroke="#1b1e25" stroke-width="2.5"/>' +
      '<g class="sc-spin"><path d="M' + (cx - r * .4) + ' ' + cy + 'H' + (cx + r * .4) + 'M' + cx + ' ' + (cy - r * .4) + 'V' + (cy + r * .4) + '" stroke="#1b1e25" stroke-width="2.5" stroke-linecap="round"/></g>';
  }
  const cars = svg('cars',
    '<g class="sc-drift">' + cloud(78, 48, '#1b1e25', .8) + cloud(178, 32, '#1b1e25', .6) + '</g>' +
    faded('road', '<rect x="0" y="146" width="320" height="24" fill="#1f242d"/><path d="M0 146H320" stroke="#8a94a6" stroke-width="2"/><path d="M4 159H320" stroke="#ffd43b" stroke-width="3" stroke-dasharray="14 10"/>') +
    // traffic light
    '<rect x="36" y="94" width="6" height="54" fill="#495057"' + ink('#1b1e25') + '/>' +
    '<rect x="25" y="42" width="28" height="56" rx="7" fill="#343a40"' + ink('#1b1e25') + '/>' +
    '<circle cx="39" cy="54" r="6" fill="#7a3434"/><circle cx="39" cy="70" r="6" fill="#7a6a2a"/><circle cx="39" cy="86" r="6.5" fill="#51cf66" stroke="#b2f2bb" stroke-width="2"/>' +
    '<g stroke="#fff" stroke-width="3.5" stroke-linecap="round" class="sc-zoom"><path d="M96 104h26M86 120h34M100 136h22"/></g>' +
    // fire engine
    '<g class="sc-roll">' +
      '<path d="M146 96v-6M226 96v-6" stroke="#1b1e25" stroke-width="4"/>' +
      '<g fill="#dee2e6" stroke="#1b1e25" stroke-width="2.5"><rect x="134" y="80" width="108" height="5" rx="2"/><rect x="134" y="89" width="108" height="5" rx="2"/></g>' +
      '<path d="' + range(8).map((index) => 'M' + (142 + index * 13) + ' 84v6').join('') + '" stroke="#1b1e25" stroke-width="2.5"/>' +
      '<rect x="132" y="96" width="110" height="42" rx="5" fill="#e03131"' + ink('#1b1e25') + '/>' +
      '<path d="M240 138V84h40q16 0 22 20l6 22v12z" fill="#e03131"' + ink('#1b1e25') + '/>' +
      '<path d="M258 90h20q10 0 14 14l2 8h-36z" fill="#bfe3ff" stroke="#1b1e25" stroke-width="2.5" stroke-linejoin="round"/>' +
      '<g fill="none" stroke="#1b1e25" stroke-width="2.5"><rect x="140" y="102" width="30" height="20" rx="3"/><rect x="204" y="102" width="30" height="20" rx="3"/><path d="M250 92v32"/></g>' +
      '<circle cx="187" cy="112" r="10" fill="#ffd43b" stroke="#1b1e25" stroke-width="2.5"/><circle cx="187" cy="112" r="3.5" fill="#1b1e25"/>' +
      '<rect x="132" y="126" width="176" height="5" fill="#f8f9fa"/>' +
      '<rect class="sc-blink" x="248" y="75" width="15" height="9" rx="3" fill="#ff6b6b"' + ink('#1b1e25') + '/><rect class="sc-blink" style="animation-delay:.6s" x="263" y="75" width="15" height="9" rx="3" fill="#4dabf7"' + ink('#1b1e25') + '/>' +
      '<circle cx="302" cy="118" r="4.5" fill="#ffe08a" stroke="#1b1e25" stroke-width="2.5"/>' +
      '<rect x="292" y="132" width="20" height="8" rx="3" fill="#adb5bd"' + ink('#1b1e25') + '/>' +
    '</g>' +
    carWheel(168, 136, 14) + carWheel(276, 136, 14));

  // Pixel art from rows of palette keys ('.' is empty), merged into horizontal runs.
  const pixels = (x, y, size, rows, palette) => {
    const runs = {};
    rows.forEach((row, line) => {
      for (let start = 0, end; start < row.length; start = end) {
        for (end = start; end < row.length && row[end] === row[start]; end += 1);
        if (row[start] !== '.') (runs[row[start]] = runs[row[start]] || []).push('M' + (x + start * size) + ' ' + (y + line * size) + 'h' + (end - start) * size + 'v' + size + 'h-' + (end - start) * size + 'z');
      }
    });
    return Object.keys(runs).map((key) => '<path d="' + runs[key].join('') + '" fill="' + palette[key] + '"/>').join('');
  };
  const arcade = { k: '#1e0b3a', g: '#4ade80', l: '#bbf7d0', w: '#fff', p: '#f9a8d4', y: '#facc15', o: '#f59e0b', r: '#ff4d6d' };
  const pixelHeart = ['.kk.kk.', 'kwrkrrk', 'krrrrrk', '.krrrk.', '..krk..', '...k...'];
  const pixelSpark = ['.w.', 'www', '.w.'];
  const games = svg('games',
    '<g shape-rendering="crispEdges">' +
      [10, 42, 74].map((x) => pixels(x, 10, 4, pixelHeart, arcade)).join('') +
      '<g opacity=".9">' + pixels(150, 30, 5, ['...ww....', '.wwwwww..', 'wwwwwwwww'], arcade) + pixels(196, 64, 5, ['..www.', 'wwwwww'], arcade) + '</g>' +
      [[180, 108, 0], [300, 52, .9], [62, 76, 1.8]].map(([x, y, delay]) => '<g class="sc-twinkle" style="animation-delay:' + delay + 's">' + pixels(x, y, 4, pixelSpark, arcade) + '</g>').join('') +
      faded('pixel-ground', '<rect x="0" y="150" width="320" height="5" fill="#22c55e"/><rect x="0" y="155" width="320" height="15" fill="#92400e"/>' +
        '<path d="' + range(16).map((index) => 'M' + (index * 20 + (index % 2) * 10) + ' 160h5v5h-5z').join('') + '" fill="#6b2f0a"/>') +
      // block and the coin it gave
      pixels(110, 82, 5, ['kkkkkkkkk', 'koyyyyyok', 'kyyyyyyyk', 'kyyywyyyk', 'kyywwwyyk', 'kyyywyyyk', 'kyyyyyyyk', 'koyyyyyok', 'kkkkkkkkk'], arcade) +
      '<g class="sc-bob"><g class="sc-flip">' + pixels(120, 44, 5, ['.kkk.', 'kyyyk', 'kyoyk', 'kyoyk', 'kyyyk', '.kkk.'], arcade) + '</g></g>' +
      // the player, looking at the block
      '<g class="sc-hop">' + pixels(222, 90, 5, ['......kkkk......', '....kkggggkk....', '...kggggggggk...', '..kggggggggggk..', '.kggwwggggwwggk.', '.kggkwggggkwggk.',
        'kgggkwggggkwgggk', 'kgppggggggggppgk', 'kggggkggggkggggk', 'kgggggkkkkgggggk', 'kgllllllllllllgk', '.kkkkkkkkkkkkkk.'], arcade) + '</g>' +
    '</g>');

  const brick = (x, y, studs, fill) => '<g fill="' + fill + '"' + ink('#1b1b2f') + '>' + range(studs).map((index) => '<rect x="' + (x + 3 + index * 16) + '" y="' + (y - 6) + '" width="10" height="8" rx="2"/>').join('') +
    '<rect x="' + x + '" y="' + y + '" width="' + studs * 16 + '" height="20" rx="3"/></g>';
  const bricks = svg('bricks',
    sparkle(30, 34, 8, '#fff6b0', 0) + sparkle(140, 26, 6, '#fff', .8) + sparkle(304, 62, 7, '#fff6b0', 1.6) + sparkle(118, 92, 5, '#fff', 2.2) +
    faded('baseplate', '<path d="' + range(20).map((index) => 'M' + (index * 16 + 3) + ' 150v-4h10v4z').join('') + '" fill="#2f9e44" stroke="#1b1b2f" stroke-width="2"/><rect x="0" y="150" width="320" height="20" fill="#2f9e44"/><path d="M0 150H320" stroke="#1b1b2f" stroke-width="2.5"/>') +
    // loose bricks
    brick(36, 130, 2, '#f8f9fa') + brick(74, 130, 1, '#ffd43b') +
    // the stack
    brick(172, 130, 4, '#2563eb') + brick(236, 130, 4, '#ffd43b') +
    brick(188, 110, 4, '#2fb35a') + brick(252, 110, 2, '#74c0fc') +
    brick(204, 90, 2, '#ffd43b') +
    // and the one going on top
    '<g class="sc-place">' + brick(236, 56, 2, '#2563eb') + '<path d="M226 58v14M278 58v14" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/></g>');

  const sprinkles = [['#ffd43b', 30], ['#74c0fc', -20], ['#69db7c', 60], ['#b197fc', -40], ['#ff922b', 20], ['#ff8fc8', -60]];
  const sprinkle = ([x, y], index, extra = '') => {
    const [color, angle] = sprinkles[index % sprinkles.length];
    const dx = (Math.cos(angle * Math.PI / 180) * 3).toFixed(1);
    const dy = (Math.sin(angle * Math.PI / 180) * 3).toFixed(1);
    return '<path ' + extra + 'd="M' + (x - dx) + ' ' + (y - dy) + 'L' + (x + +dx) + ' ' + (y + +dy) + '" stroke="' + color + '" stroke-width="3.5" stroke-linecap="round"/>';
  };
  const sweets = svg('sweets',
    [[28, 30], [140, 24], [170, 62], [300, 74], [16, 92], [124, 74], [196, 30]].map((point, index) => sprinkle(point, index, 'class="sc-twinkle" style="animation-delay:' + index * .4 + 's" ')).join('') +
    sparkle(100, 40, 7, '#fff6b0', .4) + sparkle(296, 112, 6, '#fff', 1.4) +
    faded('table', '<rect x="0" y="150" width="320" height="20" fill="#fff0f5" opacity=".3"/>') +
    // steam over warm cookies
    '<g fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity=".85">' + [[66, 0], [86, 1.3], [108, .6]].map(([x, delay]) => '<path class="sc-rise" style="animation-delay:' + delay + 's" d="M' + x + ' 96q-6-7 0-14t0-14"/>').join('') + '</g>' +
    '<ellipse cx="92" cy="146" rx="54" ry="8" fill="#fff"' + ink('#3b1622') + '/>' +
    '<circle cx="78" cy="124" r="22" fill="#e9a85a"' + ink('#3b1622') + '/><circle cx="114" cy="130" r="18" fill="#f0b86e"' + ink('#3b1622') + '/>' +
    '<g fill="#5a2e1a">' + [[70, 114, 3.2], [86, 118, 2.6], [66, 130, 3], [80, 136, 2.4], [108, 124, 3], [121, 132, 2.6], [110, 139, 2.4]].map(([x, y, r]) => '<circle cx="' + x + '" cy="' + y + '" r="' + r + '"/>').join('') + '</g>' +
    // cupcake
    '<g class="sc-rock">' +
      '<path d="M206 112h68l-8 38h-52z" fill="#7dd3fc"' + ink('#3b1622') + '/><path d="M217 116l3 30M263 116l-3 30" stroke="#38a3d1" stroke-width="2.5" stroke-linecap="round"/>' +
      '<g fill="#fff4f7"' + ink('#3b1622') + '><ellipse cx="240" cy="108" rx="40" ry="13"/><ellipse cx="240" cy="94" rx="30" ry="11"/><ellipse cx="240" cy="80" rx="18" ry="9"/></g>' +
      [[220, 106], [236, 113], [256, 108], [228, 94], [250, 90], [262, 100], [240, 80]].map((point, index) => sprinkle(point, index)).join('') +
      '<path d="M241 54q2-8 10-12" fill="none" stroke="#3b1622" stroke-width="2.5" stroke-linecap="round"/>' +
      '<circle cx="240" cy="62" r="9" fill="#e5383b"' + ink('#3b1622') + '/><circle cx="236.5" cy="58.5" r="2.2" fill="#fff"/>' +
      '<circle cx="229" cy="130" r="2.8" fill="#3b1622"/><circle cx="251" cy="130" r="2.8" fill="#3b1622"/>' +
      '<path d="M234 136q6 5 12 0" fill="none" stroke="#3b1622" stroke-width="2.5" stroke-linecap="round"/>' + blush([[222, 136], [258, 136]], 3.5) +
    '</g>');

  const raindrop = (x, y, delay) => '<path class="sc-fall" style="animation-delay:' + delay + 's" d="M' + x + ' ' + y + 'q-5 7-5 10a5 5 0 0 0 10 0q0-3-5-10z" fill="#a5d8ff" stroke="#1c2a63" stroke-width="2" stroke-linejoin="round"/>';
  const weather = svg('weather',
    faded('weather-hills', '<path d="M0 152Q60 136 130 148T320 142V170H0Z" fill="#3a9d5d"/>') +
    [['#ff6b6b', 82], ['#ffd43b', 74], ['#69db7c', 66], ['#74c0fc', 58]].map(([color, r]) => '<path d="M' + (140 - r) + ' 152a' + r + ' ' + r + ' 0 0 1 ' + r * 2 + ' 0" fill="none" stroke="' + color + '" stroke-width="8"/>').join('') +
    '<ellipse cx="40" cy="150" rx="18" ry="3.5" fill="#a5d8ff" opacity=".8"/>' +
    raindrop(24, 72, 0) + raindrop(40, 84, .5) + raindrop(56, 70, 1) + raindrop(30, 104, .8) + raindrop(50, 110, .3) +
    '<g class="sc-drift" style="animation-direction:alternate-reverse">' + cloud(42, 60, '#1c2a63', 1.1, '#dbe4ff') + '</g>' +
    // sun behind a cloud
    sunRays(264, 80, 33, 40, 10, '#ffd43b') +
    '<circle cx="264" cy="80" r="26" fill="#ffd43b"' + ink('#1c2a63') + '/>' +
    '<path d="M250 76q4-4 8 0M270 76q4-4 8 0M256 86q8 6 16 0" fill="none" stroke="#1c2a63" stroke-width="2.6" stroke-linecap="round"/>' + blush([[248, 86], [280, 86]], 4) +
    '<g class="sc-drift">' + cloud(220, 132, '#1c2a63', 1.7) + '</g>');

  // The seasons draw the time of year (its plants, weather and animals), never a holiday.
  const tulip = (x, y, fill, delay) => '<g class="sc-tilt" style="animation-delay:' + delay + 's">' + tube('M' + x + ' 156V' + (y + 8), '#1e3a28', '#5cb85c', 8) +
    '<g stroke="#1e3a28" stroke-width="2" stroke-linejoin="round"><path d="M' + x + ' ' + (y + 32) + 'q-12-4-14-18q10 2 14 12z" fill="#5cb85c"/>' +
    '<path d="M' + (x - 8) + ' ' + (y - 6) + 'l4 5 4-7 4 7 4-5v8q0 9-8 9t-8-9z" fill="' + fill + '" stroke-width="2.5"/></g></g>';
  // A lens 10 long, turned to `angle` in its own coordinates so it can carry sc-flutter.
  const petal = (x, y, angle, delay) => {
    const along = [Math.cos(angle * Math.PI / 180) * 5, Math.sin(angle * Math.PI / 180) * 5];
    const n = (value) => +value.toFixed(1);
    const [ax, ay] = along; const [px, py] = [-ay * 1.2, ax * 1.2];
    return '<path class="sc-flutter" style="animation-delay:' + delay + 's" d="M' + n(x - ax) + ' ' + n(y - ay) + 'Q' + n(x + px) + ' ' + n(y + py) + ' ' + n(x + ax) + ' ' + n(y + ay) + 'Q' + n(x - px) + ' ' + n(y - py) + ' ' + n(x - ax) + ' ' + n(y - ay) + 'z" fill="#ffe0ec"/>';
  };
  const blossomTree = '<circle cx="44" cy="84" r="20"/><circle cx="68" cy="64" r="24"/><circle cx="98" cy="70" r="21"/><circle cx="116" cy="92" r="15"/><circle cx="34" cy="104" r="13"/><circle cx="74" cy="96" r="22"/><circle cx="100" cy="102" r="14"/>';
  const lambWool = '<circle cx="214" cy="110" r="14"/><circle cx="226" cy="96" r="15"/><circle cx="246" cy="90" r="16"/><circle cx="266" cy="92" r="15"/><circle cx="282" cy="104" r="13"/><circle cx="292" cy="106" r="8"/>' +
    '<circle cx="284" cy="120" r="12"/><circle cx="268" cy="130" r="13"/><circle cx="246" cy="132" r="13"/><circle cx="224" cy="128" r="13"/><ellipse cx="248" cy="112" rx="34" ry="20"/>';
  const lambTuft = '<circle cx="186" cy="83" r="6"/><circle cx="194" cy="79" r="7"/><circle cx="203" cy="82" r="6"/>';
  const spring = svg('spring',
    '<g class="sc-drift">' + cloud(178, 40, '#1e3a28', .7) + '</g>' +
    faded('spring-meadow', '<path d="M0 150Q70 136 150 146T320 140V170H0Z" fill="#7ccf6e" opacity=".55"/>') +
    // cherry tree in blossom
    tube('M72 154C74 138 70 124 74 108', '#1e3a28', '#8a5a3c', 16) +
    '<g fill="#1e3a28" stroke="#1e3a28" stroke-width="6">' + blossomTree + '</g><g fill="#ffc2dc">' + blossomTree + '</g>' +
    '<g fill="#fff6b0" stroke="#ff8fbf" stroke-width="2.6">' + [[46, 78], [64, 56], [90, 62], [112, 88], [78, 90], [38, 102], [98, 104], [58, 82], [84, 74], [62, 104]].map(([x, y]) => '<circle cx="' + x + '" cy="' + y + '" r="2.3"/>').join('') + '</g>' +
    tulip(124, 126, '#ff8fc8', 1.8) +
    // lamb, legs then wool then head
    [214, 230, 258, 274].map((x) => '<rect x="' + x + '" y="126" width="9" height="24" rx="4" fill="#5b4740"' + ink('#1e3a28') + '/>').join('') +
    '<g fill="#1e3a28" stroke="#1e3a28" stroke-width="6">' + lambWool + '</g><g fill="#fff">' + lambWool + '</g>' +
    '<g class="sc-nuzzle">' +
      '<ellipse cx="176" cy="92" rx="10" ry="5" transform="rotate(-24 176 92)" fill="#fde4d4"' + ink('#1e3a28') + '/><ellipse cx="176" cy="92" rx="5" ry="2.2" transform="rotate(-24 176 92)" fill="#ffb3c6"/>' +
      '<ellipse cx="212" cy="88" rx="9" ry="4.5" transform="rotate(28 212 88)" fill="#fde4d4"' + ink('#1e3a28') + '/>' +
      '<ellipse cx="194" cy="97" rx="17" ry="15" fill="#fde4d4"' + ink('#1e3a28') + '/>' +
      '<g fill="#1e3a28" stroke="#1e3a28" stroke-width="6">' + lambTuft + '</g><g fill="#fff">' + lambTuft + '</g>' +
      '<circle cx="188" cy="97" r="2.4" fill="#1e3a28"/><circle cx="200" cy="97" r="2.4" fill="#1e3a28"/>' +
      '<path d="M190 105q4 3 8 0" fill="none" stroke="#1e3a28" stroke-width="2.2" stroke-linecap="round"/>' + blush([[183, 103], [206, 103]], 3) +
    '</g>' +
    tulip(148, 116, '#ff6b6b', 0) + tulip(166, 108, '#ffd43b', 1.1) + tulip(248, 134, '#ffa94d', 2.4) +
    faded('spring-grass', '<path d="M0 154Q80 146 160 152T320 150V170H0Z" fill="#57b552"/>') +
    '<g fill="#fff">' + [[40, 160], [104, 158], [196, 162], [244, 158], [286, 161]].map(([x, y]) => '<circle cx="' + x + '" cy="' + y + '" r="2.5"/>').join('') + '</g>' +
    [[138, 40, 20, 0], [150, 76, -30, 1.5], [196, 58, 40, 3], [128, 116, 10, 4.5], [212, 30, -15, 2.2]].map(([x, y, angle, delay]) => petal(x, y, angle, delay)).join(''));

  // The castle is bucket-built: its towers taper out to the sand.
  const sandTower = (x) => '<path d="M' + (x - 13) + ' 150L' + (x - 10) + ' 104h20l3 46zM' + (x - 10) + ' 104v-6h6v6zM' + (x + 4) + ' 104v-6h6v6z" fill="#f4c76b"' + ink('#123b5c') + '/>' +
    '<path d="M' + (x - 3) + ' 124v-5a3 3 0 0 1 6 0v5z" fill="#d9a441"/>';
  const summer = svg('summer',
    sunRays(48, 40, 26, 33, 10, '#ffe066') +
    '<circle cx="48" cy="40" r="20" fill="#ffd43b"' + ink('#123b5c') + '/>' +
    '<path d="M33 35h12v4a6 6 0 0 1-12 0zM51 35h12v4a6 6 0 0 1-12 0z" fill="#123b5c"/>' +
    '<path d="M45 36h6M33 35l-4-3M63 35l4-3" stroke="#123b5c" stroke-width="2.5" stroke-linecap="round"/>' +
    '<path d="M36 38l3-2M54 38l3-2" stroke="#fff" stroke-width="2" stroke-linecap="round"/>' +
    '<path d="M41 51q7 5 14 0" fill="none" stroke="#123b5c" stroke-width="2.6" stroke-linecap="round"/>' + blush([[34, 49], [62, 49]], 3.5) +
    '<g class="sc-drift" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"><path d="M132 30q6-6 12 0q6-6 12 0"/><path d="M164 50q4-4 8 0q4-4 8 0"/></g>' +
    faded('summer-back-wave', wave(126, '#7fe0f0', 'class="sc-wave-back" opacity=".75"')) +
    // sailboat on the horizon
    '<g class="sc-rock">' +
      '<path d="M96 124V88" stroke="#123b5c" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M99 90v30h22z" fill="#fff"' + ink('#123b5c') + '/><path d="M93 96v24h-16z" fill="#ffd43b"' + ink('#123b5c') + '/>' +
      '<path d="M74 124h44l-7 10h-30z" fill="#ff6b4a"' + ink('#123b5c') + '/>' +
    '</g>' +
    faded('summer-front-wave', wave(138, '#38bfd9', 'class="sc-wave-front"')) +
    faded('sand', '<path d="M0 148Q80 138 170 146T320 142V170H0Z" fill="#f7dc8f"/>' +
      '<g fill="#e8c46a">' + [[30, 158], [62, 152], [118, 160], [204, 160], [262, 156], [300, 162]].map(([x, y]) => '<circle cx="' + x + '" cy="' + y + '" r="2"/>').join('') + '</g>') +
    '<path d="' + burst(142, 155, 9, 4, 5) + '" fill="#ff8a5b" stroke="#123b5c" stroke-width="2.5" stroke-linejoin="round"/>' +
    // beach umbrella, leaning into the breeze
    '<ellipse cx="248" cy="152" rx="44" ry="4" fill="#e2bf6a"/>' +
    '<g transform="rotate(6 252 150)">' +
      tube('M252 152V80', '#123b5c', '#fff', 9) +
      '<path d="M196 80C196 58 222 46 252 46C282 46 308 58 308 80q-14 8-28 0q-14 8-28 0q-14 8-28 0q-14 8-28 0z" fill="#fff"/>' +
      '<path d="M252 46C222 46 196 58 196 80q14 8 28 0C226 62 238 50 252 46zM252 46V80q14 8 28 0C278 62 266 50 252 46z" fill="#ff6b4a"/>' +
      '<path d="M196 80C196 58 222 46 252 46C282 46 308 58 308 80q-14 8-28 0q-14 8-28 0q-14 8-28 0q-14 8-28 0z" fill="none"' + ink('#123b5c') + '/>' +
      '<path d="M224 80C226 62 238 50 252 46M252 46V80M280 80C278 62 266 50 252 46" fill="none" stroke="#123b5c" stroke-width="2.5"/>' +
      '<circle cx="252" cy="43" r="4" fill="#ff6b4a" stroke="#123b5c" stroke-width="2.5"/>' +
    '</g>' +
    // sandcastle
    '<rect x="192" y="118" width="26" height="32" fill="#f4c76b"' + ink('#123b5c') + '/>' +
    '<path d="M194 118v-6h6v6zM210 118v-6h6v6z" fill="#f4c76b"' + ink('#123b5c') + '/>' +
    sandTower(183) + sandTower(227) +
    '<path d="M199 150v-12a6 6 0 0 1 12 0v12z" fill="#d9a441"' + ink('#123b5c') + '/>' +
    '<g fill="#e0ad4f"><circle cx="178" cy="138" r="2"/><circle cx="232" cy="134" r="2"/><circle cx="214" cy="128" r="1.8"/></g>' +
    flag(183, 82, '#ff6b4a', '#123b5c') +
    // bucket
    '<path d="M285 130h24l-3 20h-18z" fill="#4dabf7"' + ink('#123b5c') + '/>' +
    '<path d="M288 129q9-16 18 0" fill="none" stroke="#123b5c" stroke-width="2.5" stroke-linecap="round"/>' +
    '<rect x="283" y="126" width="28" height="6" rx="3" fill="#a5d8ff"' + ink('#123b5c') + '/>');

  // `extra` carries the motion class on a wrapper, so the turn stays on its own group.
  const leaf = (x, y, angle, fill, extra) => {
    const body = '<g transform="rotate(' + angle + ' ' + x + ' ' + y + ')" stroke="#3f1a0c" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">' +
      '<path d="M' + x + ' ' + (y - 10) + 'c8 5 8 14 0 19c-8-5-8-14 0-19z" fill="' + fill + '"/><path d="M' + x + ' ' + (y - 6) + 'v19"/></g>';
    return extra ? '<g ' + extra + '>' + body + '</g>' : body;
  };
  const autumn = svg('autumn',
    '<path d="M14 58c18-14 38-14 54 0s36 10 50-4" fill="none" stroke="#fff" stroke-width="2.5" stroke-dasharray="2 8" stroke-linecap="round" opacity=".5"/>' +
    [[38, 30, 20, '#ffc93c', 0], [104, 46, -30, '#ff8c2e', 1.4], [150, 22, 50, '#ff6a4d', 2.8], [172, 74, -15, '#ffc93c', 4.2], [126, 92, 35, '#c8d44e', .7], [60, 90, -40, '#ff8c2e', 3.5]]
      .map(([x, y, angle, fill, delay]) => leaf(x, y, angle, fill, 'class="sc-flutter" style="animation-delay:' + delay + 's"')).join('') +
    faded('autumn-hills', '<path d="M0 150Q70 134 150 146T320 140V170H0Z" fill="#5a1d28" opacity=".55"/>') +
    // a heap of raked leaves and two toadstools
    '<path d="M12 152C16 128 44 118 64 124C86 118 108 132 112 152Z" fill="#ff8c2e"' + ink('#3f1a0c') + '/>' +
    [[32, 134, -40, '#ffc93c'], [56, 126, 10, '#ff6a4d'], [82, 130, 55, '#ffc93c'], [100, 142, 80, '#c8d44e'], [24, 146, -75, '#ff6a4d'], [66, 142, -20, '#ffc93c']].map(([x, y, angle, fill]) => leaf(x, y, angle, fill)).join('') +
    '<rect x="128" y="126" width="10" height="26" rx="4" fill="#fbe9d0"' + ink('#3f1a0c') + '/><path d="M118 130q15-24 30 0z" fill="#e8a25a"' + ink('#3f1a0c') + '/>' +
    '<g fill="#fff3dc"><circle cx="127" cy="123" r="2.6"/><circle cx="138" cy="121" r="2.2"/></g>' +
    '<rect x="146" y="138" width="7" height="14" rx="3" fill="#fbe9d0"' + ink('#3f1a0c') + '/><path d="M140 140q9-14 19 0z" fill="#e8a25a"' + ink('#3f1a0c') + '/>' +
    // log
    '<rect x="176" y="126" width="122" height="24" rx="12" fill="#8a4b2a"' + ink('#3f1a0c') + '/>' +
    '<path d="M190 134h22M226 142h26M262 134h16" stroke="#6a361c" stroke-width="2.5" stroke-linecap="round"/>' +
    '<ellipse cx="296" cy="138" rx="9" ry="12" fill="#e9b37a"' + ink('#3f1a0c') + '/><ellipse cx="296" cy="138" rx="4.5" ry="6.5" fill="none" stroke="#c98a4b" stroke-width="2"/>' +
    // squirrel, tail first
    '<g class="sc-wag"><path d="M256 124C292 128 308 100 298 76C290 58 268 52 260 66C272 64 282 74 280 88C278 102 264 108 250 110Z" fill="#e8863a"' + ink('#3f1a0c') + '/>' +
      '<path d="M264 116C284 112 294 96 290 80" fill="none" stroke="#fde3c0" stroke-width="5" stroke-linecap="round"/></g>' +
    '<ellipse cx="236" cy="106" rx="22" ry="22" fill="#e8863a"' + ink('#3f1a0c') + '/>' +
    '<ellipse cx="229" cy="110" rx="12" ry="15" fill="#fde3c0"/>' +
    '<ellipse cx="250" cy="116" rx="13" ry="11" fill="#e8863a"' + ink('#3f1a0c') + '/>' +
    '<ellipse cx="236" cy="127" rx="13" ry="4.5" fill="#e8863a"' + ink('#3f1a0c') + '/>' +
    tube('M228 94Q226 104 220 108', '#3f1a0c', '#e8863a', 10) +
    '<ellipse cx="212" cy="107" rx="7" ry="8" fill="#c98a4b" stroke="#3f1a0c" stroke-width="2.5"/><path d="M204 102q8-10 16 0z" fill="#7a4a26" stroke="#3f1a0c" stroke-width="2.5" stroke-linejoin="round"/>' +
    '<path d="M212 96v-4" stroke="#3f1a0c" stroke-width="2.5" stroke-linecap="round"/>' +
    '<g fill="#e8863a" stroke="#3f1a0c" stroke-width="2.5"><circle cx="205" cy="108" r="4.5"/><circle cx="219" cy="110" r="4.5"/></g>' +
    '<g class="sc-nuzzle">' +
      '<path d="M208 62C203 54 205 46 211 44C216 47 218 54 216 60ZM226 58C226 50 230 45 236 44C239 50 237 56 233 62Z" fill="#e8863a"' + ink('#3f1a0c') + '/>' +
      '<path d="M211 44l-2-5M236 44l2-5" stroke="#3f1a0c" stroke-width="2.5" stroke-linecap="round"/><path d="M210 57q-2-6 1-9q3 3 2 8zM230 56q1-6 5-8q1 4-2 8z" fill="#ffb39b"/>' +
      '<circle cx="222" cy="74" r="18" fill="#e8863a"' + ink('#3f1a0c') + '/>' +
      '<ellipse cx="210" cy="81" rx="9" ry="7" fill="#fde3c0"/>' +
      '<circle cx="202" cy="78" r="2.6" fill="#3f1a0c"/><circle cx="215" cy="70" r="2.6" fill="#3f1a0c"/><circle cx="228" cy="70" r="2.4" fill="#3f1a0c"/>' +
      '<path d="M204 86q4 3 8 0" fill="none" stroke="#3f1a0c" stroke-width="2.2" stroke-linecap="round"/>' + blush([[226, 82]], 3.5) +
    '</g>' +
    faded('autumn-ground', '<path d="M0 154Q80 146 160 152T320 150V170H0Z" fill="#5c2a1c"/>') +
    leaf(184, 158, 80, '#ffc93c') + leaf(272, 160, -70, '#ff6a4d') + leaf(60, 160, 100, '#c8d44e'));

  const flake = (x, y, size, delay) => {
    const half = size / 2; const rise = +(size * .87).toFixed(1);
    return '<path class="sc-snow" style="animation-delay:' + delay + 's" d="M' + (x - size) + ' ' + y + 'H' + (x + size) + 'M' + (x - half) + ' ' + (y - rise) + 'L' + (x + half) + ' ' + (y + rise) + 'M' + (x + half) + ' ' + (y - rise) + 'L' + (x - half) + ' ' + (y + rise) + '" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>';
  };
  // A pine in three tiers, each wearing a scalloped cap of snow. It stands at y 150.
  const pine = (x, top, width) => {
    const n = (value) => +value.toFixed(1);
    const height = 150 - top;
    const tier = (apex, base, half) => '<path d="M' + n(x - half) + ' ' + n(base) + 'Q' + x + ' ' + n(base + 6) + ' ' + n(x + half) + ' ' + n(base) + 'L' + x + ' ' + n(apex) + 'Z" fill="#2b8a7e"' + ink('#17324a') + '/>' +
      '<path d="M' + x + ' ' + n(apex) + 'L' + n(x + half / 2) + ' ' + n((apex + base) / 2) + 'q' + n(-half / 4) + ' 5 ' + n(-half / 2) + ' 0q' + n(-half / 4) + ' 5 ' + n(-half / 2) + ' 0Z" fill="#fff" stroke="#17324a" stroke-width="2.5" stroke-linejoin="round"/>';
    return '<rect x="' + (x - 4) + '" y="' + n(top + height * .8) + '" width="8" height="' + n(height * .2 + 4) + '" fill="#7a4a2a"' + ink('#17324a') + '/>' +
      tier(top + height * .38, top + height * .86, width) + tier(top + height * .18, top + height * .62, width * .76) + tier(top, top + height * .36, width * .52);
  };
  // Pale blue on the shadow side, so each snowball reads round.
  const shade = (cx, cy, r) => {
    const at = (degrees) => (cx + Math.cos(degrees * Math.PI / 180) * (r - 1.5)).toFixed(1) + ' ' + (cy + Math.sin(degrees * Math.PI / 180) * (r - 1.5)).toFixed(1);
    return '<path d="M' + at(-30) + 'A' + (r - 1.5) + ' ' + (r - 1.5) + ' 0 0 1 ' + at(120) + 'A' + r * 1.25 + ' ' + r * 1.25 + ' 0 0 0 ' + at(-30) + 'Z" fill="#d6e4f5"/>';
  };
  const snowball = (cx, cy, r) => '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#fff"' + ink('#17324a') + '/>' + shade(cx, cy, r);
  const winter = svg('winter',
    [[24, 24, 6, 0], [92, 40, 5, 1.2], [146, 18, 6, 2.6], [156, 124, 5, .6], [124, 96, 4, 3.4], [290, 96, 5, 1.8]].map(([x, y, size, delay]) => flake(x, y, size, delay)).join('') +
    '<g fill="#fff">' + [[52, 58, 0], [130, 58, 1.6], [182, 34, 3], [270, 62, .8], [16, 96, 2.2], [254, 112, 3.8], [104, 18, 4.4]].map(([x, y, delay]) => '<circle class="sc-snow" style="animation-delay:' + delay + 's" cx="' + x + '" cy="' + y + '" r="2.5"/>').join('') + '</g>' +
    faded('winter-hills', '<path d="M0 150Q70 128 150 142T320 134V170H0Z" fill="#cfe0f2" opacity=".5"/>') +
    pine(56, 50, 34) + pine(108, 88, 22) +
    // sled, nose to the right
    '<path d="M254 148H302q10 0 10-10" fill="none" stroke="#17324a" stroke-width="3.5" stroke-linecap="round"/>' +
    '<path d="M264 134v13M294 134v13" stroke="#17324a" stroke-width="3" stroke-linecap="round"/>' +
    '<rect x="252" y="126" width="52" height="9" rx="4" fill="#d9824b"' + ink('#17324a') + '/>' +
    '<path d="M304 130q10-2 8-12" fill="none" stroke="#ffb02e" stroke-width="2.5" stroke-linecap="round"/>' +
    // snowman: twig arms behind, then the snowballs
    '<path d="M189 94L166 106M174 102l-3-8M170 104l-8-2" fill="none" stroke="#7a4a2a" stroke-width="3.5" stroke-linecap="round"/>' +
    '<g class="sc-tilt"><path d="M222 90L242 62M236 70l8-3M234 73l-2-9" fill="none" stroke="#7a4a2a" stroke-width="3.5" stroke-linecap="round"/>' +
      '<ellipse cx="245" cy="57" rx="6" ry="7" fill="#ff7a45" stroke="#17324a" stroke-width="2.5"/><ellipse cx="239" cy="59" rx="3" ry="4" fill="#ff7a45" stroke="#17324a" stroke-width="2.5"/></g>' +
    snowball(206, 125, 26) + snowball(206, 87, 19) +
    '<g fill="#2b3440"><circle cx="206" cy="84" r="3"/><circle cx="206" cy="96" r="3"/></g>' +
    snowball(206, 55, 15) +
    '<circle cx="200" cy="53" r="2.4" fill="#2b3440"/><circle cx="212" cy="53" r="2.4" fill="#2b3440"/>' +
    '<path d="M206 56l13 3-13 3z" fill="#ff8a3d" stroke="#17324a" stroke-width="2" stroke-linejoin="round"/>' +
    '<path d="M200 63q6 3 12 0" fill="none" stroke="#2b3440" stroke-width="2.4" stroke-linecap="round"/>' + blush([[195, 60], [217, 60]], 3) +
    // knitted hat and scarf
    '<path d="M192 46a14 12 0 0 1 28 0z" fill="#ff7a45"' + ink('#17324a') + '/>' +
    '<rect x="189" y="43" width="34" height="8" rx="4" fill="#ffb02e" stroke="#17324a" stroke-width="2.5"/>' +
    '<circle cx="206" cy="32" r="5" fill="#fff" stroke="#17324a" stroke-width="2.5"/>' +
    '<g class="sc-cape"><path d="M196 69L172 71L170 81L196 79Z" fill="#ffb02e" stroke="#17324a" stroke-width="2.5" stroke-linejoin="round"/>' +
      '<path d="M188 70v9.5M180 70.5v9.8" stroke="#ff7a45" stroke-width="3"/><path d="M170 73h-5M170 77h-5M170 81h-4" stroke="#17324a" stroke-width="2" stroke-linecap="round"/></g>' +
    '<rect x="190" y="68" width="32" height="10" rx="5" fill="#ffb02e" stroke="#17324a" stroke-width="2.5"/>' +
    '<path d="M200 68v10M212 68v10" stroke="#ff7a45" stroke-width="3"/>' +
    faded('winter-snow', '<path d="M0 152Q80 144 160 150T320 148V170H0Z" fill="#f4f8ff"/>'));

  // Quiet hobbies, for older learners and adults: muted fills, faces only on animals and
  // no cheeks, and few parts moving slowly.
  // `turned` places a path drawn in local units (stem joint at 0 0, tip toward −y) at x y,
  // turned `angle` degrees and scaled by `size`, so outlines keep their width.
  const turned = (x, y, angle, size, path) => {
    const turn = angle * Math.PI / 180; const cos = Math.cos(turn); const sin = Math.sin(turn);
    return path.replace(/(-?[\d.]+) (-?[\d.]+)/g, (_, px, py) => {
      const sx = px * size; const sy = py * size;
      return +(x + sx * cos - sy * sin).toFixed(1) + ' ' + +(y + sx * sin + sy * cos).toFixed(1);
    });
  };
  const monsteraPath = 'M0 -5C8 3 24 1 27 -13L13 -20L28 -24C30 -30 29 -34 25 -37L11 -35L20 -45C14 -50 6 -52 0 -52' +
    'C-6 -52 -14 -50 -20 -45L-11 -35L-25 -37C-29 -34 -30 -30 -28 -24L-13 -20L-27 -13C-24 1 -8 3 0 -5Z';
  // Leaves overlap, so each keeps its own outline and midrib, back to front.
  const monstera = (leaves) => '<g fill="#76a46c"' + ink('#1f3322') + '>' + leaves.map(([x, y, angle, size]) => '<path d="' + turned(x, y, angle, size, monsteraPath) + '"/>' +
    '<path d="' + turned(x, y, angle, size, 'M0 -6L0 -44') + '" stroke="#b0d19c" stroke-width="2.5" stroke-linecap="round"/>').join('') + '</g>';
  // Pothos leaves are hearts drawn long, so they read as leaves and never as the symbol.
  const pothosPath = 'M0 0C-6 2 -11 -4 -10 -10C-9 -16 -4 -20 0 -27C4 -20 9 -16 10 -10C11 -4 6 2 0 0Z';
  const pothos = (leaves, size) => '<g fill="#76a46c" stroke="#1f3322" stroke-width="2.5" stroke-linejoin="round">' + leaves.map(([x, y, angle]) => '<path d="' + turned(x, y, angle, size, pothosPath) + '"/>').join('') + '</g>' +
    '<path d="' + leaves.map(([x, y, angle]) => turned(x, y, angle, size, 'M0 -3L0 -19')).join('') + '" stroke="#b0d19c" stroke-width="2" stroke-linecap="round"/>';
  const monsteraLeaves = [[206, 92, -58, .9], [226, 74, -18, 1], [262, 84, 30, .95], [274, 104, 72, .8], [234, 100, 6, .6]];
  const houseplants = svg('houseplants',
    faded('sill', '<rect x="0" y="148" width="320" height="8" fill="#d9bd8f"/><rect x="0" y="156" width="320" height="14" fill="#b38b62"/>' +
      '<path d="M0 148H320" stroke="#1f3322" stroke-width="3"/><path d="M0 156H320" stroke="#1f3322" stroke-width="2" opacity=".5"/>') +
    // pothos in a macramé hanger
    '<g class="sc-swing">' +
      '<path d="M64 0V4" stroke="#1f3322" stroke-width="2.5" stroke-linecap="round"/><circle cx="64" cy="8" r="4" fill="none" stroke="#1f3322" stroke-width="2.5"/>' +
      '<path d="M62 12L44 46M64 12V46M66 12L84 46" stroke="#e9dcc3" stroke-width="2.5" stroke-linecap="round"/>' +
      '<path d="M54 28h20" stroke="#e9dcc3" stroke-width="5" stroke-linecap="round"/>' +
      '<path d="M42 48h44q0 22-22 22q-22 0-22-22z" fill="#b2c5c2"' + ink('#1f3322') + '/>' +
      '<rect x="39" y="43" width="50" height="8" rx="4" fill="#d6e2df"' + ink('#1f3322') + '/>' +
      '<path d="M64 70v12M60 70l-3 11M68 70l3 11" stroke="#e9dcc3" stroke-width="2.5" stroke-linecap="round"/>' +
      '<g fill="none" stroke="#5d8a55" stroke-width="3" stroke-linecap="round"><path d="M44 50C30 62 36 88 22 112"/><path d="M86 50C100 66 92 90 104 106"/></g>' +
      pothos([[37, 61, 215], [33, 77, 145], [31, 93, 215], [22, 111, 180], [93, 61, 145], [96, 77, 215], [98, 93, 150], [104, 106, 180], [50, 44, -35], [78, 44, 35], [64, 44, 0]], .62) +
    '</g>' +
    // cactus in flower
    tube('M124 114h5q5 0 5-6v-8', '#1f3322', '#7fa874', 12) + tube('M106 120h-4q-5 0-5-6v-5', '#1f3322', '#7fa874', 12) +
    '<rect x="105" y="90" width="20" height="44" rx="10" fill="#7fa874"' + ink('#1f3322') + '/>' +
    '<path d="M112 98v28M118 98v28" stroke="#acd09a" stroke-width="2" stroke-linecap="round"/>' +
    '<path d="' + burst(115, 86, 8, 4.5, 5) + '" fill="#e3a1ab"' + ink('#1f3322') + '/><circle cx="115" cy="86" r="2.6" fill="#f2d27e"/>' +
    '<path d="M100 132L104 150H126L130 132Z" fill="#d3a24f"' + ink('#1f3322') + '/><rect x="97" y="126" width="36" height="8" rx="3" fill="#e6c27e"' + ink('#1f3322') + '/>' +
    // a cutting rooting in a jar of water
    tube('M164 130C164 118 160 112 162 104', '#1f3322', '#5d8a55', 8) +
    pothos([[162, 106, -50], [162, 104, 40]], .55) +
    '<rect x="150" y="114" width="28" height="36" rx="5" fill="#d8e6e2"' + ink('#1f3322') + '/>' +
    '<path d="M153 126h22v18q0 3-3 3h-16q-3 0-3-3z" fill="#b9d2cd"/>' +
    '<path d="M164 126v10M164 132q-4 4-5 10M164 132q4 3 4 9" fill="none" stroke="#f3ead6" stroke-width="2" stroke-linecap="round"/>' +
    // monstera, leaves swaying together over the pot
    '<g class="sc-tilt">' +
      tube(monsteraLeaves.map(([x, y, angle]) => 'M' + (236 + angle / 12).toFixed(1) + ' 112Q' + ((236 + x) / 2) + ' ' + (y + 10) + ' ' + x + ' ' + y).join(''), '#1f3322', '#5d8a55', 10) +
      monstera(monsteraLeaves) +
    '</g>' +
    '<path d="M212 116L218 150H262L268 116Z" fill="#ebe1cf"' + ink('#1f3322') + '/>' +
    '<g fill="#b8a487">' + [[222, 126], [236, 140], [250, 124], [258, 138], [228, 144], [244, 130]].map(([x, y]) => '<circle cx="' + x + '" cy="' + y + '" r="1.6"/>').join('') + '</g>' +
    '<rect x="206" y="106" width="68" height="12" rx="5" fill="#f6efe2"' + ink('#1f3322') + '/>');

  const steam = (x, y, delay) => '<path class="sc-steam" style="animation-delay:' + delay + 's" d="M' + x + ' ' + y + 'q-6-7 0-13t0-13" fill="none" stroke="#f3e6c8" stroke-width="3" stroke-linecap="round" opacity=".8"/>';
  // A book lying flat, spine out: a label in the middle and a band near each end.
  const book = (x, y, width, height, fill) => '<rect x="' + x + '" y="' + y + '" width="' + width + '" height="' + height + '" rx="3" fill="' + fill + '"' + ink('#2d1a2a') + '/>' +
    '<path d="M' + (x + 9) + ' ' + (y + 2) + 'v' + (height - 4) + 'M' + (x + width - 9) + ' ' + (y + 2) + 'v' + (height - 4) + '" stroke="#efe2c8" stroke-width="2.5"/>' +
    '<rect x="' + (x + width / 2 - 13) + '" y="' + (y + height / 2 - 3) + '" width="26" height="6" rx="1.5" fill="#efe2c8"/>';
  const books = svg('books',
    '<path d="M30 26a14 14 0 1 0 14 22a11 11 0 1 1-14-22z" fill="#f3e6c8"/>' +
    '<g fill="#f3e6c8">' + [[76, 22, 0], [150, 18, 2.2]].map(([x, y, delay]) => '<circle class="sc-twinkle" style="animation-delay:' + delay + 's" cx="' + x + '" cy="' + y + '" r="1.8"/>').join('') +
      '<circle cx="110" cy="44" r="1.8"/><circle cx="182" cy="54" r="1.8"/></g>' +
    faded('table', '<rect x="0" y="148" width="320" height="7" fill="#a8775a"/><rect x="0" y="155" width="320" height="15" fill="#7c5143"/>' +
      '<path d="M0 148H320" stroke="#2d1a2a" stroke-width="3"/>') +
    // teapot: spout and handle behind the body
    tube('M110 134C126 130 126 112 138 104', '#2d1a2a', '#9cc4bd', 13) +
    '<path d="M134 101l9-3" stroke="#2d1a2a" stroke-width="5" stroke-linecap="round"/>' +
    tube('M58 112C34 106 32 142 56 140', '#2d1a2a', '#9cc4bd', 11) +
    '<ellipse cx="84" cy="126" rx="34" ry="24" fill="#9cc4bd"' + ink('#2d1a2a') + '/>' +
    '<path d="M52 122q32 12 64 0" fill="none" stroke="#cfe3dc" stroke-width="6" stroke-linecap="round"/>' +
    '<path d="M66 104a18 13 0 0 1 36 0z" fill="#cfe3dc"' + ink('#2d1a2a') + '/><circle cx="84" cy="89" r="4.5" fill="#cfe3dc"' + ink('#2d1a2a') + '/>' +
    // a cup of tea, steaming
    steam(156, 114, 0) + steam(168, 110, 2.5) +
    '<ellipse cx="162" cy="148" rx="25" ry="4.5" fill="#e9dfcf"' + ink('#2d1a2a') + '/>' +
    tube('M176 128q10 0 10 7t-10 7', '#2d1a2a', '#f3ead9', 9) +
    '<path d="M146 122h32v10q0 14-16 14q-16 0-16-14z" fill="#f3ead9"' + ink('#2d1a2a') + '/>' +
    '<path d="M147 130h30" stroke="#9cc4bd" stroke-width="4"/>' +
    '<ellipse cx="162" cy="122" rx="14.5" ry="2.6" fill="#b5764a"/>' +
    // the stack, a ribbon marking a place
    book(188, 132, 116, 18, '#cf9f4a') + book(198, 116, 98, 16, '#b0634a') +
    '<path d="M268 130v14l3-3 3 3v-14" fill="#d9c27a" stroke="#2d1a2a" stroke-width="2" stroke-linejoin="round"/>' +
    book(192, 102, 98, 14, '#8aa97f') +
    // a ginger cat asleep on top
    '<g class="sc-breathe">' +
      '<path d="M206 102C204 80 226 70 250 70C274 70 290 82 288 102Z" fill="#d79c63"' + ink('#2d1a2a') + '/>' +
      '<path d="M244 76q4 6 2 12M258 74q4 6 2 12M272 80q3 5 1 10" fill="none" stroke="#b5743f" stroke-width="3" stroke-linecap="round"/>' +
      tube('M286 96C290 108 252 108 232 101', '#2d1a2a', '#d79c63', 12) +
      '<path d="M210 80L207 64L220 75ZM226 75L234 63L236 80Z" fill="#d79c63"' + ink('#2d1a2a') + '/>' +
      '<circle cx="222" cy="88" r="14" fill="#d79c63"' + ink('#2d1a2a') + '/>' +
      '<ellipse cx="222" cy="95" rx="7.5" ry="5" fill="#f2d9b8"/>' +
      '<path d="M211 87q3 3 6 0M227 87q3 3 6 0" fill="none" stroke="#2d1a2a" stroke-width="2.2" stroke-linecap="round"/>' +
      '<path d="M220 92h4l-2 2.5z" fill="#2d1a2a" stroke="#2d1a2a" stroke-width="1.5" stroke-linejoin="round"/>' +
    '</g>');

  // The Plough, handle to bowl, then the bowl closed back to its first star.
  const plough = [[24, 46], [44, 30], [66, 24], [88, 30], [126, 18], [130, 50], [94, 56]];
  const stargazing = svg('stargazing',
    '<g fill="#e9e2cf" opacity=".7">' + [[150, 12], [200, 24], [16, 84], [150, 74], [300, 70], [252, 56], [118, 96], [8, 22]].map(([x, y]) => '<circle cx="' + x + '" cy="' + y + '" r="1.3"/>').join('') + '</g>' +
    '<path d="M' + plough.map((point) => point.join(' ')).join('L') + 'L88 30" fill="none" stroke="#e9e2cf" stroke-width="1.5" stroke-linejoin="round" opacity=".4"/>' +
    plough.map(([x, y], index) => index % 3 ? '<circle cx="' + x + '" cy="' + y + '" r="2.4" fill="#fff3d6"/>' : sparkle(x, y, 5.5, '#fff3d6', index * .9)).join('') +
    '<path d="M160 32l22-12" stroke="#e9e2cf" stroke-width="2" stroke-linecap="round" opacity=".5"/>' + sparkle(184, 19, 4, '#fff', 1.6) +
    '<path d="M38 88a14 14 0 1 0 14 22a11 11 0 1 1-14-22z" fill="#f3e6c4"/>' +
    faded('stargazing-back-hill', '<path d="M0 134Q60 112 120 128T230 146V170H0Z" fill="#33426f" opacity=".75"/>') +
    // a cabin on the far hill, one window lit
    '<path d="M68 126V112l10-8 10 8v14z" fill="#24305a" stroke="#121a33" stroke-width="2.5" stroke-linejoin="round"/><rect x="75" y="114" width="6" height="6" rx="1" fill="#ffe08a"/>' +
    faded('stargazing-hill', '<path d="M0 156Q90 140 190 147T320 142V170H0Z" fill="#141c36"/>') +
    // fox, from behind, watching the sky; the tail sweeps round
    '<g class="sc-sway"><path d="M160 148C140 154 116 152 110 141C106 132 118 126 128 132C136 138 146 140 162 138Z" fill="#c97a4a"' + ink('#121a33') + '/>' +
      '<path d="M110 141C106 132 118 126 128 132C122 136 118 142 120 148C114 147 111 144 110 141Z" fill="#f1e2cc"' + ink('#121a33') + '/></g>' +
    '<path d="M150 149C142 130 148 110 166 106C184 110 192 130 184 149Z" fill="#c97a4a"' + ink('#121a33') + '/>' +
    '<path d="M155 84L151 63L166 79ZM168 79L175 61L180 85Z" fill="#c97a4a"' + ink('#121a33') + '/>' +
    '<path d="M152.6 71.5L151 63L157 69.5ZM172.3 68L175 61L176.4 70Z" fill="#3b2a2c"/>' +
    '<path d="M155 86L139 75Q136 74 137 77L156 97Z" fill="#c97a4a"' + ink('#121a33') + '/><circle cx="138" cy="76" r="2.6" fill="#121a33"/>' +
    '<circle cx="166" cy="94" r="15" fill="#c97a4a"' + ink('#121a33') + '/>' +
    // tripod and telescope
    tube('M232 98L208 149M232 98L236 149M232 98L264 149', '#121a33', '#9a7550', 10) +
    '<path d="M220 124h28" stroke="#121a33" stroke-width="3" stroke-linecap="round"/>' +
    '<rect x="225" y="84" width="14" height="14" rx="3" fill="#5a4632"' + ink('#121a33') + '/>' +
    '<g transform="rotate(28 274 96)">' +
      '<path d="M224 80v7M244 80v7" stroke="#121a33" stroke-width="2.5"/><rect x="220" y="75" width="30" height="7" rx="3" fill="#d1a95f"' + ink('#121a33') + '/>' +
      '<rect x="190" y="87" width="80" height="18" rx="4" fill="#d1a95f"' + ink('#121a33') + '/>' +
      '<path d="M212 89v14M250 89v14" stroke="#ecd29a" stroke-width="5"/>' +
      '<rect x="270" y="91" width="10" height="10" rx="2" fill="#5a4632"' + ink('#121a33') + '/><rect x="279" y="93" width="8" height="6" rx="2" fill="#5a4632" stroke="#121a33" stroke-width="2.5"/>' +
      '<rect x="168" y="84" width="26" height="24" rx="4" fill="#d1a95f"' + ink('#121a33') + '/>' +
      '<rect x="164" y="86" width="7" height="20" rx="3" fill="#9fb4dc"' + ink('#121a33') + '/>' +
    '</g>');

  const flyer = (x, y) => '<path d="M' + x + ' ' + y + 'q5-6 10 0q5-6 10 0" fill="none" stroke="#e8efe9" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>';
  const robinBody = '<ellipse cx="232" cy="82" rx="27" ry="22"/><circle cx="212" cy="66" r="15"/>';
  const birds = svg('birds',
    '<g class="sc-drift">' + flyer(30, 34) + flyer(56, 24) + flyer(80, 40) + '</g>' +
    '<g class="sc-drift" style="animation-direction:alternate-reverse">' + cloud(160, 42, '#163033', .8, '#e8efe9') + '</g>' +
    faded('birds-meadow', '<path d="M0 150Q80 140 160 148T320 144V170H0Z" fill="#8fa66b"/>' +
      '<g fill="none" stroke="#6f8a52" stroke-width="2.5" stroke-linecap="round">' + [18, 132, 196, 300].map((x) => '<path d="M' + x + ' 156l-3-9M' + (x + 4) + ' 156l1-11M' + (x + 8) + ' 156l4-8"/>').join('') + '</g>') +
    // a birdhouse on a pole, someone peeking out
    '<rect x="66" y="104" width="8" height="46" fill="#9c7a58"' + ink('#163033') + '/>' +
    '<path d="M48 108V74L70 56L92 74V108Z" fill="#e7dcc6"' + ink('#163033') + '/>' +
    '<path d="M40 78L70 50L100 78" fill="none" stroke="#163033" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/><path d="M40 78L70 50L100 78" fill="none" stroke="#6f9a8a" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<circle cx="70" cy="84" r="9" fill="#2a3b3a"' + ink('#163033') + '/>' +
    '<circle cx="70" cy="86" r="6.5" fill="#f4f1e8"/><path d="M63.5 84a6.5 6.5 0 0 1 13 0z" fill="#6f95bd"/><path d="M64 86.5h12" stroke="#2a3b3a" stroke-width="1.6"/>' +
    '<circle cx="68" cy="87" r="1.4" fill="#163033"/><path d="M65 89l-3 1 3 1z" fill="#2a3b3a"/>' +
    '<path d="M70 98v6" stroke="#163033" stroke-width="3" stroke-linecap="round"/>' +
    // a feather drifting down
    '<g class="sc-flutter" style="animation-delay:1s"><path d="M138 66c8 6 10 16 6 24c-8-6-10-16-6-24z" fill="#f1ece0" stroke="#163033" stroke-width="2" stroke-linejoin="round"/><path d="M139 70q3 10 3 24" fill="none" stroke="#163033" stroke-width="2" stroke-linecap="round"/></g>' +
    // binoculars set down in the grass, strap looped beside them
    '<path d="M264 146q-16 10 4 12q30 4 38-10" fill="none" stroke="#6b4a3a" stroke-width="2.5" stroke-linecap="round"/>' +
    '<g' + ink('#163033') + '><rect x="265" y="111" width="12" height="12" rx="3" fill="#3b3734"/><rect x="293" y="111" width="12" height="12" rx="3" fill="#3b3734"/>' +
      '<rect x="262" y="120" width="18" height="30" rx="5" fill="#7d5a43"/><rect x="290" y="120" width="18" height="30" rx="5" fill="#7d5a43"/>' +
      '<rect x="279" y="126" width="12" height="12" rx="2" fill="#3b3734"/><rect x="281" y="115" width="8" height="10" rx="2" fill="#a98366"/></g>' +
    '<path d="M265 141h12M293 141h12" stroke="#a98366" stroke-width="3.5"/>' +
    // fence post, and the robin on it facing into the banner
    '<rect x="218" y="112" width="26" height="38" rx="2" fill="#9c7a58"' + ink('#163033') + '/><rect x="215" y="106" width="32" height="8" rx="3" fill="#bf9c76"' + ink('#163033') + '/>' +
    '<path d="M228 122v14" stroke="#bf9c76" stroke-width="2.5" stroke-linecap="round"/>' +
    '<path d="M224 101l-2 5M236 101l-1 5" stroke="#163033" stroke-width="2.5" stroke-linecap="round"/>' +
    '<g class="sc-nod">' +
      '<path d="M254 88L276 100L270 106L248 96Z" fill="#7a6248"' + ink('#163033') + '/>' +
      '<g fill="#163033" stroke="#163033" stroke-width="6">' + robinBody + '</g><g fill="#8f7556">' + robinBody + '</g>' +
      '<path d="M200 58Q207 53 216 60Q222 70 226 82Q232 94 240 98Q226 102 214 96Q206 90 206 82Q203 76 199 68Z" fill="#d9824e"/>' +
      '<path d="M234 74Q252 72 260 88Q248 94 236 86Z" fill="#7a6248"/>' +
      '<circle cx="207" cy="62" r="2.6" fill="#163033"/>' +
      '<path d="M198 63L189 66L198 69Z" fill="#4a3b2e" stroke="#163033" stroke-width="2" stroke-linejoin="round"/>' +
    '</g>');

  return { trains, dinosaurs, unicorns, space, construction, ocean, pirates, heroes, robots, princesses, pets, horses, bugs, jungle, dragons, cars, games, bricks, sweets, weather, spring, summer, autumn, winter, houseplants, books, stargazing, birds };
})();
