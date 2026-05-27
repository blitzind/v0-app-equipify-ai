/**
 * Fail production deploy/build when Growth outbound runtime guards are violated.
 * Run automatically before `next build`.
 */
import { collectGrowthRuntimeDiagnostics } from "../lib/growth/runtime/runtime-guards"

function main(): void {
  const diagnostics = collectGrowthRuntimeDiagnostics()
  const isProdBuild =
    process.env.VERCEL_ENV === "production" ||
    (process.env.NODE_ENV === "production" && process.env.VERCEL !== "1")

  if (!isProdBuild) {
    if (diagnostics.warnings.length > 0) {
      console.warn("[growth-runtime-guard] dev/preview warnings:")
      for (const warning of diagnostics.warnings) console.warn(`  - ${warning}`)
    }
    console.log("[growth-runtime-guard] skipped (non-production build)")
    return
  }

  const errors = diagnostics.violations.filter((v) => v.severity === "error")
  if (errors.length > 0) {
    console.error("[growth-runtime-guard] production build blocked:")
    for (const error of errors) console.error(`  - ${error.message}`)
    process.exit(1)
  }

  console.log("[growth-runtime-guard] production build checks passed")
}

main()
