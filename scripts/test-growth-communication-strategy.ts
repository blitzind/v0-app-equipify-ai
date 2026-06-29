/**
 * GE-AIOS-SDR-1A — Unified Communication Strategy Engine certification.
 * Run: pnpm test:growth-communication-strategy
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildCommunicationStrategy,
  resolveCommunicationStrategyEscalationIndex,
} from "../lib/growth/contact-verification/communication-strategy-engine"
import {
  isCommunicationStrategyEnabled,
  isCommunicationStrategyEnabledClient,
} from "../lib/growth/contact-verification/communication-strategy-feature"
import type { NextBestAction } from "../lib/growth/contact-verification/next-best-action-types"
import type { AcquisitionCandidate } from "../lib/growth/contact-verification/contact-acquisition-types"
import type { ProspectQualification } from "../lib/growth/contact-verification/prospect-qualification-types"
import type { RevenueExecutionPlan } from "../lib/growth/contact-verification/revenue-execution-plan-types"
import type { SequenceRecommendation } from "../lib/growth/contact-verification/sequence-recommendation-types"
import { GROWTH_COMMUNICATION_STRATEGY_QA_MARKER } from "../lib/growth/contact-verification/communication-strategy-types"
import { adaptCommunicationStrategyToDisplaySummary } from "../lib/growth/contact-verification/communication-strategy-view"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function withEnv<T>(overrides: Record<string, string | undefined>, fn: () => T): T {
  const saved = new Map<string, string | undefined>()
  for (const [key, value] of Object.entries(overrides)) {
    saved.set(key, process.env[key])
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  try {
    return fn()
  } finally {
    for (const [key, value] of saved.entries()) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

const FIXTURE_ACQUISITION: AcquisitionCandidate = {
  version: 1,
  companyId: "company-fixture-001",
  generatedAt: "2026-06-28T00:00:00.000Z",
  primaryContact: {
    personId: "person-001",
    fullName: "Chris Taylor",
    title: "VP Operations",
    email: "chris.taylor@example.com",
    confidence: 88,
  },
  verification: {
    emailVerified: true,
    deliverability: "verified",
    confidence: 92,
  },
  committee: {
    role: "economic_buyer",
    confidence: 72,
  },
  outreach: {
    readiness: "ready",
    preferredChannel: "email",
    recommendedSequence: "Executive Cold Outbound Sequence",
  },
  backupContacts: [
    {
      name: "Pat Reed",
      title: "Procurement Manager",
      role: "economic_buyer",
      email: "pat.reed@example.com",
      confidence: 80,
      reasonSelected: "Backup outreach target",
    },
  ],
  blockers: [],
  reasons: ["Verified executive"],
  overallConfidence: 88,
}

const BASE_QUALIFICATION: ProspectQualification = {
  version: 1,
  companyId: "company-fixture-001",
  generatedAt: "2026-06-28T00:00:00.000Z",
  qualification: "qualified",
  overallScore: 82,
  fitScore: 80,
  contactScore: 85,
  engagementScore: 70,
  buyingCommitteeCoverage: 67,
  confidence: 84,
  acquisitionCandidate: FIXTURE_ACQUISITION,
  strengths: ["Verified executive"],
  risks: [],
  blockers: [],
  recommendations: ["Proceed with coordinated outreach"],
  nextAction: "enroll_sequence",
}

const ESCALATION_CHANNEL_CAPABILITIES = {
  phone: true,
  sms: true,
  voiceDrop: true,
  voiceDropCertified: true,
  smsReady: true,
  linkedin: true,
} as const

const BASE_SEQUENCE: SequenceRecommendation = {
  version: 1,
  companyId: "company-fixture-001",
  generatedAt: "2026-06-28T00:00:00.000Z",
  recommendedSequence: {
    type: "executive_cold_outbound",
    name: "Executive Cold Outbound Sequence",
  },
  preferredChannel: "email",
  enrollmentReadiness: "ready",
  confidence: 84,
  cadence: { intensity: "standard", suggestedTouchCount: 5, suggestedDurationDays: 21 },
  reasons: ["Qualified account with verified email"],
  risks: [],
  blockers: [],
  nextAction: "enroll_sequence",
  personalizationInputs: {},
}

const BASE_NBA: NextBestAction = {
  version: 1,
  companyId: "company-fixture-001",
  generatedAt: "2026-06-28T00:00:00.000Z",
  action: "enroll_sequence",
  priority: "high",
  confidence: 84,
  executionReadiness: "ready",
  recommendedChannel: "email",
  recommendedDelayHours: 0,
  reasons: ["Qualified and ready for enrollment"],
  blockers: [],
  dependencies: [],
  warnings: [],
}

const BASE_REP: RevenueExecutionPlan = {
  version: 1,
  companyId: "company-fixture-001",
  generatedAt: "2026-06-28T00:00:00.000Z",
  executionState: "ready",
  executionMode: "approval_required",
  recommendedWorkflow: "sequence_enrollment",
  executionSteps: [],
  prerequisites: [],
  approvalsRequired: ["human_approval"],
  estimatedDurationMinutes: 10,
  confidence: 84,
  risks: [],
  blockers: [],
}

function buildInput(touchHistory: Parameters<typeof buildCommunicationStrategy>[0]["touchHistory"]) {
  return {
    organizationId: "org-equipify",
    companyId: "company-fixture-001",
    generatedAt: "2026-06-28T00:00:00.000Z",
    qualification: BASE_QUALIFICATION,
    sequenceRecommendation: BASE_SEQUENCE,
    nextBestAction: BASE_NBA,
    revenueExecutionPlan: BASE_REP,
    touchHistory,
    channelCapabilities: ESCALATION_CHANNEL_CAPABILITIES,
  }
}

async function main(): Promise<void> {
  console.log("\n=== GE-AIOS-SDR-1A Communication Strategy Engine Certification ===\n")

  withEnv({ GROWTH_COMMUNICATION_STRATEGY: undefined, GROWTH_NATIVE_DECISION_ENGINE: undefined }, () => {
    assert.equal(isCommunicationStrategyEnabled(), false)
  })
  withEnv({ GROWTH_COMMUNICATION_STRATEGY: "true" }, () => {
    assert.equal(isCommunicationStrategyEnabled(), true)
  })
  withEnv({ GROWTH_NATIVE_DECISION_ENGINE: "true" }, () => {
    assert.equal(isCommunicationStrategyEnabled(), true)
  })
  console.log("  ✓ Feature flag defaults and enable paths")

  const fresh = buildCommunicationStrategy(buildInput({}))
  assert.equal(fresh.primaryChannel, "email")
  assert.equal(fresh.recommendedAction, "send_email")
  assert.ok(fresh.escalationPlan.length >= 5)
  console.log("  ✓ Qualified account starts with email primary")

  const emailIgnored = buildCommunicationStrategy(
    buildInput({
      emailSentCount: 2,
      emailReplyCount: 0,
      lastEmailNoReply: true,
      daysSinceLastEmail: 5,
    }),
  )
  assert.equal(emailIgnored.primaryChannel, "phone")
  assert.equal(emailIgnored.recommendedAction, "place_call")
  console.log("  ✓ Email ignored → Call")

  const callIgnored = buildCommunicationStrategy(
    buildInput({
      emailSentCount: 2,
      emailReplyCount: 0,
      lastEmailNoReply: true,
      daysSinceLastEmail: 5,
      callAttempted: true,
      callNoAnswer: true,
    }),
  )
  assert.equal(callIgnored.primaryChannel, "voice_drop")
  assert.equal(callIgnored.recommendedAction, "launch_voice_drop")
  console.log("  ✓ Call ignored → Voice Drop")

  const voiceIgnored = buildCommunicationStrategy(
    buildInput({
      emailSentCount: 2,
      emailReplyCount: 0,
      lastEmailNoReply: true,
      callAttempted: true,
      callNoAnswer: true,
      voiceDropSent: true,
      hoursSinceVoiceDrop: 48,
    }),
  )
  assert.equal(voiceIgnored.primaryChannel, "sms")
  assert.equal(voiceIgnored.recommendedAction, "send_sms")
  console.log("  ✓ Voice Drop ignored → SMS")

  const smsIgnored = buildCommunicationStrategy(
    buildInput({
      emailSentCount: 2,
      emailReplyCount: 0,
      lastEmailNoReply: true,
      daysSinceLastEmail: 5,
      smsSentCount: 1,
      smsReplyCount: 0,
      callAttempted: true,
      callNoAnswer: true,
      voiceDropSent: true,
      hoursSinceVoiceDrop: 48,
    }),
  )
  assert.equal(smsIgnored.primaryChannel, "linkedin")
  assert.equal(smsIgnored.recommendedAction, "create_linkedin_task")
  console.log("  ✓ SMS ignored → LinkedIn task")

  const positive = buildCommunicationStrategy(
    buildInput({
      positiveReply: true,
    }),
  )
  assert.equal(positive.recommendedAction, "schedule_meeting")
  console.log("  ✓ Positive reply → Meeting")

  const negative = buildCommunicationStrategy(
    buildInput({
      negativeReply: true,
    }),
  )
  assert.equal(negative.primaryChannel, "stop")
  assert.equal(negative.recommendedAction, "stop")
  console.log("  ✓ Negative reply → Stop")

  const disqualified = buildCommunicationStrategy({
    ...buildInput({}),
    qualification: {
      ...BASE_QUALIFICATION,
      qualification: "disqualified",
    },
    nextBestAction: {
      ...BASE_NBA,
      action: "disqualify",
    },
  })
  assert.equal(disqualified.primaryChannel, "stop")
  console.log("  ✓ Disqualified → Stop")

  const qualifiedContinue = buildCommunicationStrategy(buildInput({ emailSentCount: 1, emailReplyCount: 1 }))
  assert.notEqual(qualifiedContinue.primaryChannel, "stop")
  console.log("  ✓ Qualified with engagement → Continue")

  assert.equal(resolveCommunicationStrategyEscalationIndex({}), 0)
  assert.equal(
    resolveCommunicationStrategyEscalationIndex({
      emailSentCount: 1,
      emailReplyCount: 0,
      lastEmailNoReply: true,
      daysSinceLastEmail: 5,
    }),
    1,
  )
  console.log("  ✓ Escalation index deterministic")

  const display = adaptCommunicationStrategyToDisplaySummary(fresh)
  assert.equal(display.qa_marker, GROWTH_COMMUNICATION_STRATEGY_QA_MARKER)
  assert.ok(display.primary_channel_label.length > 0)
  console.log("  ✓ Display adapter sanitizes strategy")

  const adapterSource = readSource("lib/growth/contact-verification/native-revenue-decision-adapter.ts")
  assert.match(adapterSource, /buildCommunicationStrategy/)
  assert.match(adapterSource, /communication_strategy/)
  assert.match(adapterSource, /resolveAuthoritativeCommunicationStrategy/)
  console.log("  ✓ Native revenue decision adapter wired")

  const loaderSource = readSource(
    "lib/growth/prospect-search/prospect-search-contact-intelligence-loader.ts",
  )
  assert.match(loaderSource, /resolveNativeRevenueDecisionAuthoritativeBundle/)
  console.log("  ✓ Prospect Search loader consumes authoritative bundle")

  const drawerSource = readSource("components/growth/growth-lead-drawer.tsx")
  assert.match(drawerSource, /communication-strategy/)
  assert.match(drawerSource, /nativeCommunicationStrategy/)
  console.log("  ✓ Lead drawer fetches authoritative communication strategy")

  const leadApiSource = readSource("app/api/platform/growth/leads/[leadId]/communication-strategy/route.ts")
  assert.match(leadApiSource, /resolveLeadCommunicationStrategyBundle/)
  console.log("  ✓ Lead communication strategy API route registered")

  assert.match(readSource("next.config.mjs"), /NEXT_PUBLIC_GROWTH_COMMUNICATION_STRATEGY/)
  assert.match(readSource("package.json"), /test:growth-communication-strategy/)
  console.log("  ✓ Env exposure and test script registered")

  withEnv({ NEXT_PUBLIC_GROWTH_COMMUNICATION_STRATEGY: "true" }, () => {
    assert.equal(isCommunicationStrategyEnabledClient(), true)
  })
  console.log("  ✓ Client feature flag")

  console.log("\n=== GE-AIOS-SDR-1A certification passed ===\n")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
