import tsParser from "@typescript-eslint/parser"

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/docs/**",
      "**/archive/**",
      "**/*.d.ts",
    ],
  },
  {
    files: ["**/*.{js,mjs,ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parser: tsParser,
    },
  },
]
