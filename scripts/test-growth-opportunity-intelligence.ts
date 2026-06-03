/**
 * Regression checks for Inbox CRM + Opportunity Intelligence (Phase 2N).
 * Run: pnpm test:growth-opportunity-intelligence
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { detectBuyingCommitteeSignals } from "../lib/growth/opportunity-intelligence/committee-signal"
import { generateOpportunityRecommendations } from "../lib/growth/opportunity-intelligence/opportunity-recommendation"
import {
  detectOpportunitySignalsFromInbox,
  detectOpportunitySignalsFromReplyDraftOutcome,
  hasMinimumEvidence,
} from "../lib/growth/opportunity-intelligence/signal-detector"
import {
  detectSequencePauseCandidates,
  detectStopSequenceCandidate,
} from "../lib/growth/opportunity-intelligence/sequence-pause-detector"
import {
  GROWTH_OPPORTUNITY_INTELLIGENCE_PRIVACY_NOTE,
  GROWTH_OPPORTUNITY_INTELLIGENCE_QA_MARKER,
  GROWTH_OPPORTUNITY_RECOMMENDATION_TYPES,
  GROWTH_OPPORTUNITY_SIGNAL_CONFIDENCE_LEVELS,
  GROWTH_OPPORTUNITY_SIGNAL_TYPES,
  sanitizeEvidenceSnippet,
} from "../lib/growth/opportunity-intelligence/opportunity-types"
import { GROWTH_OPPORTUNITY_INTELLIGENCE_SCHEMA_MIGRATION } from "../lib/growth/opportunity-intelligence/schema-health"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function main(): Promise<void> {
  assert.equal(GROWTH_OPPORTUNITY_INTELLIGENCE_QA_MARKER, "growth-opportunity-intelligence-v1")
  assert.match(GROWTH_OPPORTUNITY_INTELLIGENCE_PRIVACY_NOTE, /Human approval required/i)
  assert.match(GROWTH_OPPORTUNITY_INTELLIGENCE_PRIVACY_NOTE, /no autonomous/i)
  assert.equal(GROWTH_OPPORTUNITY_SIGNAL_TYPES.length, 10)
  assert.equal(GROWTH_OPPORTUNITY_RECOMMENDATION_TYPES.length, 8)
  assert.equal(GROWTH_OPPORTUNITY_SIGNAL_CONFIDENCE_LEVELS.length, 4)

  const migration = readSource(`supabase/migrations/${GROWTH_OPPORTUNITY_INTELLIGENCE_SCHEMA_MIGRATION}`)
  assert.match(migration, /growth\.opportunity_signals/)
  assert.match(migration, /growth\.opportunity_recommendations/)
  assert.match(migration, /growth\.buying_committee_signals/)
  assert.match(migration, /growth\.crm_intelligence_events/)
  assert.match(migration, /growth\.sequence_pause_candidates/)
  assert.match(migration, /requires_human_approval/)
  assert.match(migration, /service role only/i)

  const meetingSignals = detectOpportunitySignalsFromInbox({
    subject: "Re: Demo next week",
    body: "Can we schedule a call to walk through pricing?",
    classification: "meeting_intent",
  })
  assert.ok(meetingSignals.some((signal) => signal.signalType === "meeting_interest"))
  assert.ok(meetingSignals.some((signal) => signal.signalType === "pricing_interest"))
  assert.ok(hasMinimumEvidence(meetingSignals))

  const budgetSignals = detectOpportunitySignalsFromInbox({
    body: "We have budget approved for Q3 and need a proposal by Friday.",
    classification: "budget",
  })
  assert.ok(budgetSignals.some((signal) => signal.signalType === "budget_signal"))
  assert.ok(budgetSignals.some((signal) => signal.signalType === "proposal_request"))

  const draftSignals = detectOpportunitySignalsFromReplyDraftOutcome({
    classification: "positive_interest",
    body: "Thanks — our CEO wants to review this with the team.",
    draftStatus: "sent",
  })
  assert.ok(draftSignals.some((signal) => signal.signalType === "decision_maker_detected"))
  assert.equal(detectOpportunitySignalsFromReplyDraftOutcome({ draftStatus: "discarded" }).length, 0)

  const recommendations = generateOpportunityRecommendations({
    signals: meetingSignals,
    hasActiveSequence: true,
    hasOwner: false,
  })
  assert.ok(recommendations.every((entry) => entry.evidence.length > 0))
  assert.ok(recommendations.some((entry) => entry.recommendationType === "create_opportunity"))
  assert.ok(recommendations.some((entry) => entry.recommendationType === "pause_sequence"))
  assert.ok(recommendations.some((entry) => entry.recommendationType === "assign_owner"))
  assert.equal(generateOpportunityRecommendations({ signals: [] }).length, 0)

  const committee = detectBuyingCommitteeSignals({
    body: "Please loop in our VP of Operations — I will refer you to my colleague.",
    signals: meetingSignals,
  })
  assert.ok(committee.length > 0)
  assert.ok(committee.every((entry) => entry.evidenceSnippet.length >= 8))

  const pauseCandidates = detectSequencePauseCandidates({
    signals: meetingSignals,
    hasActiveSequence: true,
  })
  assert.ok(pauseCandidates.length > 0)
  assert.equal(detectSequencePauseCandidates({ signals: meetingSignals, hasActiveSequence: false }).length, 0)

  const stopCandidate = detectStopSequenceCandidate({
    signals: detectOpportunitySignalsFromInbox({
      body: "We are evaluating Competitor X alongside your platform.",
      classification: "competitor",
    }),
    hasActiveSequence: true,
  })
  assert.ok(stopCandidate)

  assert.equal(sanitizeEvidenceSnippet("  hello\x00world  "), "hello world")
  assert.ok(sanitizeEvidenceSnippet("x".repeat(400)).length <= 280)

  const crmSource = readSource("lib/growth/opportunity-intelligence/crm-intelligence.ts")
  assert.match(crmSource, /acceptOpportunityRecommendation/)
  assert.match(crmSource, /dismissOpportunityRecommendation/)
  assert.match(crmSource, /no_autonomous_crm_mutation/)
  assert.match(crmSource, /acceptance_records_intent_only/)
  assert.doesNotMatch(crmSource, /createOpportunity|advanceStage|pauseSequence\(|stopSequence\(/i)

  const threadSource = readSource("lib/growth/inbox/thread-repository.ts")
  assert.match(threadSource, /ingestOpportunityIntelligenceFromInbox/)

  const replyDraftSource = readSource("lib/growth/replies/reply-draft-repository.ts")
  assert.match(replyDraftSource, /ingestOpportunityIntelligenceFromReplyDraft/)

  for (const route of [
    "app/api/platform/growth/opportunities/dashboard/route.ts",
    "app/api/platform/growth/opportunities/signals/route.ts",
    "app/api/platform/growth/opportunities/recommendations/route.ts",
    "app/api/platform/growth/opportunities/recommendations/[id]/accept/route.ts",
    "app/api/platform/growth/opportunities/recommendations/[id]/dismiss/route.ts",
  ]) {
    const source = readSource(route)
    assert.match(source, /requireGrowthEnginePlatformAccess/)
    assert.match(source, /isGrowthOpportunityIntelligenceSchemaReady/)
    assert.doesNotMatch(source, /api_key|secret|password/i)
  }

  const acceptSource = readSource("app/api/platform/growth/opportunities/recommendations/[id]/accept/route.ts")
  assert.match(acceptSource, /humanApprovalConfirmed/)
  assert.match(acceptSource, /Human approval confirmation required/)

  const dismissSource = readSource("app/api/platform/growth/opportunities/recommendations/[id]/dismiss/route.ts")
  assert.match(dismissSource, /dismissOpportunityRecommendation/)
  assert.match(dismissSource, /humanApprovalConfirmed/)
  assert.match(dismissSource, /Human approval confirmation required/)

  const uiSource = readSource("components/growth/growth-opportunity-intelligence-dashboard.tsx")
  assert.match(uiSource, /GROWTH_OPPORTUNITY_INTELLIGENCE_QA_MARKER/)
  assert.match(uiSource, /High Intent Accounts/)
  assert.match(uiSource, /Opportunity Signals/)
  assert.match(uiSource, /Committee Expansion/)
  assert.match(uiSource, /Recommended Actions/)
  assert.match(uiSource, /Sequence Pause Candidates/)
  assert.match(uiSource, /Buying Signals/)

  const inboxUiSource = readSource("components/growth/growth-inbox-opportunity-intelligence-panel.tsx")
  assert.match(inboxUiSource, /Recommendation Panel/)
  assert.match(inboxUiSource, /Evidence Panel/)
  assert.match(inboxUiSource, /Pause Sequence Recommendation/)

  const leadPanelSource = readSource("components/growth/growth-lead-opportunity-intelligence-panel.tsx")
  assert.match(leadPanelSource, /Opportunity Intelligence/)
  assert.match(leadPanelSource, /Buying Signals/)
  assert.match(leadPanelSource, /Recommended Actions/)
  assert.match(leadPanelSource, /Committee Expansion/)

  const navSource = readSource("lib/growth/navigation/growth-navigation-destinations.ts")
  assert.match(navSource, /\/admin\/growth\/opportunity-intelligence/)

  console.log("growth-opportunity-intelligence-v1: all checks passed")
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
