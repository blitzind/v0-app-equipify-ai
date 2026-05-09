import nextCoreWebVitals from "eslint-config-next/core-web-vitals"

/** ESLint 9 flat config; `eslint-config-next` ships flat rule sets for Next.js 16+. */
export default [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "out/**",
      "build/**",
      "dist/**",
      "pnpm-lock.yaml",
      "**/*.tsbuildinfo",
      "next-env.d.ts",
    ],
  },
  ...nextCoreWebVitals,
]
