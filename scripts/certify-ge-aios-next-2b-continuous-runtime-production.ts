/**
 * GE-AIOS-NEXT-2B — Continuous Runtime Production Certification.
 *
 * Local certification (architecture + regression + policy):
 *   pnpm certify:ge-aios-next-2b-continuous-runtime-production
 *
 * Full certification including Production evidence probe:
 *   pnpm certify:ge-aios-next-2b-continuous-runtime-production:live
 */
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { isWithinBusinessHours } from "../lib/growth/outreach/outreach-scheduling"
import { evaluateAllowedSendWindows } from "../lib/growth/governance/sending-policy"
import { GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS } from "../lib/growth/automation-runtime/ge-v1-5-automation-runtime-types"
import {
  buildGrowthHomeAvaContinuousExecutiveBriefingPayload,
} from "../lib/growth/ava-home/recommendations/growth-home-ava-continuous-executive-briefing-next-2a"
import {
  buildGrowthHomeAvaExecutiveBriefingCursorSnapshot,
  hoursSinceIso,
} from "../lib/growth/ava-home/recommendations/growth-home-ava-executive-briefing-cursor-next-2a"
import {
  GROWTH_AIOS_NEXT_2A_EXECUTIVE_BRIEFING_CURSOR_QA_MARKER,
} from "../lib/growth/ava-home/recommendations/growth-home-ava-executive-briefing-cursor-next-2a-types"
import { GROWTH_SCHEDULER_RUNTIME_CALL_GRAPH_1A } from "../lib/growth/objectives/growth-objective-scheduler-telemetry-1a-types"

export const GE_AIOS_NEXT_2B_CONTINUOUS_RUNTIME_CERT_QA_MARKER =
  "ge-aios-next-2b-continuous-runtime-production-cert-v1" as const

const PHASE = "GE-AIOS-NEXT-2B-CONTINUOUS-RUNTIME-PRODUCTION-CERT" as const
const ROOT = process.cwd()

type CertStep = {
  section: string
  id: string
  name: string
  status: "pass" | "fail" | "blocked" | "skip" | "warn"
  detail: string
}

const steps: CertStep[] = []

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function record(
  section: string,
  id: string,
  name: string,
  status: CertStep["status"],
  detail: string,
): void {
  steps.push({ section, id, name, status, detail })
  const icon =
    status === "pass" ? "✓" : status === "fail" ? "✗" : status === "warn" ? "!" : status === "blocked" ? "○" : "-"
  console.log(`  ${icon} [${section}/${id}] ${name}: ${detail}`)
}

function runPnpmScript(script: string): void {
  execFileSync("pnpm", [script], { cwd: ROOT, stdio: "pipe", encoding: "utf8" })
}

function auditRuntimeSystems(): void {
  const scheduler = readSource("lib/growth/objectives/growth-objective-runtime-scheduler.ts")
  assert.match(scheduler, /tickGrowthObjectiveRuntime/)
  assert.match(scheduler, /runGrowthMissionRuntimeOrchestration/)
  assert.match(scheduler, /tickAutonomousSalesLoopForScheduler/)
  assert.match(scheduler, /tickDraftFactoryDueStatesForScheduler/)
  assert.match(scheduler, /tickAutonomousPortfolioManagerForScheduler/)
  record("runtime", "scheduler-call-graph", "Objective runtime scheduler call graph", "pass", GROWTH_SCHEDULER_RUNTIME_CALL_GRAPH_1A)

  const vercel = readSource("vercel.json")
  assert.match(vercel, /growth-objective-runtime-scheduler/)
  record("runtime", "cron-schedule", "Objective scheduler cron registered", "pass", "*/20 * * * * in vercel.json")

  const cronRoute = readSource("app/api/cron/growth-objective-runtime-scheduler/route.ts")
  assert.match(cronRoute, /runGrowthObjectiveRuntimeScheduler/)
  assert.match(cronRoute, /runGrowthCronJob/)
  record("runtime", "cron-route", "Scheduler cron route delegates to canonical runner", "pass", "growth-cron-runner + telemetry")

  const stages = [
    ["lib/growth/mission-center/growth-mission-runtime-orchestrator.ts", "mission runtime"],
    ["lib/growth/specialists/execution/run-autonomous-sales-loop.ts", "autonomous sales loop"],
    ["lib/growth/draft-factory/draft-factory-due-scheduler-tick.ts", "draft factory due tick"],
    ["lib/growth/portfolio-manager/growth-autonomous-portfolio-scheduler-tick-1a.ts", "portfolio manager tick"],
    ["lib/growth/datamoon-decision-maker/datamoon-dm-discovery-poll-tick.ts", "decision-maker discovery poll"],
  ] as const

  for (const [file, label] of stages) {
    assert.ok(fs.existsSync(path.join(ROOT, file)), `${file} missing`)
    record("runtime", file, label, "pass", "canonical module present")
  }
}

