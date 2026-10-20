<script lang="ts">
	import { defaultCardStyle, cardStyleAttr, type Person } from '@woodles/mycelium';
	import { holo } from '../holo';
	import FinishOverlay from './FinishOverlay.svelte';

	let { person, interactive = false, preview = false }: {
		person: Person;
		interactive?: boolean;
		preview?: boolean;
	} = $props();

	let style = $derived(person.cardStyle ?? defaultCardStyle());
	function dark(hex: string) {
		let rgb = hex.slice(1);
		if (rgb.length <= 4) rgb = rgb.slice(0, 3).split('').map((char) => char + char).join('');
		return (parseInt(rgb.slice(0, 2), 16) * .2126 + parseInt(rgb.slice(2, 4), 16) * .7152 + parseInt(rgb.slice(4, 6), 16) * .0722) / 255 < .32;
	}
	let darkPlate = $derived(style.bgMode === 'custom' && dark(style.bg1) && dark(style.bg2));
	let shine = $derived(interactive || preview);
	let displayName = $derived(person.name.trim() || 'Someone new');
	let initials = $derived(displayName.split(/\s+/).slice(0, 2).map((part) => Array.from(part)[0]).join('').toLocaleUpperCase());
	let roleLine = $derived([person.role.trim(), person.organization.trim()].filter(Boolean).join(' · '));
	let email = $derived(person.emails.find((entry) => entry.value.trim()));
	let phone = $derived(person.phones.find((entry) => entry.value.trim()));
	let link = $derived(person.links.find((entry) => entry.value.trim()));
	let holoAmount = $derived(style.finish === 'holo' ? 0.55 + style.finishIntensity * 0.45 : style.finish === 'rainbow' || style.finish === 'foil' ? 0.5 : 0.24);
	let styleAttr = $derived(`${cardStyleAttr(style, '--b-gold', '--b-gold-bright')}; --holo: ${holoAmount}`);
</script>

<article
	class="card person-card frame-{style.frame} finish-{style.finish} tb-{style.textBox} tex-{style.texture} title-{style.titleAlign}"
	class:interactive
	class:shine
	class:dark-plate={darkPlate}
	style={styleAttr}
	use:holo={shine}
	aria-label={displayName}
