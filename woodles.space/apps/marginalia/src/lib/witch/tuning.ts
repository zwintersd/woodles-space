// Idle tuning — every balance number for The Witch's Book in one place,
// so the loop stays legible and min/max-able by inspection.

// ── observation: the idle tick ─────────────────────────────────────────────
// Seconds of attention needed to advance each stage, at studyEase 1.0.
// Index 0 unused (Notice is automatic on emergence).
//   1: Notice  → Observed
//   2: Observed → Studied
//   3: Studied  → Known
export const STAGE_SECONDS = [0, 8, 30, 95];

// A manual "look closer" click adds this many study-seconds to an
// attended life. The clicker hook on top of the idle accrual.
export const LOOK_CLOSER_SECONDS = 2.5;

// ── insight: the world's idle currency ────────────────────────────────────
// Insight/sec from one life = its insightWeight × the multiplier for its
// deepest reached stage.
export const STAGE_INSIGHT_MULT = [0, 0.2, 0.6, 1.0]; // by stage

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
export const STOCK_DRIFT_PER_SEC = 0.02; // pull back toward neutral

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