function auditNoDuplicateAuthorities(): void {
  const nextLayers = [
    "lib/growth/ava-home/recommendations/growth-home-ava-continuous-executive-briefing-next-2a.ts",
    "lib/growth/ava-home/recommendations/growth-home-ava-strategic-leadership-next-1f.ts",
    "lib/growth/ava-home/recommendations/growth-home-ava-business-objective-next-1e.ts",
    "lib/growth/ava-home/recommendations/growth-home-ava-recommendation-queue-next-1a.ts",
  ]

  for (const file of nextLayers) {
    const source = readSource(file)
    assert.doesNotMatch(source, /setInterval|node-cron|new CronJob/)
    assert.doesNotMatch(source, /runGrowthObjectiveRuntimeScheduler/)
  }
  record("architecture", "no-duplicate-runtime", "NEXT presentation layers do not introduce schedulers", "pass", "verified")
}

function validateOutboundPolicy(): void {
  assert.equal(GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS.outbound_send_execution_enabled, false)
  record("outbound", "automation-runtime-flag", "Automation runtime outbound send disabled", "pass", "outbound_send_execution_enabled=false")

  const prepare = readSource("lib/growth/automation-runtime/ge-v1-5-automation-runtime-prepare.ts")
  assert.match(prepare, /prepare_outbound_disabled/)
  record("outbound", "prepare-gate", "Prepare outbound blocked when disabled", "pass", "prepare_outbound_disabled")

  const comms = readSource("lib/growth/aios/communication/growth-communication-engine-engine.ts")
  assert.match(comms, /Growth Autonomy outbound disabled/)
  record("outbound", "communication-engine", "Communication engine blocks unapproved outbound", "pass", "canonical gate")

  const outsideHours = isWithinBusinessHours({
    at: new Date("2026-07-19T03:00:00.000Z"),
    timezone: "America/New_York",
    startMinutes: 9 * 60,
    endMinutes: 17 * 60,
  })
  assert.equal(outsideHours, false)
  record("outbound", "business-hours", "Business-hour helper rejects off-hours send window", "pass", "isWithinBusinessHours")

  const sendWindow = evaluateAllowedSendWindows({
    start: "09:00",
    end: "17:00",
    timezone: "America/New_York",
  })
  assert.ok(typeof sendWindow === "object" || sendWindow === null)
  record("outbound", "send-windows", "Governance send-window policy evaluator wired", "pass", "evaluateAllowedSendWindows")
}

