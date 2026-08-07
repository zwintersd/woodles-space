// Idle tuning — every balance number for The Witch's Book in one place,
// so the loop stays legible and min/max-able by inspection.

// ── observation: the idle tick ─────────────────────────────────────────────
// Seconds of attention needed to advance each stage, at studyEase 1.0.
// Index 0 unused (Notice is automatic on emergence).
//   1: Notice  → Observed
//   2: Observed → Studied
//   3: Studied  → Known
// Steeply increasing on purpose: a 21-second first beat so something happens
// immediately, and a long final commitment so Knowing a thing is a real one.
// At these numbers the opening water worldspace runs ~34 minutes and the
// shallows ~58 — it was four minutes and seven, which meant the whole authored
// world was spent before the first hour. See BALANCE.md.
export const STAGE_SECONDS = [0, 30, 210, 1100];

// A manual "look closer" click adds this many study-seconds to an
// attended life. The clicker hook on top of the idle accrual.
export const LOOK_CLOSER_SECONDS = 2.5;

// ── insight: the world's idle currency ────────────────────────────────────
// Insight/sec from one life = its insightWeight × the multiplier for its
// deepest reached stage.
export const STAGE_INSIGHT_MULT = [0, 0.2, 0.6, 1.0]; // by stage

// How often the idle trickle batches into a "+N insight" popup, in sim-
// seconds. Announcing every frame's fractional gain would be noise; this
// keeps the ambient drip visible without a popup storm.
export const INSIGHT_TRICKLE_ANNOUNCE_SEC = 3;

// ── attention: the one capacity upgrade ───────────────────────────────────
export const ATTENTION_START = 2;
// Insight cost to raise capacity to 3, 4, 5, 6. Empty = at maximum.
export const ATTENTION_COSTS = [45, 130, 320, 750];

// ── distilling: the World → Web bridge ────────────────────────────────────
// The impatient path to Essence: convert a block of Insight directly.
export const DISTILL_INSIGHT_COST = 60;
export const DISTILL_ESSENCE_GAIN = 1;

// ── essence: the patient path ─────────────────────────────────────────────
// Witnessing deeply is rewarded with creative power for the next world.
export const ESSENCE_ON_STUDIED = 1;
export const ESSENCE_ON_KNOWN = 2;

// ── favor: the relationship, slowly drifting ──────────────────────────────
// Favor eases toward a target set by how much she has fully Known. Attentive
// witnessing is what the world responds to.
export const FAVOR_BASE_TARGET = 50;
export const FAVOR_PER_KNOWN = 6;
export const FAVOR_DRIFT_PER_SEC = 0.012; // fraction of the gap closed each second
// Favor multiplies Insight: a world at ease shows her more.
//   favor   0 → ×0.5      favor 100 → ×1.5
export const favorMultiplier = (favor: number) => 0.5 + favor / 100;

// ── offline ───────────────────────────────────────────────────────────────
export const OFFLINE_CAP_SECONDS = 8 * 60 * 60; // credit at most 8 hours away

// ── vital signs: the world's metabolism ─────────────────────────────────────
// Three stocks — nutrients, oxygen, moisture — that life produces and consumes.
// Each starts neutral and drifts back toward neutral when nothing acts on it, so
// an empty or unwatched world holds still.
export const STOCK_START = 50;
export const STOCK_NEUTRAL = 50;
// How hard a stock is pulled back per point it sits *outside* its band. Inside
// the band there is no pull at all, so the world is free to settle wherever its
// life holds it. At the old 0.02-toward-neutral this was ~0.2/sec of restoring
// force ten points out — the same order as the entire world's metabolism, so
// nothing could ever leave the middle.
export const STOCK_DRIFT_PER_SEC = 0.005;

// The world's passive losses, per point above the band floor, per second — the
// sinks DESIGN.md names but never had: moisture "evaporates" (§1.1) and salt
// deposits "reduce nutrient leach" (§1.2). Sized so the *complete* world settles
// mid-band (roughly nutrients 60, oxygen 65, moisture 55) against an authored
// metabolism that sums to +0.12 / +0.24 / +0.29 per second.
//
// Oxygen has no sink named in the design — "animals burn it" is the intent, and
// world 1 has one animal against five oxygen producers. Its rate here stands in
// for that missing content; if world 2 brings more animals, lower it.
export const STOCK_LEAK: Record<'nutrients' | 'oxygen' | 'moisture', number> = {
	nutrients: 0.006, // leach
	oxygen: 0.012, // escape (see above)
	moisture: 0.0145 // evaporation
};

