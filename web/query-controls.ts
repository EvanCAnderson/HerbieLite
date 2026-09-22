// The flag buttons (T11c, U13): a company field suggesting the companies a
// file declares, and one button per query option (Q31). A button enters the
// query's command in the console, which runs it as typed. Untested DOM code
// (DECISIONS T10.13); the command it enters is console.ts's commandLine.
import type { Query } from "./console.js";
import { h } from "./dom.js";

export interface QueryControls {
  readonly element: HTMLElement;
  /** Replaces the companies suggested, as the file changes. */
  suggest(companies: readonly string[]): void;
}

/** Each datalist needs an id of its own for its field to name. */
let lists = 0;

export function queryControls(onQuery: (query: Query) => void): QueryControls {
  const listId = `companies-${String(++lists)}`;
  const list = h("datalist", { id: listId });
  const company = h("input", {
    type: "text",
    className: "company",
    placeholder: "Company",
    spellcheck: false,
    autocomplete: "off",
  });
  company.setAttribute("list", listId);
  company.setAttribute("aria-label", "Company to ask about");

  const buttons = (["--partners", "--employees"] as const).map((option) =>
    h("button", {
      type: "button",
      className: "action flag",
      textContent: option,
      disabled: true,
      onclick: () => onQuery({ option, company: company.value.trim() }),
    }),
  );
  // A query needs a company; with none the buttons wait for one.
  company.addEventListener("input", () => {
    for (const button of buttons) button.disabled = company.value.trim() === "";
  });

  return {
    element: h("div", { className: "queries" }, company, list, ...buttons),
    suggest(companies) {
      list.replaceChildren(
        ...companies.map((name) => h("option", { value: name })),
      );
    },
  };
}
