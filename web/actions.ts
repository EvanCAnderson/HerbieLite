// What the files panel does with the workspace, apart from the DOM, so it is
// tested in vitest like the workspace itself (DECISIONS T10.13).
import { assertNever } from "../src/assert-never.js";
import { suggestName, type SaveResult, type Workspace } from "./workspace.js";

/**
 * Adds text from elsewhere, a file opened from disk or a copied example,
 * under a name the workspace will take and that no file there has yet
 * (Q25), so nothing is ever overwritten this way.
 */
export function addToWorkspace(
  workspace: Workspace,
  from: string,
  text: string,
): SaveResult {
  return workspace.create(suggestName(from, new Set(workspace.list())), text);
}

/**
 * One sentence for the status line when a file chosen from disk could not be
 * read, as happens when it is moved or deleted after it was chosen (T12e).
 */
export function describeOpenFailure(name: string, error: unknown): string {
  const reason = error instanceof Error ? error.message : String(error);
  return `Could not open ${name}: ${reason}`;
}

/** One sentence for the status line: what a save did, or why it did not. */
export function describeSave(result: SaveResult, name: string): string {
  switch (result.outcome) {
    case "saved":
      return `Saved ${result.file.name}.`;
    case "invalid-name":
      return `${name} is not a valid name: use letters, digits, _ and -, ending .txt.`;
    case "exists":
      return `${name} is already in the workspace.`;
    case "missing":
      return `${name} is no longer in the workspace; it was deleted in another tab.`;
    case "stale":
      return `${name} was changed in another tab since it was opened.`;
    case "too-large":
      return `${name} is too large for the workspace.`;
    case "storage-full":
      return `The browser's storage is full, so ${name} was not saved; download it instead.`;
    case "storage-error":
      return `The browser would not save ${name} (${result.reason}); download it instead.`;
    default:
      return assertNever(result);
  }
}
