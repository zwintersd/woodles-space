import { createFaerie } from '../src/index.js';

const faerie = createFaerie({ tone: 'moonlight', motion: 'auto', size: 64 });
const byId = (id) => document.getElementById(id);
const stateLabels = {
  idle: 'Resting nearby',
  resting: 'Resting nearby',
  attending: 'Lighting the way',
  speaking: 'A little word',
  following: 'Following your lead',
  celebrating: 'A little celebration',
  hidden: 'Taking a quiet moment',
};

const toneColors = {
  moonlight: ['#b9ebea', '185, 235, 234'],
  lilac: ['#ccbfff', '204, 191, 255'],
  rose: ['#ffd1e0', '255, 209, 224'],
  leaf: ['#c2efb4', '194, 239, 180'],
};

let currentTourStep = -1;
let following = false;

function announce(message) {
  byId('playground-status').textContent = message;
}

function syncState() {
  const state = faerie.state;
  byId('faerie-state').textContent = stateLabels[state] || state.charAt(0).toUpperCase() + state.slice(1).replaceAll('-', ' ');
  document.body.dataset.faerieState = state;
  following = state === 'following';
  byId('follow-pointer').setAttribute('aria-pressed', String(following));
  byId('visibility').textContent = state === 'hidden' ? 'Show Faerie' : 'Hide Faerie';
}

function endTour({ rest = false } = {}) {
  currentTourStep = -1;
  byId('tour-progress').hidden = true;
  byId('stop-tour').hidden = true;
  byId('start-tour').querySelector('strong').textContent = 'Take a little tour';
  if (rest) faerie.rest();
}

const tourSteps = [
  {
    target: 'next-step',
    message: 'A little beginning. This is your next small step — one thing you can give your attention to.',
    placement: 'top',
  },
  {
    target: 'save-draft',
    message: 'When an idea is ready to keep, I can show you where to save it.',
    placement: 'bottom',
  },
  {
    target: 'collection-target',
    message: 'And when something deserves a closer look, I can quietly light the way. You decide what happens next.',
    placement: 'top',
  },
];

function showTourStep(index) {
  currentTourStep = index;
  const step = tourSteps[index];
  const lastStep = index === tourSteps.length - 1;
  byId('tour-progress').hidden = false;
  byId('tour-progress').textContent = `${index + 1} of ${tourSteps.length}`;
  byId('stop-tour').hidden = false;
  byId('start-tour').querySelector('strong').textContent = 'Start the tour again';
  faerie.attend(byId(step.target), {
    message: step.message,
    placement: step.placement,
    scroll: true,
    action: {
      label: lastStep ? 'Lovely, thank you' : 'Next little stop',
      onSelect: () => {
        if (lastStep) {
          endTour();
          faerie.celebrate('You know your way now. I’ll be nearby.');
          announce('Tour complete. Faerie is nearby.');
        } else {
          showTourStep(index + 1);
        }
      },
    },
  });
  announce(`Tour stop ${index + 1} of ${tourSteps.length}.`);
}

byId('guide-attention').addEventListener('click', () => {
  endTour();
  const targetName = byId('attention-target').value;
  let target = byId(targetName);
  if (targetName === 'open-space') {
    target.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'nearest' });
    const rect = target.getBoundingClientRect();
    target = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }
  const message = byId('hint-message').value.trim();
  faerie.attend(target, {
    message: message || 'A little light, right here.',
    placement: 'auto',
    scroll: true,
    action: { label: 'Got it, thank you', onSelect: () => faerie.rest() },
  });
  announce('Faerie is guiding your attention.');
});

byId('say-hint').addEventListener('click', () => {
  endTour();
  faerie.say(byId('hint-message').value.trim() || 'Hello. I’m nearby when you need me.', {
    action: { label: 'Hello, Faerie', onSelect: () => faerie.rest() },
  });
});

byId('start-tour').addEventListener('click', () => showTourStep(0));
byId('stop-tour').addEventListener('click', () => {
  endTour({ rest: true });
  announce('Tour finished. Faerie is resting nearby.');
});

byId('follow-pointer').addEventListener('click', () => {
  endTour();
  following = !following;
  faerie.follow(following);
  syncState();
});

byId('celebrate').addEventListener('click', () => {
  endTour();
  faerie.celebrate('A little progress is still progress. Well done.');
});

byId('rest').addEventListener('click', () => {
  endTour({ rest: true });
});

byId('visibility').addEventListener('click', () => {
  endTour();
  if (faerie.state === 'hidden') faerie.show();
  else faerie.hide();
  syncState();
});

document.querySelectorAll('.tone-button[data-tone]').forEach((button) => {
  button.addEventListener('click', () => {
    const tone = button.dataset.tone;
    faerie.configure({ tone });
    document.querySelectorAll('.tone-button[data-tone]').forEach((choice) => {
      choice.setAttribute('aria-pressed', String(choice === button));
    });
    document.documentElement.style.setProperty('--glow', toneColors[tone][0]);
    document.documentElement.style.setProperty('--glow-rgb', toneColors[tone][1]);
    announce(`${button.textContent.trim()} glow selected.`);
  });
});

byId('gentle-motion').addEventListener('change', (event) => {
  const reduced = event.target.checked;
  faerie.configure({ motion: reduced ? 'reduced' : 'auto' });
  document.body.dataset.reducedMotion = String(reduced);
  document.documentElement.style.scrollBehavior = reduced ? 'auto' : '';
  announce(reduced ? 'Gentle movement selected.' : 'Movement follows your device’s preference.');
});

byId('studio-note').addEventListener('input', () => {
  byId('save-status').textContent = 'A fresh thought';
});

byId('save-draft').addEventListener('click', () => {
  try {
    sessionStorage.setItem('faerie.playground.draft', byId('studio-note').value);
  } catch {
    // The sample stays available on this page when session storage is unavailable.
  }
  byId('save-status').textContent = 'Saved for this visit';
  endTour();
  faerie.celebrate('A thought worth keeping. Saved for this visit.');
});

byId('next-step').addEventListener('click', (event) => {
  const button = event.currentTarget;
  const done = button.getAttribute('aria-pressed') !== 'true';
  button.setAttribute('aria-pressed', String(done));
  button.querySelector('.target-description').textContent = done ? 'One small step, taken.' : 'A beginning is enough.';
  if (done) {
    endTour();
    faerie.celebrate('One small step, taken. That counts.');
  }
});

byId('collection-target').addEventListener('click', (event) => {
  const button = event.currentTarget;
  const open = button.getAttribute('aria-expanded') !== 'true';
  button.setAttribute('aria-expanded', String(open));
  byId('collection-peek').hidden = !open;
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && currentTourStep !== -1) endTour();
});

faerie.element.addEventListener('faerie-statechange', syncState);
faerie.element.addEventListener('faerie-dismiss', () => endTour());
syncState();

try {
  const savedDraft = sessionStorage.getItem('faerie.playground.draft');
  if (savedDraft !== null) {
    byId('studio-note').value = savedDraft;
    byId('save-status').textContent = 'Saved for this visit';
  }
} catch {
  // The playground also works with session storage disabled.
}

// Expose the companion for experimenting in the developer console.
window.faerie = faerie;

window.addEventListener('pagehide', (event) => {
  // A restored page keeps its original companion. A closed page releases it.
  if (!event.persisted) faerie.destroy();
});
