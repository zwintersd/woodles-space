export type AppKind = 'static' | 'sveltekit' | 'external';
export type AppMaturity = 'stable' | 'growing' | 'incubator' | 'private';

export interface LandingTileDefinition {
	tileId: string;
	order: number;
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
}

export interface LandingApp {
	appId: string;
	id: string;
	name: string;
	href: string;
	desc: string;
	g1: string;
	g2: string;
	ga: string;
	order: number;
	defaultPin?: number;
	featured?: number;
}
