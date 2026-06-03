/**
 * Regression checks for Growth production env bootstrap.
 * Run: pnpm test:growth-reply-flow-env-bootstrap
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import {
  GROWTH_PRODUCTION_ENV_SOURCES,
  GROWTH_REPLY_FLOW_REQUIRED_ENV_KEYS,
  applySupabaseUrlPublicAlias,
  bootstrapGrowthProductionEnv,
  formatGrowthProductionEnvBootstrapReport,
  mergeGrowthProductionEnvLayers,
  parseGrowthProductionEnvFile,
} from "../lib/growth/qa/reply-flow-env-bootstrap"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

assert.deepEqual(GROWTH_PRODUCTION_ENV_SOURCES, [
  ".env.local",
  ".env.local.active",
  ".env.production.local",
  ".env.vercel.production",
  ".vercel/.env.production.local",
])

assert.equal(GROWTH_REPLY_FLOW_REQUIRED_ENV_KEYS.length, 4)

const parsed = parseGrowthProductionEnvFile(
  "fixture.env",
  `
# comment
LOCAL_ONLY=from-local
NEXT_PUBLIC_SUPABASE_URL=""
SUPABASE_URL=https://project.supabase.co
printf "should skip"
export SUPABASE_SERVICE_ROLE_KEY="service-role-jwt"
`,
)

assert.equal(parsed.LOCAL_ONLY, "from-local")
assert.equal(parsed.NEXT_PUBLIC_SUPABASE_URL, "")
assert.equal(parsed.SUPABASE_URL, "https://project.supabase.co")
assert.equal(parsed.SUPABASE_SERVICE_ROLE_KEY, "service-role-jwt")
assert.equal(parsed.printf, undefined)

const alias = applySupabaseUrlPublicAlias({
  SUPABASE_URL: "https://project.supabase.co",
})
assert.equal(alias.mapped, true)
assert.equal(alias.env.NEXT_PUBLIC_SUPABASE_URL, "https://project.supabase.co")

const noAlias = applySupabaseUrlPublicAlias({
  NEXT_PUBLIC_SUPABASE_URL: "https://already.set.co",
  SUPABASE_URL: "https://project.supabase.co",
})
assert.equal(noAlias.mapped, false)

const merged = mergeGrowthProductionEnvLayers([
  { source: ".env.local", values: { A: "1", B: "local" } },
  { source: ".env.production.local", values: { B: "production", C: "3" } },
])
assert.equal(merged.merged.A, "1")
assert.equal(merged.merged.B, "production")
assert.equal(merged.sources.B, ".env.production.local")

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "growth-env-bootstrap-"))
try {
  fs.writeFileSync(
    path.join(tempDir, ".env.local"),
    "NEXT_PUBLIC_SUPABASE_ANON_KEY=anon-from-local\nB=local\n",
  )
  fs.writeFileSync(
    path.join(tempDir, ".env.production.local"),
    [
      "NEXT_PUBLIC_SUPABASE_URL=",
      "SUPABASE_URL=https://prod.supabase.co",
      "SUPABASE_SERVICE_ROLE_KEY=role-from-production",
      "EQUIPIFY_PLATFORM_ADMIN_EMAILS=admin@example.com",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY=anon-from-production",
    ].join("\n"),
  )

  const result = bootstrapGrowthProductionEnv({ cwd: tempDir, inheritProcessEnv: false })
  assert.equal(result.ok, true)
  assert.equal(result.found.NEXT_PUBLIC_SUPABASE_URL, "https://prod.supabase.co")
  assert.equal(result.found.NEXT_PUBLIC_SUPABASE_ANON_KEY, "anon-from-production")
  assert.equal(result.found.SUPABASE_SERVICE_ROLE_KEY, "role-from-production")
  assert.equal(result.found.EQUIPIFY_PLATFORM_ADMIN_EMAILS, "admin@example.com")
  assert.equal(result.supabaseUrlMapped, true)
  assert.match(result.sources.NEXT_PUBLIC_SUPABASE_URL ?? "", /mapped to NEXT_PUBLIC_SUPABASE_URL/)

  const incompleteDir = fs.mkdtempSync(path.join(os.tmpdir(), "growth-env-bootstrap-missing-"))
  fs.writeFileSync(path.join(incompleteDir, ".env.local"), "SUPABASE_URL=https://only-url.supabase.co\n")
  const missing = bootstrapGrowthProductionEnv({ cwd: incompleteDir, inheritProcessEnv: false })
  assert.equal(missing.ok, false)
  assert.ok(missing.missing.includes("NEXT_PUBLIC_SUPABASE_ANON_KEY"))
  assert.ok(missing.missing.includes("SUPABASE_SERVICE_ROLE_KEY"))
  assert.ok(missing.missing.includes("EQUIPIFY_PLATFORM_ADMIN_EMAILS"))

  const report = formatGrowthProductionEnvBootstrapReport(missing)
  assert.match(report, /FOUND:/)
  assert.match(report, /MISSING:/)
  assert.match(report, /vercel env run -e production/)

  const withEnv = bootstrapGrowthProductionEnv({
    cwd: incompleteDir,
    inheritProcessEnv: true,
    processEnv: {
      NEXT_PUBLIC_SUPABASE_URL: "https://from-vercel.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-vercel",
      SUPABASE_SERVICE_ROLE_KEY: "role-vercel",
      EQUIPIFY_PLATFORM_ADMIN_EMAILS: "vercel-admin@example.com",
    },
  })
  assert.equal(withEnv.ok, true)
  assert.equal(withEnv.sources.NEXT_PUBLIC_SUPABASE_URL, "(environment)")
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true })
}

const qaCli = readSource("scripts/qa-growth-reply-flow.ts")
assert.match(qaCli, /assertGrowthProductionEnvReady/)
assert.match(qaCli, /reply-flow-env-bootstrap/)
assert.doesNotMatch(qaCli, /function loadEnvFile/)

const packageJson = readSource("package.json")
assert.match(packageJson, /"test:growth-reply-flow-env-bootstrap"/)

console.log("growth reply flow env bootstrap tests passed")
