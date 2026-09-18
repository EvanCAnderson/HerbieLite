import { describe, expect, expectTypeOf, it } from "vitest";
import type { Declaration, NetworkWarning } from "./network.js";

describe("Declaration", () => {
  it("is every command except Contact, which may repeat (Q13)", () => {
    expectTypeOf<Declaration["kind"]>().toEqualTypeOf<
      "Partner" | "Company" | "Employee"
    >();
  });
});

describe("NetworkWarning", () => {
  // Compile-time check (Q13): a Contact line is never a duplicate declaration.
  it("rejects a Contact as a duplicate declaration", () => {
    const source = { lineNumber: 2, text: "Partner Chris" };
    const standing = {
      source: { lineNumber: 1, text: "Partner Chris" },
      command: { kind: "Partner", name: "Chris" },
    } as const;

    const repeat: NetworkWarning = {
      problem: "duplicate-declaration",
      source,
      command: { kind: "Partner", name: "Chris" },
      standing,
    };

    const contact: NetworkWarning = {
      problem: "duplicate-declaration",
      source,
      command: {
        // @ts-expect-error -- contacts are counted, never deduplicated.
        kind: "Contact",
        employee: "Laurie",
        partner: "Chris",
        contactType: "email",
      },
      standing,
    };

    expect([repeat, contact]).toHaveLength(2);
  });

  // Compile-time check (Q8): an unresolved contact names at least one slot.
  it("requires at least one failure for an unresolved contact", () => {
    const source = { lineNumber: 5, text: "Contact Chris Laurie email" };

    const swapped: NetworkWarning = {
      problem: "unresolved-contact",
      source,
      failures: [
        { role: "employee", name: "Chris", cause: "wrong-role" },
        { role: "partner", name: "Laurie", cause: "wrong-role" },
      ],
    };

    const empty: NetworkWarning = {
      problem: "unresolved-contact",
      source,
      // @ts-expect-error -- an empty list would warn about nothing.
      failures: [],
    };

    expect([swapped, empty]).toHaveLength(2);
  });
});
