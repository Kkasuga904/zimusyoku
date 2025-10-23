import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactPlugin from "eslint-plugin-react";
import prettier from "eslint-config-prettier";
import globals from "globals";

const vitestGlobals = {
  describe: "readonly",
  it: "readonly",
  expect: "readonly",
  beforeEach: "readonly",
  afterEach: "readonly",
  vi: "readonly"
};

export default [
  js.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: "latest",
        sourceType: "module"
      },
      globals: {
        ...globals.browser,
        ...vitestGlobals
      }
    },
    plugins: {
      "@typescript-eslint": tseslint,
      react: reactPlugin
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...reactPlugin.configs.recommended.rules,
      "react/prop-types": "off"
    },
    settings: {
      react: {
        version: "detect"
      }
    }
  },
  prettier
];