// the game state. svelte 5 runes.

import { generators, generatorCost, type Generator } from '../content/generators';
import { upgrades, type Upgrade } from '../content/upgrades';
import { practices, type Practice } from '../content/practices';
import { glosses as glossLines } from '../content/glosses';
import { ambient as ambientLines } from '../content/ambient';
import { canonicalFor, type Canonical } from '../content/canonical';
import { citationFromPassage, type Passage } from '../content/passages';
import { emptySave, load, save, wipe, type SaveShape } from './persist';

// ─── feed ─────────────────────────────────────────────────────────────────

export type FeedKind =
	| 'gloss'
	| 'narration'
	| 'ambient'
	| 'milestone'
	| 'echo'
	| 'system';

export interface FeedEntry {
	id: number;
	kind: FeedKind;
	text: string;
	at: number;
	cost?: number; // for "unname"
}

const FEED_CAP = 60;

// ─── helpers ──────────────────────────────────────────────────────────────

function rand<T>(arr: readonly T[]): T {
	return arr[(Math.random() * arr.length) | 0];
}

function randInt(min: number, maxExclusive: number): number {
	return min + ((Math.random() * (maxExclusive - min)) | 0);
}

// numbers folded into prose: format helpers
export function fmt(n: number): string {
	if (n < 1000) return Math.floor(n).toString();
	const units = ['', 'k', 'm', 'b', 't', 'q'];
	let i = 0;
	let v = n;
	while (v >= 1000 && i < units.length - 1) {
		v /= 1000;
		i++;
	}
	const decimals = v < 10 ? 2 : v < 100 ? 1 : 0;
	return v.toFixed(decimals) + units[i];
}

// ─── state class ──────────────────────────────────────────────────────────

export class Game {
	// resources
	glosses = $state(0);
	commentaries = $state(0);
	apparatus = $state(0);
	recensions = $state(0);
	palimpsest = $state(1);
	prestigeIndex = $state(0);

	// counters
	totalGlossesEver = $state(0);
	clicksEver = $state(0);
	clicksThisHundred = $state(0);

	// owned things
	generators = $state<Record<string, number>>({});
	upgrades = $state<Record<string, boolean>>({});

	// practice cooldowns: map of id → ready-at-ms
	practiceCooldowns = $state<Record<string, number>>({});
	palinodeUsedThisRun = $state(false);

	// transient run flags
	closeReadingClicksLeft = $state(0);
	closeReadingUntil = $state(0);
	palinodeUntil = $state(0);
	seanceUntil = $state(0);
	missingLeafId = $state<string | null>(null);
	missingLeafUntil = $state(0);
	missingLeafDoubleUntil = $state(0);

	// contested passage: cooldown gate + a record of passages survived intact.
	// Citations cross prestige (they belong to the reader, not the run).
	contestedReadyAt = $state(0);          // ms timestamp; 0 = ready now
	contestedActive = $state(false);        // is the encounter currently open?
	canonicalCitations = $state<string[]>([]); // strings: "line — source"
	passagesRead = $state<string[]>([]);    // ids of passages already survived

	// recitation (the séance) — transient flag while the overlay is open;
	// remembered lines persist across prestige and surface in Canonical.
	recitationActive = $state(false);
	canonicalRemembered = $state<string[]>([]);

	// ductus combo: each rapid click increases weight; decays after ~600ms idle
	ductusCombo = $state(0);
	lastClickAt = $state(0);

	// tactile pulse — increments on every click; components watch this
	clickPulse = $state(0);
	lastClickGain = $state(0);

	// charged-click pacing: every Nth click is worth 5×, telegraphed by ClickRegion.
	// Triggers on basic clicks only — the reading pass has its own multipliers.
	chargedClickReady = $state(false);
	clicksUntilCharged = $state(0);

	// whisper instructor: which messages have been shown (persisted) and the
	// timestamp of the last firing for repeatable whispers (in-memory only).
	whispersShown = $state<Record<string, boolean>>({});
	whispersLastFiredAt: Record<string, number> = {};
	lastInteractionAt = $state(Date.now());

