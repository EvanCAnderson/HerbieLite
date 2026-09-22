// The few DOM operations the panels share. Untested, like all DOM code here
// (DECISIONS T10.13), so each is kept to what the browser does for it.

/** An element with properties set and children appended, in one call. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const element = Object.assign(document.createElement(tag), props);
  element.append(...children);
  return element;
}

/** Saves text to the user's disk as a download named `name` (T10.16). */
export function download(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  h("a", { href: url, download: name }).click();
  URL.revokeObjectURL(url);
}