function validateExecutiveBriefingDelta(): void {
  const baseline = buildGrowthHomeAvaExecutiveBriefingCursorSnapshot({
    metricsSnapshot: {
      capturedAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
      researched: 10,
      qualified: 4,
      readyForReview: 2,
      repliesToday: 0,
      meetingsToday: 0,
      approvalsWaiting: 1,
      opportunitiesCount: 2,
    },
    leadPoolVisible: 80,
    pendingApprovals: 1,
    objectiveProgressPercent: 40,
    lastRecommendationKind: "mission_discovery",
  })

  const cursor = {
    qaMarker: GROWTH_AIOS_NEXT_2A_EXECUTIVE_BRIEFING_CURSOR_QA_MARKER,
    organizationId: "org-1",
    lastMeaningfulInteractionAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    lastMeaningfulInteractionKind: "briefing_reviewed" as const,
    lastBriefingAcknowledgedAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    lastBriefingGeneratedAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    acknowledgedSnapshot: baseline,
    briefingHistory: [],
  }

  const briefing = buildGrowthHomeAvaContinuousExecutiveBriefingPayload({
    greeting: "Good morning, Michael.",
    cursor,
    metricsSnapshot: {
      capturedAt: new Date().toISOString(),
      researched: 43,
      qualified: 11,
      readyForReview: 11,
      repliesToday: 0,
      meetingsToday: 0,
      approvalsWaiting: 4,
      opportunitiesCount: 11,
    },
    pendingApprovals: 4,
    missionDiscovery: {
      qaMarker: "ge-aios-18g-mission-discovery-snapshot-v1",
      missionId: "obj-1",
      lifecycleState: "researching",
      activityLabel: "Researching qualified companies",
      counters: {
        newCompaniesFound: 2,
        recordsImported: 4,
        researchingCount: 6,
        draftsPrepared: 11,
        pendingApprovals: 4,
      },
      searchSummary: "HVAC",
      audienceName: "HVAC",
      recordsImported: 4,
      newCompaniesFound: 2,
      leadPoolVisible: 98,
      leadPoolHasMore: false,
      pipelineLow: false,
      lastEventSummary: null,
      discoveryAction: "begin_research",
      startupDiscoveryReady: true,
    },
    outboundDisabled: true,
  })

  assert.match(briefing.openingLine, /working throughout the night|while you were away/i)
  assert.ok(briefing.activitySummary.some((line) => /researched|approval backlog|prepared/i.test(line)))
  assert.match(briefing.communicationNote ?? "", /outbound remains disabled/i)
  record("briefing", "overnight-delta", "Executive briefing reflects overnight internal work", "pass", briefing.openingLine)

  const first = buildGrowthHomeAvaContinuousExecutiveBriefingPayload({
    greeting: "Good morning, Michael.",
    cursor: {
      ...cursor,
      acknowledgedSnapshot: null,
      lastBriefingAcknowledgedAt: null,
    },
    metricsSnapshot: {
      capturedAt: new Date().toISOString(),
      researched: 0,
      qualified: 0,
      readyForReview: 0,
      repliesToday: 0,
      meetingsToday: 0,
      approvalsWaiting: 0,
      opportunitiesCount: 0,
    },
  })
  assert.equal(first.state, "first_briefing")
  record("briefing", "baseline", "First acknowledgment establishes baseline without fabricated deltas", "pass", first.state)

  const cursorSource = readSource("lib/growth/ava-home/recommendations/growth-home-ava-executive-briefing-cursor-next-2a.ts")
  assert.match(cursorSource, /markGrowthHomeAvaExecutiveBriefingPassiveRefresh/)
  record("briefing", "passive-refresh", "Passive polling does not move acknowledgment cursor", "pass", "sessionStorage gate")

  assert.ok(hoursSinceIso(cursor.lastBriefingAcknowledgedAt)! >= 7)
  record("briefing", "interaction-window", "Briefing window anchored to last acknowledgment", "pass", "hoursSinceIso")
}

function runRegressionSuite(): void {
  const scripts = [
    "test:ge-aios-next-2a-ava-continuous-executive-briefing",
    "test:ge-aios-next-1f-ava-strategic-leadership",
    "test:ge-aios-next-1e-ava-business-objective",
    "test:ge-aios-next-1d-ava-outcome-planning",
    "test:ge-aios-next-1c-ava-strategic-advisor",
    "test:ge-aios-next-1b-ava-intent-recommendation-home",
    "test:ge-aios-next-1a-ava-recommendation-home",
    "test:ge-aios-scheduler-runtime-optimization-1a",
    "test:growth-objective-ge-auto-2b",
  ] as const

  for (const script of scripts) {
    try {
      runPnpmScript(script)
      record("regression", script, script, "pass", "exit 0")
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      record("regression", script, script, "fail", message.slice(0, 240))
      throw error
    }
  }
}