	// feed (newest first; we render in reverse)
	feed = $state<FeedEntry[]>([]);
	private nextFeedId = 1;

	// canonical text for current prestige run
	canonical = $derived<Canonical>(canonicalFor(this.prestigeIndex));

	// ── derived rates ─────────────────────────────────────────────────────

	private generatorById(id: string): Generator | undefined {
		return generators.find((g) => g.id === id);
	}

	owned(id: string): number {
		return this.generators[id] ?? 0;
	}

	hasUpgrade(id: string): boolean {
		return !!this.upgrades[id];
	}

	// raw glosses/sec from generators alone (before global mults)
	private baseRate = $derived.by(() => {
		let r = 0;
		for (const g of generators) {
			const n = this.generators[g.id] ?? 0;
			if (n <= 0) continue;
			let contrib = g.rate * n;
			if (this.missingLeafId === g.id && Date.now() < this.missingLeafUntil) {
				contrib = 0;
			} else if (this.missingLeafId === g.id && Date.now() < this.missingLeafDoubleUntil) {
				contrib *= 2;
			}
			r += contrib;
		}
		return r;
	});

	// global multiplier on glosses/sec
	private globalMult = $derived.by(() => {
		let m = this.palimpsest;
		// "second hand" doubles while feed is active. always-on in this game.
		if ((this.generators['second_hand'] ?? 0) > 0) m *= 2;
		// palinode burst
		if (Date.now() < this.palinodeUntil) m *= 10;
		return m;
	});

	glossesPerSec = $derived(this.baseRate * this.globalMult);

	// click power
	clickPower = $derived.by(() => {
		const disputes = this.generators['dispute'] ?? 0;
		let cp = 1 + disputes * 0.01;
		cp *= this.palimpsest;
		// ductus combo, if owned
		if (this.hasUpgrade('ductus')) {
			cp *= 1 + Math.min(this.ductusCombo, 30) * 0.05;
		}
		// close reading active
		if (Date.now() < this.closeReadingUntil && this.closeReadingClicksLeft > 0) {
			cp *= 5;
		}
		return cp;
	});

	commentaryRate = $derived.by(() => {
		if ((this.generators['glossator'] ?? 0) <= 0) return 0;
		// commentaries are a slow trickle from total glosses/sec
		let rate = this.glossesPerSec * 0.001;
		const scholiasts = this.generators['scholiast'] ?? 0;
		rate *= 1 + scholiasts * 0.05;
		if (this.hasUpgrade('confluence')) rate *= 1.5;
		return rate;
	});

	apparatusRate = $derived.by(() => {
		const contradictions = this.generators['contradiction'] ?? 0;
		if (contradictions <= 0) return 0;
		return contradictions * 0.0005 * this.palimpsest;
	});

	recensionRate = $derived.by(() => {
		const mis = this.generators['misattribution'] ?? 0;
		if (mis <= 0) return 0;
		return mis * 0.00002 * this.palimpsest;
	});

	// prestige reward: palimpsest gained on voluntary forgetting
	pendingPalimpsest = $derived.by(() => {
		// gain depends mostly on recensions, with apparatus as a kicker
		const r = this.recensions;
		const a = this.apparatus;
		const score = r * 5 + a * 0.5;
		if (score < 1) return 0;
		return Math.floor(Math.sqrt(score));
	});

	// ── api ───────────────────────────────────────────────────────────────

	pushFeed(kind: FeedKind, text: string, cost?: number) {
		const entry: FeedEntry = { id: this.nextFeedId++, kind, text, at: Date.now(), cost };
		this.feed.push(entry);
		if (this.feed.length > FEED_CAP) this.feed.splice(0, this.feed.length - FEED_CAP);
	}

