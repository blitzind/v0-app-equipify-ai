/**
 * Regression checks for Growth command palette ranking + usage memory (Prompt 35).
 * Run: pnpm test:growth-command-ranking
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_COMMAND_PALETTE_ENTRIES,
  GROWTH_NAV_GROUP_DEFS,
  listGrowthNavigationPaletteHrefs,
  resolveGrowthNavigationEntryFromPathname,
} from "../lib/growth/navigation/growth-navigation-destinations"
import {
  GROWTH_COMMAND_QUERY_BOOSTS,
  GROWTH_NAVIGATION_POLISH_QA_MARKER,
  rankGrowthCommandPaletteEntries,
  scoreGrowthCommandPaletteEntry,
} from "../lib/growth/navigation/growth-navigation-ranking"
import {
  EMPTY_GROWTH_NAVIGATION_USAGE,
  GROWTH_NAVIGATION_USAGE_MAX_RECENT,
  GROWTH_NAVIGATION_USAGE_STORAGE_KEY,
  recordGrowthNavigationUsage,
} from "../lib/growth/navigation/growth-navigation-usage-memory"

assert.equal(GROWTH_NAVIGATION_POLISH_QA_MARKER, "growth-navigation-polish-v1")
assert.equal(GROWTH_NAVIGATION_USAGE_MAX_RECENT, 10)
assert.match(GROWTH_NAVIGATION_USAGE_STORAGE_KEY, /growth-nav-usage/)

const paletteSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-command-navigation-palette.tsx"),
  "utf8",
)
assert.match(paletteSource, /GROWTH_NAVIGATION_POLISH_QA_MARKER/)
assert.match(paletteSource, /shouldFilter: false/)
assert.match(paletteSource, /rankGrowthCommandPaletteEntries/)
assert.match(paletteSource, /GrowthCommandPaletteEmptyState/)
assert.match(paletteSource, /recordGrowthNavigationUsage/)

const providerSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-navigation-provider.tsx"),
  "utf8",
)
assert.match(providerSource, /normalizeGrowthPathname/)
assert.match(providerSource, /GrowthNavigationResolution failed/)
assert.match(providerSource, /recordGrowthNavigationUsage/)

const sidebarSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-section-sidebar-nav.tsx"),
  "utf8",
)
assert.match(sidebarSource, /GROWTH_NAVIGATION_POLISH_QA_MARKER/)
assert.match(sidebarSource, /data-navigation-polish-marker/)

function topRanked(query: string) {
  return rankGrowthCommandPaletteEntries(GROWTH_COMMAND_PALETTE_ENTRIES, query, EMPTY_GROWTH_NAVIGATION_USAGE)
}

const leadRanked = topRanked("lead")
assert.equal(leadRanked[0]?.id, "inbox")
assert.ok(leadRanked.slice(0, 3).some((entry) => entry.id === "lead-intelligence"))
assert.ok(leadRanked.slice(0, 4).some((entry) => entry.id === "search"))

const intentRanked = topRanked("intent")
assert.equal(intentRanked[0]?.id, "intent-pixel")
assert.ok(intentRanked.slice(0, 3).some((entry) => entry.id === "inbox"))

const callRanked = topRanked("call")
assert.equal(callRanked[0]?.id, "call-workspace")
assert.ok(callRanked.slice(0, 4).some((entry) => entry.id === "calls-live"))
assert.ok(callRanked.slice(0, 5).some((entry) => entry.id === "call-queue"))

const prospectRanked = topRanked("prospect")
assert.equal(prospectRanked[0]?.id, "search")
assert.ok(prospectRanked.slice(0, 3).some((entry) => entry.id === "inbox"))

const coachRanked = topRanked("coach")
assert.equal(coachRanked[0]?.id, "live-coaching")
assert.ok(coachRanked.slice(0, 3).some((entry) => entry.id === "call-providers"))

const providerRanked = topRanked("provider")
assert.equal(providerRanked[0]?.id, "providers")
assert.ok(providerRanked.slice(0, 3).some((entry) => entry.id === "call-providers"))

const discoverRanked = topRanked("discover")
assert.equal(discoverRanked[0]?.id, "search")
assert.ok(discoverRanked.slice(0, 4).some((entry) => entry.id === "intent-pixel"))

assert.ok(GROWTH_COMMAND_QUERY_BOOSTS.lead?.inbox)
assert.ok(GROWTH_COMMAND_QUERY_BOOSTS.intent?.["intent-pixel"])

const aliasScore = scoreGrowthCommandPaletteEntry(
  GROWTH_COMMAND_PALETTE_ENTRIES.find((entry) => entry.id === "inbox")!,
  "lead inbox",
  EMPTY_GROWTH_NAVIGATION_USAGE,
)
assert.ok(aliasScore > 0)

const usage = recordGrowthNavigationUsage({
  id: "search",
  href: "/admin/growth/search",
  label: "Prospect Search",
})
assert.equal(usage.recent[0]?.id, "search")
assert.equal(usage.recent[0]?.openCount, 1)

const boostedSearch = rankGrowthCommandPaletteEntries(GROWTH_COMMAND_PALETTE_ENTRIES, "", usage)
assert.equal(boostedSearch[0]?.id, "search")

const coreGroup = GROWTH_NAV_GROUP_DEFS.find((group) => group.id === "core")
assert.ok(coreGroup?.items.some((item) => item.label === "Revenue Inbox"))
assert.ok(!coreGroup?.items.some((item) => item.label === "Imports"))

const leadEngineGroup = GROWTH_NAV_GROUP_DEFS.find((group) => group.id === "lead-engine")
assert.ok(leadEngineGroup?.items.some((item) => item.label === "Imports"))
assert.ok(!leadEngineGroup?.items.some((item) => item.label === "Discover Companies"))

const intelligenceGroup = GROWTH_NAV_GROUP_DEFS.find((group) => group.id === "intelligence")
assert.equal(intelligenceGroup?.label, "Intelligence")
assert.ok(intelligenceGroup?.items.some((item) => item.label === "Intent Signals"))
assert.ok(intelligenceGroup?.items.some((item) => item.label === "Relationships"))

const executionGroup = GROWTH_NAV_GROUP_DEFS.find((group) => group.id === "execution")
assert.equal(executionGroup?.label, "Execution")
assert.ok(executionGroup?.items.some((item) => item.label === "Live Coaching"))
assert.ok(executionGroup?.items.some((item) => item.label === "Call Providers"))
assert.ok(executionGroup?.items.some((item) => item.label === "Outreach Approval"))

const aiGroup = GROWTH_NAV_GROUP_DEFS.find((group) => group.id === "ai")
assert.equal(aiGroup?.label, "AI")
assert.ok(aiGroup?.items.some((item) => item.label === "Playbooks"))
assert.ok(aiGroup?.items.some((item) => item.label === "Copilot"))

const providersGroup = GROWTH_NAV_GROUP_DEFS.find((group) => group.id === "providers-nav")
assert.ok(providersGroup?.items.some((item) => item.label === "Delivery"))
assert.ok(providersGroup?.items.some((item) => item.label === "Warmup"))

const navIds = GROWTH_NAV_GROUP_DEFS.flatMap((group) => group.items.map((item) => item.id))
assert.equal(navIds.length, new Set(navIds).size, "duplicate sidebar nav ids")

const paletteIds = GROWTH_COMMAND_PALETTE_ENTRIES.map((entry) => entry.id)
assert.equal(paletteIds.length, new Set(paletteIds).size, "duplicate palette ids")

const hrefs = listGrowthNavigationPaletteHrefs()
assert.ok(hrefs.includes("/admin/growth/leads"))
assert.ok(hrefs.includes("/admin/growth/search"))

const resolvedInbox = resolveGrowthNavigationEntryFromPathname("/admin/growth/leads")
assert.equal(resolvedInbox?.id, "revenue-inbox")

const resolvedLeadEngine = resolveGrowthNavigationEntryFromPathname("/admin/growth/leads/lead-engine")
assert.equal(resolvedLeadEngine?.id, "lead-engine-inspector")

console.log("growth-command-ranking: all checks passed")
