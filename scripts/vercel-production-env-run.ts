/**
 * Run a command with Vercel Production env — never reads legacy local env files.
 *
 * Uses `vercel env run -e production` so Production vars are injected into the
 * child process. Hides `.env.local`, `.env.production.local`, and related legacy
 * files so Next.js / dotenv loaders cannot apply stale placeholders.
 *
 * Usage: node -r ./scripts/server-only-shim.cjs --import tsx scripts/vercel-production-env-run.ts -- pnpm check:apollo-live-pilot-env-ai-4
 */
import { spawnSync } from "node:child_process"
import {
  hideLegacyLocalEnvFiles,
  LEGACY_LOCAL_ENV_FILES,
  restoreLegacyLocalEnvFiles,
} from "../lib/build/vercel-build-env"

export const VERCEL_PRODUCTION_ENV_RUN_QA_MARKER = "vercel-production-env-run-le-4-v1" as const

function parseArgs(argv: string[]): string[] {
  const dash = argv.indexOf("--")
  if (dash === -1) {
    console.error("Usage: vercel-production-env-run.ts -- <command...>")
    process.exit(1)
  }
  const command = argv.slice(dash + 1)
  if (command.length === 0) {
    console.error("No command provided after --")
    process.exit(1)
  }
  return command
}

export function runWithVercelProductionEnv(command: string[], cwd = process.cwd()): number {
  const hidden = hideLegacyLocalEnvFiles(cwd)

  try {
    process.stderr.write(
      `Running with Vercel Production env via \`vercel env run -e production\` (legacy files hidden: ${LEGACY_LOCAL_ENV_FILES.join(", ")})\n`,
    )

    const result = spawnSync("vercel", ["env", "run", "-e", "production", "--", ...command], {
      cwd,
      stdio: "inherit",
      env: {
        ...process.env,
        EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN: "1",
      },
      shell: false,
    })

    if (result.error) {
      console.error(result.error.message)
      return 1
    }
    return result.status ?? 1
  } finally {
    restoreLegacyLocalEnvFiles(hidden)
  }
}

if (process.argv[1]?.endsWith("vercel-production-env-run.ts")) {
  const command = parseArgs(process.argv)
  process.exit(runWithVercelProductionEnv(command))
}
