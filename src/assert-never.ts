// Exhaustiveness guard for switches over discriminated unions (DECISIONS D3).
// Called in the default branch: if a case is missing, the value there is not
// `never` and the call fails to compile. The throw only runs if a value
// escapes the type system at runtime.
export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}
