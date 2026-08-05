# @woodles/emoji

The character → [OpenMoji](https://openmoji.org) codepoint registry shared by
[Bloomforge Studio](../../apps/bloomforge) and
[Bloomforge Player](../../apps/bloomforge-player), plus the curated palette
offered by the Studio's currency symbol picker.

## why a package rather than two copies

A symbol picked in the Studio has to render identically in the Player — the
same artwork, not a fallback to whatever native glyph the visitor's OS
happens to draw for that codepoint. That only holds if both apps agree on
which characters map to which OpenMoji file, so the mapping lives here once
rather than as two hand-maintained tables that can drift apart.

Each app still bundles its own copy of the actual SVGs (`src/lib/assets/emoji/`
in each), since both are independently deployed static sites — this package
carries no artwork of its own, only the data pointing at codepoint filenames.

## OpenMoji license

> All emojis designed by [OpenMoji](https://openmoji.org/) — the open-source
> emoji and icon project. License:
> [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/#)

The bundled SVGs (`src/lib/assets/emoji/` in each app) are graphics only,
unmodified exports from the `color/svg` set at `openmoji@17.0.0`.
