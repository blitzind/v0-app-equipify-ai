/**
 * Growth middleware auth + performance guards (local only).
 *
 * Usage: pnpm test:growth-middleware-auth
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { GROWTH_WORKSPACE_BASE_PATH } from "../lib/growth/navigation/growth-route-metadata-types"

export const GROWTH_MIDDLEWARE_AUTH_QA_MARKER = "growth-middleware-auth-v1" as const

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function runAudit(): void {
  console.log(`\n=== Growth middleware auth audit (${GROWTH_MIDDLEWARE_AUTH_QA_MARKER}) ===\n`)

  const middleware = read("middleware.ts")
  const growthLayout = read("app/(growth)/layout.tsx")

  assert.match(
    middleware,
    /from "@\/lib\/growth\/navigation\/growth-route-metadata-types"/,
    "middleware must import Growth base path from lightweight metadata-types",
  )
  assert.doesNotMatch(
    middleware,
    /growth-workspace-base-path|growth-route-registry|growth-route-metadata"|growth-route-catalog/,
    "middleware must not import heavy Growth navigation registries",
  )
  console.log("  ✓ middleware avoids heavy Growth registry imports")

  assert.match(middleware, /pathname === GROWTH_WORKSPACE_BASE_PATH \|\| pathname\.startsWith\(`\$\{GROWTH_WORKSPACE_BASE_PATH\}\/`\)/)
  assert.equal(GROWTH_WORKSPACE_BASE_PATH, "/growth")
  console.log("  ✓ /growth/* is intentionally matched for auth")

  assert.match(middleware, /\/downloads\//, "matcher or early return must bypass /downloads/*")
  assert.match(middleware, /zip/, "matcher should bypass zip downloads")
  assert.match(middleware, /shouldSkipSupabaseSessionRefresh/, "voice ingress bypass preserved")
  console.log("  ✓ static/download paths bypass middleware work")

  assert.match(middleware, /if \(!isAuthenticated\)/, "unauthenticated users are redirected")
  assert.match(
    growthLayout,
    /loadPlatformAdminIdentity/,
    "Growth route group layout must enforce platform-admin gate",
  )
  assert.match(growthLayout, /redirect\("\/"\)/, "non-admin users redirected away from Growth workspace")
  console.log("  ✓ /growth/* auth preserved via session + server layout gate")

  assert.doesNotMatch(
    middleware,
    /growth-route-registry-reports|growth-navigation-derivation|growth-workspace-shell-navigation/,
    "middleware must not pull navigation derivation modules",
  )
  console.log("  ✓ no navigation derivation imports in middleware path")

  console.log("\nGrowth middleware auth audit PASS\n")
  console.log(JSON.stringify({ ok: true, qa_marker: GROWTH_MIDDLEWARE_AUTH_QA_MARKER }, null, 2))
}

runAudit()
