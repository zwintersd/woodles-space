export type OutputContract = 'fragment';

export interface BriefOptions {
	topic: string;
	/** Defaults to `fragment`. */
	output?: OutputContract;
	/** Domain / subdomain, for context. */
	subject?: string;
	/** Your own relationship to the topic, if any. */
	context?: string;
	/** Adds the health-condition sections. */
	diagnosis?: boolean;
	/** Caller-specific trailer appended after a rule. */
	appendix?: string;
}

export const OUTPUT_CONTRACTS: Readonly<Record<OutputContract, string>>;

export function buildBrief(options: BriefOptions): string;
export function stripCodeFences(text: string): string;
export function ingestDraft(text: string, htmlToText: (html: string) => string): string;
