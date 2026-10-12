// How a learner's visual schedule looks: themes built around popular special
// interests, and the per-plan choices layered over them. The style studio
// edits `plan.style`, publishing carries it, and the learner view applies it.
// api/_schedule-payload.ts validates the same shape on the server.
window.ScheduleThemes = (() => {
  'use strict';

  // `spec` is the Google Fonts css2 family; `scale` evens out very wide display faces.
  const FONTS = {
    bungee: { label: 'Bungee', family: 'Bungee', spec: 'Bungee', fallback: '"Arial Black", Impact, sans-serif', scale: 1 },
    fredoka: { label: 'Fredoka', family: 'Fredoka', spec: 'Fredoka:wght@500;600;700', fallback: '"Trebuchet MS", system-ui, sans-serif', scale: 1.08, body: 600 },
    baloo: { label: 'Baloo', family: 'Baloo 2', spec: 'Baloo+2:wght@600;700;800', fallback: '"Trebuchet MS", system-ui, sans-serif', scale: 1.08, body: 700 },
    luckiest: { label: 'Luckiest Guy', family: 'Luckiest Guy', spec: 'Luckiest+Guy', fallback: 'Impact, sans-serif', scale: 1 },
    alfa: { label: 'Alfa Slab', family: 'Alfa Slab One', spec: 'Alfa+Slab+One', fallback: 'Rockwell, Georgia, serif', scale: 1 },
    orbitron: { label: 'Orbitron', family: 'Orbitron', spec: 'Orbitron:wght@700;900', fallback: 'system-ui, sans-serif', scale: .88 },
    audiowide: { label: 'Audiowide', family: 'Audiowide', spec: 'Audiowide', fallback: 'system-ui, sans-serif', scale: .94 },
    pixel: { label: 'Press Start', family: 'Press Start 2P', spec: 'Press+Start+2P', fallback: '"Courier New", monospace', scale: .58 },
    rye: { label: 'Rye', family: 'Rye', spec: 'Rye', fallback: 'Georgia, serif', scale: .9 },
    pirata: { label: 'Pirata', family: 'Pirata One', spec: 'Pirata+One', fallback: 'Georgia, serif', scale: 1.12 },
    bangers: { label: 'Bangers', family: 'Bangers', spec: 'Bangers', fallback: 'Impact, sans-serif', scale: 1.1 },
    racing: { label: 'Racing Sans', family: 'Racing Sans One', spec: 'Racing+Sans+One', fallback: 'Impact, sans-serif', scale: 1.04 },
    lilita: { label: 'Lilita One', family: 'Lilita One', spec: 'Lilita+One', fallback: '"Arial Black", sans-serif', scale: 1.06 },
    chewy: { label: 'Chewy', family: 'Chewy', spec: 'Chewy', fallback: '"Comic Sans MS", sans-serif', scale: 1.08 },
    medieval: { label: 'MedievalSharp', family: 'MedievalSharp', spec: 'MedievalSharp', fallback: 'Georgia, serif', scale: 1.04 },
    russo: { label: 'Russo One', family: 'Russo One', spec: 'Russo+One', fallback: 'system-ui, sans-serif', scale: .96 },
    pacifico: { label: 'Pacifico', family: 'Pacifico', spec: 'Pacifico', fallback: 'cursive', scale: .92 },
    sniglet: { label: 'Sniglet', family: 'Sniglet', spec: 'Sniglet:wght@400;800', fallback: '"Trebuchet MS", system-ui, sans-serif', scale: 1, body: 800 },
    grandstander: { label: 'Grandstander', family: 'Grandstander', spec: 'Grandstander:wght@600;800', fallback: '"Comic Sans MS", sans-serif', scale: .96, body: 700 },
    nunito: { label: 'Nunito', family: 'Nunito', spec: 'Nunito:wght@600;800;900', fallback: '"Trebuchet MS", system-ui, sans-serif', scale: 1.05, body: 800 },
    quicksand: { label: 'Quicksand', family: 'Quicksand', spec: 'Quicksand:wght@600;700', fallback: 'system-ui, sans-serif', scale: 1.05, body: 700 },
    comic: { label: 'Comic Neue', family: 'Comic Neue', spec: 'Comic+Neue:wght@700', fallback: '"Comic Sans MS", sans-serif', scale: 1.05, body: 700 },
    patrick: { label: 'Patrick Hand', family: 'Patrick Hand', spec: 'Patrick+Hand', fallback: '"Comic Sans MS", sans-serif', scale: 1.1, body: 400 },
    atkinson: { label: 'Atkinson Hyperlegible', family: 'Atkinson Hyperlegible', spec: 'Atkinson+Hyperlegible:wght@400;700', fallback: 'Verdana, system-ui, sans-serif', scale: 1, body: 700 },
    lexend: { label: 'Lexend', family: 'Lexend', spec: 'Lexend:wght@500;700;800', fallback: 'Verdana, system-ui, sans-serif', scale: .96, body: 700 },
    andika: { label: 'Andika', family: 'Andika', spec: 'Andika:wght@400;700', fallback: 'Verdana, system-ui, sans-serif', scale: 1, body: 700 },
    system: { label: 'This device’s font', family: '', spec: '', fallback: 'system-ui, -apple-system, "Segoe UI", sans-serif', scale: 1, body: 700 }
  };
  const READING_FONTS = ['atkinson', 'lexend', 'andika'];

  const GROUPS = [
    ['creatures', 'Creatures'], ['go', 'Things that go'], ['play', 'Make-believe and play'], ['calm', 'Classic and calm']
  ];

  // Colour roles a theme sets and the studio can override; everything else is derived.
  const COLOR_ROLES = [
    ['accent', 'Buttons and highlights'], ['hero', 'Banner'], ['page', 'Page background'], ['card', 'Cards'],
    ['ink', 'Text'], ['now', 'Now highlight'], ['done', 'Done check'], ['track', 'Timeline track']
  ];

  const T = (id, group, name, emoji, blurb, colors, look) => ({ id, group, name, emoji, blurb, colors, ...look });
  const THEMES = [
    T('classic', 'calm', 'Bright sky', '⭐', 'The original blue schedule.',
      { accent: '#2f7bf5', heroA: '#1757b9', heroB: '#2464c9', pageA: '#f5f8ff', pageB: '#eef4ff', card: '#ffffff', ink: '#15213b', now: '#ff3e6c', done: '#23b26d', sun: '#ffc83d', track: '#e1eaf8' },
      { heading: 'bungee', body: 'nunito', stickers: ['⭐', '✨', '🎈', '🎨', '📚', '🌟'], mascots: [], scene: 'tickets', pattern: 'none', track: 'line', shape: 'soft', stamp: 'check', marker: 'dot', celebrate: 'gentle', motion: 'on',
        words: { kicker: 'One thing at a time', greeting: 'Hi {name}!', finishTitle: 'All done!', finishMessage: 'Great job today, {name}!', now: 'NOW', next: 'NEXT' } }),
    T('unicorns', 'creatures', 'Unicorns', '🦄', 'Pastel rainbows and sparkles.',
      { accent: '#b04fc4', heroA: '#b44cc9', heroB: '#7c6cf0', pageA: '#fff4fb', pageB: '#f3ecff', card: '#ffffff', ink: '#3d2350', now: '#ff4f97', done: '#24a37f', sun: '#ffd36e', track: '#f0c9f0' },
      { heading: 'fredoka', body: 'nunito', stickers: ['🦄', '🌈', '✨', '💖', '⭐', '🧁'], mascots: ['🦄', '🌈', '✨'], pattern: 'stars', track: 'rainbow', shape: 'round', stamp: '🦄', marker: '🦄', celebrate: 'party', motion: 'on',
        words: { kicker: 'Sparkle by sparkle', greeting: 'Hi {name}!', finishTitle: 'Magical work!', finishMessage: 'You did it, {name}!', now: 'NOW', next: 'NEXT' } }),
    T('dinosaurs', 'creatures', 'Dinosaurs', '🦖', 'Jungle greens, volcanoes and big stomps.',
      { accent: '#3f7d3a', heroA: '#2f6b2b', heroB: '#5b8a26', pageA: '#f4f7e8', pageB: '#ecf2d9', card: '#ffffff', ink: '#26311c', now: '#f26b1d', done: '#3f9b4a', sun: '#ffcf4a', track: '#cfdcae' },
      { heading: 'luckiest', body: 'baloo', stickers: ['🦖', '🦕', '🌋', '🥚', '🌿', '🦴'], mascots: ['🦕', '🌋', '🦖'], pattern: 'stickers', track: 'prints', shape: 'soft', stamp: '🦖', marker: '🦕', celebrate: 'party', motion: 'on',
        words: { kicker: 'Stomp through the day', greeting: 'Roar, {name}!', finishTitle: 'Dino-mite!', finishMessage: 'Great stomping today, {name}!', now: 'NOW', next: 'NEXT' } }),
    T('ocean', 'creatures', 'Under the sea', '🐳', 'Whales, fish and bubbles.',
      { accent: '#0c7a9e', heroA: '#0b6f94', heroB: '#139aab', pageA: '#eaf8fb', pageB: '#dcf1f6', card: '#ffffff', ink: '#10313d', now: '#ff7a59', done: '#1f9e7a', sun: '#ffd66b', track: '#bfe3ec' },
      { heading: 'baloo', body: 'baloo', stickers: ['🐳', '🐠', '🐙', '🦈', '🐚', '🌊'], mascots: ['🐳', '🐠', '🐙'], pattern: 'dots', track: 'dotted', shape: 'round', stamp: '🐚', marker: '🐠', celebrate: 'gentle', motion: 'on',
        words: { kicker: 'Swim through the day', greeting: 'Hi {name}!', finishTitle: 'Splash-tastic!', finishMessage: 'Great swimming today, {name}!', now: 'NOW', next: 'NEXT' } }),
    T('pets', 'creatures', 'Puppies and kittens', '🐶', 'Paw prints, yarn and bones.',
      { accent: '#c2571a', heroA: '#d9663a', heroB: '#d4566b', pageA: '#fff8f1', pageB: '#fdeee2', card: '#ffffff', ink: '#3a2418', now: '#e5487a', done: '#2f9e6e', sun: '#ffd36b', track: '#f3d6c2' },
      { heading: 'chewy', body: 'nunito', stickers: ['🐶', '🐱', '🐾', '🦴', '🧶', '🐹'], mascots: ['🐶', '🐾', '🐱'], pattern: 'stickers', track: 'prints', shape: 'round', stamp: '🐾', marker: '🐶', celebrate: 'gentle', motion: 'on',
        words: { kicker: 'Paw by paw', greeting: 'Hi {name}!', finishTitle: 'Pawsome job!', finishMessage: 'Good work today, {name}!', now: 'NOW', next: 'NEXT' } }),
    T('horses', 'creatures', 'Horses', '🐴', 'Saddles, hay bales and wide-open fields.',
      { accent: '#8b5a2b', heroA: '#7a4b22', heroB: '#a86b35', pageA: '#faf6ee', pageB: '#f1e9d7', card: '#fffdf8', ink: '#2f2216', now: '#d9480f', done: '#4d7c0f', sun: '#f6c453', track: '#e2d0ae' },
      { heading: 'rye', body: 'nunito', stickers: ['🐴', '🐎', '🤠', '🌾', '🌵', '🏇'], mascots: ['🐴', '🌾', '🤠'], pattern: 'stickers', track: 'dashed', shape: 'soft', stamp: '🤠', marker: '🐎', celebrate: 'gentle', motion: 'on',
        words: { kicker: 'Giddy up through the day', greeting: 'Howdy, {name}!', finishTitle: 'Great riding!', finishMessage: 'Yeehaw, {name}! All done.', now: 'NOW', next: 'NEXT' } }),
    T('bugs', 'creatures', 'Bugs and butterflies', '🦋', 'Ladybirds, bees and garden leaves.',
      { accent: '#2f7d32', heroA: '#2a6f2d', heroB: '#478f27', pageA: '#f3faee', pageB: '#fbf7e6', card: '#ffffff', ink: '#1e2b18', now: '#e2558f', done: '#0f8a6a', sun: '#ffd84a', track: '#d2e6c2' },
      { heading: 'sniglet', body: 'sniglet', stickers: ['🦋', '🐞', '🐝', '🐛', '🌼', '🍃'], mascots: ['🦋', '🐞', '🌼'], pattern: 'stickers', track: 'dotted', shape: 'round', stamp: '🐞', marker: '🐛', celebrate: 'gentle', motion: 'on',
        words: { kicker: 'Little by little', greeting: 'Hi {name}!', finishTitle: 'Buzzing good job!', finishMessage: 'You flew through today, {name}!', now: 'NOW', next: 'NEXT' } }),
    T('jungle', 'creatures', 'Jungle safari', '🦁', 'Lions, monkeys and tall palms.',
      { accent: '#166534', heroA: '#14532d', heroB: '#4d7c0f', pageA: '#f5f9ee', pageB: '#f6f0de', card: '#ffffff', ink: '#1f2a18', now: '#ea580c', done: '#0d9488', sun: '#fcd34d', track: '#d6e2c0' },
      { heading: 'grandstander', body: 'nunito', stickers: ['🦁', '🐘', '🦒', '🐒', '🐯', '🌴'], mascots: ['🦁', '🐒', '🌴'], pattern: 'stickers', track: 'prints', shape: 'soft', stamp: '🍌', marker: '🐒', celebrate: 'party', motion: 'on',
        words: { kicker: 'Into the jungle', greeting: 'Hi {name}!', finishTitle: 'Wild work!', finishMessage: 'A roar-some day, {name}!', now: 'NOW', next: 'NEXT' } }),
    T('dragons', 'creatures', 'Dragons and castles', '🐉', 'Quests, shields and royal purple.',
      { accent: '#6d28d9', heroA: '#4c1d95', heroB: '#065f46', pageA: '#f4f1fa', pageB: '#ebf4ef', card: '#ffffff', ink: '#22172e', now: '#e11d48', done: '#059669', sun: '#fbbf24', track: '#ddd0f2' },
      { heading: 'medieval', body: 'nunito', stickers: ['🐉', '🏰', '🗡️', '🛡️', '👑', '🔥'], mascots: ['🐉', '🏰', '🔥'], pattern: 'stars', track: 'line', shape: 'square', stamp: '🛡️', marker: '🐉', celebrate: 'party', motion: 'on',
        words: { kicker: 'A quest in steps', greeting: 'Hail, {name}!', finishTitle: 'Quest complete!', finishMessage: 'A legendary day, {name}!', now: 'NOW', next: 'NEXT' } }),
    T('trains', 'go', 'Trains', '🚂', 'Railway tracks, tickets and station stops.',
      { accent: '#1f4e8c', heroA: '#a82820', heroB: '#c9452f', pageA: '#f6f1e7', pageB: '#eee5d3', card: '#fffdf8', ink: '#1f2430', now: '#e8a317', done: '#2e8b57', sun: '#ffd25a', track: '#6b6257' },
      { heading: 'alfa', body: 'nunito', stickers: ['🚂', '🚃', '🚉', '🛤️', '🚦', '🎫'], mascots: ['🚂', '🚃', '🚃'], pattern: 'none', track: 'rails', shape: 'soft', stamp: '🎫', marker: '🚂', celebrate: 'gentle', motion: 'on',
        words: { kicker: 'Next stop: today', greeting: 'All aboard, {name}!', finishTitle: 'End of the line!', finishMessage: 'What a journey, {name}!', now: 'THIS STOP', next: 'NEXT STOP' } }),
    T('cars', 'go', 'Cars and trucks', '🚒', 'Fire engines, race cars and the open road.',
      { accent: '#c81e1e', heroA: '#2b3442', heroB: '#424c5c', pageA: '#f3f4f6', pageB: '#e7ebf0', card: '#ffffff', ink: '#111827', now: '#f59e0b', done: '#16a34a', sun: '#fcd34d', track: '#4b5563' },
      { heading: 'racing', body: 'nunito', stickers: ['🚗', '🚒', '🚓', '🚑', '🚌', '🏁'], mascots: ['🚗', '🚒', '🏁'], pattern: 'stripes', track: 'road', shape: 'soft', stamp: '🏁', marker: '🚗', celebrate: 'gentle', motion: 'on',
        words: { kicker: 'Vroom through the day', greeting: 'Start your engines, {name}!', finishTitle: 'Finish line!', finishMessage: 'Great driving today, {name}!', now: 'NOW', next: 'NEXT' } }),
    T('construction', 'go', 'Diggers and building sites', '🚜', 'Hard hats, hazard stripes and diggers.',
      { accent: '#1f2937', heroA: '#f5b700', heroB: '#f59e0b', pageA: '#fbf8ef', pageB: '#f3eedf', card: '#ffffff', ink: '#1c1f24', now: '#f97316', done: '#15803d', sun: '#fbbf24', track: '#facc15' },
      { heading: 'bungee', body: 'nunito', stickers: ['🚧', '🏗️', '🚜', '👷', '🔨', '🧱'], mascots: ['🚜', '🏗️', '🚧'], pattern: 'stripes', track: 'hazard', shape: 'square', stamp: '👷', marker: '🚜', celebrate: 'gentle', motion: 'on',
        words: { kicker: 'Dig into the day', greeting: 'Hard hats on, {name}!', finishTitle: 'Job done!', finishMessage: 'Great building today, {name}!', now: 'NOW', next: 'NEXT' } }),
    T('space', 'go', 'Outer space', '🚀', 'Rockets, planets and a starry night sky.',
      { accent: '#6c7dff', heroA: '#2a1f6b', heroB: '#0d3b78', pageA: '#0f1630', pageB: '#1b1f4a', card: '#1d2550', ink: '#f2f4ff', now: '#ffcc33', done: '#22c39a', sun: '#ffd84d', track: '#3a4690' },
      { heading: 'orbitron', body: 'nunito', stickers: ['🚀', '🪐', '🌙', '⭐', '👩‍🚀', '🛸'], mascots: ['🚀', '🪐', '🌙'], pattern: 'stars', track: 'dotted', shape: 'soft', stamp: '⭐', marker: '🚀', celebrate: 'party', motion: 'on',
        words: { kicker: 'Mission control', greeting: 'Blast off, {name}!', finishTitle: 'Mission complete!', finishMessage: 'Stellar work today, {name}!', now: 'NOW', next: 'NEXT' } }),
    T('robots', 'play', 'Robots', '🤖', 'Gears, circuits and friendly beeps.',
      { accent: '#0e7490', heroA: '#334155', heroB: '#0e7490', pageA: '#eef2f6', pageB: '#e4eaf1', card: '#ffffff', ink: '#0f172a', now: '#f59e0b', done: '#16a34a', sun: '#fde047', track: '#b9c7d6' },
      { heading: 'audiowide', body: 'lexend', stickers: ['🤖', '⚙️', '🔋', '🔧', '💡', '🛰️'], mascots: ['🤖', '⚙️', '🔋'], pattern: 'grid', track: 'dashed', shape: 'square', stamp: '🔋', marker: '🤖', celebrate: 'gentle', motion: 'on',
        words: { kicker: 'One step, then the next', greeting: 'Hello, {name}!', finishTitle: 'Program complete!', finishMessage: 'All systems happy, {name}!', now: 'NOW', next: 'NEXT' } }),
    T('games', 'play', 'Pixel games', '👾', 'Arcade pixels, coins and high scores.',
      { accent: '#15803d', heroA: '#6d28d9', heroB: '#be185d', pageA: '#1a1033', pageB: '#24124a', card: '#2a1b52', ink: '#f7f2ff', now: '#facc15', done: '#22c55e', sun: '#facc15', track: '#4b3a86' },
      { heading: 'pixel', body: 'nunito', stickers: ['🎮', '👾', '🕹️', '🍄', '🏆', '💎'], mascots: ['👾', '🎮', '🏆'], pattern: 'grid', track: 'dashed', shape: 'square', stamp: '🏆', marker: '👾', celebrate: 'party', motion: 'on',
        words: { kicker: 'Level by level', greeting: 'Ready, {name}?', finishTitle: 'Level complete!', finishMessage: 'High score, {name}!', now: 'NOW', next: 'NEXT' } }),
    T('heroes', 'play', 'Superheroes', '🦸', 'Comic-book bursts, capes and lightning.',
      { accent: '#1e40af', heroA: '#c81e1e', heroB: '#1e40af', pageA: '#f2f6ff', pageB: '#fff2f2', card: '#ffffff', ink: '#111827', now: '#dc2626', done: '#16a34a', sun: '#facc15', track: '#d3dbef' },
      { heading: 'bangers', body: 'nunito', stickers: ['🦸', '💥', '⚡', '🛡️', '🌟', '💪'], mascots: ['🦸', '⚡', '💥'], pattern: 'dots', track: 'line', shape: 'square', stamp: '💥', marker: '⚡', celebrate: 'party', motion: 'on',
        words: { kicker: 'Hero mode: on', greeting: 'Ready, {name}!', finishTitle: 'Mission accomplished!', finishMessage: 'Super work today, {name}!', now: 'NOW', next: 'NEXT' } }),
    T('pirates', 'play', 'Pirates', '🏴‍☠️', 'Treasure maps, parrots and parchment.',
      { accent: '#9b2c2c', heroA: '#12324a', heroB: '#1d4e6b', pageA: '#f7efd9', pageB: '#eedfbb', card: '#fffaf0', ink: '#2b2015', now: '#c2410c', done: '#2f855a', sun: '#f6c453', track: '#b08d57' },
      { heading: 'pirata', body: 'nunito', stickers: ['🦜', '⚓', '🗺️', '💰', '🏝️', '⛵'], mascots: ['🦜', '⚓', '🗺️'], pattern: 'none', track: 'dashed', shape: 'soft', stamp: '💰', marker: '⛵', celebrate: 'gentle', motion: 'on',
        words: { kicker: 'X marks the plan', greeting: 'Ahoy, {name}!', finishTitle: 'Treasure found!', finishMessage: 'Shipshape work, {name}!', now: 'NOW', next: 'NEXT' } }),
    T('bricks', 'play', 'Building bricks', '🧱', 'Bright studs and primary colours.',
      { accent: '#1d4ed8', heroA: '#d62828', heroB: '#e2620b', pageA: '#fffbea', pageB: '#fff3d1', card: '#ffffff', ink: '#1b1b1f', now: '#e11d48', done: '#16a34a', sun: '#facc15', track: '#facc15' },
      { heading: 'lilita', body: 'nunito', stickers: ['🧱', '🟥', '🟨', '🟦', '🟩', '🏠'], mascots: ['🧱', '🟦', '🟨'], pattern: 'dots', track: 'dotted', shape: 'square', stamp: '⭐', marker: '🧱', celebrate: 'gentle', motion: 'on',
        words: { kicker: 'Brick by brick', greeting: 'Hi {name}!', finishTitle: 'Built it!', finishMessage: 'Great building today, {name}!', now: 'NOW', next: 'NEXT' } }),
    T('sweets', 'play', 'Sweets and baking', '🧁', 'Cupcakes, sprinkles and cookies.',
      { accent: '#be185d', heroA: '#c0266d', heroB: '#c2410c', pageA: '#fff6f8', pageB: '#fff0e4', card: '#ffffff', ink: '#3b1d2a', now: '#7c3aed', done: '#16a34a', sun: '#fcd34d', track: '#f5c6d6' },
      { heading: 'pacifico', body: 'quicksand', stickers: ['🧁', '🍩', '🍪', '🍓', '🎂', '🍭'], mascots: ['🧁', '🍩', '🍭'], pattern: 'stickers', track: 'rainbow', shape: 'round', stamp: '🍪', marker: '🧁', celebrate: 'party', motion: 'on',
        words: { kicker: 'Sweet and simple', greeting: 'Hi {name}!', finishTitle: 'Sweet success!', finishMessage: 'Delicious work today, {name}!', now: 'NOW', next: 'NEXT' } }),
    T('weather', 'calm', 'Weather watch', '🌦️', 'Sunshine, rainbows and today’s forecast.',
      { accent: '#2563eb', heroA: '#2f6fe0', heroB: '#7349d6', pageA: '#eef6ff', pageB: '#f6f3ff', card: '#ffffff', ink: '#172036', now: '#f59e0b', done: '#059669', sun: '#fcd34d', track: '#d3e0f5' },
      { heading: 'fredoka', body: 'nunito', stickers: ['☀️', '🌈', '🌦️', '❄️', '⚡', '🌪️'], mascots: ['☀️', '🌈', '🌦️'], pattern: 'stickers', track: 'rainbow', shape: 'round', stamp: '☀️', marker: '⛅', celebrate: 'gentle', motion: 'on',
        words: { kicker: 'Today’s forecast', greeting: 'Hi {name}!', finishTitle: 'Sunny skies!', finishMessage: 'Bright work today, {name}!', now: 'NOW', next: 'NEXT' } }),
    T('calm', 'calm', 'Quiet and calm', '🌿', 'Soft, low-stimulation colours with no movement.',
      { accent: '#3f6473', heroA: '#4f6d7a', heroB: '#58737f', pageA: '#f4f3ef', pageB: '#f1f0eb', card: '#ffffff', ink: '#22303a', now: '#a85d65', done: '#4a7c59', sun: '#e9dcb4', track: '#dde3e6' },
      { heading: 'lexend', body: 'lexend', stickers: ['🌿', '🍃', '☁️', '🫧', '🌙', '🕊️'], mascots: [], scene: 'none', pattern: 'none', track: 'line', shape: 'soft', stamp: 'check', marker: 'dot', celebrate: 'off', motion: 'off',
        words: { kicker: 'One thing at a time', greeting: 'Hi {name}.', finishTitle: 'All done.', finishMessage: 'Thank you, {name}.', now: 'NOW', next: 'NEXT' } })
  ];
  const THEME_IDS = new Set(THEMES.map((theme) => theme.id));

  const OPTIONS = {
    textSize: [['standard', 'Standard'], ['large', 'Large'], ['xl', 'Extra large']],
    pictureSize: [['standard', 'Standard'], ['large', 'Large']],
    shape: [['', 'Theme default'], ['square', 'Crisp corners'], ['soft', 'Soft corners'], ['round', 'Bubbly']],
    borders: [['standard', 'Standard'], ['bold', 'Bold outlines']],
    pattern: [['', 'Theme default'], ['none', 'Plain'], ['stickers', 'Theme stickers'], ['dots', 'Dots'], ['stars', 'Stars'], ['stripes', 'Stripes'], ['grid', 'Grid']],
    patternStrength: [['subtle', 'Subtle'], ['playful', 'Playful']],
    track: [['', 'Theme default'], ['line', 'Simple line'], ['rainbow', 'Rainbow'], ['rails', 'Railway track'], ['road', 'Road'], ['prints', 'Paw prints'], ['dotted', 'Dots'], ['dashed', 'Dashes'], ['hazard', 'Hazard stripes']],
    celebrate: [['', 'Theme default'], ['off', 'Off'], ['gentle', 'A small burst'], ['party', 'Party']],
    motion: [['', 'Theme default'], ['on', 'Gently moving'], ['off', 'Still']],
    scene: [['theme', 'Theme banner'], ['stickers', 'Theme stickers'], ['custom', 'My stickers'], ['none', 'Nothing']]
  };
  const WORDS = [
    ['kicker', 'Banner line', 60], ['greeting', 'Greeting', 60], ['now', 'Now label', 16], ['next', 'Next label', 16],
    ['finishTitle', 'Finish title', 40], ['finishMessage', 'Finish message', 80]
  ];
  const TEXT_SCALE = { standard: 1, large: 1.15, xl: 1.3 };
  const SHAPE_ROUND = { square: .35, soft: 1, round: 1.6 };
  const EXTRA_STICKERS = ['⭐', '✅', '👍', '🏆', '❤️', '🎉', '🌟', '🎈'];

  function pick(value, list, fallback) {
    return list.some(([key]) => key === value) ? value : fallback;
  }
  function hex(value) {
    return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value).toLowerCase() : '';
  }
  // Stickers end up in markup and SVG patterns; keep them short and inert.
  function sticker(value) {
    return String(value == null ? '' : value).replace(/[<>&"'\\\u0000-\u001f]/g, '').trim().slice(0, 16);
  }
  function words(value, max) {
    return String(value == null ? '' : value).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
  }

  function sanitizeStyle(value) {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const colors = source.colors && typeof source.colors === 'object' ? source.colors : {};
    const text = source.words && typeof source.words === 'object' ? source.words : {};
    const font = (key, body) => FONTS[key] && (!body || FONTS[key].body) ? key : '';
    const choice = (key) => key === 'theme' ? 'theme' : key === 'check' || key === 'dot' ? key : sticker(key) || 'theme';
    return {
      theme: THEME_IDS.has(source.theme) ? source.theme : 'classic',
      colors: Object.fromEntries(COLOR_ROLES.map(([role]) => [role, hex(colors[role])])),
      headingFont: font(source.headingFont, false),
      bodyFont: font(source.bodyFont, true),
      textSize: pick(source.textSize, OPTIONS.textSize, 'standard'),
      pictureSize: pick(source.pictureSize, OPTIONS.pictureSize, 'standard'),
      shape: pick(source.shape, OPTIONS.shape, ''),
      borders: pick(source.borders, OPTIONS.borders, 'standard'),
      pattern: pick(source.pattern, OPTIONS.pattern, ''),
      patternStrength: pick(source.patternStrength, OPTIONS.patternStrength, 'subtle'),
      track: pick(source.track, OPTIONS.track, ''),
      scene: pick(source.scene, OPTIONS.scene, 'theme'),
      mascots: (Array.isArray(source.mascots) ? source.mascots : []).map(sticker).filter(Boolean).slice(0, 3),
      stamp: source.stamp === 'check' ? 'check' : choice(source.stamp),
      marker: source.marker === 'dot' ? 'dot' : choice(source.marker),
      celebrate: pick(source.celebrate, OPTIONS.celebrate, ''),
      motion: pick(source.motion, OPTIONS.motion, ''),
      highContrast: source.highContrast === true,
      words: Object.fromEntries(WORDS.map(([key, , max]) => [key, words(text[key], max)]))
    };
  }

  function theme(id) {
    return THEMES.find((entry) => entry.id === id) || THEMES[0];
  }

  // --- colour arithmetic, so derived roles stay readable whatever is picked ---
  function rgb(value) {
    const number = parseInt(value.slice(1), 16);
    return [number >> 16 & 255, number >> 8 & 255, number & 255];
  }
  function toHex(parts) {
    return '#' + parts.map((part) => Math.round(Math.max(0, Math.min(255, part))).toString(16).padStart(2, '0')).join('');
  }
  function mix(a, b, amount) {
    const from = rgb(a); const to = rgb(b);
    return toHex(from.map((part, index) => part + (to[index] - part) * amount));
  }
  function luminance(value) {
    const [r, g, b] = rgb(value).map((part) => { const c = part / 255; return c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; });
    return .2126 * r + .7152 * g + .0722 * b;
  }
  function contrast(a, b) {
    const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (high + .05) / (low + .05);
  }
  // Darken (or lighten) until `against` reads on it at `ratio`.
  function readableOn(color, against, ratio) {
    const toward = luminance(against) > .5 ? '#000000' : '#ffffff';
    let result = color;
    for (let step = 1; step <= 20 && contrast(result, against) < ratio; step++) result = mix(color, toward, step * .05);
    return result;
  }
  function textOn(background) {
    return contrast('#ffffff', background) >= contrast('#14161c', background) ? '#ffffff' : '#14161c';
  }

  // Every concrete token the learner view and the preview read.
  function resolve(input) {
    const style = sanitizeStyle(input);
    const base = theme(style.theme);
    const own = style.colors;
    const c = { ...base.colors };
    if (own.accent) c.accent = own.accent;
    if (own.hero) { c.heroA = own.hero; c.heroB = mix(own.hero, '#000000', .14); }
    if (own.page) { c.pageA = own.page; c.pageB = mix(own.page, c.accent, .06); }
    if (own.card) c.card = own.card;
    if (own.ink) c.ink = own.ink;
    if (own.now) c.now = own.now;
    if (own.done) c.done = own.done;
    if (own.track) c.track = own.track;
    if (style.highContrast) {
      Object.assign(c, { pageA: '#ffffff', pageB: '#ffffff', card: '#ffffff', ink: '#000000', track: '#000000' });
      c.accent = readableOn(c.accent, '#ffffff', 7);
    }
    const dark = luminance(c.card) < .2;
    const heroInk = textOn(mix(c.heroA, c.heroB, .5));
    const tokens = {
      dark,
      sky: c.accent,
      skyButton: readableOn(c.accent, '#ffffff', 4.5),
      skyDeep: dark ? mix(c.accent, '#ffffff', .35) : readableOn(mix(c.accent, '#000000', .25), c.card, 6),
      heroA: c.heroA, heroB: c.heroB, heroInk,
      heroShadow: heroInk === '#ffffff' ? mix(c.heroA, '#000000', .45) : 'transparent',
      heroChip: heroInk === '#ffffff' ? mix(c.heroA, '#000000', .3) : mix(c.heroA, '#ffffff', .55),
      pageA: c.pageA, pageB: c.pageB,
      card: c.card,
      cardSoft: mix(c.card, c.accent, dark ? .12 : .05),
      ink: c.ink,
      inkSoft: style.highContrast ? '#1f1f1f' : readableOn(mix(c.ink, c.card, .3), c.card, 4.5),
      line: style.highContrast ? '#000000' : mix(c.card, c.accent, dark ? .32 : .2),
      now: c.now,
      nowInk: readableOn(c.now, '#ffffff', 4.5),
      done: readableOn(c.done, '#ffffff', 3),
      sun: c.sun,
      track: c.track,
      dot: c.accent
    };
    const heading = style.headingFont || base.heading;
    const body = style.bodyFont || base.body;
    const stickers = [...base.stickers];
    const mascots = style.scene === 'none' ? [] : style.scene === 'custom' ? style.mascots : base.mascots;
    const art = style.scene === 'theme' && window.ScheduleScenes?.[base.id] ? base.id : '';
    const wordsOut = Object.fromEntries(WORDS.map(([key]) => [key, style.words[key] || base.words[key]]));
    const resolvedStamp = style.stamp === 'theme' ? base.stamp : style.stamp;
    const resolvedMarker = style.marker === 'theme' ? base.marker : style.marker;
    return {
      style, theme: base, tokens, heading, body, stickers, mascots,
      scene: art ? 'art' : style.scene === 'theme' && base.scene === 'tickets' ? 'tickets' : mascots.length ? 'mascots' : 'none',
      art,
      pattern: style.highContrast ? 'none' : style.pattern || base.pattern,
      track: style.track || base.track,
      shape: style.shape || base.shape,
      stamp: resolvedStamp === 'check' ? '' : resolvedStamp,
      marker: resolvedMarker === 'dot' ? '' : resolvedMarker,
      celebrate: style.celebrate || base.celebrate,
      motion: (style.motion || base.motion) === 'on',
      words: wordsOut
    };
  }

  function fill(template, name) {
    return String(template).split('{name}').join(name);
  }

  // Readability problems worth telling the planner about before a learner sees them.
  function warnings(look) {
    const t = look.tokens;
    const out = [];
    if (contrast(t.ink, t.card) < 4.5) out.push('Text on cards is hard to read. Pick a darker text colour or a lighter card colour.');
    if (contrast(t.ink, t.pageA) < 3) out.push('Text on the page background is hard to read.');
    if (contrast(t.heroInk, t.heroA) < 3 || contrast(t.heroInk, t.heroB) < 3) out.push('The banner greeting is hard to read on that banner colour.');
    return out;
  }

  function svgUrl(svg) {
    return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
  }
  function esc(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  }

  function patternImage(look) {
    const t = look.tokens;
    const strength = look.style.patternStrength === 'playful' ? 1.9 : 1;
    const ink = t.dark ? '#ffffff' : t.sky;
    const o = (value) => Math.min(.6, value * strength).toFixed(3);
    switch (look.pattern) {
      case 'stickers': {
        const set = (look.mascots.length ? look.mascots : look.stickers).slice(0, 4);
        while (set.length < 4) set.push(look.stickers[set.length] || '⭐');
        const spots = [[22, 34, -12], [96, 22, 10], [60, 92, 6], [136, 108, -8]];
        return svgUrl('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="140"><g font-size="24" opacity="' + o(.13) + '" font-family="sans-serif">' +
          spots.map(([x, y, r], index) => '<text x="' + x + '" y="' + y + '" transform="rotate(' + r + ' ' + x + ' ' + y + ')" text-anchor="middle">' + esc(set[index]) + '</text>').join('') + '</g></svg>');
      }
      case 'dots':
        return svgUrl('<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26"><circle cx="6" cy="6" r="3" fill="' + ink + '" opacity="' + o(.12) + '"/><circle cx="19" cy="19" r="3" fill="' + ink + '" opacity="' + o(.08) + '"/></svg>');
      case 'stars':
        return svgUrl('<svg xmlns="http://www.w3.org/2000/svg" width="90" height="90"><g fill="' + (t.dark ? '#ffffff' : t.sky) + '" opacity="' + o(.16) + '"><path d="m18 8 3 9 9 3-9 3-3 9-3-9-9-3 9-3Z"/><path d="m66 52 2 6 6 2-6 2-2 6-2-6-6-2 6-2Z"/><circle cx="70" cy="16" r="2"/><circle cx="26" cy="72" r="1.6"/></g></svg>');
      case 'stripes':
        return svgUrl('<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><path d="M-7 7 7-7M0 28 28 0M21 35 35 21" stroke="' + ink + '" stroke-width="5" opacity="' + o(.07) + '"/></svg>');
      case 'grid':
        return svgUrl('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><path d="M32 0H0V32" fill="none" stroke="' + ink + '" stroke-width="1.5" opacity="' + o(.12) + '"/><circle cx="0" cy="0" r="2.5" fill="' + ink + '" opacity="' + o(.18) + '"/></svg>');
      default:
        return 'none';
    }
  }

  // The vertical line joining the times: width and paint.
  function trackPaint(look) {
    const t = look.tokens;
    const color = t.track;
    switch (look.track) {
      case 'rainbow': return ['8px', 'linear-gradient(to bottom, #ef4444, #f59e0b, #facc15, #22c55e, #3b82f6, #8b5cf6, #ef4444)'];
      case 'rails': return ['18px', 'linear-gradient(to right, ' + color + ' 0 3px, transparent 3px calc(100% - 3px), ' + color + ' calc(100% - 3px)), repeating-linear-gradient(to bottom, ' + mix(color, '#8b5a2b', .5) + ' 0 4px, transparent 4px 13px)'];
      case 'road': return ['18px', 'repeating-linear-gradient(to bottom, #fcd34d 0 10px, transparent 10px 20px) center / 3px 100% no-repeat, ' + color];
      case 'dotted': return ['12px', 'radial-gradient(circle, ' + color + ' 3.5px, transparent 4px) center top / 12px 14px repeat-y'];
      case 'dashed': return ['6px', 'repeating-linear-gradient(to bottom, ' + color + ' 0 12px, transparent 12px 20px)'];
      case 'hazard': return ['12px', 'repeating-linear-gradient(-45deg, #1c1f24 0 6px, ' + color + ' 6px 12px)'];
      case 'prints': return ['24px', svgUrl('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="40"><text x="12" y="18" font-size="15" text-anchor="middle" opacity=".55" transform="rotate(-8 12 14)">🐾</text></svg>') + ' center top / 24px 40px repeat-y'];
      default: return ['4px', color];
    }
  }

  function variables(look) {
    const t = look.tokens;
    const heading = FONTS[look.heading];
    const body = FONTS[look.body];
    const [trackWidth, trackBackground] = trackPaint(look);
    const family = (font) => (font.family ? '"' + font.family + '", ' : '') + font.fallback;
    return {
      '--sky': t.sky, '--sky-deep': t.skyDeep, '--sky-button': t.skyButton,
      '--hero-a': t.heroA, '--hero-b': t.heroB, '--hero-ink': t.heroInk, '--hero-shadow': t.heroShadow, '--hero-chip': t.heroChip,
      '--page-a': t.pageA, '--page-b': t.pageB, '--pattern': patternImage(look),
      '--card': t.card, '--card-soft': t.cardSoft, '--ink': t.ink, '--ink-soft': t.inkSoft, '--line': t.line,
      '--now': t.now, '--now-ink': t.nowInk, '--grass': t.done, '--sun': t.sun, '--dot': t.dot,
      '--track-w': trackWidth, '--track-bg': trackBackground,
      '--display': family(heading), '--body': family(body), '--body-weight': String(body.body || 800),
      '--display-scale': String(heading.scale || 1),
      '--text': String(TEXT_SCALE[look.style.textSize] || 1),
      '--round': String(SHAPE_ROUND[look.shape] || 1),
      '--line-w': look.style.borders === 'bold' ? '3px' : '2px',
      '--pic-boost': look.style.pictureSize === 'large' ? '1.35' : '1'
    };
  }

  function fontsHref(keys) {
    const specs = [...new Set(keys)].map((key) => FONTS[key]?.spec).filter(Boolean);
    return specs.length ? 'https://fonts.googleapis.com/css2?family=' + specs.join('&family=') + '&display=swap' : '';
  }
  function loadFonts(keys, id) {
    const href = fontsHref(keys);
    let link = document.getElementById(id);
    if (!href) { link?.remove(); return; }
    if (link && link.getAttribute('href') === href) return;
    if (!link) { link = document.createElement('link'); link.id = id; link.rel = 'stylesheet'; document.head.append(link); }
    link.href = href;
  }

  // Paint a look onto an element (the learner page's root, or the studio's preview).
  function paint(node, look) {
    for (const [name, value] of Object.entries(variables(look))) node.style.setProperty(name, value);
    node.dataset.theme = look.theme.id;
    node.dataset.scheme = look.tokens.dark ? 'dark' : 'light';
    node.dataset.motion = look.motion ? 'on' : 'off';
    node.dataset.contrast = look.style.highContrast ? 'high' : 'standard';
  }

  // The banner's picture: an illustration, the theme's stickers, or nothing.
  function sceneMarkup(look) {
    return look.scene === 'art' ? window.ScheduleScenes[look.art] : mascotMarkup(look);
  }

  function mascotMarkup(look) {
    return look.mascots.map((mascot, index) => '<span class="mascot mascot-' + (index + 1) + '">' + esc(mascot) + '</span>').join('');
  }

  // A short burst of the theme's stickers from a just-checked item.
  function celebrate(origin, look) {
    if (!look || look.celebrate === 'off' || !origin?.getBoundingClientRect) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const box = origin.getBoundingClientRect();
    const count = look.celebrate === 'party' ? 14 : 6;
    const set = look.stamp ? [look.stamp, ...look.stickers] : look.stickers;
    for (let index = 0; index < count; index++) {
      const piece = document.createElement('span');
      piece.className = 'celebration-piece';
      piece.setAttribute('aria-hidden', 'true');
      piece.textContent = set[index % set.length];
      Object.assign(piece.style, { position: 'fixed', left: box.left + box.width / 2 + 'px', top: box.top + box.height / 2 + 'px', zIndex: 50, pointerEvents: 'none', fontSize: (look.celebrate === 'party' ? 22 : 18) + 'px', lineHeight: 1 });
      document.body.append(piece);
      const angle = (Math.PI * 2 * index) / count + Math.random() * .5;
      const distance = (look.celebrate === 'party' ? 90 : 46) + Math.random() * 30;
      const x = Math.cos(angle) * distance; const y = Math.sin(angle) * distance - 20;
      const animation = piece.animate([
        { transform: 'translate(-50%, -50%) scale(.4)', opacity: 1 },
        { transform: 'translate(calc(-50% + ' + x + 'px), calc(-50% + ' + y + 'px)) scale(1.1) rotate(' + (Math.random() * 60 - 30) + 'deg)', opacity: 1, offset: .7 },
        { transform: 'translate(calc(-50% + ' + x + 'px), calc(-50% + ' + (y + 30) + 'px)) scale(.9)', opacity: 0 }
      ], { duration: look.celebrate === 'party' ? 900 : 650, easing: 'cubic-bezier(.2,.8,.3,1)' });
      animation.onfinish = () => piece.remove();
      animation.oncancel = () => piece.remove();
    }
  }

  return {
    FONTS, READING_FONTS, THEMES, GROUPS, COLOR_ROLES, OPTIONS, WORDS, EXTRA_STICKERS,
    sanitizeStyle, theme, resolve, fill, warnings, variables, paint, fontsHref, loadFonts, mascotMarkup, sceneMarkup, celebrate, contrast
  };
})();
