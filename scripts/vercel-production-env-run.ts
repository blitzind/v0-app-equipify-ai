/**
 * Run a command with Vercel Production env — never reads or writes .env.local.
 *
 * Usage: node -r ./scripts/server-only-shim.cjs --import tsx scripts/vercel-production-env-run.ts -- pnpm check:apollo-live-pilot-env-ai-4
 */
import { execSync, spawnSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, rmSync, unlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { parseGrowthProductionEnvFile } from "../lib/growth/qa/reply-flow-env-bootstrap"

export const VERCEL_PRODUCTION_ENV_RUN_QA_MARKER = "vercel-production-env-run-le-4-v1" as const

const BLOCKED_LOCAL_ENV_FILES = [".env.local", ".env.local.active"] as const

function isPresent(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.trim() !== '""' && value.trim() !== "''"
}

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

function pullVercelProductionEnv(tempEnvPath: string, cwd: string): void {
  execSync(
    `vercel env pull ${JSON.stringify(tempEnvPath)} --environment=production --yes`,
    {
      cwd,
      stdio: ["ignore", "pipe", "inherit"],
      env: process.env,
    },
  )
}

function applyPulledEnvToProcess(envPath: string): number {
  const pulled = parseGrowthProductionEnvFile(envPath)
  let applied = 0
  for (const [key, value] of Object.entries(pulled)) {
    if (!isPresent(value)) continue
    process.env[key] = value.trim()
    applied++
  }
  return applied
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
  process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN = "1"

  const tempDir = mkdtempSync(join(tmpdir(), "equipify-vercel-prod-env-"))
  const tempEnvPath = join(tempDir, "production.env")
  const hidden = hideLocalEnvFiles(cwd)

  try {
    pullVercelProductionEnv(tempEnvPath, cwd)
    const applied = applyPulledEnvToProcess(tempEnvPath)
    process.stderr.write(
      `Vercel Production env loaded from temporary pull (${applied} keys applied; .env.local not used)\n`,
    )

    const result = spawnSync(command[0]!, command.slice(1), {
      cwd,
      stdio: "inherit",
      env: process.env,
      shell: false,
    })

    if (result.error) {
      console.error(result.error.message)
      return 1
    }
    return result.status ?? 1
  } finally {
    restoreLocalEnvFiles(hidden)
    try {
      rmSync(tempDir, { recursive: true, force: true })
    } catch {
      /* optional */
    }
  }
}

if (process.argv[1]?.endsWith("vercel-production-env-run.ts")) {
  const command = parseArgs(process.argv)
  process.exit(runWithVercelProductionEnv(command))
}
