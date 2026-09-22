// The editor (T10g, U1's builder): a workspace file as text, each line
// checked as it is edited, the command reference beside it, and saving back
// into the workspace. What a line's check says is editor.ts; what a save
// says is actions.ts. This module only draws and wires them, and is not
// tested (DECISIONS T10.13).
import { COMMAND_REFERENCE } from "../src/help.js";
import { describeSave } from "./actions.js";
import type { Runnable } from "./console.js";
import { download, h } from "./dom.js";
import { checkText, summary, type Mark } from "./editor.js";
import type { SaveResult, Workspace, WorkspaceFile } from "./workspace.js";

export interface EditorOptions {
  readonly workspace: Workspace;
  readonly file: WorkspaceFile;
  readonly onRun: (file: Runnable) => void;
  /** The file was deleted from the editor; the panel lets go of it. */
  readonly onDelete: () => void;
  /** The workspace changed (a save), so the file list may need redrawing. */
  readonly onChange: () => void;
}

/** How long typing pauses before the file is checked again, in ms. */
const CHECK_DELAY = 150;

/** A textarea's line height, which the gutter's rows must match. */
const LINE_HEIGHT_EM = 1.5;

export class Editor {
  readonly element: HTMLElement;
  readonly name: string;
  private version: number;
  private saved: string;
  private readonly text: HTMLTextAreaElement;
  private readonly gutter: HTMLElement;
  private readonly problems: HTMLElement;
  private readonly state: HTMLElement;
  private readonly status: HTMLElement;
  private marks: readonly Mark[] = [];
  private checks = 0;
  private timer: number | undefined;

  constructor(private readonly options: EditorOptions) {
    const { file } = options;
    this.name = file.name;
    this.version = file.version;
    this.saved = file.text;

    this.text = h("textarea", {
      className: "code",
      value: file.text,
      spellcheck: false,
      wrap: "off",
      oninput: () => {
        this.update();
        this.schedule();
      },
      onscroll: () => {
        this.gutter.scrollTop = this.text.scrollTop;
      },
      onkeydown: (event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === "s") {
          event.preventDefault();
          this.save();
        }
      },
    });
    this.text.setAttribute("autocapitalize", "off");
    this.text.setAttribute("aria-label", `Contents of ${file.name}`);
    this.gutter = h("div", { className: "gutter" });
    this.gutter.setAttribute("aria-hidden", "true");
    this.problems = h("div", { className: "problems" });
    this.state = h("span", { className: "badge" });
    this.status = h("div", { className: "status", role: "status" });

