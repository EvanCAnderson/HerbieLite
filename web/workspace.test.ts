import { describe, expect, it } from "vitest";
import {
  MAX_LENGTH,
  MemoryStore,
  suggestName,
  Workspace,
} from "./workspace.js";

function workspace(): { store: MemoryStore; files: Workspace } {
  const store = new MemoryStore();
  return { store, files: new Workspace(store) };
}

describe("creating and reading files", () => {
  it("stores a file and reads it back at version 1", () => {
    const { files } = workspace();
    expect(files.create("network.txt", "Partner Chris\n")).toEqual({
      outcome: "saved",
      file: { name: "network.txt", text: "Partner Chris\n", version: 1 },
    });
    expect(files.read("network.txt")).toEqual({
      name: "network.txt",
      text: "Partner Chris\n",
      version: 1,
    });
  });

  it("lists files in code-unit order (Q14)", () => {
    const { files } = workspace();
    for (const name of ["b.txt", "a.txt", "Z.txt"]) files.create(name, "");
    expect(files.list()).toEqual(["Z.txt", "a.txt", "b.txt"]);
  });

  it("leaves keys that are not its own alone", () => {
    const { store, files } = workspace();
    store.setItem("theme", "dark");
    files.create("a.txt", "");
    expect(files.list()).toEqual(["a.txt"]);
    expect(store.getItem("theme")).toBe("dark");
  });

  it("treats a value damaged by hand as absent", () => {
    const { store, files } = workspace();
    store.setItem("herbie-lite:file:a.txt", "not json");
    store.setItem("herbie-lite:file:b.txt", '{"text":1}');
    expect(files.list()).toEqual([]);
    expect(files.read("a.txt")).toBeUndefined();
  });
});

describe("file names (Q25)", () => {
  it("accepts letters, digits, _ and -, ending .txt", () => {
    const { files } = workspace();
    expect(files.create("My_network-2.txt", "").outcome).toBe("saved");
  });

  it("refuses anything else", () => {
    const { files } = workspace();
    const names = [
      "network",
      "network.TXT",
      "my network.txt",
      "../network.txt",
      ".txt",
      `${"a".repeat(101)}.txt`,
    ];
    for (const name of names) {
      expect(files.create(name, "").outcome, name).toBe("invalid-name");
    }
  });

  it("tells names apart by case", () => {
    const { files } = workspace();
    files.create("a.txt", "lower");
    expect(files.create("A.txt", "upper").outcome).toBe("saved");
  });
});

describe("a name already taken (Q30)", () => {
  it("refuses to create over an existing file unless told to", () => {
    const { files } = workspace();
    files.create("a.txt", "first");
    expect(files.create("a.txt", "second")).toEqual({ outcome: "exists" });
    expect(files.read("a.txt")?.text).toBe("first");
  });

  it("overwrites once confirmed, raising the version", () => {
    const { files } = workspace();
    files.create("a.txt", "first");
    expect(files.create("a.txt", "second", true)).toEqual({
      outcome: "saved",
      file: { name: "a.txt", text: "second", version: 2 },
    });
  });
});

describe("saving an edit (Q26)", () => {
  it("saves from the current version, and raises it", () => {
    const { files } = workspace();
    files.create("a.txt", "one");
    expect(files.save("a.txt", "two", 1)).toEqual({
      outcome: "saved",
      file: { name: "a.txt", text: "two", version: 2 },
    });
  });

  it("refuses a save from an older copy, as another tab would make", () => {
    const { files } = workspace();
    files.create("a.txt", "one");
    files.save("a.txt", "saved in another tab", 1);
    expect(files.save("a.txt", "this tab's edit", 1)).toEqual({
      outcome: "stale",
      current: { name: "a.txt", text: "saved in another tab", version: 2 },
    });
    expect(files.read("a.txt")?.text).toBe("saved in another tab");
  });

  it("makes another tab's copy stale when a file is overwritten", () => {
    const { files } = workspace();
    files.create("a.txt", "one");
    files.create("a.txt", "replaced", true);
    expect(files.save("a.txt", "edit", 1).outcome).toBe("stale");
  });

  it("refuses to save a file deleted since it was opened", () => {
    const { files } = workspace();
    files.create("a.txt", "one");
    files.delete("a.txt");
    expect(files.save("a.txt", "edit", 1)).toEqual({ outcome: "missing" });
  });
});

describe("a save the storage cannot hold (Q30)", () => {
  it("refuses text over the limit, keeping the old version", () => {
    const { files } = workspace();
    files.create("a.txt", "one");
    expect(files.save("a.txt", "x".repeat(MAX_LENGTH + 1), 1)).toEqual({
      outcome: "too-large",
    });
    expect(files.read("a.txt")?.text).toBe("one");
  });

  it("reports a full store, keeping the old version", () => {
    const { store, files } = workspace();
    files.create("a.txt", "one");
    store.full = true;
    expect(files.save("a.txt", "two", 1)).toEqual({ outcome: "storage-full" });
    expect(files.read("a.txt")).toEqual({
      name: "a.txt",
      text: "one",
      version: 1,
    });
  });
});

describe("deleting", () => {
  it("removes a file, and says whether there was one", () => {
    const { files } = workspace();
    files.create("a.txt", "");
    expect(files.delete("a.txt")).toBe(true);
    expect(files.list()).toEqual([]);
    expect(files.delete("a.txt")).toBe(false);
  });
});

describe("a name for a file from elsewhere (Q25)", () => {
  it("keeps a name that is already valid", () => {
    expect(suggestName("network.txt", new Set())).toBe("network.txt");
  });

  it("replaces what a name may not hold, and adds .txt", () => {
    expect(suggestName("My Network (final).TXT", new Set())).toBe(
      "My-Network-final.txt",
    );
    expect(suggestName("contacts.csv", new Set())).toBe("contacts-csv.txt");
  });

  it("numbers a name that is taken", () => {
    const taken = new Set(["input.txt", "input-2.txt"]);
    expect(suggestName("input.txt", taken)).toBe("input-3.txt");
  });

  it("falls back to untitled when nothing is left", () => {
    expect(suggestName("   .txt", new Set())).toBe("untitled.txt");
  });
});
