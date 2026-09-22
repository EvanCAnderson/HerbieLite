// The web UI's server (DECISIONS T9.5, T9.7): Node's own http module, serving
// the page Vite built into dist/web/ (Q22). It listens on 127.0.0.1 only; the
// Host and Origin checks come with the rest of the server's defences (Q24,
// T10d).
import { readdir, readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { extname, join, relative, sep } from "node:path";

/** One file of the built page, held in memory with its media type. */
interface Asset {
  readonly type: string;
  readonly body: Buffer;
}

/** The media types Vite emits for a page of HTML, TypeScript and CSS. */
const TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

/**
 * Reads every file under the built page into a map from URL path to asset,
 * with `/` for index.html. A request is looked up in this map and never
 * turned into a file path, so no request can reach a file outside it, however
 * it is spelled. A file of a type the page does not use is left out.
 */
async function loadSite(root: string): Promise<Map<string, Asset>> {
  const site = new Map<string, Asset>();
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const path = join(entry.parentPath, entry.name);
    const type = TYPES[extname(entry.name)];
    if (type === undefined) continue;
    const url = `/${relative(root, path).split(sep).join("/")}`;
    site.set(url === "/index.html" ? "/" : url, {
      type,
      body: await readFile(path),
    });
  }
  return site;
}

/**
 * A server for the page built into `root`: GET and HEAD for the files found
 * there when it starts, 404 for anything else, 405 for any other method. The
 * page is read once, so a rebuild needs a restart.
 */
export async function createUiServer(root: string): Promise<Server> {
  const site = await loadSite(root);
  return createServer((request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { allow: "GET, HEAD" }).end();
      return;
    }
    const path = new URL(request.url ?? "/", "http://localhost").pathname;
    const asset = site.get(path);
    if (asset === undefined) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end(request.method === "HEAD" ? undefined : "Not found\n");
      return;
    }
    response.writeHead(200, {
      "content-type": asset.type,
      "content-length": asset.body.length,
    });
    response.end(request.method === "HEAD" ? undefined : asset.body);
  });
}

/** Where the server listens: this machine only (Q24). */
export const HOST = "127.0.0.1";

/** A fixed port, so the address printed at startup is the same every time. */
export const PORT = 5170;

/**
 * Starts the UI and resolves with its address once it is listening. Rejects
 * with a message a person can act on when the page has not been built or the
 * port is taken.
 */
export async function startUi(root: string): Promise<string> {
  let server: Server;
  try {
    server = await createUiServer(root);
  } catch {
    throw new Error(
      `no built page in ${root}; start the UI with npm run ui, which builds it first`,
    );
  }
  await new Promise<void>((resolve, reject) => {
    server.once("error", (error: NodeJS.ErrnoException) => {
      reject(
        new Error(
          error.code === "EADDRINUSE"
            ? `port ${PORT} is already in use; is the UI already running?`
            : error.message,
        ),
      );
    });
    server.listen(PORT, HOST, resolve);
  });
  return `http://${HOST}:${PORT}`;
}
