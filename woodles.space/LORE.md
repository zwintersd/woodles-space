# lore

the story marginalia tells, gathered in one place for reading rather than
building. the mechanical side — vital signs, interventions, prestige — lives
in [`apps/marginalia/DESIGN.md`](./apps/marginalia/DESIGN.md) and its
siblings; this is the other half.

## the premise

a witch named Brianna wakes up with a Book and an empty planet, and no
memory of how either came to be hers. the Book is warm. the planet is not.
she writes a word in the margin — *flow* — and the world answers with a
river, more river than the word asked for. she starts learning the names of
things by watching what her writing becomes.

the thesis, stated plainly in the game's own footer:

> a game about writing worlds into being, and learning that witnessing them
> is enough.

every system marginalia has — sediment, worldspaces, favor, the vital signs
of a place — is in service of that one sentence. an intervention *repairs*
something; restraint is never the thing being optimized away.

## Brianna's titles

titles mark her changing relationship to what she makes, not a difficulty
tier (`content/titles.ts`):

| title | earned when |
| --- | --- |
| **The Witch** | what she calls herself when she doesn't know what else to be |
| **The Dreamer** | she imagined a world before she wrote it |
| **The Gardener** | something grew, and she chose to tend it rather than only make it |
| **The Mother** | she made something that can look back at her *(not yet — not in this world)* |
| **The Witness** | what she always was — the golden ending |

## the journal

Brianna's journal answers to Favor — how the world feels about how she's
treated it — not to progress. a few of its seeds (`content/journal.ts`):

> The planet is empty. I have a Book. I do not know why either of those
> things is true, only that they are, and that the Book is warm and the
> planet is not.

> I wrote one line. I did not write a river — I wrote *flow* — and the world
> made a river out of it without asking me how. I think I am going to like
> it here.

taken gently, the world stays generous:

> It keeps giving me more than I asked for. I wrote four conditions and the
> shallows answered with forty greens. I am trying to learn all their names.
> It feels rude not to.

taken quickly, it goes quiet instead:

> I took what I needed quickly. The world gave it. It also went a little
> quiet, the way a room goes quiet. I told myself I imagined that.

and the moment the game is actually about:

> I watched a tidal pool for a long time today. Nothing happened, and then
> everything did, slowly. I did not write any of it. I only knew where to
> look. I do not know why I am crying.

## the world so far

the first worldspace is water — sediment, shallows, and the life that
becomes visible once enough of it is known. the creatures that surface there
get their own field guide at [`/bestiary`](https://woodles.space/bestiary),
cast from the same roster (`content/life.ts`) rather than a separate
invention. what comes after the water — the phases
[`WORLDS.md`](./apps/marginalia/WORLDS.md) calls **prestige**, **procedural
worlds**, and **collapse** — is still being decided; this page will grow
with it.

## keeping this page honest

this is curated, not generated — nothing here re-derives automatically from
`content/journal.ts` or `content/titles.ts` the way
[`/marginalia/cheats`](https://woodles.space/marginalia/cheats) re-derives
from `CHEAT_CODES`. if those files change in a way that makes a quote or a
title wrong, update this file in the same session.
