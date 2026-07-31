import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    ignores: [".react-router/", "web/components/ui-kit/", "build/"],
  },
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2020,
      },
      ecmaVersion: "latest",
      sourceType: "module",
    },
  },
  tseslint.configs.recommended,
  pluginReact.configs.flat.recommended,
  pluginReact.configs.flat["jsx-runtime"],
  {
    files: ["**/*.js"],
    languageOptions: {
      parser: undefined,
    },
  },
  {
    settings: {
      react: {
        version: "detect",
      },
    },
  },
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^\\.\\./\\.\\./",
              message:
                "Use the ~/* (web), ~/db/* (db), ~/worker/* (worker), or ~/env.server alias instead of ../../ deep relative imports. See README.md → Conventions.",
            },
          ],
        },
      ],
    },
  },
]);
