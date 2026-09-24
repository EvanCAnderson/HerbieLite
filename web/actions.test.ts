import { describe, expect, it } from "vitest";
import {
  addToWorkspace,
  describeOpenFailure,
  describeSave,
} from "./actions.js";
import { MemoryStore, Workspace, type SaveResult } from "./workspace.js";

describe("adding a file from elsewhere (Q25)", () => {
  it("keeps a valid name that is free", () => {
    const workspace = new Workspace(new MemoryStore());
    expect(addToWorkspace(workspace, "input.txt", "Partner Chris\n")).toEqual({
      outcome: "saved",
      file: { name: "input.txt", text: "Partner Chris\n", version: 1 },
    });
  });

  it("gives a copy its own name rather than overwriting", () => {
    const workspace = new Workspace(new MemoryStore());
    workspace.create("input.txt", "mine");
    const result = addToWorkspace(workspace, "input.txt", "the example");
    expect(result.outcome === "saved" && result.file.name).toBe("input-2.txt");
    expect(workspace.read("input.txt")?.text).toBe("mine");
  });

  it("makes a name from disk valid", () => {
    const workspace = new Workspace(new MemoryStore());
    const result = addToWorkspace(workspace, "My Network.TXT", "");
    expect(result.outcome === "saved" && result.file.name).toBe(
      "My-Network.txt",
    );
  });
});

describe("the status line", () => {
  it("names the file saved", () => {
    const file = { name: "a.txt", text: "", version: 1 };
    expect(describeSave({ outcome: "saved", file }, "a.txt")).toBe(
      "Saved a.txt.",
    );
  });

  it("says why each refused save did nothing", () => {
    const current = { name: "a.txt", text: "", version: 2 };
    const refused: SaveResult[] = [
      { outcome: "invalid-name" },
      { outcome: "exists" },
      { outcome: "missing" },
      { outcome: "stale", current },
      { outcome: "too-large" },
    ];
    expect(refused.map((result) => describeSave(result, "a.txt"))).toEqual([
      "a.txt is not a valid name: use letters, digits, _ and -, ending .txt.",
      "a.txt is already in the workspace.",
      "a.txt is no longer in the workspace; it was deleted in another tab.",
      "a.txt was changed in another tab since it was opened.",
      "a.txt is too large for the workspace.",
    ]);
  });

  it("offers a download when storage is full (Q30)", () => {
    expect(describeSave({ outcome: "storage-full" }, "a.txt")).toBe(
      "The browser's storage is full, so a.txt was not saved; download it instead.",
    );
  });

  it("gives the reason for any other storage failure (T12e)", () => {
    expect(
      describeSave(
        { outcome: "storage-error", reason: "The operation is insecure." },
        "a.txt",
      ),
    ).toBe(
      "The browser would not save a.txt (The operation is insecure.); download it instead.",
    );
  });

  it("says a file from disk could not be read, and why (T12e)", () => {
    expect(
      describeOpenFailure(
        "network.txt",
        new DOMException(
          "The requested file could not be read.",
          "NotReadableError",
        ),
      ),
    ).toBe("Could not open network.txt: The requested file could not be read.");
  });
});
