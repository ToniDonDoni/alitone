import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default [
  {
    ignores: ["node_modules/**", "output/**", "references/**", "src/vendor/**",
      "thirdparty/**", ".husky/_/**"]
  },
  {
    files: ["src/**/*.js", "tools/**/*.{js,mjs}", "eslint.config.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      globals: {...globals.browser, ...globals.node}
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": ["error", {argsIgnorePattern: "^_", varsIgnorePattern: "^_"}]
    }
  },
  ...tseslint.configs.recommended.map(config => ({
    ...config,
    files: ["src/**/*.ts", "tools/**/*.ts"]
  }))
];
