/**
 * GE-AI-UX-3B — AI Teammate Server Identity certification (static).
 * Run: pnpm test:ge-ai-ux-3b-ai-teammate-server-identity
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GE_AI_UX_3B_QA_MARKER,
  GROWTH_AI_TEAMMATE_IDENTITY_API_PATH,
  GROWTH_AI_TEAMMATE_IDENTITY_MIGRATION,
} from "../lib/growth/settings/growth-ai-teammate-identity-types"
import { sanitizeAiTeammateName } from "../lib/workspace/ai-teammate-identity"
import {
  AI_TEAMMATE_DEFAULT_NAME,
  AI_TEAMMATE_DEFAULT_ROLE,
  isValidAiTeammateName,
} from "../lib/workspace/ai-teammate-identity"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

console.log(`[GE-AI-UX-3B] AI Teammate Server Identity certification`)

assert.equal(GE_AI_UX_3B_QA_MARKER, "ge-ai-ux-3b-ai-teammate-server-identity-v1")
assert.equal(GROWTH_AI_TEAMMATE_IDENTITY_API_PATH, "/api/growth/workspace/settings/ai-teammate")
console.log("  ✓ server identity QA marker and API path defined")

const migrationPath = path.join(ROOT, "supabase/migrations", GROWTH_AI_TEAMMATE_IDENTITY_MIGRATION)
assert.ok(fs.existsSync(migrationPath))
const migration = fs.readFileSync(migrationPath, "utf8")
assert.match(migration, /growth\.organization_ai_teammate_identity/)
assert.match(migration, /ai_teammate_onboarding_completed/)
assert.match(migration, /service_role/)
console.log("  ✓ migration defines org table + user onboarding column with service-role RLS")

const route = readSource("app/api/growth/workspace/settings/ai-teammate/route.ts")
assert.ok(route.includes("export async function GET"))
assert.ok(route.includes("export async function PATCH"))
assert.ok(route.includes("requireGrowthWorkspaceSettingsAccess"))
assert.ok(route.includes("loadAiTeammateIdentity"))
assert.ok(route.includes("updateAiTeammateIdentity"))
console.log("  ✓ GET/PATCH API route uses workspace settings access pattern")

const service = readSource("lib/growth/settings/growth-ai-teammate-identity-service.ts")
assert.equal(service.includes("fetch("), false)
assert.ok(service.includes('role: AI_TEAMMATE_DEFAULT_ROLE'))
console.log("  ✓ service layer is server-only with read-only role")

assert.equal(sanitizeAiTeammateName("Ava"), "Ava")
assert.equal(sanitizeAiTeammateName(""), AI_TEAMMATE_DEFAULT_NAME)
assert.equal(sanitizeAiTeammateName("!!"), AI_TEAMMATE_DEFAULT_NAME)
assert.ok(isValidAiTeammateName("Jordan"))
assert.ok(isValidAiTeammateName("Scout-2"))
assert.equal(isValidAiTeammateName("A"), false)
assert.equal(isValidAiTeammateName("x".repeat(33)), false)
console.log("  ✓ name validation and Ava fallback")

const provider = readSource("components/growth/ai-teammate/ai-teammate-identity-provider.tsx")
assert.ok(provider.includes("fetchAiTeammateIdentity"))
assert.ok(provider.includes("patchAiTeammateIdentity"))
assert.ok(provider.includes("readAiTeammateStoredIdentity"))
assert.ok(provider.includes("writeAiTeammateStoredIdentity"))
console.log("  ✓ provider hydrates server-first with localStorage cache fallback")

const settings = readSource("components/growth/settings/growth-ai-teammate-settings-panel.tsx")
assert.ok(settings.includes("Saving…"))
assert.ok(settings.includes("text-destructive"))
console.log("  ✓ settings panel exposes save/error states")

const autonomyRoute = readSource("app/api/growth/workspace/settings/autonomy/route.ts")
assert.equal(autonomyRoute.includes("ai-teammate"), false)
const autonomyService = readSource("lib/growth/autonomy/growth-autonomy-settings-service.ts")
assert.equal(autonomyService.includes("ai-teammate"), false)
console.log("  ✓ no autonomy/runtime changes")

const auditRows = [
  ["Organization autonomy settings", "growth.organization_autonomy_settings", "Organization", "Separate — org AI teammate uses new table"],
  ["Operator workspace prefs", "growth.operator_workspace_preferences", "User", "Reused for onboarding flag column"],
  ["Organization AI teammate", "growth.organization_ai_teammate_identity", "Organization", "New — teammate name"],
  ["UX-3A localStorage", "equipify:ai-os:teammate-identity/v1", "Client", "Optimistic cache fallback only"],
]
console.log("  ✓ persistence audit:")
for (const [pattern, table, scope, strategy] of auditRows) {
  console.log(`      · ${pattern} → ${table} (${scope}) — ${strategy}`)
}

assert.equal(AI_TEAMMATE_DEFAULT_ROLE, "Equipify's AI Growth Operator")
console.log("  ✓ role remains read-only system default")

console.log(`[GE-AI-UX-3B] PASS — ${GE_AI_UX_3B_QA_MARKER}`)
