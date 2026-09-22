// The files panel (T10e): the examples and the workspace listed, the chosen
// file shown read-only with line numbers, and the actions on it. The work on
// the workspace is in actions.ts; this module only draws and wires it.
import { addToWorkspace, describeSave } from "./actions.js";
import { download, h } from "./dom.js";
import type { Workspace } from "./workspace.js";

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
}

export function mountFilesPanel(
  root: HTMLElement,
  { workspace, examples, persistent }: FilesPanelOptions,
): void {
  let selection: Selection | undefined =
    examples.size > 0
      ? { source: "example", name: [...examples.keys()][0] ?? "" }
      : undefined;
  let status = persistent
    ? ""
    : "This browser will not keep files, so the workspace lasts until the page is reloaded.";

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
        selection = { source: "workspace", name: result.file.name };
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
        selection = chosen;
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
              textContent: "No files yet. Open one, or copy an example.",
            })
          : h(
              "ul",
              {},
              ...names.map((name) => fileButton({ source: "workspace", name })),
            ),
        h("button", {
          type: "button",
          className: "action",
          textContent: "Open a file…",
          onclick: () => picker.click(),
        }),
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
    const actions = h("div", { className: "actions" });
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
              selection = { source: "workspace", name: result.file.name };
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
    if (chosen.source === "workspace") {
      actions.append(
        h("button", {
          type: "button",
          className: "action danger",
          textContent: "Delete",
          onclick: () => {
            // Deletion is permanent, so it is confirmed first (Q26).
            if (!confirm(`Delete ${chosen.name}? This cannot be undone.`)) {
              return;
            }
            workspace.delete(chosen.name);
            status = `Deleted ${chosen.name}.`;
            selection = undefined;
            render();
          },
        }),
      );
    }
    return h(
      "section",
      { className: "viewer" },
      h(
        "header",
        {},
        h("h2", { textContent: chosen.name }),
        h("span", {
          className: "badge",
          textContent:
            chosen.source === "example" ? "Example · read-only" : "Workspace",
        }),
        actions,
      ),
      source(text),
    );
  }

  function render(): void {
    root.replaceChildren(
      h(
        "div",
        { className: "layout" },
        fileList(),
        viewer(),
        h("p", { className: "status", role: "status", textContent: status }),
      ),
      picker,
    );
  }

  // Another tab changed the workspace: redraw, and let go of a file it
  // deleted rather than show text that is no longer there.
  window.addEventListener("storage", () => {
    if (
      selection?.source === "workspace" &&
      workspace.read(selection.name) === undefined
    ) {
      selection = undefined;
    }
    render();
  });

  render();
}
