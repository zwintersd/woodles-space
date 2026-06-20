# planner — known issues

planner's test and check setup has a few sharp edges. they all trace back to one
thing: the store is a rune module that builds itself at import time. here's what
that means, and what you'll see if you trip over it.

## the store is a module-level singleton

`src/lib/store.svelte.ts` ends with `export const store = new PlannerStore()`.
the class fields use `$state`, so the moment anything imports the store, the
runes run. there's no way to import the store "quietly" — importing it
constructs it.

## vitest needs the Svelte plugin

because of the singleton, any test that imports the store runs `$state` at
import. `$state` only exists once the Svelte compiler has processed the file, so
`vitest.config.ts` loads the SvelteKit plugin to compile `.svelte.ts` modules.
drop the plugin and the store tests fail at load with:

```
ReferenceError: $state is not defined
```

keep the plugin. the other SvelteKit apps that test rune modules either inherit
it from `vite.config.ts` or never construct a rune store at import, so they don't
need their own `vitest.config.ts` to say so. planner does.

## store.test.ts runs in happy-dom, per file

constructing the store touches `window` and `localStorage`, so
`store.test.ts` opens with:

```
// @vitest-environment happy-dom
```

the rest of planner's tests run in node — some check behavior with no `window`
at all (the bells code, for one) — so the DOM environment is set on the one file
that needs it rather than globally.

## $state arrays hold proxies, not your objects

when you push an object into a `$state` array, Svelte wraps it in a reactive
proxy. the object you pushed back out is not identical to the one you put in, so
an identity check fails:

```js
const t = store.addTask({ title: 'x' });
expect(store.tasks).toContain(t);        // fails — t is not the proxy
expect(store.tasks).toContainEqual(t);   // passes — compares by value
```

compare by value (`toContainEqual`) when you're checking that something landed in
the store. the existing tests already do.

## svelte-kit sync before vitest

`tsconfig.json` extends `./.svelte-kit/tsconfig.json`, which `svelte-kit sync`
generates. the `test` script runs `svelte-kit sync && vitest run`, so a fresh
clone is fine. if you run `vitest` by hand instead, run `svelte-kit sync` once
first or the tsconfig won't resolve.

## the recursive scripts stop on first failure

`pnpm -r check` and `pnpm -r test` stop at the first app that fails. to see
planner on its own:

```
pnpm --filter planner check
pnpm --filter planner test
```
