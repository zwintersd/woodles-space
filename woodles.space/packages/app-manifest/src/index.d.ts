import type { AppDefinition, LandingApp, LandingBand } from './types';

export type {
	AppDefinition,
	AppKind,
	AppMaturity,
	LandingApp,
	LandingBand,
	LandingBandId,
	LandingTileDefinition
} from './types';

export const appManifest: readonly AppDefinition[];
export const appById: Readonly<Record<string, AppDefinition>>;
export const landingApps: readonly LandingApp[];
export const defaultLandingPins: readonly string[];
export const featuredLandingApps: readonly LandingApp[];
export const landingBands: readonly LandingBand[];
export const landingAppsByBand: readonly { band: LandingBand; apps: readonly LandingApp[] }[];
export function primaryDestination(app: AppDefinition): string;
export function canAddress(appId: string, kind: string): boolean;
export function entityHref(appId: string, kind: string, id: string): string;