	click() {
		const now = Date.now();
		this.lastInteractionAt = now;
		// ductus combo accumulates if last click within 600ms
		if (now - this.lastClickAt < 600) this.ductusCombo += 1;
		else this.ductusCombo = 0;
		this.lastClickAt = now;

		let gain = this.clickPower;

		// charged click consumed
		const wasCharged = this.chargedClickReady;
		if (wasCharged) {
			gain *= 5;
			this.chargedClickReady = false;
		}
		// reset the countdown to the next charged click — a small jitter so the
		// tell never feels metronomic
		if (!this.chargedClickReady) {
			this.clicksUntilCharged -= 1;
			if (this.clicksUntilCharged <= 0) {
				this.chargedClickReady = true;
				this.clicksUntilCharged = 12 + ((Math.random() * 9) | 0);
			}
		}

		// collation: every 100th click is worth 10x
		this.clicksThisHundred += 1;
		if (this.hasUpgrade('collation') && this.clicksThisHundred >= 100) {
			gain *= 10;
			this.clicksThisHundred = 0;
			this.pushFeed('milestone', 'a collation lands. the hundredth gloss carries the weight of ten.');
		}

		// close reading consumes a charge
		if (Date.now() < this.closeReadingUntil && this.closeReadingClicksLeft > 0) {
			this.closeReadingClicksLeft -= 1;
			if (this.closeReadingClicksLeft <= 0) this.closeReadingUntil = 0;
		}

		this.glosses += gain;
		this.totalGlossesEver += gain;
		this.clicksEver += 1;
		this.lastClickGain = gain;
		this.clickPulse += 1;

		if (wasCharged) {
			this.pushFeed('milestone', 'a heavier mark — the click weighs five times as much.');
		}

		// only occasionally surface a written gloss in the feed —
		// the mark itself is the per-click feedback.
		if (Math.random() < 0.08) {
			this.pushFeed('gloss', rand(glossLines));
		}

		// emendation: 5% chance to also produce a commentary
		if (this.hasUpgrade('emendation') && Math.random() < 0.05) {
			this.commentaries += 1;
			this.pushFeed('milestone', 'an emendation cohereres into a commentary.');
		}
	}

	// ── stray glosses (asides) ──────────────────────────────────────────────

	gainStrayGloss(amount: number, source: string) {
		this.lastInteractionAt = Date.now();
		const gain = amount * this.palimpsest;
		this.glosses += gain;
		this.totalGlossesEver += gain;
		this.lastClickGain = gain;
		this.clickPulse += 1;
		// modest, intentionally rare — the aside is its own small reward.
		if (Math.random() < 0.25) {
			this.pushFeed('gloss', `caught a stray phrase — ${source}`);
		}
	}

	// ── whispers ────────────────────────────────────────────────────────────

	markWhisperShown(id: string, repeat: boolean) {
		this.whispersLastFiredAt[id] = Date.now();
		if (!repeat) {
			this.whispersShown[id] = true;
		}
	}

	noteInteraction() {
		this.lastInteractionAt = Date.now();
	}

	// ── reading pass ─────────────────────────────────────────────────────────

	glossFromReadingPass(quality: 'luminous' | 'tight' | 'wide') {
		const qualMult = quality === 'luminous' ? 25 : quality === 'tight' ? 5 : 1;

		// ductus combo still applies (rapid successive hits build a rhythm)
		const now = Date.now();
		this.lastInteractionAt = now;
		if (now - this.lastClickAt < 600) this.ductusCombo += 1;
		else this.ductusCombo = 0;
		this.lastClickAt = now;

		let gain = this.clickPower * qualMult;

		// collation: every 100th click
		this.clicksThisHundred += 1;
		if (this.hasUpgrade('collation') && this.clicksThisHundred >= 100) {
			gain *= 10;
			this.clicksThisHundred = 0;
			this.pushFeed('milestone', 'a collation lands. the hundredth gloss carries the weight of ten.');
		}

		// close reading consumes a charge
		if (Date.now() < this.closeReadingUntil && this.closeReadingClicksLeft > 0) {
			this.closeReadingClicksLeft -= 1;
			if (this.closeReadingClicksLeft <= 0) this.closeReadingUntil = 0;
		}

		this.glosses += gain;
		this.totalGlossesEver += gain;
		this.clicksEver += 1;
		this.lastClickGain = gain;
		this.clickPulse += 1;

		if (Math.random() < 0.08) {
			this.pushFeed('gloss', rand(glossLines));
		}

		// emendation still fires on reading pass hits
		if (this.hasUpgrade('emendation') && Math.random() < 0.05) {
			this.commentaries += 1;
			this.pushFeed('milestone', 'an emendation coheres into a commentary.');
		}

		// luminous: 0.5% chance of a free commentary (the charged-token payoff)
		if (quality === 'luminous' && Math.random() < 0.005) {
			this.commentaries += 1;
			this.pushFeed('milestone', 'a luminous gloss — a commentary coheres unbidden.');
		}
	}

