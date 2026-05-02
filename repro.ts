// tsc vs tsgo behavioural difference around `const` type parameter inference
// with a default. See README.md for a full walkthrough.
//
// Versions:
//   typescript@6.0.3                                  -> compiles cleanly
//   @typescript/native-preview@7.0.0-dev.20260502.1   -> error TS2322
//   @typescript/native-preview@7.0.0-dev.20260421.2   -> error TS2322

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
// tsgo: error TS2322. Type '"narrow"' is not assignable to type '"wide"'.
//        (T bound as `string` (default) -> conditional resolves to 'wide')
f({ from: 'x' as never, via: 'narrow' })