// How metabolically present life is at each observation stage. Unwitnessed life
// (Noticed) doesn't move the world at all; deeply Known life moves it fully.
export const STAGE_ACTIVITY = [0, 0.3, 0.7, 1.0];

// A need is a healthy band on a stock; health falls from 100 at the band edge to
// 0 this many points outside it.
export const BAND_FALLOFF = 25;

// Vitality — each life's health, 0..1, easing toward 0 under stress and back
// toward 1 when its needs are met. Exponential rates, stable for any dt.
export const VITALITY_DRAIN_PER_SEC = 0.05;
export const VITALITY_RECOVER_PER_SEC = 0.03;
// Life never vanishes in this pass — it floors here, dormant, and can recover.
export const VITALITY_FLOOR = 0.05;

// Favor answers to suffering: each unit of accumulated stress (1 − vitality,
// summed across life) pulls the favor target down by this much.
export const FAVOR_STRESS_PENALTY = 4;

// Stability rises a little with each ecosystem she has come to Know.
export const STABILITY_ECOSYSTEM_BONUS = 0.04;

// Below this stability, with life present, the world is "going quiet" — a
// placeholder state ahead of the full collapse/soft-fail pass.
export const WORLD_QUIET_STABILITY = 18;

// ── interventions: the Known endgame (phase C) ──────────────────────────────
// Effect magnitudes. tend/invoke bump a stock level — drift then fades them, so
// they read as temporary; shape/encourage/guide set a lasting modifier.
export const TEND_BUMP = 8; // + to a plant's focus stock
export const INVOKE_BUMP = 22; // + to moisture, ×0.6..1.4 (invoked, never commanded)
export const SHAPE_BASELINE_RAISE = 15; // permanent raise to a stock's drift target
export const SHAPE_BASELINE_MAX = 85;
export const ENCOURAGE_STABILITY = 8; // permanent stability add
export const ENCOURAGE_STABILITY_MAX = 40;
export const GUIDE_METABOLISM_SCALE = 0.5; // a guided animal eases what it draws

// Restraint, rewarded. Each act adds load by its permanence; load decays, and
// while it is low and the stocks sit in band the world banks an equilibrium
// dividend — so the lightest touch is worth the most.
export const INTERVENTION_LOAD_WEIGHT = {
	temporary: 0.1,
	lasting: 0.3,
	permanent: 0.5
} as const;
export const INTERVENTION_LOAD_DECAY = 0.01; // per second, the hand grows light again
export const FAVOR_EQUILIBRIUM_BONUS = 8;
export const EQUILIBRIUM_MIN_FACTOR = 0.5; // above this, equilibrium seconds bank

// ── focus: consecutive "look closer" clicks build a bounded streak ─────────
// A click within this many seconds of the last one continues the streak;
// a longer gap resets it to one. Each step beyond the first adds a little
// more study-time to the click — reads as skill, not randomness.
export const FOCUS_STREAK_WINDOW_SEC = 2.2;
export const FOCUS_STREAK_STEP = 0.09; // + per streak level beyond the first
export const FOCUS_STREAK_MAX = 6; // caps the bonus at +(MAX-1)*STEP

// ── vital-sign instrumentation: rolling sample history for the sparklines ──
export const STOCK_HISTORY_SAMPLE_SEC = 3; // sim-seconds between samples
export const STOCK_HISTORY_LENGTH = 40; // samples kept per stock

// ── field notes: the live observation log ──────────────────────────────────
export const FIELD_NOTES_MAX = 24;

// ── category mastery: a completion bonus, once earned, never revoked ───────
// every currently-emerged life in a category (aquatic/terrestrial/
// atmospheric) reaching Known permanently lifts that category's yield.
export const CATEGORY_MASTERY_BONUS = 0.12;