	// ── the contested passage ────────────────────────────────────────────────

	// Cooldown is 5 minutes between encounters; the first one is free at unlock.
	private static CONTESTED_COOLDOWN_MS = 5 * 60 * 1000;

	canBeginContestedPassage(): boolean {
		if (!this.hasUpgrade('contested_passage')) return false;
		if (this.contestedActive) return false;
		return Date.now() >= this.contestedReadyAt;
	}

	contestedCooldownLeftMs(): number {
		return Math.max(0, this.contestedReadyAt - Date.now());
	}

	beginContestedPassage() {
		if (!this.canBeginContestedPassage()) return;
		this.contestedActive = true;
	}

	completeContestedPassage(args: {
		passage: Passage;
		intact: boolean;
		caught: number;
		corrupted: number;
	}) {
		this.contestedActive = false;
		this.contestedReadyAt = Date.now() + Game.CONTESTED_COOLDOWN_MS;

		if (args.intact) {
			// Apparatus reward scales with how cleanly the read went.
			const apparatusGain = 5 + args.caught * 0.5 - args.corrupted * 1;
			this.apparatus += Math.max(1, apparatusGain);

			// First-time read of a passage: it joins the canonical citations.
			if (!this.passagesRead.includes(args.passage.id)) {
				this.passagesRead.push(args.passage.id);
				this.canonicalCitations.push(citationFromPassage(args.passage));
			}

			this.pushFeed(
				'milestone',
				`the contested passage holds. apparatus +${Math.max(1, apparatusGain).toFixed(1)} — and the passage joins your citations.`
			);
		} else {
			this.pushFeed(
				'milestone',
				'the passage collapses into nonsense. nothing is gained from a reading that was not finished.'
			);
		}
	}

	// ── the recitation (v2.5) ────────────────────────────────────────────────

	beginRecitation() {
		if (!this.hasUpgrade('recitation')) return;
		if (this.recitationActive) return;
		this.recitationActive = true;
	}

	completeRecitation(args: { hits: number; total: number; rememberedLine?: string }) {
		this.recitationActive = false;
		const ratio = args.total > 0 ? args.hits / args.total : 0;

		if (ratio >= 0.8) {
			// They are remembered.
			this.apparatus += 5;
			if (args.rememberedLine) {
				this.canonicalRemembered.push(args.rememberedLine);
			}
			this.pushFeed(
				'milestone',
				`they are remembered — ${args.hits} of ${args.total} in time. apparatus +5, and a line returns to the canonical.`
			);
		} else if (ratio >= 0.5) {
			this.apparatus += 2;
			this.pushFeed(
				'milestone',
				`a partial recitation — ${args.hits} of ${args.total}. apparatus +2. some of the rhythm comes back.`
			);
		} else {
			this.pushFeed(
				'milestone',
				`the margin forgets itself. only ${args.hits} of ${args.total} were in time. nothing returns.`
			);
		}
	}

	// ── the dispute ──────────────────────────────────────────────────────────

	resourcesFromDispute(mode: 'agreement' | 'disagreement' | 'counterpoint') {
		const now = Date.now();
		this.lastInteractionAt = now;
		if (now - this.lastClickAt < 600) this.ductusCombo += 1;
		else this.ductusCombo = 0;
		this.lastClickAt = now;
		this.clickPulse += 1;

		switch (mode) {
			case 'agreement':
				this.commentaries += 1;
				if (Math.random() < 0.08)
					this.pushFeed('milestone', 'you collate. the margins agree with themselves.');
				break;
			case 'disagreement':
				this.apparatus += 0.1;
				if (Math.random() < 0.1)
					this.pushFeed('milestone', 'a refutation. apparatus accretes around the disputed passage.');
				break;
			case 'counterpoint':
				this.recensions += 0.01;
				if (Math.random() < 0.25)
					this.pushFeed('milestone', 'counterpoint — your reading diverges into its own tradition.');
				break;
		}
	}

