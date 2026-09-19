// Thin I/O shell (DECISIONS T1.11, layer 4). Wiring for the
// parser/network/report layers lands in later tasks (T3–T6); for now this is
// a placeholder entry point so the toolchain (start/build/typecheck) has
// something to run.
// The executable entry is bin.ts; this module only exports main.
export function main(): void {
  console.log("herbie-lite: not implemented yet");
}
