// The web UI's executable entry, logic-free like src/bin.ts (DECISIONS T1.6).
// `npm run ui` builds the page first, then runs this.
import { join } from "node:path";
import { startUi } from "./server.js";

// src/ui/ and dist/ui/ both sit two levels below the repository root, so this
// finds dist/web/ whether run from source or built.
const root = join(import.meta.dirname, "..", "..", "dist", "web");

startUi(root).then(
  (address) => {
    process.stdout.write(`herbie-lite UI: ${address} (Ctrl+C to stop)\n`);
  },
  (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`herbie-lite UI: ${message}\n`);
    process.exitCode = 1;
  },
);
