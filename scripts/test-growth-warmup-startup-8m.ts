/**
 * GS-GROWTH-WARMUP-HOTFIX-8M regression tests.
 * Run: pnpm test:growth-warmup-startup-8m
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { resolveConnectedMailboxWarmupDisplay } from "../lib/growth/mailboxes/connected-mailbox-warmup-label"
import {
  warmupProfileStatusAllowsStart,
  warmupStartupUserMessage,
} from "../lib/growth/warmup/warmup-startup-actions"
import { resolveWarmupStartupPlan } from "../lib/growth/warmup/warmup-startup-plan"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function testStartupPlan() {
  assert.equal(resolveWarmupStartupPlan(null), "create_and_generate")
  assert.equal(resolveWarmupStartupPlan({ status: "new", scheduleLength: 0 }), "generate_existing_new")
  assert.equal(resolveWarmupStartupPlan({ status: "warming", scheduleLength: 5 }), "already_active")
  assert.equal(resolveWarmupStartupPlan({ status: "active", scheduleLength: 30 }), "already_active")
  assert.equal(resolveWarmupStartupPlan({ status: "paused", scheduleLength: 0 }), "generate_existing_new")
  assert.equal(resolveWarmupStartupPlan({ status: "paused", scheduleLength: 3 }), "already_active")
}

function testStartupMessages() {
  assert.match(
    warmupStartupUserMessage({ action: "generated_existing_new", email: "mike@equipifyai.com" }),
    /already exists/i,
  )
  assert.match(
    warmupStartupUserMessage({ action: "created_and_generated", email: "mike@equipifyai.com" }),
    /Warmup schedule generated/i,
  )
  assert.match(
    warmupStartupUserMessage({ action: "already_active", email: "mike@equipifyai.com" }),
    /already active/i,
  )
  assert.match(
    warmupStartupUserMessage({
      action: "schedule_generation_failed",
      reason: "duplicate key value",
    }),
    /Could not generate warmup schedule because duplicate key value/i,
  )
  assert.equal(
    warmupStartupUserMessage({ action: "missing_sender" }),
    "Sender account id is required to start warmup.",
  )
}

function testWarmupLabelMapping() {
  const notStarted = resolveConnectedMailboxWarmupDisplay({
    warmupStatus: null,
    warmupProfileId: null,
    senderStatus: "connected",
  })
  assert.equal(notStarted.label, "Not Started")
  assert.equal(notStarted.canStart, true)

  const ready = resolveConnectedMailboxWarmupDisplay({
    warmupStatus: "new",
    warmupProfileId: "profile-1",
    senderStatus: "connected",
  })
  assert.equal(ready.label, "Ready to Generate")
  assert.equal(ready.canStart, true)

  const warming = resolveConnectedMailboxWarmupDisplay({
    warmupStatus: "warming",
    warmupProfileId: "profile-1",
    senderStatus: "connected",
  })
  assert.equal(warming.label, "Warming")
  assert.equal(warming.canStart, false)

  assert.equal(warmupProfileStatusAllowsStart("new"), true)
  assert.equal(warmupProfileStatusAllowsStart("warming"), false)
}

function testRoutesAndUiWiring() {
  const generateRoute = readSource("app/api/platform/growth/warmup/[id]/generate/route.ts")
  assert.match(generateRoute, /requireGrowthCommunicationsSettingsAccess\(request\)/)
  assert.doesNotMatch(generateRoute, /requireGrowthCommunicationsSettingsAccess\(_request\)/)

  const startRoute = readSource("app/api/platform/growth/warmup/start/route.ts")
  assert.match(startRoute, /startWarmupForSenderAccount/)
  assert.match(startRoute, /senderAccountId/)

  const uiSource = readSource("components/growth/mailboxes/growth-connected-mailboxes-dashboard.tsx")
  assert.match(uiSource, /\/api\/platform\/growth\/warmup\/start/)
  assert.doesNotMatch(uiSource, /\/api\/platform\/growth\/warmup`\s*,\s*\{\s*method:\s*"POST"/)

  const repoSource = readSource("lib/growth/warmup/warmup-repository.ts")
  assert.match(repoSource, /findWarmupProfileBySenderAccount/)
  assert.match(repoSource, /warmup_profile_already_exists/)
}

const tests: Array<{ name: string; fn: () => void }> = [
  { name: "warmup startup plan resolution", fn: testStartupPlan },
  { name: "warmup startup user messages", fn: testStartupMessages },
  { name: "connected mailbox warmup label mapping", fn: testWarmupLabelMapping },
  { name: "routes and UI wiring", fn: testRoutesAndUiWiring },
]

let failed = 0
for (const t of tests) {
  try {
    t.fn()
    console.log(`ok\t${t.name}`)
  } catch (e) {
    failed += 1
    console.error(`fail\t${t.name}`)
    console.error(e)
  }
}

if (failed > 0) process.exit(1)
console.log(`\nAll ${tests.length} growth-warmup-startup-8m tests passed.`)
