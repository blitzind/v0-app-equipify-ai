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
import { mapReplyIntentToAdaptiveProspectEvent } from "../lib/growth/aios/growth/growth-adaptive-loop-1b-event-mappers"
import { isRelationshipMaterialChange } from "../lib/growth/aios/growth/growth-adaptive-loop-1b-material-change"

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

const memoryCopilot = buildReplyCopilotAssist({
  bodyPreview: "Following up on our conversation.",
  companyName: "Acme Co",
  contactLabel: "Alex",
  relationshipMemory: {
    relationshipSummary: "Prospect evaluating pricing after demo.",
    topObjections: ["Budget concern: tight this quarter"],
    topPreferences: ["communication preference: email follow-up"],
    avoidRepeating: ["What is your budget for this quarter?"],
    commitmentSummaries: ["Demo scheduled for next week"],
  },
})
assert.match(memoryCopilot.suggestedReplyDraft, /budget|earlier|concern/i)
assert.ok(memoryCopilot.memoryContext?.length)
assert.ok(memoryCopilot.memoryAvoidRepeating?.length)

const copilotRouteSource = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/replies/copilot/route.ts"),
  "utf8",
)
assert.match(copilotRouteSource, /buildLeadMemoryInfluenceContext/)
assert.match(copilotRouteSource, /mapMemoryInfluenceToReplyCopilotRelationship/)

const replyPromptSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/replies/reply-prompt.ts"),
  "utf8",
)
assert.match(replyPromptSource, /formatRelationshipMemoryForReplyPrompt/)
assert.match(replyPromptSource, /buildMemoryAwareSuggestedReplyDraft/)

const memoryStrategySource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/outreach/personalization/memory-strategy.ts"),
  "utf8",
)
assert.match(memoryStrategySource, /resolveMemoryInfluencedPainId/)
assert.match(memoryStrategySource, /shouldAvoidPainBlock/)

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
assert.match(processSource, /insertConversationTimelineEvent/)

const outboundProcessSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/outbound/process-event.ts"),
  "utf8",
)
assert.match(outboundProcessSource, /finalizeIngestedReplyIntelligence/)
assert.match(outboundProcessSource, /recomputeGrowthLeadWorkflowSignals/)
const finalizeCallIdx = outboundProcessSource.indexOf("await finalizeIngestedReplyIntelligence")
const recomputeCallIdx = outboundProcessSource.lastIndexOf("await recomputeGrowthLeadWorkflowSignals")
assert.ok(
  finalizeCallIdx >= 0 && recomputeCallIdx > finalizeCallIdx,
  "webhook path recomputes workflow after finalize",
)

const bridgeSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/replies/finalize-ingested-reply-intelligence.ts"),
  "utf8",
)
assert.match(bridgeSource, /processReplyIntelligence/)
assert.match(bridgeSource, /routeLeadSignalEvents/)
assert.match(bridgeSource, /scheduleUnifiedRevenueWorkflowLifecycleReEvaluation/)
assert.match(bridgeSource, /mapReplyIntentToAdaptiveProspectEvent/)
assert.match(bridgeSource, /ingestLiveRelationshipEvent/)
assert.match(bridgeSource, /\.catch\(\(\) => undefined\)/)
assert.doesNotMatch(
  bridgeSource,
  /recomputeGrowthLeadWorkflowSignals/,
  "workflow recompute is delegated to webhook caller, not finalize",
)

const adaptiveRecordSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/aios/growth/growth-adaptive-loop-1b-relationship-event-record.ts"),
  "utf8",
)
assert.match(adaptiveRecordSource, /fingerprint/)
assert.match(adaptiveRecordSource, /existing\?\.id/)

const occurredAt = "2026-07-14T10:00:00.000Z"

function expectMappedIntent(
  intent: ReturnType<typeof classifyReplyIntentV2>["intent"],
  body: string,
  expectedEventType: string,
  material = true,
) {
  const event = mapReplyIntentToAdaptiveProspectEvent({
    intent,
    occurredAt,
    bodyPreview: body,
  })
  assert.ok(event, `expected adaptive event for ${intent}`)
  assert.equal(event!.type, expectedEventType)
  assert.equal(isRelationshipMaterialChange({ eventType: event!.type }), material)
}

