import { describe, expect, it } from "vitest";
import { EXAMPLES, PURPOSES } from "./examples.js";

describe("the bundled examples (T10.16)", () => {
  it("holds every file in examples/, by name, in code-unit order", () => {
    expect([...EXAMPLES.keys()]).toEqual([
      "input.txt",
      "late-declarations.txt",
      "names-and-repeats.txt",
      "queries.txt",
      "ties.txt",
      "warnings.txt",
    ]);
  });

  it("describes every example, and nothing that is not one (T11.2)", () => {
    expect([...PURPOSES.keys()].sort()).toEqual([...EXAMPLES.keys()]);
    for (const purpose of PURPOSES.values()) {
      expect(purpose).toMatch(/^[A-Z].*\.$/);
    }
  });

  it("holds each file's text as written", () => {
    expect(EXAMPLES.get("input.txt")?.split("\n").slice(0, 2)).toEqual([
      "Partner Chris",
      "Partner Molly",
    ]);
  });
});
