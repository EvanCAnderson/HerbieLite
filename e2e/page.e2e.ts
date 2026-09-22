// The page used as a person uses it, in a real browser (U11, T10h): one test
// per thing they do, each asserting what they would see (Q36). What each
// module computes is already asserted in vitest; these hold the wiring
// between the panels, which nothing else runs (DECISIONS T10.13). Every test
// gets a fresh browser context, so its workspace starts empty.
import { expect, test, type Locator, type Page } from "@playwright/test";

/** A file's button in the list, under Examples or Workspace. */
function fileIn(
  page: Page,
  list: "Examples" | "Workspace",
  name: string,
): Locator {
  return page
    .getByRole("navigation")
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: list }) })
    .getByRole("button", { name, exact: true });
}

/** What the console pane shows, as its rows of text. */
function consoleText(page: Page): Locator {
  return page.locator(".console .xterm-rows");
}

const editor = (page: Page): Locator => page.locator("textarea.code");

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("opens on the first example, read-only, with what each example is for", async ({
  page,
}) => {
  const viewer = page.locator(".viewer");
  await expect(
    viewer.getByRole("heading", { name: "input.txt" }),
  ).toBeVisible();
  await expect(viewer.getByText("Example · read-only")).toBeVisible();
  await expect(viewer.locator(".purpose")).toHaveText(
    "The brief's own example, verbatim. Runs to the three lines the brief expects.",
  );
  await expect(fileIn(page, "Examples", "ties.txt")).toHaveAttribute(
    "title",
    /alphabetically first partner/,
  );
  await expect(viewer.getByText("Contact Laurie Chris coffee")).toBeVisible();
  await expect(fileIn(page, "Examples", "input.txt")).toHaveAttribute(
    "aria-current",
    "true",
  );
  await expect(page.getByText("No files yet.")).toBeVisible();
});

test("runs an example in the console and shows the brief's report", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Run", exact: true }).click();
  const shown = consoleText(page);
  await expect(shown).toContainText("$ node dist/bin.js examples/input.txt");
  await expect(shown).toContainText("ACME: No current relationship");
  await expect(shown).toContainText("Globex: Chris (2)");
  await expect(shown).toContainText("Hooli: Molly (1)");
  await expect(shown).toContainText("exit 0");
});

test("copies an example, edits it, saves it, and keeps it across a reload", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Copy to workspace" }).click();
  await expect(fileIn(page, "Workspace", "input.txt")).toBeVisible();
  const text = await editor(page).inputValue();
  await editor(page).fill(`${text}Company Initech\n`);
  await expect(page.getByText("Workspace · unsaved changes")).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".editor .status")).toHaveText("Saved input.txt.");

  await page.reload();
  await fileIn(page, "Workspace", "input.txt").click();
  await expect(editor(page)).toHaveValue(/Company Initech\n$/);
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(consoleText(page)).toContainText(
    "Initech: No current relationship",
  );
});

test("names a new file in the page, then marks a line naming a company not declared yet, until it is", async ({
  page,
}) => {
  await page.getByRole("button", { name: "New file…" }).click();
  const name = page.getByRole("textbox", { name: "New file name" });
  await expect(name).toHaveValue("untitled.txt");
  // A name the workspace refuses leaves the form open to correct it (Q25).
  await name.fill("my draft");
  await name.press("Enter");
  await expect(page.getByText("my draft is not a valid name")).toBeVisible();
  await name.fill("draft.txt");
  await name.press("Enter");
  await expect(fileIn(page, "Workspace", "draft.txt")).toBeVisible();

  await editor(page).fill("Employee Pat Nowhere\n");
  await expect(page.locator(".gutter .row.pending")).toHaveText(["1"]);
  await expect(page.locator(".problems")).toContainText(
    "no company named Nowhere was declared",
  );

  await editor(page).fill("Employee Pat Nowhere\nCompany Nowhere\n");
  await expect(page.locator(".problems")).toContainText("No problems.");
  await expect(page.locator(".gutter .row.pending")).toHaveCount(0);
});

test("asks before deleting a workspace file, and keeps it if refused", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Copy to workspace" }).click();
  const copy = fileIn(page, "Workspace", "input.txt");
  await expect(copy).toBeVisible();

  let asked = "";
  page.once("dialog", (dialog) => {
    asked = dialog.message();
    void dialog.dismiss();
  });
  await page.getByRole("button", { name: "Delete" }).click();
  expect(asked).toBe("Delete input.txt? This cannot be undone.");
  await expect(copy).toBeVisible();

  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(copy).toHaveCount(0);
  await expect(page.getByText("Deleted input.txt.")).toBeVisible();
});
