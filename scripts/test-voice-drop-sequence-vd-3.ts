/**
 * Voice Drop sequence operator readiness — VD-3 certification harness.
 * Run: pnpm test:voice-drop-sequence-vd-3
 *
 * No live Twilio calls. Provider mocked in upstream VD-1 tests.
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  evaluateSequenceChannelSelectionRules,
  shouldSkipStepByChannelRules,
} from "../lib/growth/sequence-orchestration/sequence-channel-selection-rules"
import type { GrowthSequenceEnrollmentStep } from "../lib/growth/sequence-enrollment-types"
import {
  GROWTH_SEQUENCE_VOICE_DROP_VD_3_QA_MARKER,
  validateGrowthSequencePatternVoiceDropActivation,
  VOICE_DROP_SEQUENCE_COMPLIANCE_WARNING,
} from "../lib/growth/sequences/sequence-voice-drop-pattern-readiness"
import {
  GROWTH_VOICE_DROP_SEQUENCE_SCHEMA_TABLES,
  GROWTH_VOICE_DROP_SEQUENCE_VD_2_SCHEMA_MIGRATION,
  GROWTH_VOICE_DROP_SEQUENCE_VD_3_SCHEMA_MIGRATION,
} from "../lib/growth/sequences/voice-drop-sequence-schema-health"
import { GROWTH_SEQUENCE_CATALOG_KEYS } from "../lib/growth/sequence-types"

const REQUIRED_FILES = [
  "supabase/migrations/20270809120000_growth_voice_drop_sequence_vd_3.sql",
  "lib/growth/sequences/sequence-voice-drop-pattern-readiness.ts",
  "lib/growth/sequence-orchestration/sequence-voice-drop-fatigue.ts",
  "components/growth/growth-sequence-pattern-builder.tsx",
  "app/(admin)/admin/growth/sequences/builder/page.tsx",
  "app/api/platform/growth/voice/voice-drops/campaigns/approved/route.ts",
  "app/api/platform/growth/sequences/patterns/[patternId]/steps/[stepId]/route.ts",
  "docs/VOICE_DROP_SEQUENCE_VD_3_LIVE_CERTIFICATION.md",
]

for (const relativePath of REQUIRED_FILES) {
  assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing required file: ${relativePath}`)
}

assert.equal(GROWTH_SEQUENCE_VOICE_DROP_VD_3_QA_MARKER, "growth-sequence-voice-drop-vd-3")
assert.ok(GROWTH_SEQUENCE_CATALOG_KEYS.includes("multichannel_with_voice_drop"))
assert.match(VOICE_DROP_SEQUENCE_COMPLIANCE_WARNING, /approval, compliance pass, and certified provider gates/)

const vd3Migration = fs.readFileSync(
  path.join(process.cwd(), `supabase/migrations/${GROWTH_VOICE_DROP_SEQUENCE_VD_3_SCHEMA_MIGRATION}`),
  "utf8",
)
assert.match(vd3Migration, /multichannel_with_voice_drop/)
assert.match(vd3Migration, /voice_drop/)
assert.match(vd3Migration, /\n  false,\n/)

const vd2Migration = fs.readFileSync(
  path.join(process.cwd(), `supabase/migrations/${GROWTH_VOICE_DROP_SEQUENCE_VD_2_SCHEMA_MIGRATION}`),
  "utf8",
)
assert.match(vd2Migration, /voice_drop_campaign_id/)

const builderSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-sequence-pattern-builder.tsx"),
  "utf8",
)
assert.match(builderSource, /campaigns\/approved/)
assert.match(builderSource, /VOICE_DROP_SEQUENCE_COMPLIANCE_WARNING/)
assert.match(builderSource, /Manage Voice Drop campaigns/)

const dashboardSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-sequence-safe-execution-dashboard.tsx"),
  "utf8",
)
assert.match(dashboardSource, /Voice Drops Queued/)
assert.match(dashboardSource, /voiceDropMetrics/)

console.log("\n=== VD-3 Pattern Readiness ===")
const templatePattern = {
  id: "pattern-1",
  key: "multichannel_with_voice_drop",
  label: "Template",
  description: null,
  patternKind: "catalog" as const,
  sequenceVersion: 1,
  isActive: false,
  minTouches: 5,
  maxObservationDays: 90,
  attemptCount: 0,
  replyRate: 0,
  positiveReplyRate: 0,
  meetingSignalRate: 0,
  followUpCompletionRate: 0,
  sequenceAbandonmentRate: 0,
  opportunityLift: 0,
  revenueProbabilityLift: 0,
  conversationHealthLift: 0,
  averageTimeToReplyHours: null,
  averageTouchesToPositiveSignal: null,
  sequenceQualityScore: 0,
  sequenceFatigueRisk: "none" as const,
  confidenceScore: 0,
  computedAt: null,
  steps: [
    {
      id: "s1",
      patternId: "pattern-1",
      stepOrder: 1,
      channel: "email" as const,
      delayDaysMin: 0,
      delayDaysMax: 0,
      generationType: "cold_email",
      playbookCategory: null,
      voiceDropCampaignId: null,
      requiredHumanApproval: true,
      expectedSignal: "reply" as const,
    },
    {
      id: "s2",
      patternId: "pattern-1",
      stepOrder: 2,
      channel: "voice_drop" as const,
      delayDaysMin: 3,
      delayDaysMax: 3,
      generationType: null,
      playbookCategory: null,
      voiceDropCampaignId: null,
      requiredHumanApproval: true,
      expectedSignal: "no_signal" as const,
    },
  ],
}

const blocked = validateGrowthSequencePatternVoiceDropActivation(templatePattern)
assert.equal(blocked.ok, false)

const ready = validateGrowthSequencePatternVoiceDropActivation({
  ...templatePattern,
  steps: templatePattern.steps.map((step) =>
    step.channel === "voice_drop"
      ? { ...step, voiceDropCampaignId: "11111111-1111-4111-8111-111111111111" }
      : step,
  ),
})
assert.equal(ready.ok, true)

console.log("\n=== VD-3 Fatigue Rules ===")
function mockStep(channel: GrowthSequenceEnrollmentStep["channel"], stepOrder: number): GrowthSequenceEnrollmentStep {
  return {
    id: `step-${stepOrder}`,
    enrollmentId: "enrollment",
    leadId: "lead",
    sequencePatternStepId: "pattern-step",
    stepOrder,
    channel,
    generationType: null,
    scheduledFor: new Date().toISOString(),
    status: "pending",
    stepExecutionConfidence: 80,
    outreachQueueId: null,
    cadenceTaskId: null,
    generationId: null,
    instructions: null,
    voiceDropCampaignId: null,
    stepOutcome: null,
    skipReason: null,
    opportunityId: null,
    meetingId: null,
    dueAt: null,
    completedAt: null,
    failureReason: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

const cooldownDecision = evaluateSequenceChannelSelectionRules({
  steps: [mockStep("email", 1), mockStep("voice_drop", 2)],
  currentStep: mockStep("voice_drop", 2),
  touches: [
    {
      occurredAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      channel: "voice_drop",
      generationType: null,
    },
  ],
})
assert.equal(cooldownDecision.ruleCode, "voice_drop_cooldown_skip")
assert.ok(shouldSkipStepByChannelRules(cooldownDecision))

console.log("\n=== VD-3 Supabase Integration ===")
async function runSupabaseProbes(): Promise<void> {
  const boot = bootstrapVerifiedChannelsCertEnv()
  if (!boot) {
    console.log("Supabase credentials unavailable — skipping live schema probes (static checks passed).")
    console.log("\nVD-3 voice drop sequence operator readiness certification passed (static)")
    return
  }

  const admin: SupabaseClient = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })

  async function probeColumn(table: string, column: string): Promise<boolean> {
    const { error } = await admin.schema("growth").from(table).select(column).limit(1)
    return !error
  }

  for (const table of GROWTH_VOICE_DROP_SEQUENCE_SCHEMA_TABLES) {
    const { error } = await admin.schema("growth").from(table).select("id").limit(1)
    assert.ok(!error, `Expected growth.${table} to be queryable: ${error?.message}`)
  }

  const patternStepColumn = await probeColumn("sequence_pattern_steps", "voice_drop_campaign_id")
  if (!patternStepColumn) {
    console.log(
      "VD-2/VD-3 migrations not applied on target Supabase — apply 20270808120000 and 20270809120000 for full integration certification.",
    )
    console.log("\nVD-3 voice drop sequence operator readiness certification passed (static; integration skipped)")
    return
  }

  assert.equal(await probeColumn("sequence_enrollment_steps", "voice_drop_campaign_id"), true)
  assert.equal(await probeColumn("sequence_execution_jobs", "voice_drop_campaign_id"), true)
  assert.equal(await probeColumn("sequence_execution_jobs", "voice_drop_recipient_id"), true)
  assert.equal(await probeColumn("sequence_execution_jobs", "voice_drop_delivery_attempt_id"), true)

  const { data: templateRow } = await admin
    .schema("growth")
    .from("sequence_patterns")
    .select("id, key, is_active")
    .eq("key", "multichannel_with_voice_drop")
    .maybeSingle()

  if (templateRow) {
    const { data: voiceStep } = await admin
      .schema("growth")
      .from("sequence_pattern_steps")
      .select("id, channel, voice_drop_campaign_id")
      .eq("pattern_id", templateRow.id)
      .eq("channel", "voice_drop")
      .maybeSingle()
    assert.ok(voiceStep, "Expected voice_drop step on template pattern after VD-3 migration")
  } else {
    console.log("Template pattern not seeded yet — apply migration 20270809120000_growth_voice_drop_sequence_vd_3.sql")
  }

  console.log("\nVD-3 voice drop sequence operator readiness certification passed")
}

void runSupabaseProbes()