	canBuyGenerator(id: string): boolean {
		const g = this.generatorById(id);
		if (!g) return false;
		return this.glosses >= generatorCost(g, this.owned(id));
	}

	costFor(id: string): number {
		const g = this.generatorById(id);
		if (!g) return Infinity;
		return generatorCost(g, this.owned(id));
	}

	buyGenerator(id: string) {
		const g = this.generatorById(id);
		if (!g) return;
		const cost = generatorCost(g, this.owned(id));
		if (this.glosses < cost) return;
		this.glosses -= cost;
		this.generators[id] = (this.generators[id] ?? 0) + 1;
		this.pushFeed('milestone', `${g.name} — acquired. (${this.generators[id]})`);
	}

	canBuyUpgrade(u: Upgrade): boolean {
		if (this.upgrades[u.id]) return false;
		if (u.cost.commentaries && this.commentaries < u.cost.commentaries) return false;
		if (u.cost.apparatus && this.apparatus < u.cost.apparatus) return false;
		if (u.cost.recensions && this.recensions < u.cost.recensions) return false;
		return true;
	}

	buyUpgrade(id: string) {
		const u = upgrades.find((x) => x.id === id);
		if (!u || !this.canBuyUpgrade(u)) return;
		if (u.cost.commentaries) this.commentaries -= u.cost.commentaries;
		if (u.cost.apparatus) this.apparatus -= u.cost.apparatus;
		if (u.cost.recensions) this.recensions -= u.cost.recensions;
		this.upgrades[id] = true;
		this.pushFeed('milestone', `marginalia: ${u.name} — adopted as a reading practice.`);
		// activation side effects
		if (id === 'missing_leaf') this.triggerMissingLeaf();
	}

	practiceReady(id: string): boolean {
		if (id === 'palinode') return !this.palinodeUsedThisRun;
		const ready = this.practiceCooldowns[id] ?? 0;
		return Date.now() >= ready;
	}

	practiceCost(id: string): number {
		const p = practices.find((x) => x.id === id);
		return p?.cost ?? 0;
	}

	canInvokePractice(p: Practice): boolean {
		if (this.glosses < p.cost) return false;
		return this.practiceReady(p.id);
	}

	invokePractice(id: string) {
		const p = practices.find((x) => x.id === id);
		if (!p) return;
		if (!this.canInvokePractice(p)) return;
		this.glosses -= p.cost;
		this.practiceCooldowns[id] = Date.now() + p.cooldown * 1000;
		switch (id) {
			case 'close_reading':
				this.closeReadingClicksLeft = 10;
				this.closeReadingUntil = Date.now() + p.duration * 1000;
				this.pushFeed('milestone', '— close reading — the next ten clicks weigh five times as much.');
				break;
			case 'marginal_seance':
				this.seanceUntil = Date.now() + p.duration * 1000;
				this.pushFeed('milestone', '— marginal séance — a passage from elsewhere is summoned.');
				this.bleedThrough();
				break;
			case 'unname':
				this.unnameLast();
				break;
			case 'recitation':
				if (this.hasUpgrade('recitation')) {
					this.beginRecitation();
				} else {
					this.pushFeed('system', 'a séance requires the recitation practice. it is not yet adopted.');
				}
				break;
		}
	}

	invokePalinode() {
		if (this.palinodeUsedThisRun) return;
		if (!this.hasUpgrade('palinode')) return;
		this.palinodeUsedThisRun = true;
		this.palinodeUntil = Date.now() + 30_000;
		this.pushFeed('milestone', 'palinode — you retract everything you have written this run. for thirty seconds, you write ten times as fast.');
	}

