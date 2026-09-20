import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { ReadError, readLines } from "./lines.js";
import type { SourceLine } from "./parser.js";

/**
 * Feeds the reader exactly these chunks. `Readable.from` is in object mode by
 * default, which delivers each one as written — the point of most cases here
 * is where a chunk boundary falls.
 */
async function read(...chunks: string[]): Promise<SourceLine[]> {
  return readFrom(Readable.from(chunks));
}

async function readFrom(stream: NodeJS.ReadableStream): Promise<SourceLine[]> {
  const lines: SourceLine[] = [];
  for await (const line of readLines(stream)) lines.push(line);
  return lines;
}

describe("splitting and numbering", () => {
  it("numbers lines from 1", async () => {
    expect(await read("Partner Chris\nCompany Globex\n")).toEqual([
      { lineNumber: 1, text: "Partner Chris" },
      { lineNumber: 2, text: "Company Globex" },
    ]);
  });

  it("joins a line split across chunks", async () => {
    expect(await read("Partner Ch", "ris\nCompany ", "Globex\n")).toEqual([
      { lineNumber: 1, text: "Partner Chris" },
      { lineNumber: 2, text: "Company Globex" },
    ]);
  });

  it("yields several lines arriving in one chunk", async () => {
    expect(await read("Partner Chris\nCompany Globex\nCompany ACME\n")).toEqual(
      [
        { lineNumber: 1, text: "Partner Chris" },
        { lineNumber: 2, text: "Company Globex" },
        { lineNumber: 3, text: "Company ACME" },
      ],
    );
  });

  it("yields a final line with no trailing newline", async () => {
    expect(await read("Partner Chris")).toEqual([
      { lineNumber: 1, text: "Partner Chris" },
    ]);
  });

  it("does not invent a line after a trailing newline", async () => {
    expect(await read("Partner Chris\n")).toHaveLength(1);
  });

  it("yields nothing for an empty stream", async () => {
    expect(await read()).toEqual([]);
    expect(await read("")).toEqual([]);
  });

  it("keeps blank lines, so later line numbers still match the file (Q6)", async () => {
    expect(await read("Partner Chris\n\nCompany Globex\n")).toEqual([
      { lineNumber: 1, text: "Partner Chris" },
      { lineNumber: 2, text: "" },
      { lineNumber: 3, text: "Company Globex" },
    ]);
  });
});

describe("carriage returns are left to the parser (Q10, T3.2)", () => {
  it("keeps the `\\r` of a CRLF line in the text", async () => {
    expect(await read("Partner Chris\r\nCompany Globex\r\n")).toEqual([
      { lineNumber: 1, text: "Partner Chris\r" },
      { lineNumber: 2, text: "Company Globex\r" },
    ]);
  });

  it("does not treat a lone `\\r` as a line break, unlike readline", async () => {
    expect(await read("Partner Chris\rCompany Globex\n")).toEqual([
      { lineNumber: 1, text: "Partner Chris\rCompany Globex" },
    ]);
  });
});

describe("byte-order mark (Q16)", () => {
  it("strips one at the very start of the stream", async () => {
    expect(await read("﻿Partner Chris\n")).toEqual([
      { lineNumber: 1, text: "Partner Chris" },
    ]);
  });

  it("strips it when it arrives in a chunk of its own", async () => {
    expect(await read("﻿", "Partner Chris\n")).toEqual([
      { lineNumber: 1, text: "Partner Chris" },
    ]);
  });

  it("leaves a line holding nothing else empty, not absent", async () => {
    expect(await read("﻿\nPartner Chris\n")).toEqual([
      { lineNumber: 1, text: "" },
      { lineNumber: 2, text: "Partner Chris" },
    ]);
  });

  it("keeps one that starts a later line, which is not a file's mark", async () => {
    expect(await read("Partner Chris\n﻿Company Globex\n")).toEqual([
      { lineNumber: 1, text: "Partner Chris" },
      { lineNumber: 2, text: "﻿Company Globex" },
    ]);
  });
});

describe("decoding", () => {
  it("reassembles a character split across two byte chunks", async () => {
    // Why the reader sets an encoding rather than concatenating buffers: the
    // two bytes of `é` arrive separately. Names are ASCII (Q9), so this only
    // shows up in the text a warning quotes.
    const bytes = Readable.from(
      [Buffer.from([0xc3]), Buffer.from([0xa9, 0x0a])],
      { objectMode: false },
    );
    const lines: SourceLine[] = [];
    for await (const line of readLines(bytes)) lines.push(line);
    expect(lines).toEqual([{ lineNumber: 1, text: "é" }]);
  });
});

describe("stream failures (T6.12)", () => {
  it("names a stream failure as a ReadError, keeping the cause", async () => {
    const cause = new Error("disk went away");
    const failure = await readFrom(
      new Readable({
        read() {
          this.destroy(cause);
        },
      }),
    ).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ReadError);
    expect(failure).toMatchObject({ message: "disk went away", cause });
  });

  it("does not wrap a failure thrown by the consumer", async () => {
    // A consumer's throw reaches the generator as a `return` completion, so
    // it skips the catch: a bug downstream stays a bug (T6.1).
    const boom = new Error("bug in the consumer");
    await expect(
      (async () => {
        for await (const line of readLines(Readable.from(["a\n"]))) {
          throw Object.assign(boom, { seen: line.lineNumber });
        }
      })(),
    ).rejects.toBe(boom);
  });
});
