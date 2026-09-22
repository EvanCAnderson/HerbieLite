// The files panel (T10e): the examples and the workspace listed, an example
// shown read-only with line numbers, a workspace file in the editor (T10g),
// and the actions on each. The work on the workspace is in actions.ts; this
// module only draws and wires it.
import { addToWorkspace, describeSave } from "./actions.js";
import { companiesIn, type Query, type Runnable } from "./console.js";
import { download, h } from "./dom.js";
import { Editor } from "./editor-panel.js";
import { queryControls } from "./query-controls.js";
import { suggestName, type Workspace } from "./workspace.js";

/** Which file is shown: an example (read-only) or a workspace file. */
interface Selection {
  readonly source: "example" | "workspace";
  readonly name: string;
}

export interface FilesPanelOptions {
  readonly workspace: Workspace;
  readonly examples: ReadonlyMap<string, string>;
  /** What each example is for, in one line (T11.2). */
  readonly purposes: ReadonlyMap<string, string>;
  /** False when the browser refused storage, so files last only until reload. */
  readonly persistent: boolean;
  /** Runs herbie-lite on the chosen file, in the console (T10f, T11c). */
  readonly onRun: (file: Runnable, query?: Query) => void;
}

export function mountFilesPanel(
  root: HTMLElement,
  { workspace, examples, purposes, persistent, onRun }: FilesPanelOptions,
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
   * The form that names a new file, made once and kept across renders, so a
   * redraw (another tab saving, say) never loses a half-typed name. It is a
   * form in the page rather than `prompt()`, which some browsers do not
   * support: the Claude app's throws on it (T11a).
   */
  const nameInput = h("input", {
    type: "text",
    className: "name",
    spellcheck: false,
    autocomplete: "off",
  });
  nameInput.setAttribute("aria-label", "New file name");
  const nameForm = h(
    "form",
    {
      className: "new-file",
      onsubmit: (event) => {
        event.preventDefault();
        createFile(nameInput.value.trim());
      },
      // Enter is handled here as well as by the form's own submission,
      // which a synthetic keypress (as some embedded browsers send) does not
      // trigger; preventing the default keeps a real one from creating twice.
      onkeydown: (event) => {
        if (event.key === "Escape") closeNameForm();
        if (event.key === "Enter" && event.target === nameInput) {
          event.preventDefault();
          createFile(nameInput.value.trim());
        }
      },
    },
    nameInput,
    h(
      "div",
      { className: "actions" },
      h("button", {
        type: "submit",
        className: "action primary",
        textContent: "Create",
      }),
      h("button", {
        type: "button",
        className: "action",
        textContent: "Cancel",
        onclick: () => closeNameForm(),
      }),
    ),
  );
  let naming = false;

  function openNameForm(): void {
    naming = true;
    nameInput.value = suggestName("untitled", new Set(workspace.list()));
    render();
    nameInput.focus();
    // Select the name without `.txt`, so typing replaces just that part.
    nameInput.setSelectionRange(0, nameInput.value.length - ".txt".length);
  }

  function closeNameForm(): void {
    naming = false;
    render();
  }

  /**
   * A new, empty workspace file under the name given. A name already taken
   * is overwritten only once the user confirms it (Q30); a name the
   * workspace refuses leaves the form open to correct it (Q25).
   */
  function createFile(name: string): void {
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
      naming = false;
    }
    render();
    if (naming) nameInput.focus();
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
    const purpose =
      chosen.source === "example" ? purposes.get(chosen.name) : undefined;
    if (purpose !== undefined) button.title = purpose;
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
        naming
          ? nameForm
          : h(
              "div",
              { className: "actions" },
              h("button", {
                type: "button",
                className: "action",
                textContent: "New file…",
                onclick: openNameForm,
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
    const purpose = purposes.get(chosen.name);
    const queries = queryControls((query) => onRun({ ...chosen, text }, query));
    void companiesIn(text).then((companies) => queries.suggest(companies));
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
      ...(purpose === undefined
        ? []
        : [h("p", { className: "purpose", textContent: purpose })]),
      queries.element,
      source(text),
    );
  }

  const layout = h("div", { className: "layout" });
  const statusLine = h("p", { className: "status", role: "status" });
  root.replaceChildren(layout, picker);

  function render(): void {
    statusLine.textContent = status;
    // The name form moves into the redrawn list, and a moved element loses
    // focus, so it is given back.
    const typing = document.activeElement === nameInput;
    const view = viewer();
    // An editor already on the page is left where it is, so typing, the
    // cursor and the scroll position are never disturbed by a redraw.
    if (view.parentElement === layout) {
      layout.firstElementChild?.replaceWith(fileList());
    } else {
      layout.replaceChildren(fileList(), view, statusLine);
    }
    if (typing) nameInput.focus();
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
