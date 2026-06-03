/**
 * Regression checks for Growth Engine reply intelligence v2 (Phase 5).
 * Run: pnpm test:growth-reply-intelligence-v2
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { classifyReplyIntentV2 } from "../lib/growth/reply-intelligence/reply-intent-classifier-v2"
import { extractBuyingSignals } from "../lib/growth/reply-intelligence/buying-signal-extractor"
import { detectReplyObjections } from "../lib/growth/reply-intelligence/objection-detection"
import { buildReplyCopilotAssist } from "../lib/growth/reply-intelligence/reply-copilot-service"
import {
  GROWTH_REPLY_INTELLIGENCE_V2_QA_MARKER,
  GROWTH_REPLY_SALES_EXECUTION_VIEWS,
} from "../lib/growth/reply-intelligence/reply-intent-types"

assert.equal(GROWTH_REPLY_INTELLIGENCE_V2_QA_MARKER, "growth-reply-intelligence-v1")
assert.ok(GROWTH_REPLY_SALES_EXECUTION_VIEWS.includes("demo_requests"))

const demo = classifyReplyIntentV2("Can we schedule a product demo next week?")
assert.equal(demo.intent, "demo_request")
assert.ok(demo.matchedPhrases.length > 0)
assert.ok(demo.confidenceTier === "high" || demo.confidenceTier === "medium")
assert.equal(demo.aiAssisted, false)
assert.ok(demo.recommendedOperatorAction.includes("demo"))

const angry = classifyReplyIntentV2("This is spam. Stop contacting me or I will report you.")
assert.equal(angry.intent, "angry_complaint")

const unsub = classifyReplyIntentV2("Please unsubscribe me from this list.")
assert.equal(unsub.intent, "unsubscribe")
assert.equal(unsub.uncertaintyState, "confident")

const signals = extractBuyingSignals("We are looking to replace our current vendor this quarter. What is pricing?")
assert.ok(signals.some((s) => s.signal === "replacement_intent"))
assert.ok(signals.every((s) => s.excerpt.length > 0))

const objections = detectReplyObjections("Too expensive for us right now — no budget until next quarter.")
assert.ok(objections.some((o) => o.category === "price" || o.category === "timing"))
assert.ok(objections.every((o) => o.suggestedReplyDraft.length > 0))

const copilot = buildReplyCopilotAssist({
  bodyPreview: "Interested in a demo and pricing for 20 users.",
  companyName: "Acme Co",
  contactLabel: "Alex",
})
assert.equal(copilot.assistedLabel, "AI-assisted")
assert.equal(copilot.qaMarker, GROWTH_REPLY_INTELLIGENCE_V2_QA_MARKER)
assert.ok(copilot.evidenceExcerpts.length > 0)
assert.ok(!copilot.suggestedReplyDraft.includes("auto-send"))

const migrationSource = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270601120000_growth_reply_intelligence_v2.sql"),
  "utf8",
)
assert.match(migrationSource, /reply_ingestion_events/)
assert.match(migrationSource, /conversation_timeline_events/)
assert.match(migrationSource, /campaign_reply_learning_snapshots/)
assert.match(migrationSource, /demo_request/)

const pipelineSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/replies/reply-ingestion-pipeline.ts"),
  "utf8",
)
assert.match(pipelineSource, /ingestGrowthReplyFromWebhook/)
assert.match(pipelineSource, /ingestGrowthReplyFromInboxSync/)
assert.match(pipelineSource, /rebuildLeadMemoryProfile/)

const processSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/reply-intelligence/process-reply-intelligence.ts"),
  "utf8",
)
assert.match(processSource, /classifyReplyIntentV2/)
assert.match(processSource, /routeReplyWorkflows/)

const uiSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-reply-inbox-dashboard.tsx"),
  "utf8",
)
assert.match(uiSource, /GROWTH_REPLY_INTELLIGENCE_V2_QA_MARKER/)
assert.match(uiSource, /data-qa-marker=\{GROWTH_REPLY_INTELLIGENCE_V2_QA_MARKER\}/)
assert.match(uiSource, /Conversation timeline/)
assert.match(uiSource, /AI reply copilot/)

const inboxRunner = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/inbox-sync/inbox-sync-runner.ts"),
  "utf8",
)
assert.match(inboxRunner, /ingestGrowthReplyFromInboxSync/)

console.log("growth-reply-intelligence-v2: all checks passed")
