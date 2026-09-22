// The console: an xterm.js pane (Q27) that is a shell for herbie-lite and
// nothing else (T11c, DECISIONS T11.5). A line typed at its prompt, or
// entered by a button, runs if it invokes herbie-lite as the README shows,
// and is refused otherwise; commands themselves are never typed (T9.12).
// What a line asks for and how it runs is shell.ts, how a run is shown is
// console.ts; this module only draws the pane and wires them.
import "@xterm/xterm/css/xterm.css";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import {
  commandLine,
  output,
  pathOf,
  stderrLine,
  UNSAVED_NOTE,
  type Query,
  type Runnable,
} from "./console.js";
import { h } from "./dom.js";
import {
  CONSOLE_HELP,
  LineEditor,
  readCommandLine,
  runLine,
  type Files,
} from "./shell.js";

export interface Console {
  /** Enters the command for the file, and a query if asked, and runs it. */
  run(file: Runnable, query?: Query): void;
}

const PROMPT = "\u001b[1;32m$\u001b[0m ";

export function mountConsole(root: HTMLElement, files: Files): Console {
  const terminal = new Terminal({
    // The program writes `\n`; a terminal needs `\r\n` to return the cursor.
    convertEol: true,
    cursorBlink: true,
    cursorStyle: "bar",
    cursorInactiveStyle: "outline",
    fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
    fontSize: 13,
    scrollback: 5000,
    screenReaderMode: true,
    // The page's colours (T11.3): green for the prompt, amber for stderr.
    theme: {
      background: "#11150f",
      foreground: "#d7e0d0",
      cursor: "#7bd88f",
      cursorAccent: "#11150f",
      selectionBackground: "#1f3a24",
      green: "#7bd88f",
      brightGreen: "#9be6aa",
      yellow: "#e5b567",
      brightYellow: "#f0c987",
      red: "#ff7a70",
      brightBlack: "#5c6656",
    },
  });
  const fit = new FitAddon();
  terminal.loadAddon(fit);
  const editor = new LineEditor(PROMPT);

  // xterm.js styles the element it opens in, so it gets one of its own
  // inside the frame that carries the page's border and padding.
  const pane = h("div");
  root.replaceChildren(
    h(
      "section",
      { className: "console" },
      h(
        "header",
        {},
        h("h2", { textContent: "Console" }),
        h("button", {
          type: "button",
          className: "action",
          textContent: "Clear",
          onclick: () => {
            terminal.clear();
            terminal.focus();
          },
        }),
      ),
      h("div", { className: "screen" }, pane),
    ),
  );
  terminal.open(pane);
  // Lines wrap at the pane's width, so it is measured again when it changes.
  new ResizeObserver(() => fit.fit()).observe(pane);
  terminal.write(
    "\u001b[2mType a herbie-lite command, such as node dist/bin.js examples/input.txt,\n" +
      "or choose a file and press Run. Type help for what this console takes.\u001b[0m\n\n" +
      PROMPT,
  );

  /**
   * Runs one line. `override` supplies the file a button ran, so an editor's
   * unsaved text is what runs, as on screen (T10g).
   */
  async function execute(line: string, override?: Runnable): Promise<void> {
    const asked = readCommandLine(line);
    switch (asked.kind) {
      case "empty":
        break;
      case "help":
        terminal.write(CONSOLE_HELP);
        break;
      case "clear":
        terminal.clear();
        break;
      case "refused":
        terminal.write(stderrLine(`console: ${asked.message}`));
        break;
      case "run": {
        const path = override === undefined ? undefined : pathOf(override);
        const read: Files = (file) =>
          override !== undefined && file === path ? override.text : files(file);
        if (override?.unsaved === true) terminal.write(`${UNSAVED_NOTE}\n`);
        try {
          const { cat, result } = await runLine(asked, read);
          terminal.write(cat.map(stderrLine).join("") + output(result));
        } catch (error) {
          // A throw is a bug, not data (T6.1): the pane shows its stack, as
          // Node would, and the console carries on.
          const stack =
            error instanceof Error ? (error.stack ?? error.message) : "";
          terminal.write(`\u001b[31m${stack}\u001b[0m\n\n`);
          console.error(error);
        }
        break;
      }
    }
    terminal.write(PROMPT + editor.current);
    terminal.scrollToBottom();
  }

  // Lines run one at a time, in the order entered, so a paste of several
  // lines, or quick clicks, cannot interleave their output.
  let queue: Promise<void> = Promise.resolve();
  function enqueue(line: string, override?: Runnable): void {
    queue = queue.then(() => execute(line, override));
  }

  function feed(data: string): void {
    for (const effect of editor.feed(data)) {
      if (effect.kind === "write") terminal.write(effect.text);
      else if (effect.kind === "clear") terminal.clear();
      else enqueue(effect.line);
    }
  }
  terminal.onData(feed);
  // xterm.js knows Enter and Backspace by the deprecated `keyCode`, which a
  // synthetic keypress (as some embedded browsers send) leaves at 0, so the
  // line would never run. Those two are read from `key` instead when
  // `keyCode` is missing; a real keypress takes xterm's own path.
  const byKey: Readonly<Record<string, string>> = {
    Enter: "\r",
    Backspace: "\u007f",
  };
  terminal.attachCustomKeyEventHandler((event) => {
    const data = byKey[event.key];
    if (data === undefined || event.keyCode !== 0) return true;
    if (event.type === "keydown") feed(data);
    return false;
  });

  return {
    run(file, query) {
      const command = commandLine(file, query);
      terminal.write(editor.enter(command));
      enqueue(command, file);
      // The pane may be below the fold, where a run would go unseen.
      pane.scrollIntoView({ behavior: "smooth", block: "nearest" });
    },
  };
}
