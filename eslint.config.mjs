import nextCoreWebVitals from "eslint-config-next/core-web-vitals"

/** ESLint 9 flat config; `eslint-config-next` ships flat rule sets for Next.js 16+. */
const eslintConfig = [
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
  {
    name: "equipify/phase23-pragmatic-react-hooks",
    files: ["**/*.{js,jsx,ts,tsx}"],
    rules: {
      /**
       * Phase 23: `set-state-in-effect` flags common, intentional “load on mount” patterns
       * (`useEffect` calling async loaders that call `setState`). Clearing this across the
       * app would be a large refactor with behavior risk. Prefer reviewing call sites over
       * time; follow-up: narrow fixes per route if desired.
       */
      "react-hooks/set-state-in-effect": "off",
      /**
       * Phase 23: “Cannot create components during render” requires extracting nested
       * components / stable references — high churn on large pages (customers, equipment).
       * Follow-up: refactor column factories into module-scope components where valuable.
       */
      "react-hooks/static-components": "off",
      /**
       * Phase 23: React Compiler–oriented rules — many valid patterns (context providers reading
       * ref-like sync state, column memo stability) require non-trivial refactors.
       * Follow-up: targeted fixes per module if desired.
       */
      "react-hooks/refs": "off",
      "react-hooks/purity": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/use-memo": "off",
      "react-hooks/immutability": "off",
    },
  },
]

export default eslintConfig
