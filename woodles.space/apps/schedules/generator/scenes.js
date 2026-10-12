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

  return { trains, dinosaurs, unicorns, space, construction, ocean };
})();