function expectAdaptiveIntent(
  body: string,
  expectedIntent: ReturnType<typeof classifyReplyIntentV2>["intent"],
  expectedEventType: string,
  material = true,
) {
  const classified = classifyReplyIntentV2(body)
  assert.equal(classified.intent, expectedIntent)
  expectMappedIntent(classified.intent, body, expectedEventType, material)
}

expectAdaptiveIntent(
  "Thanks for reaching out. We are interested in learning more.",
  "positive_interest",
  "reply_received",
)

const incumbentBody = "We already have software for dispatch."
const incumbentMapped = mapReplyIntentToAdaptiveProspectEvent({
  intent: "objection",
  occurredAt,
  bodyPreview: incumbentBody,
})
assert.ok(incumbentMapped)
assert.equal(incumbentMapped!.type, "already_have_software")
assert.equal(isRelationshipMaterialChange({ eventType: incumbentMapped!.type }), true)

expectAdaptiveIntent("What does pricing look like for 40 technicians?", "pricing_question", "pricing_discussion")
expectAdaptiveIntent("Not now. Circle back next quarter.", "timing_delay", "timing_objection")
expectAdaptiveIntent("We are already using ServiceMax for this.", "competitor_mention", "competitor_mentioned")
expectMappedIntent("referral", "Please loop in our ops lead Sarah on this thread.", "referral")
const wrongContactEvent = mapReplyIntentToAdaptiveProspectEvent({
  intent: "wrong_contact",
  occurredAt,
  bodyPreview: "You have the wrong person on this account.",
})
assert.ok(wrongContactEvent)
assert.equal(wrongContactEvent!.type, "contact_changed")
assert.equal(isRelationshipMaterialChange({ eventType: wrongContactEvent!.type }), false)
assert.equal(
  isRelationshipMaterialChange({
    eventType: wrongContactEvent!.type,
    context: { organizationalImpactScore: 0.5 },
  }),
  true,
)
expectAdaptiveIntent("Please unsubscribe me.", "unsubscribe", "unsubscribe")

const ooo = classifyReplyIntentV2("I am out of office until Monday.")
assert.equal(ooo.intent, "out_of_office")
assert.equal(
  mapReplyIntentToAdaptiveProspectEvent({ intent: ooo.intent, occurredAt, bodyPreview: "OOO" }),
  null,
)

const unknown = classifyReplyIntentV2("👍")
assert.equal(unknown.intent, "unknown")
assert.equal(
  mapReplyIntentToAdaptiveProspectEvent({ intent: unknown.intent, occurredAt, bodyPreview: "👍" }),
  null,
)

const positiveEvent = mapReplyIntentToAdaptiveProspectEvent({
  intent: "positive_interest",
  occurredAt,
  bodyPreview: "Interested",
})!
const duplicateFingerprint = `ge-aios-adaptive-loop-1b:reply_received:${occurredAt}`
assert.match(adaptiveRecordSource, /fingerprint/)
assert.ok(duplicateFingerprint.includes(positiveEvent.type))

const inboxRunnerSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/inbox-sync/inbox-sync-runner.ts"),
  "utf8",
)
assert.match(inboxRunnerSource, /finalizeIngestedReplyIntelligence/)
assert.match(inboxRunnerSource, /pauseSequenceEnrollmentOnInboundReply/)

const uiSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-reply-inbox-dashboard.tsx"),
  "utf8",
)
assert.match(uiSource, /GROWTH_REPLY_INTELLIGENCE_V2_QA_MARKER/)
assert.match(uiSource, /data-qa-marker=\{GROWTH_REPLY_INTELLIGENCE_V2_QA_MARKER\}/)
assert.match(uiSource, /Conversation timeline/)
assert.match(uiSource, /AI-assisted reply copilot/)

const inboxRunner = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/inbox-sync/inbox-sync-runner.ts"),
  "utf8",
)
assert.match(inboxRunner, /ingestGrowthReplyFromInboxSync/)

console.log("growth-reply-intelligence-v2: all checks passed")