    this.element = h(
      "section",
      { className: "viewer editor" },
      h(
        "header",
        {},
        h("h2", { textContent: file.name }),
        this.state,
        h(
          "div",
          { className: "actions" },
          this.button("Run", "action primary", () => {
            options.onRun({
              source: "workspace",
              name: this.name,
              text: this.text.value,
              unsaved: this.dirty,
            });
          }),
          this.button("Save", "action", () => this.save()),
          this.button("Download", "action", () => {
            download(this.name, this.text.value);
          }),
          this.button("Delete", "action danger", () => this.delete()),
        ),
      ),
      h(
        "div",
        { className: "editing" },
        h(
          "div",
          { className: "editor-main" },
          h("div", { className: "code-frame" }, this.gutter, this.text),
          this.status,
          this.problems,
        ),
        h(
          "aside",
          { className: "reference" },
          h("h2", { textContent: "Commands" }),
          h("pre", { textContent: COMMAND_REFERENCE }),
        ),
      ),
    );
    this.update();
    void this.check();
  }

  /** Whether the text differs from what the workspace holds. */
  get dirty(): boolean {
    return this.text.value !== this.saved;
  }

  /**
   * The workspace changed in another tab. A file with no unsaved changes
   * takes the new version; one with unsaved changes keeps them, and its
   * next save is refused as stale and offers the choice (Q26).
   */
  refresh(): void {
    const current = this.options.workspace.read(this.name);
    if (current === undefined || this.dirty) return;
    if (current.version !== this.version) this.load(current);
  }

  private button(
    textContent: string,
    className: string,
    onclick: () => void,
  ): HTMLButtonElement {
    return h("button", { type: "button", className, textContent, onclick });
  }

  private load(file: WorkspaceFile): void {
    this.version = file.version;
    this.saved = file.text;
    this.text.value = file.text;
    this.update();
    void this.check();
  }

  private save(): void {
    const { workspace } = this.options;
    this.settle(workspace.save(this.name, this.text.value, this.version));
  }

  /** What a save did: kept, or refused with a way forward (Q26, Q30). */
  private settle(result: SaveResult): void {
    this.status.replaceChildren(describeSave(result, this.name));
    if (result.outcome === "saved") {
      this.version = result.file.version;
      this.saved = result.file.text;
      this.update();
      this.options.onChange();
    } else if (result.outcome === "stale") {
      // Another tab saved first. Either copy may be the one to keep, so the
      // choice is the user's, and neither is lost until it is made.
      const { current } = result;
      this.status.append(
        " ",
        this.button("Keep mine", "action", () => {
          const { workspace } = this.options;
          this.settle(
            workspace.save(this.name, this.text.value, current.version),
          );
        }),
        " ",
        this.button("Load theirs", "action", () => {
          this.load(current);
          this.status.replaceChildren(`Loaded the version saved elsewhere.`);
        }),
      );
    } else if (result.outcome === "missing") {
      this.status.append(
        " ",
        this.button("Save as new", "action", () => {
          const { workspace } = this.options;
          this.settle(workspace.create(this.name, this.text.value));
        }),
      );
    }
  }

  private delete(): void {
    // Deletion is permanent, so it is confirmed first (Q26).
    if (!confirm(`Delete ${this.name}? This cannot be undone.`)) return;
    this.options.workspace.delete(this.name);
    this.options.onDelete();
  }

  private schedule(): void {
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.check(), CHECK_DELAY);
  }

  /** Checks the text as it stands; a check overtaken by an edit is dropped. */
  private async check(): Promise<void> {
    const ticket = ++this.checks;
    const marks = await checkText(this.text.value);
    if (ticket !== this.checks) return;
    this.marks = marks;
    this.update();
    this.problems.replaceChildren(
      h("p", { className: "summary", textContent: summary(marks) }),
      ...(marks.length === 0
        ? []
        : [
            h(
              "ul",
              {},
              ...marks.map((mark) =>
                h(
                  "li",
                  {},
                  h(
                    "button",
                    {
                      type: "button",
                      className: `problem ${mark.severity}`,
                      onclick: () => this.goTo(mark.lineNumber),
                    },
                    h("span", {
                      className: "where",
                      textContent: `Line ${mark.lineNumber} · ${mark.severity}`,
                    }),
                    ` ${mark.message}`,
                  ),
                ),
              ),
            ),
          ]),
    );
  }

  /** Redraws the gutter and the unsaved badge from the text as it stands. */
  private update(): void {
    const count = this.text.value.split("\n").length;
    const marked = new Map(this.marks.map((mark) => [mark.lineNumber, mark]));
    const rows: HTMLElement[] = [];
    for (let n = 1; n <= count; n++) {
      const mark = marked.get(n);
      const row = h("div", {
        className: mark === undefined ? "row" : `row ${mark.severity}`,
        textContent: String(n),
      });
      if (mark !== undefined) row.title = mark.message;
      rows.push(row);
    }
    this.gutter.replaceChildren(...rows);
    this.gutter.scrollTop = this.text.scrollTop;
    this.state.textContent = this.dirty
      ? "Workspace · unsaved changes"
      : "Workspace";
  }

  /** Puts the cursor at the start of a line and scrolls it into view. */
  private goTo(lineNumber: number): void {
    const lines = this.text.value.split("\n");
    const offset = lines
      .slice(0, lineNumber - 1)
      .reduce((total, line) => total + line.length + 1, 0);
    this.text.focus();
    this.text.setSelectionRange(offset, offset);
    const lineHeight =
      parseFloat(getComputedStyle(this.text).fontSize) * LINE_HEIGHT_EM;
    this.text.scrollTop = Math.max(0, (lineNumber - 3) * lineHeight);
  }
}
