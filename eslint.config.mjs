import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Electron client is a separate, plain Node.js (CommonJS) project —
    // not part of the Next.js/TypeScript/ESM web app, so it's out of scope
    // for these lint rules.
    "electron/**",
    "dist/**",
  ]),
]);

export default eslintConfig;
