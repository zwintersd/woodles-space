export type AppKind = 'static' | 'sveltekit' | 'external';
export type AppMaturity = 'stable' | 'growing' | 'incubator' | 'private';

/**
 * The moment an app is for, rather than the thing it holds. Tiles group under
 * these on the landing page so the homepage stops presenting every app as a
 * peer you have to choose between. See CONVERGENCE.md §3.
 *
 * `catch` retired with Notebook (CONVERGENCE.md §7) — catching a thought is
 * the write band's job now.
 */
export type LandingBandId = 'write' | 'tend' | 'read' | 'play';

export interface LandingBand {
	id: LandingBandId;
	label: string;
	/** One line naming the moment, shown under the band heading. */
	blurb: string;
	order: number;
}

export interface LandingTileDefinition {
	tileId: string;
	order: number;
	band: LandingBandId;
	description: string;
	gradientFrom: string;
	gradientTo: string;
	gradientAngle: string;
	name?: string;
	href?: string;
	defaultPin?: number;
	featured?: number;
}

export interface AppDefinition {
	id: string;
	name: string;
	publicPath: string;
	aliases: readonly string[];
	kind: AppKind;
	maturity: AppMaturity;
	sourceDir: string;
	outputDir: string;
	entryFile: string;
	packageName?: string;
	landing?: LandingTileDefinition;
	landingSurfaces?: readonly LandingTileDefinition[];
	/**
	 * Record kinds this app can be opened *on*, as query parameter names —
	 * `['game']` means the app reads `?game=<id>` and opens that record.
	 *
	 * This is the addressing half of REFERENCES.md: a link into another app has
	 * to resolve through the manifest that owns its path, or it decays into a
	 * hardcoded string pointing at an app root (see `HandoffSource.href`). An
	 * app is only addressable by a kind it lists here, and `entityHref` refuses
	 * anything else, so a link can never name a parameter nothing reads.
	 */
	addressableBy?: readonly string[];
}

export interface LandingApp {
	appId: string;
	id: string;
	name: string;
	href: string;
	desc: string;
	band: LandingBandId;
	g1: string;
	g2: string;
	ga: string;
	order: number;
	defaultPin?: number;
	featured?: number;
}