>
	<div class="card-inner">
		<header class="title-bar">
			<div class="name-block">
				<p class="cname" title={displayName}>{displayName}</p>
				{#if person.pronouns.trim()}<p class="pronouns">{person.pronouns.trim()}</p>{/if}
			</div>
			{#if person.favorite}<span class="favorite" title="Favorite person" aria-label="Favorite">✦</span>{/if}
		</header>

		<div class="art" class:empty={!person.portrait}>
			{#if person.portrait}
				<img src={person.portrait} alt="Portrait of {displayName}" draggable="false" />
			{:else}
				<div class="initials-medallion" aria-hidden="true"><span>{initials}</span></div>
				<span class="portrait-flourish" aria-hidden="true">☾ · ✧ · ☽</span>
			{/if}
		</div>

		{#if style.showTypeLine && roleLine}
			<div class="type-line">
				<span class="domain-glyph" aria-hidden="true">❋</span>
				<span class="type-text" title={roleLine}>{roleLine}</span>
			</div>
		{/if}

		{#if style.textBox !== 'none'}
			<div class="text-box">
				{#if email}<p class="contact-line"><span class="channel-glyph" aria-hidden="true">@</span><span title={email.value}>{email.value}</span></p>{/if}
				{#if phone}<p class="contact-line"><span class="channel-glyph" aria-hidden="true">☎</span><span title={phone.value}>{phone.value}</span></p>{/if}
				{#if !email && !phone && link}<p class="contact-line"><span class="channel-glyph" aria-hidden="true">↗</span><span title={link.value}>{link.label || link.value}</span></p>{/if}
				{#if !email && !phone && !link}<p class="empty-text">a new connection</p>{/if}
			</div>
		{/if}

		{#if style.showStats && person.tags.length}
			<div class="stat-strip" aria-label="Tags">
				{#each person.tags.slice(0, 3) as tag}<span class="tag" title={tag}>{tag}</span>{/each}
				{#if person.tags.length > 3}<span class="tag-more">+{person.tags.length - 3}</span>{/if}
			</div>
		{/if}

		<footer class="card-foot">
			{#if style.showFoundIn && person.location.trim()}<span class="found" title={person.location.trim()}>⌖ {person.location.trim()}</span>{:else}<span></span>{/if}
			<span class="connection-mark" aria-hidden="true">❦</span>
		</footer>
	</div>

	<div class="texture" aria-hidden="true"></div>
	<div class="finish-layer" aria-hidden="true"></div>
	{#if style.finish === 'sparkle' || style.finish === 'holo'}
		{#key `${person.id}-${style.finish}-${style.finishIntensity}`}
			<FinishOverlay finish={style.finish} intensity={style.finishIntensity} personId={person.id} animated={shine} />
		{/key}
	{/if}
	{#if shine}
		<div class="holo-glare" aria-hidden="true"></div>
		{#if style.finish !== 'holo'}<div class="holo-sheen" aria-hidden="true"></div>{/if}
	{/if}
</article>

<style>
	.card {
		container-type: inline-size;
		position: relative;
		box-sizing: border-box;
		width: 100%;
		aspect-ratio: 3 / 4;
		border-radius: var(--card-radius);
		background: var(--plate-base);
		box-shadow: var(--b-shadow-card);
		border: var(--card-border-w) solid var(--card-border-color);
		overflow: hidden;
		isolation: isolate;
		user-select: none;
	}
	.card.shine {
		transform: perspective(900px) rotateX(var(--holo-rx, 0deg)) rotateY(var(--holo-ry, 0deg)) translateY(calc(var(--holo-active, 0) * -5px));
	}
	.card.dark-plate {
		--b-bg-2: #30213c; --b-vellum: #291b33; --b-surface: #24182f;
		--b-text: #fff6da; --b-text-dim: #d6c5d8; --b-muted: #c6b6cc;
		--b-border: #eaa15a40; --b-border-strong: #eaa15a70;
	}
	.card.interactive { cursor: pointer; transition: box-shadow var(--b-transition-medium), border-color var(--b-transition-fast); }
	.card.interactive:hover { box-shadow: var(--b-shadow-hover); border-color: var(--domain); }
	.card-inner { position: absolute; inset: 0; font-size: 4.4cqw; display: flex; flex-direction: column; gap: 0.4em; padding: 0.6em; z-index: 1; }
	.title-bar { display: flex; align-items: center; gap: 0.4em; background: color-mix(in srgb, var(--domain) 16%, var(--b-bg-2)); border: 1px solid var(--b-border-strong); border-radius: 0.5em; padding: 0.38em 0.5em; }
	.name-block { flex: 1; min-width: 0; }
	.cname { margin: 0; font-family: var(--title-font); font-weight: 600; font-size: 1.1em; line-height: 1.1; color: var(--title-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.pronouns { margin: 0.28em 0 0; font-family: var(--b-font-mono); font-size: 0.53em; line-height: 1.3; color: var(--b-text-dim); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
	.title-center .name-block { text-align: center; }
	.favorite { flex-shrink: 0; display: grid; place-items: center; width: 1.7em; height: 1.7em; border-radius: 50%; color: var(--b-on-accent); background: radial-gradient(circle at 35% 30%, var(--b-gold-bright), var(--domain)); box-shadow: inset 0 0.08em 0.16em #ffffff99, 0 0.12em 0.3em #ce82af66; }
	.art { position: relative; flex: 1 1 auto; min-height: 0; border-radius: 0.45em; border: 1px solid var(--b-border-strong); background: radial-gradient(120% 90% at 50% 0%, color-mix(in srgb, var(--domain) 30%, transparent), transparent 70%), var(--b-vellum); overflow: hidden; display: grid; place-items: center; }
	.art img { width: 100%; height: 100%; object-fit: cover; display: block; }
	.art.empty { background: radial-gradient(ellipse at 50% 28%, color-mix(in srgb, var(--domain) 26%, transparent), transparent 70%), repeating-linear-gradient(45deg, transparent 0 18px, color-mix(in srgb, var(--domain) 5%, transparent) 18px 19px), var(--b-vellum); }
	.initials-medallion { width: 5.8em; height: 5.8em; display: grid; place-items: center; border-radius: 50%; border: 1px solid color-mix(in srgb, var(--domain) 50%, transparent); outline: 1px solid color-mix(in srgb, var(--domain) 23%, transparent); outline-offset: 0.4em; background: color-mix(in srgb, var(--b-surface) 45%, transparent); box-shadow: 0 0 0 0.8em color-mix(in srgb, var(--domain) 5%, transparent); }
	.initials-medallion span { font-family: var(--b-font-display); font-size: 2.5em; line-height: 1; color: color-mix(in srgb, var(--domain) 68%, var(--b-text)); }
	.portrait-flourish { position: absolute; bottom: 0.65em; font-size: 0.8em; color: color-mix(in srgb, var(--domain) 65%, var(--b-muted)); letter-spacing: 0.4em; }
	.type-line { display: flex; align-items: center; gap: 0.4em; background: color-mix(in srgb, var(--domain) 14%, var(--b-bg-2)); border: 1px solid var(--b-border); border-radius: 0.4em; padding: 0.3em 0.5em; }
	.domain-glyph { flex-shrink: 0; color: var(--domain); font-size: 0.82em; }
	.type-text { flex: 1; min-width: 0; font-family: var(--b-font-codex); font-size: 0.74em; color: var(--b-text-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.text-box { flex: 0 0 auto; min-height: 2.1em; overflow: hidden; background: linear-gradient(180deg, color-mix(in srgb, var(--b-vellum) 80%, var(--b-bg-2)), var(--b-bg-2)); border: 1px solid var(--b-border); border-radius: 0.4em; padding: 0.45em 0.55em; display: flex; flex-direction: column; justify-content: center; gap: 0.35em; }
	.contact-line { margin: 0; display: flex; align-items: center; gap: 0.5em; font-family: var(--b-font-mono); font-size: 0.6em; line-height: 1.35; color: var(--b-text); }
	.contact-line > span:last-child { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.channel-glyph { flex-shrink: 0; width: 1em; color: var(--domain); }
	.empty-text { margin: 0; font-family: var(--b-font-mono); font-size: 0.58em; color: var(--b-muted); font-style: italic; }
	.tb-ghost .text-box { background: color-mix(in srgb, var(--b-surface) 32%, transparent); border-color: color-mix(in srgb, var(--b-text) 12%, transparent); backdrop-filter: blur(2px); }
	.tb-ink .text-box { background: #120c1ab8; border-color: #ffffff24; }
	.tb-ink .contact-line { color: #f1ebf7; }
	.tb-ink .empty-text { color: #cdbfe0; }
	.stat-strip { display: flex; align-items: center; gap: 0.4em; min-width: 0; overflow: hidden; padding: 0.25em 0.35em; background: color-mix(in srgb, var(--domain) 8%, var(--b-bg-2)); border: 1px solid var(--b-border); border-radius: 0.4em; }
	.tag { min-width: 0; padding: 0.15em 0.4em; border-radius: 0.3em; background: color-mix(in srgb, var(--domain) 12%, transparent); font-family: var(--b-font-mono); font-size: 0.5em; color: var(--b-text-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.tag-more { flex-shrink: 0; font-family: var(--b-font-mono); font-size: 0.5em; color: var(--b-muted); }
	.card-foot { display: flex; align-items: center; justify-content: space-between; gap: 0.5em; margin-top: auto; min-height: 1em; }
	.found { font-family: var(--b-font-mono); font-size: 0.56em; letter-spacing: 0.04em; color: var(--b-text-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.connection-mark { flex-shrink: 0; color: var(--domain); font-size: 1em; line-height: 1; }
	.frame-fullart .title-bar { margin-bottom: auto; }
	.frame-fullart .card-foot { margin-top: 0; }

	.texture {
		position: absolute;
		inset: 0;
		pointer-events: none;
		border-radius: inherit;
		opacity: var(--tex-opacity);
		z-index: 2;
		display: none;
		background-size: cover;
	}
	.tex-paper .texture {
		display: block;
		background-image:
			radial-gradient(circle at 18% 22%, rgba(110, 80, 50, 0.05) 0, transparent 38%),
			radial-gradient(circle at 82% 64%, rgba(110, 80, 50, 0.05) 0, transparent 40%),
			repeating-linear-gradient(92deg, rgba(120, 90, 60, 0.035) 0 1px, transparent 1px 3px);
		mix-blend-mode: multiply;
	}
	.tex-linen .texture {
		display: block;
		background-image:
			repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.05) 0 1px, transparent 1px 4px),
			repeating-linear-gradient(90deg, rgba(0, 0, 0, 0.05) 0 1px, transparent 1px 4px);
		mix-blend-mode: multiply;
	}
	.tex-grain .texture {
		display: block;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E");
		background-size: 180px 180px;
		mix-blend-mode: soft-light;
	}
	.tex-noise .texture {
		display: block;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.5' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)'/%3E%3C/svg%3E");
		background-size: 150px 150px;
		mix-blend-mode: soft-light;
	}

	/* ── finishes ── */
	.finish-layer {
		position: absolute;
		inset: 0;
		pointer-events: none;
		border-radius: inherit;
		z-index: 4;
	}
	.finish-gloss .finish-layer {
		background: linear-gradient(125deg,
			rgba(255, 255, 255, calc(0.4 * var(--finish-amt))) 0%, transparent 36%,
			transparent 64%, rgba(255, 255, 255, calc(0.12 * var(--finish-amt))) 100%);
	}
	.finish-foil .finish-layer {
		background: repeating-linear-gradient(115deg,
			transparent 0 7px,
			color-mix(in srgb, var(--domain) 45%, transparent) 7px 9px,
			color-mix(in srgb, var(--rarity) 45%, transparent) 9px 11px);
		mix-blend-mode: overlay;
		opacity: var(--finish-amt);
	}
	.finish-rainbow .finish-layer {
		background: linear-gradient(125deg,
			#ff6b9d 0%, #ffd36b 22%, #6bffb0 44%, #6bb8ff 66%, #c79bff 88%, #ff6b9d 100%);
		mix-blend-mode: overlay;
		opacity: calc(0.6 * var(--finish-amt));
	}
	.finish-glow {
		box-shadow:
			0 0 calc(22px * var(--finish-amt)) color-mix(in srgb, var(--domain) 70%, transparent),
			0 0 calc(6px * var(--finish-amt)) color-mix(in srgb, var(--domain) 90%, transparent),
			var(--b-shadow-card);
	}
	.finish-glow .finish-layer {
		box-shadow: inset 0 0 calc(10px * var(--finish-amt))
			color-mix(in srgb, var(--domain) 55%, transparent);
	}

	/* ── pointer-driven holo ── */
	/* a soft glare that rides the cursor — present on every live card */
	.holo-glare {
		position: absolute;
		inset: 0;
		border-radius: inherit;
		pointer-events: none;
		z-index: 5;
		background: radial-gradient(
			58% 46% at calc(var(--holo-px, 0.5) * 100%) calc(var(--holo-py, 0.5) * 100%),
			rgba(255, 255, 255, 0.6),
			rgba(255, 255, 255, 0) 60%
		);
		mix-blend-mode: screen;
		opacity: calc(var(--holo-active, 0) * 0.35);
	}
	/* spectral banding that slides with the pointer — scaled by the card's --holo
	   (loud on a holo finish, a whisper on a matte common) */
	.holo-sheen {
		position: absolute;
		inset: 0;
		border-radius: inherit;
		pointer-events: none;
		z-index: 5;
		background-image: repeating-linear-gradient(
			110deg,
			hsl(0 90% 72%) 0%,
			hsl(50 90% 72%) 7%,
			hsl(140 85% 70%) 14%,
			hsl(200 90% 72%) 21%,
			hsl(280 85% 74%) 28%,
			hsl(330 90% 74%) 35%,
			hsl(0 90% 72%) 42%
		);
		background-size: 230% 230%;
		background-position: calc(var(--holo-px, 0.5) * 120%) calc(var(--holo-py, 0.5) * 120%);
		mix-blend-mode: color-dodge;
		opacity: calc(var(--holo, 0.24) * var(--holo-active, 0) * 0.45);
	}

	/* ── frames ── */
	/* Full art: the portrait fills the card; its panels float above it. */
	.frame-fullart .art {
		position: absolute;
		inset: -0.62em;
		border: none;
		border-radius: inherit;
		/* sit beneath the in-flow panels so they float over the art */
		z-index: -1;
	}
	.frame-fullart .title-bar,
	.frame-fullart .type-line,
	.frame-fullart .stat-strip {
		background: color-mix(in srgb, var(--b-bg-2) 55%, transparent);
		backdrop-filter: blur(2px);
	}

	/* borderless: drop the outer edge, lean on the plate */
	.frame-borderless { border-width: 0; }

	/* minimal: flatten the internal chrome for a quiet card */
	.frame-minimal .title-bar,
	.frame-minimal .type-line,
	.frame-minimal .stat-strip {
		background: transparent;
		border-color: transparent;
	}
	.frame-minimal .favorite {
		background: transparent;
		box-shadow: none;
		color: var(--domain);
		border-color: color-mix(in srgb, var(--domain) 35%, transparent);
	}

	/* cinema: a dark inset edge, art given room */
	.frame-cinema {
		box-shadow: inset 0 0 0 0.5em rgba(12, 8, 18, 0.85), var(--b-shadow-card);
	}
	.frame-cinema .card-inner { padding: 0.9em 0.8em; }

	@media (prefers-reduced-motion: reduce), print {
		.card.shine { transform: none; }
		.holo-glare, .holo-sheen { display: none; }
		.card.interactive { transition: none; }
	}
</style>
