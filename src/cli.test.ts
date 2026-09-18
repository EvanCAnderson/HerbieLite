import { describe, expect, it } from "vitest";
import { main } from "./cli.js";

// Smoke test: proves the toolchain (vitest + tsx + ESM/NodeNext resolution)
// is wired up end to end. Real behavioral tests arrive with each layer.
describe("scaffold smoke test", () => {
  it("exposes a callable entry point", () => {
    expect(main).toBeTypeOf("function");
  });
});
