/**
 * BUILD-ENV-1 — Pull Vercel Production env to `.env.build`.
 * Run: pnpm env:pull:production
 */
import { execSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import {
  PRODUCTION_BUILD_REQUIRED_ENV_KEYS,
  VERCEL_BUILD_ENV_FILE,
} from "../lib/build/vercel-build-env"
import { parseGrowthProductionEnvFile } from "../lib/growth/qa/reply-flow-env-bootstrap"

function main(): void {
  const target = VERCEL_BUILD_ENV_FILE
  process.stderr.write(
    `[build-env] Pulling Vercel Production env to ${target} (not .env.local / .env.production.local)\n`,
  )

  execSync(`vercel env pull ${JSON.stringify(target)} --environment=production --yes`, {
    stdio: "inherit",
  })

  const absolutePath = join(process.cwd(), target)
  if (!existsSync(absolutePath)) {
    console.error(`[build-env] Pull completed but ${target} was not created.`)
    process.exit(1)
  }

  const parsed = parseGrowthProductionEnvFile(absolutePath, readFileSync(absolutePath, "utf8"))
  const missing = PRODUCTION_BUILD_REQUIRED_ENV_KEYS.filter(
    (key) => typeof parsed[key] !== "string" || parsed[key].trim().length === 0,
  )

  if (missing.length > 0) {
    console.warn(
      `[build-env] Warning: ${target} is missing non-empty values for: ${missing.join(", ")}`,
    )
    console.warn(
      "[build-env] Sensitive Vercel secrets may appear as empty placeholders in pulled files.",
    )
    console.warn("[build-env] For builds, prefer: pnpm build:production (vercel env run).")
  } else {
    process.stderr.write(`[build-env] ${target} contains required public Supabase keys.\n`)
  }
}

main()
