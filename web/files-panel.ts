// The files panel (T10e): the examples and the workspace listed, an example
// shown read-only with line numbers, a workspace file in the editor (T10g),
// and the actions on each. The work on the workspace is in actions.ts; this
// module only draws and wires it.
import { addToWorkspace, describeSave } from "./actions.js";
import type { Runnable } from "./console.js";
import { download, h } from "./dom.js";
import { Editor } from "./editor-panel.js";
import { suggestName, type Workspace } from "./workspace.js";

/** Which file is shown: an example (read-only) or a workspace file. */
interface Selection {
  readonly source: "example" | "workspace";
  readonly name: string;
}

export interface FilesPanelOptions {
  readonly workspace: Workspace;
  readonly examples: ReadonlyMap<string, string>;
  /** False when the browser refused storage, so files last only until reload. */
  readonly persistent: boolean;
  /** Runs herbie-lite on the chosen file, in the console (T10f). */
  readonly onRun: (file: Runnable) => void;
}

export function mountFilesPanel(
  root: HTMLElement,
  { workspace, examples, persistent, onRun }: FilesPanelOptions,
): void {
  let selection: Selection | undefined =
    examples.size > 0
      ? { source: "example", name: [...examples.keys()][0] ?? "" }
      : undefined;
  let status = persistent
    ? ""
    : "This browser will not keep files, so the workspace lasts until the page is reloaded.";

  // The open workspace file's editor, kept across renders so its text,
  // cursor and scroll survive them. There is at most one.
  let editor: Editor | undefined;

  /**
   * Shows another file, or none. Unsaved changes in the editor are only
   * given up once the user agrees; returns whether the switch happened.
   */
  function select(next: Selection | undefined): boolean {
    const same = next?.source === "workspace" && editor?.name === next.name;
    if (!same && editor?.dirty === true) {
      if (!confirm(`Discard your unsaved changes to ${editor.name}?`)) {
        return false;
      }
    }
    if (!same) editor = undefined;
    selection = next;
    return true;
  }

  /** The editor for the selected workspace file, made when first shown. */
  function editorFor(name: string): Editor | undefined {
    if (editor?.name === name) return editor;
    const file = workspace.read(name);
    if (file === undefined) return undefined;
    editor = new Editor({
      workspace,
      file,
      onRun,
      onDelete: () => {
        status = `Deleted ${name}.`;
        editor = undefined;
        selection = undefined;
        render();
      },
      onChange: () => render(),
    });
    return editor;
  }

  /**
   * A new, empty workspace file under a name the user gives. A name already
   * taken is overwritten only once the user confirms it (Q30).
   */
  function newFile(): void {
    const suggested = suggestName("untitled", new Set(workspace.list()));
    const name = prompt("Name the new file:", suggested)?.trim();
    if (name === undefined || name === "") return;
    let result = workspace.create(name, "");
    if (
      result.outcome === "exists" &&
      confirm(
        `${name} is already in the workspace. Replace it with an empty file?`,
      )
    ) {
      result = workspace.create(name, "", true);
    }
    status = describeSave(result, name);
    if (result.outcome === "saved") {
      if (!select({ source: "workspace", name })) return;
      // An overwritten file is a new file, whatever the editor held.
      editor = undefined;
    }
    render();
  }

  // One file input, kept across renders, so choosing a file is not lost.
  const picker = h("input", { type: "file", accept: ".txt,text/plain" });
  picker.hidden = true;
  picker.addEventListener("change", () => {
    const file = picker.files?.[0];
    picker.value = "";
    if (file === undefined) return;
    void file.text().then((text) => {
      const result = addToWorkspace(workspace, file.name, text);
      status = describeSave(result, file.name);
      if (result.outcome === "saved") {
        select({ source: "workspace", name: result.file.name });
      }
      render();
    });
  });

  function textOf(chosen: Selection): string | undefined {
    return chosen.source === "example"
      ? examples.get(chosen.name)
      : workspace.read(chosen.name)?.text;
  }

  function fileButton(chosen: Selection): HTMLLIElement {
    const current =
      selection?.source === chosen.source && selection.name === chosen.name;
    const button = h("button", {
      type: "button",
      className: "file",
      textContent: chosen.name,
      onclick: () => {
        if (!select(chosen)) return;
        status = "";
        render();
      },
    });
    if (current) button.setAttribute("aria-current", "true");
    return h("li", {}, button);
  }

  function fileList(): HTMLElement {
    const names = workspace.list();
    return h(
      "nav",
      { className: "files" },
      h(
        "section",
        {},
        h("h2", { textContent: "Examples" }),
        h(
          "ul",
          {},
          ...[...examples.keys()].map((name) =>
            fileButton({ source: "example", name }),
          ),
        ),
      ),
      h(
        "section",
        {},
        h("h2", { textContent: "Workspace" }),
        names.length === 0
          ? h("p", {
              className: "empty",
              textContent:
                "No files yet. Start one, open one, or copy an example.",
            })
          : h(
              "ul",
              {},
              ...names.map((name) => fileButton({ source: "workspace", name })),
            ),
        h(
          "div",
          { className: "actions" },
          h("button", {
            type: "button",
            className: "action",
            textContent: "New file…",
            onclick: newFile,
          }),
          h("button", {
            type: "button",
            className: "action",
            textContent: "Open a file…",
            onclick: () => picker.click(),
          }),
        ),
      ),
    );
  }

  /** The file's lines, numbered by CSS, as warnings number them (T6.4). */
  function source(text: string): HTMLElement {
    const lines = text.split("\n");
    if (lines.at(-1) === "") lines.pop();
    return h(
      "pre",
      { className: "source" },
      h(
        "code",
        {},
        ...lines.map((line) => h("span", { className: "line" }, line)),
      ),
    );
  }

  function viewer(): HTMLElement {
    if (selection?.source === "workspace") {
      const open = editorFor(selection.name);
      if (open !== undefined) return open.element;
    }
    const text = selection === undefined ? undefined : textOf(selection);
    if (selection === undefined || text === undefined) {
      return h(
        "section",
        { className: "viewer" },
        h("p", {
          className: "empty",
          textContent: "Choose a file to view it.",
        }),
      );
    }
    const chosen = selection;
    const actions = h(
      "div",
      { className: "actions" },
      h("button", {
        type: "button",
        className: "action primary",
        textContent: "Run",
        onclick: () => onRun({ ...chosen, text }),
      }),
    );
    if (chosen.source === "example") {
      actions.append(
        h("button", {
          type: "button",
          className: "action",
          textContent: "Copy to workspace",
          onclick: () => {
            const result = addToWorkspace(workspace, chosen.name, text);
            status = describeSave(result, chosen.name);
            if (result.outcome === "saved") {
              select({ source: "workspace", name: result.file.name });
            }
            render();
          },
        }),
      );
    }
    actions.append(
      h("button", {
        type: "button",
        className: "action",
        textContent: "Download",
        onclick: () => download(chosen.name, text),
      }),
    );
    return h(
      "section",
      { className: "viewer" },
      h(
        "header",
        {},
        h("h2", { textContent: chosen.name }),
        h("span", {
          className: "badge",
          textContent: "Example · read-only",
        }),
        actions,
      ),
      source(text),
    );
  }

  const layout = h("div", { className: "layout" });
  const statusLine = h("p", { className: "status", role: "status" });
  root.replaceChildren(layout, picker);

  function render(): void {
    statusLine.textContent = status;
    const view = viewer();
    // An editor already on the page is left where it is, so typing, the
    // cursor and the scroll position are never disturbed by a redraw.
    if (view.parentElement === layout) {
      layout.firstElementChild?.replaceWith(fileList());
    } else {
      layout.replaceChildren(fileList(), view, statusLine);
    }
  }

  // Another tab changed the workspace: redraw, and let go of a file it
  // deleted, unless the editor holds unsaved changes to it, which a save
  // can still keep as a new file (Q26).
  window.addEventListener("storage", () => {
    if (
      selection?.source === "workspace" &&
      workspace.read(selection.name) === undefined &&
      editor?.dirty !== true
    ) {
      editor = undefined;
      selection = undefined;
    }
    editor?.refresh();
    render();
  });

  // Leaving the page drops unsaved changes, so the browser asks first.
  window.addEventListener("beforeunload", (event) => {
    if (editor?.dirty === true) event.preventDefault();
  });

  render();
}
