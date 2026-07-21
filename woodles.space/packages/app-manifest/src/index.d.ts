import type { AppDefinition, LandingApp } from './types';

export type { AppDefinition, AppKind, AppMaturity, LandingApp, LandingTileDefinition } from './types';

export const appManifest: readonly AppDefinition[];
export const appById: Readonly<Record<string, AppDefinition>>;
export const landingApps: readonly LandingApp[];
export const defaultLandingPins: readonly string[];
export const featuredLandingApps: readonly LandingApp[];
export function primaryDestination(app: AppDefinition): string;
