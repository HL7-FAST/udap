import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

export default defineConfig([
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
  ...nextCoreWebVitals,
  ...nextTypescript,
  prettier,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": "warn",
      "import/order": ["warn", {}],
      "sort-imports": ["warn", { ignoreDeclarationSort: true }],
    },
  },
]);
