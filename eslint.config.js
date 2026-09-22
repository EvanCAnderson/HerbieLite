// Flat config (ESLint 10). Type-checked rules via typescript-eslint's project
// service — correctness only; formatting is delegated to Prettier (the
// eslint-config-prettier entry disables any rules that would fight it).
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "coverage/**",
      "node_modules/**",
      "test-results/**",
      "playwright-report/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  // The config files are plain JS, outside the TS project.
  {
    files: ["eslint.config.js", "vitest.config.js", "playwright.config.js"],
    ...tseslint.configs.disableTypeChecked,
  },
  prettier,
);