	private unnameLast() {
		// remove the most recent gloss-kind feed entry, refund its cost (1 gloss base)
		for (let i = this.feed.length - 1; i >= 0; i--) {
			if (this.feed[i].kind === 'gloss') {
				const refund = this.feed[i].cost ?? 1;
				this.feed.splice(i, 1);
				this.glosses += refund;
				this.pushFeed('milestone', '— unnamed — a gloss is taken back. the margin shifts up by a line.');
				return;
			}
		}
		this.pushFeed('milestone', '— unnamed — but there is nothing to unname.');
	}

	private triggerMissingLeaf() {
		// pick a random owned generator and dim it for 30s, then double for 30s
		const owned = generators.filter((g) => (this.generators[g.id] ?? 0) > 0);
		if (owned.length === 0) return;
		const target = rand(owned);
		this.missingLeafId = target.id;
		this.missingLeafUntil = Date.now() + 30_000;
		this.missingLeafDoubleUntil = Date.now() + 60_000;
		this.pushFeed('milestone', `the missing leaf — ${target.name} is dark for thirty seconds.`);
	}

	private bleedThrough() {
		// bring a previous-run-style line in caveat
		const fragment =
			this.prestigeIndex > 0
				? canonicalFor(Math.max(0, this.prestigeIndex - 1)).lines[randInt(0, 5)]
				: 'a passage you have not yet written drifts through.';
		this.pushFeed('echo', `— [echoed from a previous run] — ${fragment}`);
	}

	// ── tick ──────────────────────────────────────────────────────────────

	tick(dt: number) {
		// dt in seconds
		const now = Date.now();

		// passive resources
		const dGlosses = this.glossesPerSec * dt;
		this.glosses += dGlosses;
		this.totalGlossesEver += dGlosses;

		this.commentaries += this.commentaryRate * dt;
		this.apparatus += this.apparatusRate * dt;
		this.recensions += this.recensionRate * dt;

		// occasional events (per tick chance, small)
		// generator narration (codex disclosure)
		if (this.hasUpgrade('codex_disclosure') && Math.random() < dt * 0.15) {
			const owned = generators.filter((g) => (this.generators[g.id] ?? 0) > 0);
			if (owned.length > 0) this.pushFeed('narration', rand(owned).narration);
		}

		// ambient drift (always)
		if (Math.random() < dt * 0.06) {
			this.pushFeed('ambient', rand(ambientLines));
		}

		// contradiction occasionally produces apparatus directly
		const contra = this.generators['contradiction'] ?? 0;
		if (contra > 0 && Math.random() < dt * (contra * 0.005)) {
			this.apparatus += 1;
			this.pushFeed('milestone', 'a contradiction yields a footnote of its own.');
		}

		// misattribution occasionally produces recensions
		const mis = this.generators['misattribution'] ?? 0;
		if (mis > 0 && Math.random() < dt * (mis * 0.001)) {
			this.recensions += 1;
			this.pushFeed('milestone', 'a misattribution lifts off and becomes a recension.');
		}

		// expire missing-leaf doubling cleanup
		if (this.missingLeafId && now > this.missingLeafDoubleUntil) {
			this.missingLeafId = null;
		}

		// ductus decay
		if (now - this.lastClickAt > 1500 && this.ductusCombo > 0) this.ductusCombo = 0;

		// seance bleed-through every few seconds
		if (now < this.seanceUntil && Math.random() < dt * 0.4) {
			this.bleedThrough();
		}
	}

	// ── prestige ──────────────────────────────────────────────────────────

	canPrestige(): boolean {
		return this.pendingPalimpsest > 0;
	}

