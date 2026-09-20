// Executable entry point. Kept free of logic so tests can import main from
// cli.ts without running anything (DECISIONS T1.6), and so nothing has to
// detect how the module was loaded.
import { main } from "./cli.js";

process.exitCode = await main(
  process.argv.slice(2),
  process.stdin,
  process.stdout,
  process.stderr,
);
