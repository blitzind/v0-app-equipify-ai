/**
 * BUILD-ENV-1 — Run `next build` with Vercel Production env semantics.
 *
 * - On Vercel (VERCEL=1): env is injected by the platform — run build directly.
 * - Locally: hide legacy .env.* files so Next.js cannot load stale placeholders,
 *   then require env from `vercel env run`, a sourced `.env.build`, or the shell.
 *
 * Usage:
 *   pnpm build:production
 *   pnpm build:production:pulled
 *   vercel env run -e production -- node ... run-production-build.ts --via-vercel-run
 */
import { execSync } from "node:child_process"
import {
  assertProductionBuildEnvReady,
  hideLegacyLocalEnvFiles,
  loadVercelBuildEnvFileIntoProcess,
  restoreLegacyLocalEnvFiles,
} from "../lib/build/vercel-build-env"

function runNextBuild(): void {
  execSync(
    "node -r ./scripts/server-only-shim.cjs --import tsx scripts/verify-growth-production-runtime.ts && pnpm exec next build",
    { stdio: "inherit", env: process.env },
  )
}

function main(): void {
  const fromPulledEnv = process.argv.includes("--from-pulled-env")
  const viaVercelRun =
    process.argv.includes("--via-vercel-run") ||
    process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN === "1"

  if (process.env.VERCEL === "1") {
    assertProductionBuildEnvReady()
    runNextBuild()
    return
  }

  const hidden = hideLegacyLocalEnvFiles()

  try {
    if (fromPulledEnv) {
      const loaded = loadVercelBuildEnvFileIntoProcess()
      if (!loaded) {
        console.error(
          `[build-env] ${".env.build"} not found. Run: pnpm env:pull:production`,
        )
        process.exit(1)
      }
    }

    if (!viaVercelRun && !fromPulledEnv) {
      const loaded = loadVercelBuildEnvFileIntoProcess()
      if (loaded) {
        process.stderr.write("[build-env] Loaded .env.build (legacy local env files hidden)\n")
      }
    }

    assertProductionBuildEnvReady()
    runNextBuild()
  } finally {
    restoreLegacyLocalEnvFiles(hidden)
  }
}

main()