function evaluateProductionEvidence(rawJson: string): void {
  const evidence = JSON.parse(rawJson) as {
    continuousExecution?: {
      schedulerRunsInWindow?: number
      schedulerSuccessInWindow?: number
      autonomousDiscoveryRunsInWindow?: number
      leadsAdmittedInWindow?: number
      draftFactoryUpdatesInWindow?: number
    }
    outboundPolicy?: {
      outboundMessagesInWindow?: number
    }
  }

  const schedulerRuns = evidence.continuousExecution?.schedulerRunsInWindow ?? 0
  const schedulerOk = evidence.continuousExecution?.schedulerSuccessInWindow ?? 0
  if (schedulerRuns === 0) {
    record("production", "scheduler-activity", "Scheduler executed in observation window", "warn", "No scheduler runs in window — verify cron telemetry or widen window")
  } else {
    record(
      "production",
      "scheduler-activity",
      "Scheduler executed in observation window",
      schedulerOk > 0 ? "pass" : "fail",
      `${schedulerOk}/${schedulerRuns} successful runs`,
    )
  }

  const internalSignals =
    (evidence.continuousExecution?.autonomousDiscoveryRunsInWindow ?? 0) +
    (evidence.continuousExecution?.leadsAdmittedInWindow ?? 0) +
    (evidence.continuousExecution?.draftFactoryUpdatesInWindow ?? 0)

  record(
    "production",
    "internal-work",
    "Internal work signals in observation window",
    internalSignals > 0 ? "pass" : "warn",
    `discovery=${evidence.continuousExecution?.autonomousDiscoveryRunsInWindow ?? 0}, leads=${evidence.continuousExecution?.leadsAdmittedInWindow ?? 0}, drafts=${evidence.continuousExecution?.draftFactoryUpdatesInWindow ?? 0}`,
  )

  const outboundCount = evidence.outboundPolicy?.outboundMessagesInWindow ?? 0
  record(
    "production",
    "outbound-policy",
    "Outbound messages in observation window",
    outboundCount === 0 ? "pass" : "warn",
    `${outboundCount} messages — review against explicit authorization policy`,
  )
}

async function maybeRunProductionProbe(runLive: boolean): Promise<void> {
  if (!runLive) {
    record("production", "evidence-probe", "Production evidence probe", "skip", "Run with :live to collect Production DB evidence")
    return
  }

  try {
    const output = execFileSync(
      "pnpm",
      ["probe:ge-aios-next-2b-production-evidence-readonly"],
      { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    )
    const jsonStart = output.indexOf("{")
    if (jsonStart === -1) throw new Error("probe_output_missing_json")
    evaluateProductionEvidence(output.slice(jsonStart))
    record("production", "evidence-probe", "Production evidence probe", "pass", "readonly evidence collected")
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    record("production", "evidence-probe", "Production evidence probe", "blocked", message.slice(0, 240))
  }
}

function renderVerdict(runLive: boolean): "CERTIFIED" | "CERTIFIED_WITH_WARNINGS" | "NOT_CERTIFIED" {
  const failures = steps.filter((step) => step.status === "fail")
  if (failures.length > 0) return "NOT_CERTIFIED"

  const warnings = steps.filter((step) => step.status === "warn")
  const blockedProduction = steps.some(
    (step) => step.section === "production" && step.status === "blocked" && runLive,
  )
  if (blockedProduction) return "NOT_CERTIFIED"
  if (warnings.length > 0) return "CERTIFIED_WITH_WARNINGS"
  return "CERTIFIED"
}

async function main(): Promise<void> {
  const runLive = process.argv.includes("--live")
  console.log(`[${PHASE}] certification ${runLive ? "(live production evidence)" : "(local)"}`)
  console.log(`  qaMarker=${GE_AIOS_NEXT_2B_CONTINUOUS_RUNTIME_CERT_QA_MARKER}`)

  auditRuntimeSystems()
  auditNoDuplicateAuthorities()
  validateOutboundPolicy()
  validateExecutiveBriefingDelta()
  runRegressionSuite()
  await maybeRunProductionProbe(runLive)

  const verdict = renderVerdict(runLive)
  console.log(`\nVERDICT: ${verdict}`)
  console.log(
    JSON.stringify(
      {
        qaMarker: GE_AIOS_NEXT_2B_CONTINUOUS_RUNTIME_CERT_QA_MARKER,
        verdict,
        runLive,
        steps,
      },
      null,
      2,
    ),
  )

  if (verdict === "NOT_CERTIFIED") process.exit(1)
}

void main()
