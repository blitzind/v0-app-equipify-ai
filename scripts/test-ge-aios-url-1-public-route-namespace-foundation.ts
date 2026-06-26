/**
 * GE-AIOS-URL-1 — Public AI OS route namespace certification.
 * Run: pnpm test:ge-aios-url-1-public-route-namespace-foundation
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_AI_OS_LEGACY_PUBLIC_BASE_PATH,
  GROWTH_AI_OS_PUBLIC_BASE_PATH,
  GROWTH_AIOS_URL_1_PHASE,
  buildAiOsMissionPlanningHref,
  buildAiOsPilotLeadResearchHref,
  mapAiOsLegacyPublicPathToCanonical,
} from "../lib/growth/aios/ai-os-public-routes"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function assertNoCoreTouch(relativePath: string, forbidden: string[]): void {
  const source = readSource(relativePath)
  for (const token of forbidden) {
    assert.equal(source.includes(token), false, `${relativePath} must not reference ${token}`)
  }
}

console.log(`[${GROWTH_AIOS_URL_1_PHASE}] Public route namespace certification`)

assert.equal(GROWTH_AI_OS_PUBLIC_BASE_PATH, "/growth/os")
assert.equal(GROWTH_AI_OS_LEGACY_PUBLIC_BASE_PATH, "/growth/ai-os")

const missionId = "d702724e-6565-4db7-a2f0-d686fea7623a"
assert.equal(
  buildAiOsMissionPlanningHref(missionId),
  `/growth/os/missions/${missionId}/planning`,
)
assert.equal(
  buildAiOsPilotLeadResearchHref("5469ab95-79ce-4831-9695-fbbcbdab4d25"),
  "/growth/os/pilot/lead-research/5469ab95-79ce-4831-9695-fbbcbdab4d25",
)
assert.equal(
  mapAiOsLegacyPublicPathToCanonical(`/growth/ai-os/missions/${missionId}/planning`),
  `/growth/os/missions/${missionId}/planning`,
)
assert.equal(mapAiOsLegacyPublicPathToCanonical("/growth/ai-os"), "/growth/os")

const canonicalPages = [
  "app/(growth)/growth/os/page.tsx",
  "app/(growth)/growth/os/missions/[missionId]/planning/page.tsx",
  "app/(growth)/growth/os/pilot/lead-research/[leadId]/page.tsx",
]
for (const file of canonicalPages) {
  assert.ok(fs.existsSync(path.join(process.cwd(), file)), `${file} must exist`)
}

const legacyRedirects = [
  "app/(growth)/growth/ai-os/page.tsx",
  "app/(growth)/growth/ai-os/[...path]/page.tsx",
  "app/(growth)/growth/ai-os/missions/[missionId]/planning/page.tsx",
  "app/(growth)/growth/ai-os/pilot/lead-research/[leadId]/page.tsx",
]
for (const file of legacyRedirects) {
  const source = readSource(file)
  assert.ok(source.includes("RedirectType.permanent"), `${file} must permanent redirect`)
  assert.ok(source.includes("mapAiOsLegacyPublicPathToCanonical") || source.includes("GROWTH_AI_OS_PUBLIC_BASE_PATH"), file)
}

const nextConfig = readSource("next.config.mjs")
assert.ok(nextConfig.includes('source: "/growth/ai-os/:path*"'))
assert.ok(nextConfig.includes('destination: "/growth/os/:path*"'))
assert.ok(nextConfig.includes("permanent: true"))

function assertNoLegacyPublicUiHrefs(relativePath: string): void {
  const source = readSource(relativePath)
  const forbidden = [
    'href="/growth/ai-os',
    "href={`/growth/ai-os",
    'href={`/growth/ai-os',
    "`/growth/ai-os/missions/",
    "`/growth/ai-os/pilot/",
  ]
  for (const token of forbidden) {
    assert.equal(source.includes(token), false, `${relativePath} must not emit legacy public hrefs (${token})`)
  }
}

const linkSources = ["lib/growth/aios/ai-os-public-routes.ts"]
for (const file of linkSources) {
  readSource(file)
}

const pilotPanel = readSource("components/growth/ai-os/growth-ai-os-lead-research-pilot-panel.tsx")
assert.ok(pilotPanel.includes("buildAiOsMissionPlanningHref"))
assertNoLegacyPublicUiHrefs("components/growth/ai-os/growth-ai-os-lead-research-pilot-panel.tsx")

const apiConsumers = readSource("components/growth/ai-os/growth-ai-os-mission-planning-review-panel.tsx")
assert.ok(apiConsumers.includes("/api/platform/growth/ai-os/missions/"))

for (const file of [
  "lib/growth/aios/ai-os-public-routes.ts",
  "app/(growth)/growth/os/missions/[missionId]/planning/page.tsx",
]) {
  assertNoCoreTouch(file, ["public.invoices", "public.quotes", "blitzpay"])
}

console.log(`[${GROWTH_AIOS_URL_1_PHASE}] PASS — Public route namespace certified (local)`)
