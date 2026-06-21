import type { Creature } from './types';
import type { CoreStat } from './content/stats';
import { domainDef, rarityDef } from './content/domains';
import { coreStats } from './content/stats';

const HR = '─'.repeat(52);

function coreVal(c: Creature, id: CoreStat): number {
	return c.stats[id];
}

export function formatPlainText(c: Creature): string {
	const domain = domainDef(c.domain);
	const rarity = rarityDef(c.rarity);
	const name = c.name || '(unnamed)';

	const lines: string[] = [
		HR,
		name.toUpperCase(),
		`${rarity.name}  ·  ${domain.glyph} ${domain.name}  ·  Cost ${c.cost}  ·  ${c.power}/${c.toughness}`,
		c.kind || '(no type)',
		HR
	];

	if (c.abilities.trim()) lines.push('', c.abilities.trim());
	if (c.flavor.trim()) lines.push('', `"${c.flavor.trim()}"`);
	if (c.foundIn.trim()) lines.push('', `Found in: ${c.foundIn.trim()}`);

	const statLine = coreStats.map(s => `${s.name} ${coreVal(c, s.id)}`).join('  ·  ');
	lines.push('', 'Stats', `  ${statLine}`);

	const subs: string[] = [];
	for (const stat of coreStats) {
		for (const sub of stat.substats) {
			const v = c.stats.substats[sub.id];
			if (v !== undefined) subs.push(`  ${sub.name}: ${v}`);
		}
	}
	if (subs.length > 0) lines.push('', 'Substats', ...subs);

	lines.push(HR);
	return lines.join('\n');
}

export function formatMarkdown(c: Creature): string {
	const domain = domainDef(c.domain);
	const rarity = rarityDef(c.rarity);
	const name = c.name || '(unnamed)';

	const lines: string[] = [
		`## ${name}`,
		'',
		`**${rarity.name}** · ${domain.glyph} **${domain.name}** · Cost **${c.cost}** · **${c.power}/${c.toughness}**`,
		'',
		`*${c.kind || '(no type)'}*`
	];

	if (c.abilities.trim()) lines.push('', c.abilities.trim());
	if (c.flavor.trim()) lines.push('', `> *${c.flavor.trim()}*`);
	if (c.foundIn.trim()) lines.push('', `*Found in: ${c.foundIn.trim()}*`);

	const statLine = coreStats.map(s => `${s.name} ${coreVal(c, s.id)}`).join(' · ');
	lines.push('', `**Stats:** ${statLine}`);

	const subs: string[] = [];
	for (const stat of coreStats) {
		for (const sub of stat.substats) {
			const v = c.stats.substats[sub.id];
			if (v !== undefined) subs.push(`| ${sub.name} | ${v} |`);
		}
	}
	if (subs.length > 0) {
		lines.push('', '**Substats**', '', '| Substat | Value |', '|---------|-------|', ...subs);
	}

	return lines.join('\n');
}

export function formatAllPlainText(creatures: Creature[]): string {
	if (creatures.length === 0) return '(no creatures)';
	return creatures.map(formatPlainText).join('\n\n');
}

export function formatAllMarkdown(creatures: Creature[]): string {
	if (creatures.length === 0) return '*(no creatures)*';

	const lines: string[] = [
		'# Bestiary',
		'',
		`*${creatures.length} creature${creatures.length === 1 ? '' : 's'}*`,
		''
	];

	for (const c of creatures) {
		const domain = domainDef(c.domain);
		const rarity = rarityDef(c.rarity);
		lines.push(`- ${domain.glyph} **${c.name || '(unnamed)'}** — ${rarity.name}${c.kind ? ' ' + c.kind : ''}`);
	}
	lines.push('', '---', '');
	lines.push(creatures.map(formatMarkdown).join('\n\n---\n\n'));

	return lines.join('\n');
}

export function downloadText(content: string, filename: string): void {
	const a = document.createElement('a');
	a.href = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
	a.download = filename;
	a.click();
	URL.revokeObjectURL(a.href);
}
