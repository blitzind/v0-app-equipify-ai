/**
 * Run a command with Vercel Production env — never reads or writes .env.local.
 *
 * Uses `vercel env run -e production` so non-sensitive Production vars are injected
 * into the child process. Sensitive secrets (Supabase service role, CRON_SECRET)
 * are not materialized locally by Vercel CLI; production certs may fall back to
 * Supabase CLI linked-project keys for live schema verification.
 *
 * Usage: node -r ./scripts/server-only-shim.cjs --import tsx scripts/vercel-production-env-run.ts -- pnpm check:apollo-live-pilot-env-ai-4
 */
import { execSync, spawnSync } from "node:child_process"
import { existsSync, unlinkSync } from "node:fs"
import { join } from "node:path"

export const VERCEL_PRODUCTION_ENV_RUN_QA_MARKER = "vercel-production-env-run-le-4-v1" as const

const BLOCKED_LOCAL_ENV_FILES = [".env.local", ".env.local.active"] as const

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

function hideLocalEnvFiles(cwd: string): Array<{ path: string; backup: string }> {
  const hidden: Array<{ path: string; backup: string }> = []
  for (const name of BLOCKED_LOCAL_ENV_FILES) {
    const path = join(cwd, name)
    if (!existsSync(path)) continue
    const backup = `${path}.equipify-vercel-run-hidden`
    if (existsSync(backup)) unlinkSync(backup)
    execSync(`mv ${JSON.stringify(path)} ${JSON.stringify(backup)}`)
    hidden.push({ path, backup })
  }
  return hidden
}

function restoreLocalEnvFiles(hidden: Array<{ path: string; backup: string }>): void {
  for (const { path, backup } of hidden) {
    if (!existsSync(backup)) continue
    if (existsSync(path)) unlinkSync(path)
    execSync(`mv ${JSON.stringify(backup)} ${JSON.stringify(path)}`)
  }
}

export function runWithVercelProductionEnv(command: string[], cwd = process.cwd()): number {
  const hidden = hideLocalEnvFiles(cwd)

  try {
    process.stderr.write(
      "Running with Vercel Production env via `vercel env run -e production` (.env.local not used)\n",
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
    restoreLocalEnvFiles(hidden)
  }
}

if (process.argv[1]?.endsWith("vercel-production-env-run.ts")) {
  const command = parseArgs(process.argv)
  process.exit(runWithVercelProductionEnv(command))
}
