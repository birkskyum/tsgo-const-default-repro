# tsgo-const-default-repro

Self-contained reproduction of a `tsgo` (TypeScript native preview) inference
behavioural difference vs. `tsc`. Filed against
[microsoft/typescript-go](https://github.com/microsoft/typescript-go).

Two dev dependencies: `typescript` and `@typescript/native-preview`.

## TL;DR

A `const T extends string = string` parameter, given an argument of static
type `never`, infers `T = never` under `tsc` and binds `T = string` (the
constraint default) under `tsgo`. The two bindings diverge on a downstream
conditional `string extends T ? 'wide' : 'narrow'`, producing a `TS2322`
under `tsgo` only.

## Run

```sh
pnpm install
./node_modules/.bin/tsc      # exit 0, no diagnostics
./node_modules/.bin/tsgo     # error TS2322 on line 25
```

Versions verified:

| compiler | version                                      | result |
|----------|----------------------------------------------|--------|
| `tsc`    | `typescript@6.0.3`                           | ✅     |
| `tsgo`   | `@typescript/native-preview@7.0.0-dev.20260502.1` | ❌     |
| `tsgo`   | `@typescript/native-preview@7.0.0-dev.20260421.2` | ❌     |

## What's in `repro.ts`

```ts
type Paths<T> = unknown extends T ? string : string

declare function f<
  R extends { p: any },
  const T extends string = string,
>(opts: {
  from?: (T & Paths<R['p']>) | Paths<R['p']>
  via: string extends T ? 'wide' : 'narrow'
}): void

f({ from: 'x',          via: 'narrow' })   // T = 'x'   -> 'narrow' (both OK)
f({ from: 'x' as 'x',   via: 'narrow' })   // T = 'x'   -> 'narrow' (both OK)
f({ from: 'x' as never, via: 'narrow' })   // T should be `never`
```

Expected `tsgo` output:

```
repro.ts(25,25): error TS2322: Type '"narrow"' is not assignable to type '"wide"'.
```

## Required ingredients

Each of the four is load-bearing. Drop any one and both compilers agree.

1. `const T extends string = string` (with the `string` default).
2. A sibling generic parameter `R` constrained to a structural type. Replacing
   `R['p']` with a fixed (non-generic) indexed access, for example
   `type X = { p: any }; ...Paths<X['p']>`, makes the bug disappear.
3. The prop holding the inferred value is typed `(T & C) | C` where `C` goes
   through an indexed access into the *generic* `R`. A bare `T` does not
   trigger.
4. `Paths<T>` is a *conditional* type that resolves to `string`, namely
   `unknown extends T ? string : string`. Replacing it with the bare alias
   `type Paths<T> = string` makes the bug disappear, even though both branches
   of the conditional return `string`.

## Where this surfaces in real code

Observed against [`@tanstack/react-router@1.169.x`](https://www.npmjs.com/package/@tanstack/react-router):
calls like `<Link from={fullPath as never} {...props} />` in
[`packages/react-router/src/route.tsx#L162-L165`](https://github.com/TanStack/router/blob/main/packages/react-router/src/route.tsx#L162-L165)
emit `TS2741`. There, `from` flows through `ConstrainLiteral<T, RoutePaths<TRouter['routeTree']>>`
(the `(T & C) | C` shape above) with a `MakeToRequired` conditional on the same `T`.

## Related

Same family as [microsoft/typescript-go#2797](https://github.com/microsoft/typescript-go/issues/2797),
fixed by [#2803](https://github.com/microsoft/typescript-go/pull/2803). That
fix was scoped to JSX-children context-sensitive discrimination. This case
is a plain function call (no JSX, no children) and is still live three months
after #2803 merged.
