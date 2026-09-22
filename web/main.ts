// The page's entry point (DECISIONS T9.7): plain TypeScript, bundled by Vite
// into dist/web/ (Q22), running with no server (T10.16).
import "./style.css";
import { mountConsole } from "./console-panel.js";
import { pageFiles } from "./shell.js";
import { h } from "./dom.js";
import { EXAMPLES, PURPOSES } from "./examples.js";
import { mountFilesPanel } from "./files-panel.js";
import { MemoryStore, Workspace, type Store } from "./workspace.js";

/**
 * The browser's storage, or one held in memory if the browser refuses it,
 * as some private modes do; merely reading `localStorage` can throw there.
 */
function openStore(): { store: Store; persistent: boolean } {
  try {
    const store = window.localStorage;
    store.getItem("herbie-lite:probe");
    return { store, persistent: true };
  } catch {
    return { store: new MemoryStore(), persistent: false };
  }
}

const app = document.querySelector<HTMLElement>("#app");
if (app === null) throw new Error("index.html has no #app element");

const { store, persistent } = openStore();
const workspace = new Workspace(store);
// The console is mounted apart from the files panel, which redraws itself
// on every change, so the terminal and its scrollback are never torn down.
const panel = h("div");
const consoleRoot = h("div");
app.replaceChildren(
  h("h1", { textContent: "herbie-lite" }),
  h("p", {
    className: "tagline",
    textContent: "build your network. know your ties.",
  }),
  panel,
  consoleRoot,
);
const herbie = mountConsole(
  consoleRoot,
  pageFiles(EXAMPLES, (name) => workspace.read(name)?.text),
);
mountFilesPanel(panel, {
  workspace,
  examples: EXAMPLES,
  purposes: PURPOSES,
  persistent,
  onRun: (file, query) => herbie.run(file, query),
});
