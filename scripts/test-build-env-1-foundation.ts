/**
 * BUILD-ENV-1 — Local build env workflow certification.
 * Run: pnpm test:build-env-1-foundation
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import {
  BUILD_ENV_QA_MARKER,
  LEGACY_LOCAL_ENV_FILES,
  PRODUCTION_BUILD_REQUIRED_ENV_KEYS,
  VERCEL_BUILD_ENV_FILE,
  hideLegacyLocalEnvFiles,
  loadVercelBuildEnvFileIntoProcess,
  restoreLegacyLocalEnvFiles,
} from "../lib/build/vercel-build-env"
import { GROWTH_PRODUCTION_ENV_SOURCES } from "../lib/growth/qa/reply-flow-env-bootstrap"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function existsSync(filePath: string): boolean {
  return fs.existsSync(filePath)
}

assert.equal(BUILD_ENV_QA_MARKER, "build-env-1-vercel-production-v1")
assert.equal(VERCEL_BUILD_ENV_FILE, ".env.build")
assert.deepEqual(GROWTH_PRODUCTION_ENV_SOURCES, [".env.build", ".env.vercel.production"])
assert.ok(LEGACY_LOCAL_ENV_FILES.includes(".env.production.local"))
assert.ok(LEGACY_LOCAL_ENV_FILES.includes(".env.local"))
assert.equal(PRODUCTION_BUILD_REQUIRED_ENV_KEYS.length, 2)

for (const file of [
  "lib/build/vercel-build-env.ts",
  "scripts/run-production-build.ts",
  "scripts/vercel-build-env-pull.ts",
  "scripts/vercel-production-env-run.ts",
]) {
  assert.ok(fs.existsSync(path.join(process.cwd(), file)), `Missing ${file}`)
}

const packageJson = readSource("package.json")
assert.match(packageJson, /"env:pull:production"/)
assert.match(packageJson, /"build:production"/)
assert.match(packageJson, /run-production-build\.ts/)

const vercelRun = readSource("scripts/vercel-production-env-run.ts")
assert.match(vercelRun, /hideLegacyLocalEnvFiles/)
assert.doesNotMatch(vercelRun, /\.env\.production\.local.*not used/)

const runBuild = readSource("scripts/run-production-build.ts")
assert.match(runBuild, /hideLegacyLocalEnvFiles/)
assert.match(runBuild, /assertProductionBuildEnvReady/)

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "build-env-1-"))
try {
  fs.writeFileSync(
    path.join(tempDir, ".env.production.local"),
    'NEXT_PUBLIC_SUPABASE_URL=""\n',
  )
  fs.writeFileSync(
    path.join(tempDir, ".env.build"),
    [
      "NEXT_PUBLIC_SUPABASE_URL=https://prod.supabase.co",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY=anon-key",
    ].join("\n"),
  )

  const hidden = hideLegacyLocalEnvFiles(tempDir)
  assert.equal(existsSync(path.join(tempDir, ".env.production.local")), false)
  assert.ok(hidden.some((row) => row.path.endsWith(".env.production.local")))

  delete process.env.NEXT_PUBLIC_SUPABASE_URL
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const loaded = loadVercelBuildEnvFileIntoProcess({ cwd: tempDir })
  assert.equal(loaded, true)
  assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, "https://prod.supabase.co")
  assert.equal(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "anon-key")

  restoreLegacyLocalEnvFiles(hidden)
  assert.equal(existsSync(path.join(tempDir, ".env.production.local")), true)
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true })
}

console.log("[BUILD-ENV-1] foundation certification PASS")
