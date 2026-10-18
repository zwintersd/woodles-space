// Illustrated banners for some themes, drawn for a 320×170 box like the
// original ticket scene. Constant markup only: nothing here comes from a plan.
// Moving parts carry sc-* classes; scenes.css animates them when motion is on.
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
  const cloud = (x, y) => '<path d="M' + (x - 26) + ' ' + y + 'a12 12 0 0 1 8-20a15 15 0 0 1 28-4a12 12 0 0 1 16 12a10 10 0 0 1 0 12z" fill="#fff" stroke="#8a5cc2" stroke-width="2.5" stroke-linejoin="round"/>';
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

  // The remaining interest banners use the same outlined, gently moving art.
  const eyes = (x, y, gap = 18, color = '#302b38') => '<g fill="' + color + '" stroke="none"><circle cx="' + x + '" cy="' + y + '" r="3"/><circle cx="' + (x + gap) + '" cy="' + y + '" r="3"/></g>';
  const meadow = (id) => faded(id, '<path d="M0 152Q80 126 166 148T320 140V170H0Z" fill="#a7cf72" opacity=".65"/>');
  const pets = svg('pets', meadow('pet-ground') +
    '<g class="sc-bob"' + ink('#623b30') + '><path d="M40 96Q28 45 62 60L78 83M114 83Q139 45 148 76L138 106" fill="#925a37"/><rect x="53" y="70" width="84" height="76" rx="34" fill="#f6c88c"/><ellipse cx="94" cy="122" rx="26" ry="18" fill="#fff2db"/><path d="M85 112h18l-9 9z" fill="#623b30"/><path d="M94 122v7q-8 9-15 0m15 0q8 9 15 0" fill="none"/>' + eyes(77, 100, 34, '#623b30') + '</g>' +
    '<g class="sc-nod"' + ink('#623b30') + '><path d="M191 90l-3-41 32 24h31l30-24-3 48" fill="#e7e5f5"/><rect x="184" y="73" width="98" height="72" rx="33" fill="#e7e5f5"/><path d="M200 68l-3-10 15 12m48 0 12-12-2 13" stroke="#d4879f"/><path d="M229 113h9l-5 6z" fill="#d4879f"/><path d="M192 116l-19-5m20 15-20 2m100-12 19-5m-20 15 20 2" fill="none"/>' + eyes(213, 103, 38, '#623b30') + '</g>' +
    '<g class="sc-rock"' + ink('#803560') + '><circle cx="157" cy="141" r="16" fill="#f49bb8"/><path d="M144 133q22 0 24 17m-26-8q20-17 25-3m-15-13q-9 19 5 28" fill="none"/></g>');

  const horses = svg('horses', meadow('paddock') +
    '<g' + ink('#dfbb80') + '><path d="M18 104h284m-284 23h284M36 87v65m68-65v65m108-65v65m70-65v65" fill="none" stroke-width="6"/></g>' +
    '<g' + ink('#482d23') + '><path d="M97 103Q73 75 59 97q-8 20-17 24 28 9 43-9" fill="#513c32"/><path d="M100 133v17h15v-17M158 133v17h15v-20" fill="#c88a50"/><path d="M86 109q5-24 44-21h35l13-46 29-3 21 41-18 14-18-23-13 56q-4 17-39 17h-27q-29 0-27-35z" fill="#c88a50"/><path d="M178 48l8-25 12 17m5-2 11-17 4 29" fill="#c88a50"/><path d="M176 45q-17 7-17 46l17 7 10-48" fill="#513c32"/><path d="M206 55l13 25-9 8-16-26" fill="#fff1dc"/><circle cx="202" cy="53" r="3" fill="#482d23"/><path d="M121 88h39v29h-39z" fill="#af3e44"/></g>' +
    '<rect x="239" y="117" width="57" height="36" rx="7" fill="#efca64"' + ink('#9b732d') + '/><path d="M250 118v35m16-35v35m16-35v35" stroke="#bf963d" stroke-width="3"/>');

  const bugs = svg('bugs', meadow('garden') +
    '<path d="M68 155V97m172 58V97" fill="none" stroke="#c3e58e" stroke-width="5"/>' +
    [68, 240].map(x => '<g fill="#ffe58b">' + range(6).map(i => '<ellipse cx="' + x + '" cy="83" rx="9" ry="18" transform="rotate(' + (i * 60) + ' ' + x + ' 97)"/>').join('') + '<circle cx="' + x + '" cy="97" r="12" fill="#e6a43d"/></g>').join('') +
    '<g class="sc-bob"' + ink('#3c355c') + '><path d="M151 61C90 7 88 100 145 94c-45 30-5 69 18 23 22 46 62 7 18-23 57 6 55-87-6-33z" fill="#c3a0f4"/><path d="M151 70q-34-30-38-2t38 15m24-13q34-30 38-2t-38 15" fill="#ffb4d7"/><rect x="151" y="55" width="24" height="65" rx="12" fill="#ffe58b"/><path d="M158 56l-9-17m19 17 9-17" fill="none"/>' + eyes(158, 67, 10, '#3c355c') + '</g>' +
    '<g class="sc-rock"' + ink('#28342b') + '><circle cx="87" cy="140" r="16" fill="#f76c66"/><path d="M87 124v32"/><circle cx="87" cy="123" r="7" fill="#28342b"/><circle cx="79" cy="137" r="3"/><circle cx="95" cy="145" r="3"/></g>');

  const jungle = svg('jungle', meadow('safari') +
    '<g' + ink('#194b37') + '><path d="M38 150l6-90m242 90-9-98" fill="none" stroke="#b78a55" stroke-width="9"/><path d="M44 60Q6 28 5 76q20-16 39-16Q22 9 74 21L44 60q41-35 48 5-26-10-48-5m233-8q-36-32-44 11 21-14 44-11-18-41 18-39l-18 39q30-26 41 9-25-10-41-9" fill="#72b86e"/></g>' +
    '<g class="sc-bob"' + ink('#633a24') + '><circle cx="122" cy="99" r="50" fill="#ba683b"/><circle cx="122" cy="100" r="34" fill="#ffd075"/><circle cx="98" cy="77" r="9" fill="#ffd075"/><circle cx="146" cy="77" r="9" fill="#ffd075"/><ellipse cx="122" cy="119" rx="19" ry="14" fill="#fff0c7"/><path d="M115 112h14l-7 8z" fill="#633a24"/><path d="M122 120v8"/>' + eyes(108, 98, 28, '#633a24') + '</g>' +
    '<g class="sc-nod"' + ink('#633a24') + '><circle cx="215" cy="96" r="33" fill="#ab784f"/><circle cx="184" cy="91" r="12" fill="#eaca92"/><circle cx="246" cy="91" r="12" fill="#eaca92"/><path d="M191 89q8-14 24-2 17-12 25 2v21q-25 31-49 0z" fill="#eaca92"/><path d="M207 114q8 7 16 0" fill="none"/>' + eyes(205, 96, 20, '#633a24') + '</g>');

  // Rounded resting dragon: rear wing on the torso; tube neck under the head.
  // All callers use fixed colours. Its head alone nods from the neck joint.
  const sleepyDragon = (fill, belly, wing, stroke) =>
    '<path d="M220 134C201 154 178 150 181 133q3-14 15-8" fill="none" stroke="' + stroke + '" stroke-width="17" stroke-linecap="round"/><path d="M220 134C201 154 178 150 181 133q3-14 15-8" fill="none" stroke="' + fill + '" stroke-width="11" stroke-linecap="round"/>' +
    '<path d="M266 124Q287 127 304 111q-12-2-9-18-23 4-33 28z" fill="' + wing + '"' + ink(stroke) + '/>' +
    '<path d="M257 116C257 103 249 96 241 90" fill="none" stroke="' + stroke + '" stroke-width="32" stroke-linecap="round"/><path d="M257 116C257 103 249 96 241 90" fill="none" stroke="' + fill + '" stroke-width="26" stroke-linecap="round"/>' +
    '<g' + ink(stroke) + '><rect x="217" y="135" width="23" height="15" rx="7" fill="' + fill + '"/><rect x="267" y="135" width="23" height="15" rx="7" fill="' + fill + '"/><ellipse cx="249" cy="124" rx="44" ry="23" fill="' + fill + '"/><ellipse cx="241" cy="130" rx="22" ry="13" fill="' + belly + '" stroke="none"/></g>' +
    '<g class="sc-nod"' + ink(stroke) + '><path d="M232 60l4-17 12 16m8 4 13-15 2 22" fill="#ffd43b"/><path d="M267 80C266 62 253 56 237 58q-22 0-24 17-20-1-21 14-1 16 22 18h28q32-4 25-27z" fill="' + fill + '"/><path d="M231 79q7 7 14 0M204 97q9 5 17 0" fill="none" stroke-width="2.5" stroke-linecap="round"/><circle cx="202" cy="87" r="2.2" fill="' + stroke + '" stroke="none"/><circle cx="227" cy="91" r="5" fill="#ffb3cf" opacity=".8" stroke="none"/></g>';

  const dragons = svg('dragons',
    sparkle(145, 39, 8, '#fff6b0', .4) + meadow('quest') +
    '<g' + ink('#35305c') + '><rect x="28" y="88" width="92" height="62" fill="#cdc5e7"/><path d="M22 89V67h14v10h14V67h14v10h14V67h14v10h14V67h20v22z" fill="#cdc5e7"/><path d="M60 150v-28a13 13 0 0 1 26 0v28z" fill="#635192"/><path d="M43 107v-8m63 8v-8" stroke="#ffd43b" stroke-width="7" stroke-linecap="round"/></g>' +
    flag(73, 38, '#ffd43b', '#35305c') +
    sleepyDragon('#f2c570', '#fff1cd', '#ce95e2', '#63432d'));

  const cars = svg('cars', faded('street', '<rect x="0" y="139" width="320" height="25" rx="12" fill="#1a2433"/><path d="M8 154h30m20 0h30m20 0h30m20 0h30m20 0h30m20 0h30" stroke="#ffda6b" stroke-width="3"/>') +
    '<g' + ink('#192b43') + '><path d="M24 113l17-32h48l25 32 8 1v24H19v-20z" fill="#ffcf58"/><path d="M46 88h16v23H35zm22 0h17l18 23H68z" fill="#bdeafb"/><path d="M24 126h12m71 0h12" stroke="#fff4cf" stroke-width="5"/></g>' +
    '<g' + ink('#192b43') + '><rect x="147" y="73" width="102" height="63" rx="6" fill="#f67465"/><path d="M249 93h34l19 25v18h-53z" fill="#d84d48"/><path d="M257 100h22l13 18h-35z" fill="#bdeafb"/><path d="M154 84h85m-85 12h85m-85 12h85" stroke="#ffcf58" stroke-width="4"/><path d="M175 63h66" stroke="#dce4ed" stroke-width="7"/></g>' +
    [41, 101, 170, 233, 282].map(x => '<circle cx="' + x + '" cy="137" r="11" fill="#192b43"/><circle cx="' + x + '" cy="137" r="5" fill="#dce4ed"/>').join(''));

  const games = svg('games',
    '<g fill="#7b5fce" opacity=".6">' + range(8).map(i => '<rect x="' + (24 + i * 38) + '" y="154" width="30" height="10"/>').join('') + '</g>' +
    '<g class="sc-bob" fill="#9af78e"><path d="M68 43h12v12h12V43h12v12h12v12h12v48h-12v12h-12v-24H80v24H68v-12H56V67h12V55h12z"/><path d="M74 78h12v12H74zm30 0h12v12h-12z" fill="#30234e"/></g>' +
    '<g class="sc-pulse" fill="#ffdb64"><path d="M156 68h12V56h36v12h12v48h-12v12h-36v-12h-12z"/><path d="M180 72h12v40h-12z" fill="#c78d35"/></g>' +
    '<g fill="#ec9ed8"><path d="M243 110h12V98h36v12h12v36h-60z"/><path d="M255 98V86h24v12zm-12 48v12h24v-12m24 0v12h12v-12"/><path d="M255 119h12v12h-12zm24 0h12v12h-12z" fill="#30234e"/></g>' +
    sparkle(254, 39, 11, '#e8e0ff', .5) + sparkle(36, 129, 7, '#ffdb64', 1));

  const brick = (x, y, w, color) => '<g' + ink('#38304a') + '><path d="M' + x + ' ' + y + 'l12-10h' + w + 'l-12 10z" fill="' + color + '"/><rect x="' + x + '" y="' + y + '" width="' + w + '" height="28" rx="3" fill="' + color + '"/>' + range(Math.floor(w / 24)).map(i => '<ellipse cx="' + (x + 16 + i * 24) + '" cy="' + (y - 8) + '" rx="8" ry="4" fill="' + color + '"/>').join('') + '</g>';
  const bricks = svg('bricks',
    brick(26, 125, 96, '#f26c65') + brick(126, 125, 72, '#77c4f2') + brick(202, 125, 72, '#ffcf5c') +
    brick(62, 87, 72, '#ffcf5c') + brick(140, 87, 96, '#84d69b') +
    '<g class="sc-bob">' + brick(102, 49, 96, '#77c4f2') + '</g>' + sparkle(259, 57, 12, '#fff4bf', .6));

  const sweets = svg('sweets',
    '<ellipse cx="157" cy="153" rx="137" ry="11" fill="#ffdfc6" opacity=".55"/>' +
    '<g class="sc-bob"' + ink('#74394a') + '><path d="M45 101l10 47h62l10-47z" fill="#f8ca74"/><path d="M68 111l4 28m17-28v28m17-28-4 28" fill="none" stroke="#cb964f"/><path d="M38 99q-4-18 16-22-4-19 18-23 0-19 17-26 0 18 18 22 19 5 17 24 20 7 10 25z" fill="#ffbdd6"/><circle cx="89" cy="30" r="8" fill="#e65067"/></g>' +
    '<g class="sc-rock"' + ink('#74394a') + '><circle cx="193" cy="113" r="37" fill="#e7b073"/><circle cx="193" cy="113" r="24" fill="#f7d297"/><path d="M175 96l7 4m20-4 6 4m-32 20 5 5m25-12 6 4m-17 17 6 1" stroke="#74394a" stroke-width="6" stroke-linecap="round"/></g>' +
    '<path d="M273 80v70" stroke="#fff3d7" stroke-width="7"/>' +
    '<g class="sc-sway"' + ink('#74394a') + '><circle cx="273" cy="60" r="30" fill="#ffdc82"/><path d="M273 60q-16-16 0-20 21 1 20 21-1 27-31 26-32-6-25-35" fill="none" stroke="#f078a1" stroke-width="9"/></g>');

  const weather = svg('weather',
    '<g fill="none" stroke-width="13"><path d="M94 145a91 91 0 0 1 182 0" stroke="#ff929a"/><path d="M107 145a78 78 0 0 1 156 0" stroke="#ffdc7d"/><path d="M120 145a65 65 0 0 1 130 0" stroke="#96e2bb"/><path d="M133 145a52 52 0 0 1 104 0" stroke="#a7cdff"/></g>' +
    '<g class="sc-rock" stroke="#ffdc7d" stroke-width="5" stroke-linecap="round">' + range(8).map(i => '<path d="M63 14v10" transform="rotate(' + (i * 45) + ' 63 56)"/>').join('') + '<circle cx="63" cy="56" r="26" fill="#ffdc7d"' + ink('#d69832') + '/>' + eyes(55, 53, 16, '#d69832') + '</g>' +
    '<g class="sc-bob"><path d="M219 95q-22 0-21-18t22-19q4-25 26-22 19 1 22 22 26-4 29 18 2 19-22 19z" fill="#f3f7ff"' + ink('#a9bddd') + '/></g>' +
    '<path d="M224 108l-4 9m26-9-4 9m26-9-4 9" stroke="#a7cdff" stroke-width="5" stroke-linecap="round"/>');

  const mushroomHouse = (x, y, size, cap) => '<g transform="translate(' + x + ' ' + y + ') scale(' + size + ')"' + ink('#533c35') + '>' +
    '<path d="M-28 0l4 56q24 8 48 0l4-56z" fill="#fff0d1"/><path d="M-46 0q3-48 46-48T46 0q-46 13-92 0z" fill="' + cap + '"/>' +
    '<g fill="#fff0d1" stroke="none"><ellipse cx="-24" cy="-14" rx="9" ry="7"/><ellipse cx="7" cy="-31" rx="10" ry="8"/><ellipse cx="28" cy="-10" rx="7" ry="6"/></g>' +
    '<path d="M-12 59V36a12 12 0 0 1 24 0v23z" fill="#986741"/><circle cx="6" cy="43" r="2" fill="#ffe28c" stroke="none"/>' +
    '<circle cx="-17" cy="16" r="6" fill="#ffd675"/><path d="M-23 16h12m-6-6v12" fill="none" stroke-width="2"/></g>';
  const mushroom = svg('mushroom', meadow('mushroom-moss') +
    '<path d="M135 147q-12 5-20 11h64q-10-6-18-11z" fill="#dbc49b" opacity=".9"/>' +
    mushroomHouse(55, 112, .64, '#e9a358') + mushroomHouse(246, 109, .7, '#a68bd2') + mushroomHouse(145, 91, 1, '#e36d68') +
    '<g class="sc-sway"' + ink('#533c35') + '><path d="M210 148V82q0-12-14-12" fill="none" stroke-width="4"/><path d="M189 76h17l3 25h-23z" fill="#ffe18d"/><path d="M188 76l9-8 10 8M197 80v17" fill="none"/><circle class="sc-twinkle" cx="197" cy="87" r="4" fill="#fff9ce" stroke="none"/></g>' +
    '<g class="sc-swim"' + ink('#533c35') + '><path d="M237 149q4-12 22-12h26l8-12q8-7 13 1v23z" fill="#e4c389"/><circle cx="260" cy="135" r="18" fill="#c593bf"/><path d="M260 135q-9-12-13 0t12 11q15-4 9-15" fill="none" stroke-width="2.5"/><path d="M297 128l-3-10m9 11 6-10" fill="none"/><circle cx="294" cy="116" r="2.5" fill="#533c35"/><circle cx="309" cy="117" r="2.5" fill="#533c35"/></g>' +
    '<g fill="#fff1bc"><circle class="sc-twinkle" cx="24" cy="62" r="2.5"/><circle class="sc-twinkle" style="animation-delay:1s" cx="217" cy="32" r="3"/><circle class="sc-twinkle" style="animation-delay:1.8s" cx="294" cy="70" r="2.5"/></g>');

  // A sleepy dragon reading by lamplight. Dragon: 169–304 × 43–150;
  // books and lamp: 18–195 × 38–152. Feet and books meet the rug at 150.
  const library = svg('library',
    sparkle(134, 45, 7, '#fff6b0', .4) + sparkle(186, 27, 5, '#fff6b0', 1.1) +
    faded('library-rug', '<ellipse cx="166" cy="154" rx="148" ry="10" fill="#c88b71" opacity=".45"/>') +
    '<g' + ink('#493846') + '><path d="M50 146V68l25-23" fill="none" stroke-width="5" stroke-linecap="round"/><path d="M59 45q9-16 23-5l17 16-25 19z" fill="#ffd43b"/><ellipse cx="50" cy="146" rx="20" ry="4" fill="#9390c4"/></g>' +
    '<g' + ink('#493846') + '><rect x="21" y="130" width="88" height="18" rx="4" fill="#8bb6a0"/><rect x="28" y="111" width="76" height="18" rx="4" fill="#d98b91"/><rect x="18" y="93" width="86" height="17" rx="4" fill="#9390c4"/><path d="M29 139h70m-63-19h60m-70-19h68" fill="none" stroke="#fff3d9" stroke-width="3" stroke-linecap="round"/></g>' +
    sleepyDragon('#a8d4b0', '#d7e9c2', '#d0aacd', '#325b45') +
    '<g' + ink('#493846') + '><path d="M109 135q21-9 43 0 21-9 43 0v17q-21-9-43-1-22-8-43 1z" fill="#fff3d9"/><path d="M152 135v16m-35-9q13-3 25 0m20 0q12-3 25 0" fill="none" stroke-width="2" stroke-linecap="round"/><path d="M142 135v12l5-3 5 3v-12" fill="#d98b91" stroke="none"/></g>');

  const duckling = (x, y, size) => '<g class="sc-bob" transform="translate(' + x + ' ' + y + ') scale(' + size + ')"' + ink('#79542b') + '><ellipse cx="0" cy="0" rx="14" ry="10" fill="#ffde70"/><circle cx="9" cy="-12" r="9" fill="#ffde70"/><path d="M17-13l9 4-9 3z" fill="#e99a48"/><path d="M-4-3q-4 6 4 7" fill="none" stroke-width="2"/><circle cx="11" cy="-14" r="2" fill="#79542b" stroke="none"/><path d="M-4 10l-3 5m9-5 3 5" fill="none" stroke-width="2"/></g>';
  const farm = svg('farm', meadow('farm-field') +
    '<circle cx="278" cy="29" r="18" fill="#ffe18b"/>' +
    '<g' + ink('#733e36') + '><path d="M24 72l57-39 57 39v75H24z" fill="#d87669"/><path d="M15 76l66-46 66 46" fill="none" stroke-width="7"/><path d="M60 146v-51h43v51z" fill="#a54f49"/><path d="M62 96l39 49m0-49-39 49" fill="none" stroke="#ffe9c9"/><path d="M67 73V58h27v15z" fill="#ffe9c9"/><path d="M80 58v15" fill="none" stroke-width="2"/></g>' +
    // A spotted cow with a soft pink muzzle.
    '<g' + ink('#4c4342') + '><path d="M214 137v20h14v-22m38 0v22h14v-27" fill="#fff5df"/><path d="M201 108q-22-20-29-3" fill="none" stroke-width="5"/><ellipse cx="241" cy="117" rx="45" ry="29" fill="#fff5df"/><path d="M223 94q23-16 27 8-5 18-22 15-14-6-5-23m40 32q12-18 21-8-2 19-18 21z" fill="#77717c" stroke="none"/><path d="M258 67l-13-10q-9 10 8 18m34-8 13-10q9 10-8 18" fill="#fff5df"/><path d="M261 60l-3-14q9 2 11 13m11 1 6-14q5 11 2 16" fill="#efc47e"/><rect x="253" y="61" width="40" height="58" rx="17" fill="#fff5df"/><ellipse cx="273" cy="108" rx="23" ry="15" fill="#eeb5b0"/><circle cx="263" cy="107" r="2.5" fill="#4c4342" stroke="none"/><circle cx="283" cy="107" r="2.5" fill="#4c4342" stroke="none"/><path d="M265 115q8 5 16 0" fill="none" stroke-width="2"/>' + eyes(264, 80, 18, '#4c4342') + '</g>' +
    duckling(146, 145, .75) + duckling(177, 150, .55) +
    '<g' + ink('#876445') + '><path d="M33 153h67" fill="none"/><path d="M47 149l-4-16m18 16 1-20m19 20 8-14" fill="none" stroke="#6a9856" stroke-width="4"/><path d="M41 143l13 10H43zm20-2 8 12H56zm22 2 9 10H77z" fill="#e99950" stroke-width="2"/></g>');

  const note = (x, y, color, delay) => '<g class="sc-bob" style="animation-delay:' + delay + 's" fill="' + color + '"><path d="M' + x + ' ' + y + 'v-28l19-5v27h-4v-19l-11 3v22z"/><ellipse cx="' + (x - 3) + '" cy="' + y + '" rx="7" ry="5" transform="rotate(-20 ' + (x - 3) + ' ' + y + ')"/><ellipse cx="' + (x + 12) + '" cy="' + (y - 6) + '" rx="7" ry="5" transform="rotate(-20 ' + (x + 12) + ' ' + (y - 6) + ')"/></g>';
  const music = svg('music',
    // An upright acoustic guitar, a small keyboard and a record on a faded stage.
    faded('music-stage', '<path d="M0 150H320v20H0z" fill="#b09ab7" opacity=".28"/><path d="M0 150H320" stroke="#433747" stroke-width="3" opacity=".45"/>') +
    note(29, 42, '#efb2ba', 0) + note(161, 57, '#d7c2ec', .8) + sparkle(201, 28, 6, '#f9e5a1', .5) +
    // The complete disc fixes the rotating group's bounding box on its centre.
    '<g class="sc-spin"' + ink('#433747') + '><circle cx="68" cy="74" r="26" fill="#9186ad"/><circle cx="68" cy="74" r="19" fill="none" stroke="#c4b9d5" stroke-width="2"/><circle cx="68" cy="74" r="11" fill="#f3c67b"/><circle cx="68" cy="74" r="3" fill="#433747" stroke="none"/><path d="M48 67q3-9 12-12" fill="none" stroke="#ede5f7" stroke-width="3" stroke-linecap="round"/></g>' +
    // A keyboard on an X stand; its whole face moves with its casing.
    '<g class="sc-rock"' + ink('#433747') + '><path d="M40 136l65 14m11-14-65 14" fill="none" stroke-width="5" stroke-linecap="round"/><rect x="20" y="98" width="118" height="42" rx="9" fill="#91cec3"/><circle cx="68" cy="107" r="3" fill="#433747" stroke="none"/><circle cx="90" cy="107" r="3" fill="#433747" stroke="none"/><path d="M73 112q6 5 12 0" fill="none" stroke-width="2.5" stroke-linecap="round"/><rect x="26" y="119" width="106" height="16" rx="3" fill="#fff2d9"/><path d="M43 120v14m18-14v14m18-14v14m18-14v14m18-14v14" fill="none" stroke-width="2"/><path d="M40 120v8m18-8v8m36-8v8m18-8v8" fill="none" stroke-width="6"/></g>' +
    // All guitar parts share x = 247: neck, soundhole, bridge and strings.
    '<g class="sc-rock"' + ink('#694332') + '><path d="M240 90C228 81 216 86 216 100C216 109 225 112 221 119C216 125 210 129 210 137C210 148 228 150 247 150C266 150 284 148 284 137C284 129 278 125 273 119C269 112 278 109 278 100C278 86 266 81 254 90Z" fill="#f3c67b"/><rect x="240" y="62" width="14" height="36" rx="2" fill="#b98055"/><path d="M239 48h-7m7 8h-7m7 8h-7m23-16h7m-7 8h7m-7 8h7" fill="none" stroke-width="3" stroke-linecap="round"/><rect x="236" y="43" width="22" height="23" rx="4" fill="#f3c67b"/><path d="M241 74h12m-12 9h12m-12 9h12" fill="none" stroke-width="2"/><circle cx="247" cy="111" r="14" fill="#fff0cd"/><circle cx="247" cy="111" r="10" fill="#694332" stroke="none"/><rect x="232" y="132" width="30" height="7" rx="3" fill="#694332" stroke="none"/><path d="M243 65v71m4-71v71m4-71v71" fill="none" stroke="#fff4d8" stroke-width="1.5" stroke-linecap="round"/></g>');

  const penguin = (x, y, size, scarf) => '<g class="sc-rock" transform="translate(' + x + ' ' + y + ') scale(' + size + ')"' + ink('#253b54') + '><path d="M-17-9q-17 7-20 23 15-1 22-12m30-11q17 7 20 23-15-1-22-12" fill="#36546a"/><path d="M-10 27l-12 8h19l6-8m8 0 11 8H3l-5-8" fill="#efb464"/><ellipse cx="0" cy="0" rx="25" ry="32" fill="#36546a"/><ellipse cx="0" cy="8" rx="17" ry="22" fill="#f1f5f3"/><path d="M-18-13q8-16 18-3 10-13 18 3l-5 16H-13z" fill="#f1f5f3" stroke="none"/><circle cx="-8" cy="-10" r="2.5" fill="#253b54" stroke="none"/><circle cx="8" cy="-10" r="2.5" fill="#253b54" stroke="none"/><path d="M-6-3H6L0 4z" fill="#efb464" stroke-width="2"/><path d="M-23 7q23 9 46 0l-1 7q-23 8-44 0zM13 14l-3 16h10l2-17" fill="' + scarf + '" stroke-width="2"/></g>';
  const arctic = svg('arctic',
    '<g class="sc-billow" fill="none" stroke-linecap="round" opacity=".75"><path d="M20 52Q73-2 127 31t96-2 82-3" stroke="#82dab9" stroke-width="14"/><path d="M25 65Q78 13 130 43t98-2 74-4" stroke="#aaa8e0" stroke-width="9"/></g>' +
    sparkle(44, 23, 4, '#f5fbff', .2) + sparkle(190, 20, 5, '#f5fbff', 1) + sparkle(300, 74, 4, '#f5fbff', 1.7) +
    faded('arctic-snow', '<path d="M0 151Q75 132 155 144T320 139v31H0z" fill="#d6ecf0"/><path d="M6 157q90-8 136 0m79-4q43-5 86-1" fill="none" stroke="#abcfdc" stroke-width="2"/>') +
    '<g' + ink('#6489a2') + '><path d="M19 142l6-49 21-30 35-8 35 19 17 68z" fill="#b7dce8"/><path d="M50 142V112a27 27 0 0 1 54 0v30z" fill="#48758b"/><path d="M28 97l26-7-8-26m10 24 25-32 13 30 27-9m-11 19 17 16" fill="none" stroke="#e9f7fa" stroke-width="5"/><path d="M53 114l9-10m27 2 11 10" fill="none" stroke="#8eb4c7" stroke-width="3"/></g>' +
    penguin(154, 117, .9, '#d6869b') + penguin(204, 136, .58, '#e8b76f') +
    '<g class="sc-bob"' + ink('#566175') + '><path d="M229 146h70q13 0 12-11m-72 11v9h50m-45-19v10m36-10v10" fill="none" stroke-width="3.5"/><path d="M234 135h63l-5-7h-54z" fill="#c98b70"/><rect x="242" y="105" width="41" height="23" rx="5" fill="#e4b178"/><path d="M254 106v22m17-22v22" fill="none" stroke="#a36d55" stroke-width="2.5"/><path d="M291 132q-6-39 14-44" fill="none" stroke-width="2.5"/><path d="M245 104l7-11h21l6 11z" fill="#edf6f2"/></g>');

  const potionBottle = (x, y, size, color, shape) => '<g transform="translate(' + x + ' ' + y + ') scale(' + size + ')"' + ink('#584468') + '><path d="M-7-38h14v17' + (shape === 'round' ? 'q20 7 18 26-2 19-25 19S-23 5-25 5q-2-19 18-26' : 'l13 12v27q-20 7-40 0V-9l13-12') + 'z" fill="#f0eafa" fill-opacity=".7"/><path d="' + (shape === 'round' ? 'M-21-2q21 9 42 0v7q-1 15-21 15T-21 5z' : 'M-16-4q16 5 32 0v18q-16 5-32 0z') + '" fill="' + color + '" stroke="none"/><rect x="-9" y="-44" width="18" height="8" rx="2" fill="#c5936a"/><path d="M-14-11v10" stroke="#fff" stroke-width="3" stroke-linecap="round"/><circle cx="5" cy="5" r="3" fill="#fff" opacity=".7" stroke="none"/></g>';
  const potions = svg('potions', faded('potion-table', '<path d="M6 151h308v12H6z" fill="#b28776" opacity=".5"/><path d="M12 151h296" stroke="#584468" stroke-width="3"/>') +
    // Three jewel colored bottles with simple readable silhouettes.
    potionBottle(46, 131, .84, '#61c5ba', 'round') + potionBottle(98, 132, .88, '#ba8bdb', 'square') + potionBottle(144, 134, .7, '#e7ae61', 'round') +
    '<g fill="none" stroke="#d3bbe7" stroke-width="5" stroke-linecap="round"><path class="sc-puff" d="M43 86q-12-13 0-24t-2-19"/><path class="sc-puff" style="animation-delay:.8s" d="M96 83q13-11 0-23t3-20"/></g>' +
    sparkle(28, 30, 6, '#f7da89', .1) + sparkle(155, 40, 7, '#d7bdeb', .9) + sparkle(305, 22, 5, '#f7da89', 1.6) +
    // A helpful frog rests its hands on the mixing bowl.
    '<g' + ink('#36594f') + '><ellipse cx="251" cy="125" rx="34" ry="26" fill="#88b88a"/><ellipse cx="251" cy="130" rx="20" ry="17" fill="#d2ddb0"/><path d="M226 134q-26 10-20 19h28m37-19q26 10 20 19h-28" fill="#88b88a"/><ellipse cx="251" cy="87" rx="39" ry="27" fill="#88b88a"/><circle cx="229" cy="67" r="14" fill="#88b88a"/><circle cx="273" cy="67" r="14" fill="#88b88a"/><circle cx="229" cy="65" r="8" fill="#f8f2d4" stroke="none"/><circle cx="273" cy="65" r="8" fill="#f8f2d4" stroke="none"/><circle cx="230" cy="66" r="3.5" fill="#36594f" stroke="none"/><circle cx="272" cy="66" r="3.5" fill="#36594f" stroke="none"/><path d="M233 91q18 14 36 0" fill="none" stroke-linecap="round"/><circle cx="225" cy="89" r="5" fill="#df9c9c" stroke="none"/><circle cx="277" cy="89" r="5" fill="#df9c9c" stroke="none"/></g>' +
    '<g' + ink('#584468') + '><path d="M167 118q35 12 70 0l-7 28h-56z" fill="#8a6d9c"/><ellipse cx="202" cy="117" rx="35" ry="8" fill="#d5a3d2"/><path d="M192 117l-9-37" fill="none" stroke="#c5936a" stroke-width="6"/><path d="M229 113q-9-13-15-6l-3 12q9 7 18-6m10 16q-4-14-12-7l-4 12q10 8 16-5" fill="#88b88a" stroke="#36594f"/></g>' +
    '<g class="sc-rise" fill="none" stroke="#f0d9f5" stroke-width="2.5"><circle cx="183" cy="100" r="4"/><circle cx="207" cy="88" r="5"/><circle cx="223" cy="101" r="3"/></g>');

  return { trains, dinosaurs, unicorns, space, construction, ocean, pirates, heroes, robots, princesses,
    pets, horses, bugs, jungle, dragons, cars, games, bricks, sweets, weather,
    mushroom, library, farm, music, arctic, potions };
})();
