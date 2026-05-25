/**
 * Regression checks for Growth Engine multi-channel cadence (slice 6.24A).
 * Run: pnpm test:growth-multi-channel-cadence
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  assertCadenceChannelsMatchSequenceChannels,
  buildCadenceSuggestedSmsText,
  buildCadenceTaskInstructions,
  isCadenceEmailChannel,
  isCadenceTaskChannel,
} from "../lib/growth/cadence/cadence-channel-engine"
import {
  GROWTH_CADENCE_TASK_CHANNELS,
  GROWTH_MULTI_CHANNEL_CADENCE_QA_MARKER,
} from "../lib/growth/cadence/cadence-types"
import { GROWTH_NOTIFICATION_TYPES } from "../lib/growth/notifications/notification-types"
import { GROWTH_LEAD_TIMELINE_EVENT_TYPES } from "../lib/growth/timeline-types"
import { GROWTH_SEQUENCE_STEP_CHANNELS } from "../lib/growth/sequence-types"

assert.equal(GROWTH_MULTI_CHANNEL_CADENCE_QA_MARKER, "multi-channel-cadence-v1")
assertCadenceChannelsMatchSequenceChannels()

assert.equal(isCadenceEmailChannel("email"), true)
assert.equal(isCadenceTaskChannel("email"), false)
assert.equal(isCadenceTaskChannel("linkedin_message"), true)
assert.equal(isCadenceTaskChannel("sms_task"), true)

const sms = buildCadenceSuggestedSmsText({ companyName: "Acme HVAC", contactName: "Sam" })
assert.match(sms, /Acme HVAC/)
assert.match(sms, /Sam/)

const linkedin = buildCadenceTaskInstructions({ channel: "linkedin_connect", companyName: "Acme" })
assert.match(linkedin, /No LinkedIn API/i)

const smsInstructions = buildCadenceTaskInstructions({ channel: "sms_task", companyName: "Acme" })
assert.match(smsInstructions, /does not send SMS/i)

for (const channel of GROWTH_CADENCE_TASK_CHANNELS) {
  assert.ok((GROWTH_SEQUENCE_STEP_CHANNELS as readonly string[]).includes(channel))
}

for (const type of [
  "cadence_task_due",
  "cadence_task_overdue",
  "cadence_task_completed",
  "cadence_task_skipped",
  "manual_call_due",
  "linkedin_task_due",
] as const) {
  assert.ok(GROWTH_NOTIFICATION_TYPES.includes(type))
}

for (const type of [
  "cadence_task_created",
  "cadence_task_due",
  "cadence_task_completed",
  "cadence_task_skipped",
  "cadence_step_completed",
  "cadence_step_skipped",
] as const) {
  assert.ok(GROWTH_LEAD_TIMELINE_EVENT_TYPES.includes(type))
}

const migrationSource = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270231120000_growth_engine_multi_channel_cadence.sql"),
  "utf8",
)
assert.match(migrationSource, /create table if not exists growth\.cadence_tasks/)
assert.match(migrationSource, /cadence_step_completed/)
assert.match(migrationSource, /idx_growth_cadence_tasks_owner_due/)

const schedulerSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/sequence-enrollment/run-sequence-scheduler.ts"),
  "utf8",
)
assert.match(schedulerSource, /createCadenceTaskFromEnrollmentStep/)
assert.match(schedulerSource, /isCadenceEmailChannel/)

const orchestratorSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/sequence-enrollment/sequence-enrollment-orchestrator.ts"),
  "utf8",
)
assert.match(orchestratorSource, /createCadenceTaskFromEnrollmentStep/)

const materializeSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/cadence/materialize-cadence-step.ts"),
  "utf8",
)
assert.match(materializeSource, /insertGrowthCadenceTaskRow/)

const channelEngineSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/cadence/cadence-channel-engine.ts"),
  "utf8",
)
assert.match(channelEngineSource, /No LinkedIn API/)

const uiSource = fs.readFileSync(path.join(process.cwd(), "components/growth/growth-cadence-dashboard.tsx"), "utf8")
assert.match(uiSource, /copy & send manually/i)
assert.match(uiSource, /Skip/)

console.log("growth-multi-channel-cadence: all checks passed")
