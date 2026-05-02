// Self-contained reproduction of a tsgo (TypeScript native preview) inference
// regression vs tsc.
//
// Versions tested:
//   typescript@6.0.3                                  -> compiles cleanly
//   @typescript/native-preview@7.0.0-dev.20260502.1   -> error TS2322
//   @typescript/native-preview@7.0.0-dev.20260421.2   -> error TS2322
//
// Run:
//   pnpm install
//   ./node_modules/.bin/tsc
//   ./node_modules/.bin/tsgo
//
// Bug: the `const T extends string = string` parameter, given an argument of
// static type `never`, should infer T = `never`. tsc does. tsgo binds T to
// the constraint default `string` instead.
//
// All four ingredients are required to trigger the bug — removing any one of
// them and both compilers agree:
//   1. `const T extends string` with a default of `string`
//   2. a sibling generic parameter `R` constrained to a structural type
//      (here `{ p: any }`)
//   3. the prop holding the inferred value is typed
//      `(T & Paths<R['p']>) | Paths<R['p']>` — i.e. `(T & C) | C` where C
//      goes through an indexed access into the *generic* `R`
//   4. `Paths<T>` is a *conditional* type that resolves to `string`
//      (`unknown extends T ? string : string`); replacing it with the bare
//      type alias `type Paths<T> = string` makes the bug disappear

type Paths<T> = unknown extends T ? string : string

declare function f<
  R extends { p: any },
  const T extends string = string,
>(opts: {
  from?: (T & Paths<R['p']>) | Paths<R['p']>
  via: string extends T ? 'wide' : 'narrow'
}): void

f({ from: 'x', via: 'narrow' })            // T = 'x'   -> via 'narrow'  (both OK)
f({ from: 'x' as 'x', via: 'narrow' })     // T = 'x'   -> via 'narrow'  (both OK)

// tsc : OK   (T inferred as `never`  -> `string extends never`? false -> 'narrow')
// tsgo: error TS2322 — Type '"narrow"' is not assignable to type '"wide"'.
//        (T bound as `string` (default) -> conditional resolves to 'wide')
f({ from: 'x' as never, via: 'narrow' })
