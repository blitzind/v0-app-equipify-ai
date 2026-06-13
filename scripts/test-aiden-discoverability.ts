/**
 * Phase 15.2E — Aiden discoverability regression checks.
 * Run: pnpm test:aiden-discoverability
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { answerAidenQuestion, AIDEN_ASK_ENGINE_QA_MARKER } from "../lib/growth/aiden/aiden-ask-engine"
import { buildAidenGuidedWorkflowCards, AIDEN_GUIDED_WORKFLOWS_QA_MARKER } from "../lib/growth/aiden/aiden-guided-workflows"
import { buildAidenDailyBriefing } from "../lib/growth/aiden/aiden-daily-briefing"
import { buildAidenPriorityRecommendations } from "../lib/growth/aiden/aiden-priority-engine"
import { GROWTH_COMMAND_REGISTRY } from "../lib/growth/navigation/growth-command-registry"
import { GROWTH_NAV_GROUP_DEFS } from "../lib/growth/navigation/growth-navigation-destinations"
import { rankGrowthCommandPaletteEntries } from "../lib/growth/navigation/growth-navigation-ranking"
import { GROWTH_COMMAND_PALETTE_ENTRIES } from "../lib/growth/navigation/growth-navigation-destinations"

const coreGroup = GROWTH_NAV_GROUP_DEFS.find((group) => group.id === "core")
const executionGroup = GROWTH_NAV_GROUP_DEFS.find((group) => group.id === "execution")

assert.ok(coreGroup?.items.some((item) => item.id === "aiden-guide" && item.href === "/admin/growth/aiden"))
assert.equal(coreGroup?.items.find((item) => item.id === "aiden-guide")?.label, "Aiden")
assert.equal(coreGroup?.items[0]?.id, "command")
assert.equal(coreGroup?.items[1]?.id, "aiden-guide")
assert.ok(!executionGroup?.items.some((item) => item.id === "aiden-guide"))

const sidebarSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-section-sidebar-nav.tsx"),
  "utf8",
)
assert.match(sidebarSource, /"aiden-guide": Bot/)

const aidenRegistry = GROWTH_COMMAND_REGISTRY.find((entry) => entry.id === "aiden-guide")
assert.ok(aidenRegistry)
assert.equal(aidenRegistry?.coreWorkflow, true)
assert.ok(aidenRegistry?.keywords?.includes("next step"))
assert.ok(aidenRegistry?.keywords?.includes("blocker"))

const rankedHelp = rankGrowthCommandPaletteEntries(GROWTH_COMMAND_PALETTE_ENTRIES, "help", {
  recent: [],
  frequency: {},
})
assert.equal(rankedHelp[0]?.id, "aiden-guide")

const rankedAiden = rankGrowthCommandPaletteEntries(GROWTH_COMMAND_PALETTE_ENTRIES, "aiden", {
  recent: [],
  frequency: {},
})
assert.equal(rankedAiden[0]?.id, "aiden-guide")

const rankedNext = rankGrowthCommandPaletteEntries(GROWTH_COMMAND_PALETTE_ENTRIES, "next", {
  recent: [],
  frequency: {},
})
assert.equal(rankedNext[0]?.id, "aiden-guide")

const executionPage = fs.readFileSync(
  path.join(process.cwd(), "app/(admin)/admin/growth/sequences/execution/page.tsx"),
  "utf8",
)
assert.match(executionPage, /AidenOperatorGuidePanel[^\n]*pinned/)

const operatorPanel = fs.readFileSync(
  path.join(process.cwd(), "components/growth/aiden-operator-guide-panel.tsx"),
  "utf8",
)
assert.match(operatorPanel, /pinned\?: boolean/)
assert.match(operatorPanel, /GrowthEngineCard/)
assert.match(operatorPanel, /AidenGuidedWorkflowsPanel/)

const growthLayout = fs.readFileSync(path.join(process.cwd(), "app/(admin)/admin/growth/layout.tsx"), "utf8")
assert.match(growthLayout, /AidenAskLauncher/)

const askLauncher = fs.readFileSync(path.join(process.cwd(), "components/growth/aiden-ask-launcher.tsx"), "utf8")
assert.match(askLauncher, /rule-based/i)
assert.doesNotMatch(askLauncher, /\/api\/organizations\/.*\/aiden\/chat/)

const signals = {
  mailbox: { healthy_mailboxes: 1, expired_mailboxes: 0, warnings: 0 },
  inbox: {
    new_replies: 2,
    replies_needing_attention: 2,
    positive_interest: 1,
    meeting_requests: 1,
    objections: 0,
    unsubscribes: 0,
  },
  approval_queue: { pending_drafts: 1, pending_jobs: 2, blocked_jobs: 1, running_jobs: 0 },
  meetings: { meetings_today: 0, meetings_this_week: 1, opportunities_pending: 1 },
  revenue: { emails_sent: 10, replies: 2, meetings: 1, opportunities: 1, revenue: 0 },
}

const briefing = buildAidenDailyBriefing({
  operatorName: "Mike",
  greeting: "Good morning",
  signals,
  priorities: buildAidenPriorityRecommendations(signals),
  recommendedAction: "Respond to new replies before approving additional sends.",
})

const cards = buildAidenGuidedWorkflowCards(signals)
assert.equal(cards.length, 6)
assert.ok(cards.some((card) => card.id === "launch-pilot"))
assert.ok(cards.some((card) => card.id === "handle-reply"))

const nextAnswer = answerAidenQuestion("What do I do next?", briefing)
assert.equal(nextAnswer.source, "priority")
assert.ok(nextAnswer.answer.length > 0)

const blockedAnswer = answerAidenQuestion("Why is this blocked?", briefing)
assert.equal(blockedAnswer.source, "blocker")

assert.equal(AIDEN_ASK_ENGINE_QA_MARKER, "aiden-ask-engine-v1")
assert.equal(AIDEN_GUIDED_WORKFLOWS_QA_MARKER, "aiden-guided-workflows-v1")

console.log("aiden-discoverability: all checks passed")