	prestige() {
		if (!this.canPrestige()) return;
		const gained = this.pendingPalimpsest;
		this.palimpsest += gained;
		this.prestigeIndex += 1;
		this.glosses = 0;
		this.commentaries = 0;
		this.apparatus = 0;
		this.recensions = 0;
		this.totalGlossesEver = 0;
		this.clicksEver = 0;
		this.clicksThisHundred = 0;
		this.generators = {};
		this.upgrades = {};
		this.practiceCooldowns = {};
		this.palinodeUsedThisRun = false;
		this.closeReadingClicksLeft = 0;
		this.closeReadingUntil = 0;
		this.palinodeUntil = 0;
		this.seanceUntil = 0;
		this.missingLeafId = null;
		this.contestedActive = false;
		this.contestedReadyAt = 0;
		this.recitationActive = false;
		// canonicalCitations, passagesRead, and canonicalRemembered persist
		// across prestige — the reader carries them forward.
		this.feed = [];
		this.pushFeed(
			'milestone',
			`voluntary forgetting — your reading is allowed to lapse into apocrypha. the next reader inherits ${gained} more layer${gained === 1 ? '' : 's'} of palimpsest.`
		);
	}

	hardReset() {
		wipe();
		this.glosses = 0;
		this.commentaries = 0;
		this.apparatus = 0;
		this.recensions = 0;
		this.palimpsest = 1;
		this.prestigeIndex = 0;
		this.totalGlossesEver = 0;
		this.clicksEver = 0;
		this.clicksThisHundred = 0;
		this.generators = {};
		this.upgrades = {};
		this.practiceCooldowns = {};
		this.palinodeUsedThisRun = false;
		this.closeReadingClicksLeft = 0;
		this.closeReadingUntil = 0;
		this.palinodeUntil = 0;
		this.seanceUntil = 0;
		this.missingLeafId = null;
		this.contestedActive = false;
		this.contestedReadyAt = 0;
		this.canonicalCitations = [];
		this.passagesRead = [];
		this.canonicalRemembered = [];
		this.recitationActive = false;
		this.whispersShown = {};
		this.whispersLastFiredAt = {};
		this.chargedClickReady = false;
		this.clicksUntilCharged = 0;
		this.feed = [];
		this.pushFeed('system', 'a wipe. the library returns to first hand.');
	}

	// ── persistence ──────────────────────────────────────────────────────

	toSave(): SaveShape {
		return {
			v: 1,
			glosses: this.glosses,
			commentaries: this.commentaries,
			apparatus: this.apparatus,
			recensions: this.recensions,
			palimpsest: this.palimpsest,
			prestigeIndex: this.prestigeIndex,
			totalGlossesEver: this.totalGlossesEver,
			clicksEver: this.clicksEver,
			generators: { ...this.generators },
			upgrades: { ...this.upgrades },
			practiceCooldowns: { ...this.practiceCooldowns },
			palinodeUsedThisRun: this.palinodeUsedThisRun,
			contestedReadyAt: this.contestedReadyAt,
			canonicalCitations: [...this.canonicalCitations],
			passagesRead: [...this.passagesRead],
			whispersShown: { ...this.whispersShown },
			canonicalRemembered: [...this.canonicalRemembered],
			startedAt: Date.now()
		};
	}

	fromSave(s: SaveShape) {
		this.glosses = s.glosses;
		this.commentaries = s.commentaries;
		this.apparatus = s.apparatus;
		this.recensions = s.recensions;
		this.palimpsest = s.palimpsest;
		this.prestigeIndex = s.prestigeIndex;
		this.totalGlossesEver = s.totalGlossesEver;
		this.clicksEver = s.clicksEver;
		this.generators = { ...s.generators };
		this.upgrades = { ...s.upgrades };
		this.practiceCooldowns = { ...s.practiceCooldowns };
		this.palinodeUsedThisRun = s.palinodeUsedThisRun;
		this.contestedReadyAt = s.contestedReadyAt ?? 0;
		this.canonicalCitations = [...(s.canonicalCitations ?? [])];
		this.passagesRead = [...(s.passagesRead ?? [])];
		this.whispersShown = { ...(s.whispersShown ?? {}) };
		this.canonicalRemembered = [...(s.canonicalRemembered ?? [])];
	}

	hydrate() {
		const s = load();
		if (s) {
			this.fromSave(s);
			this.pushFeed('system', 'a save returns. the margin remembers where it was.');
		} else {
			this.pushFeed(
				'system',
				'an empty page. the canonical text is at the center; the margin is yours.'
			);
		}
	}

	persist() {
		save(this.toSave());
	}
}

export const game = new Game();
