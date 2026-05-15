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
