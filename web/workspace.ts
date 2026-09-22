// The web UI's workspace: files the user creates, edits and deletes, kept in
// the browser's storage (DECISIONS T10.16). No DOM here, so it is tested in
// vitest with an in-memory store (T10.13); the page passes localStorage.

/** The part of the Web Storage API the workspace uses. */
export interface Store {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * A store held in memory, for a browser that refuses `localStorage`, as some
 * private modes do: the page still works, and forgets its files on reload.
 * The tests use it too; `full` makes every write throw, as a full store does.
 */
export class MemoryStore implements Store {
  private readonly items = new Map<string, string>();
  full = false;
  get length(): number {
    return this.items.size;
  }
  key(index: number): string | null {
    return [...this.items.keys()][index] ?? null;
  }
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    if (this.full) throw new Error("storage is full");
    this.items.set(key, value);
  }
  removeItem(key: string): void {
    this.items.delete(key);
  }
}

/** A workspace file as stored: its text and how many times it was saved. */
export interface WorkspaceFile {
  readonly name: string;
  readonly text: string;
  /** Raised by every save, so a save from an older copy is caught (Q26). */
  readonly version: number;
}

/** What a create or save did, or why it did nothing (Q25, Q26, Q30). */
export type SaveResult =
  | { readonly outcome: "saved"; readonly file: WorkspaceFile }
  | { readonly outcome: "invalid-name" }
  | { readonly outcome: "exists" }
  | { readonly outcome: "missing" }
  | { readonly outcome: "stale"; readonly current: WorkspaceFile }
  | { readonly outcome: "too-large" }
  | { readonly outcome: "storage-full" };

/** Letters, digits, `_` and `-`, then `.txt`, as a download is named (Q25). */
const NAME = /^[A-Za-z0-9_-]{1,100}\.txt$/;

/** The longest text a file may hold, in characters (Q30). */
export const MAX_LENGTH = 1_000_000;

/** Every workspace key starts with this, so other keys are left alone. */
const PREFIX = "herbie-lite:file:";

export function isValidName(name: string): boolean {
  return NAME.test(name);
}

/**
 * A name the workspace will accept for a file arriving from elsewhere: a
 * file opened from disk, or a copied example (Q25). Characters a name may
 * not hold become `-`, `.txt` is added if missing, and a taken name gets
 * `-2`, `-3` and so on before `.txt`.
 */
export function suggestName(raw: string, taken: ReadonlySet<string>): string {
  const base =
    raw
      .replace(/\.txt$/i, "")
      .replace(/[^A-Za-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 90) || "untitled";
  let name = `${base}.txt`;
  for (let n = 2; taken.has(name); n++) name = `${base}-${n}.txt`;
  return name;
}

function parse(name: string, value: string | null): WorkspaceFile | undefined {
  if (value === null) return undefined;
  try {
    const data = JSON.parse(value) as unknown;
    if (
      typeof data === "object" &&
      data !== null &&
      "text" in data &&
      "version" in data &&
      typeof data.text === "string" &&
      typeof data.version === "number"
    ) {
      return { name, text: data.text, version: data.version };
    }
  } catch {
    // Not ours, or damaged by hand: treated as absent, below.
  }
  return undefined;
}

export class Workspace {
  constructor(private readonly store: Store) {}

  /** Every workspace file's name, in code-unit order (Q14). */
  list(): string[] {
    const names: string[] = [];
    for (let i = 0; i < this.store.length; i++) {
      const key = this.store.key(i);
      if (key?.startsWith(PREFIX) !== true) continue;
      const name = key.slice(PREFIX.length);
      if (this.read(name) !== undefined) names.push(name);
    }
    return names.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }

  /**
   * One file, or `undefined` if there is none. A stored value that does not
   * parse as a workspace file is treated as absent rather than thrown on:
   * only this module writes these keys, so such a value was edited by hand.
   */
  read(name: string): WorkspaceFile | undefined {
    return parse(name, this.store.getItem(PREFIX + name));
  }

  /**
   * A new file: from the editor, from disk, or a copied example. A name
   * already in the workspace is refused unless `overwrite` is set, which the
   * page does only once the user has confirmed it (Q30); an overwrite still
   * raises the version, so another tab's copy of the old file goes stale.
   */
  create(name: string, text: string, overwrite = false): SaveResult {
    if (!isValidName(name)) return { outcome: "invalid-name" };
    const existing = this.read(name);
    if (existing !== undefined && !overwrite) return { outcome: "exists" };
    return this.write(name, text, (existing?.version ?? 0) + 1);
  }

  /**
   * A new version of a file already in the workspace, from a copy opened at
   * `version`. If the file has been saved since, in another tab, the save is
   * refused with the current file, rather than overwriting it (Q26).
   */
  save(name: string, text: string, version: number): SaveResult {
    const current = this.read(name);
    if (current === undefined) return { outcome: "missing" };
    if (current.version !== version) return { outcome: "stale", current };
    return this.write(name, text, version + 1);
  }

  /** Removes a file; the page confirms first, since it is permanent (Q26). */
  delete(name: string): boolean {
    if (this.read(name) === undefined) return false;
    this.store.removeItem(PREFIX + name);
    return true;
  }

  /**
   * Stores one file under its own key, so a failure touches no other file.
   * setItem replaces a value whole or throws, so a save the storage refuses
   * leaves the previous version as it was (Q30).
   */
  private write(name: string, text: string, version: number): SaveResult {
    if (text.length > MAX_LENGTH) return { outcome: "too-large" };
    try {
      this.store.setItem(PREFIX + name, JSON.stringify({ text, version }));
    } catch {
      return { outcome: "storage-full" };
    }
    return { outcome: "saved", file: { name, text, version } };
  }
}
