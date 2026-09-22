import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { request, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createUiServer } from "./server.js";

// A real server on an ephemeral port, over a page written for the test rather
// than Vite's build, so the suite needs no build step (Q23, T6.10).
let dir: string;
let server: Server;
let base: string;
let port: number;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "herbie-ui-"));
  await mkdir(join(dir, "assets"));
  await writeFile(join(dir, "index.html"), "<!doctype html><title>t</title>");
  await writeFile(join(dir, "assets", "app.js"), "console.log(1);");
  await writeFile(join(dir, "notes.txt"), "not part of the page");
  server = await createUiServer(dir);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
  base = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  await rm(dir, { recursive: true });
});

describe("serving the built page (Q22)", () => {
  it("serves index.html at /", async () => {
    const response = await fetch(`${base}/`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/html; charset=utf-8",
    );
    expect(await response.text()).toBe("<!doctype html><title>t</title>");
  });

  it("serves a bundled script with its media type", async () => {
    const response = await fetch(`${base}/assets/app.js`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/javascript; charset=utf-8",
    );
  });

  it("ignores a query string", async () => {
    expect((await fetch(`${base}/?v=1`)).status).toBe(200);
  });

  it("answers HEAD with the headers and no body", async () => {
    const response = await fetch(`${base}/`, { method: "HEAD" });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-length")).toBe("31");
    expect(await response.text()).toBe("");
  });
});

describe("what it will not serve", () => {
  it("answers 404 for a path it does not have", async () => {
    const response = await fetch(`${base}/nosuch.js`);
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not found\n");
  });

  it("leaves out a file of a type the page does not use", async () => {
    expect((await fetch(`${base}/notes.txt`)).status).toBe(404);
  });

  it("does not serve index.html under its own name", async () => {
    expect((await fetch(`${base}/index.html`)).status).toBe(404);
  });

  it("cannot be walked out of the page's folder", async () => {
    // fetch, and request given a URL, would normalise the dots away, so each
    // path goes in the request options and reaches the server as written.
    const paths = [
      "/../package.json",
      "/assets/../../package.json",
      "/%2e%2e/package.json",
    ];
    for (const path of paths) {
      const status = await new Promise<number | undefined>((resolve) => {
        request({ host: "127.0.0.1", port, path }, (response) => {
          response.resume();
          resolve(response.statusCode);
        }).end();
      });
      expect(status, path).toBe(404);
    }
  });

  it("refuses any method but GET and HEAD", async () => {
    const response = await fetch(`${base}/`, { method: "POST" });
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, HEAD");
  });
});
