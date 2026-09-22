// The console (T10f): an xterm.js pane that runs herbie-lite on a listed
// file and shows what it printed (Q27). It runs this program and nothing
// else, and takes no typed input (DECISIONS T9.5, T9.12). What a run prints,
// and how it is shown, is in console.ts; this module only draws the pane.
import "@xterm/xterm/css/xterm.css";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { commandLine, runFile, transcript, type Runnable } from "./console.js";
import { h } from "./dom.js";

export interface Console {
  /** Runs herbie-lite on the file and appends the run to the pane. */
  run(file: Runnable): void;
}

export function mountConsole(root: HTMLElement): Console {
  const terminal = new Terminal({
    // The program writes `\n`; a terminal needs `\r\n` to return the cursor.
    convertEol: true,
    disableStdin: true,
    cursorStyle: "bar",
    cursorInactiveStyle: "none",
    fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
    fontSize: 13,
    scrollback: 5000,
    screenReaderMode: true,
    theme: { background: "#15171b", foreground: "#e6e8eb" },
  });
  const fit = new FitAddon();
  terminal.loadAddon(fit);

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
          onclick: () => terminal.clear(),
        }),
      ),
      h("div", { className: "screen" }, pane),
    ),
  );
  terminal.open(pane);
  // Lines wrap at the pane's width, so it is measured again when it changes.
  new ResizeObserver(() => fit.fit()).observe(pane);
  terminal.writeln(
    "\u001b[2mChoose a file and press Run to run herbie-lite on it.\u001b[0m\r\n",
  );

  // Runs are queued, so two quick clicks cannot interleave their output.
  let queue: Promise<void> = Promise.resolve();
  return {
    run(file) {
      const command = commandLine(file);
      queue = queue.then(async () => {
        try {
          terminal.write(
            transcript(command, await runFile(file), file.unsaved === true),
          );
        } catch (error) {
          // A throw is a bug, not data (T6.1): the pane shows its stack, as
          // Node would, and the page carries on.
          const stack =
            error instanceof Error ? (error.stack ?? error.message) : "";
          terminal.write(
            `\u001b[1m$ ${command}\u001b[0m\n\u001b[31m${stack}\u001b[0m\n\n`,
          );
          console.error(error);
        }
        terminal.scrollToBottom();
        // The pane may be below the fold, where a run would go unseen.
        pane.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    },
  };
}
