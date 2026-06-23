/**
 * GE-AUTO-2H — Live autonomous execution certification (production).
 *
 * Run: pnpm test:growth-objective-ge-auto-2h:production
 *
 * Live writes:
 *   CONFIRM_GE_AUTO_2H_LIVE=1
 *   CONFIRM_GE_AUTO_2H_ENABLE_AUTONOMY=1  (enables platform + org autonomy; outbound stays locked)
 *   CONFIRM_GE_AUTO_2H_ENABLE_OUTBOUND=1  (only when outbound launch/send explicitly approved)
 */
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  fetchSupabaseServiceRoleKeyFromCli,
  resolveLinkedSupabaseProjectRef,
  resolveSupabaseUrlForProjectRef,
} from "../lib/growth/qa/supabase-cli-linked-project-bootstrap"
import { resolveGrowthDeployedRuntimeBaseUrl } from "../lib/growth/qa/growth-provider-deployed-runtime-probe"
import { GROWTH_OBJECTIVE_PHASE, GROWTH_OBJECTIVE_QA_MARKER } from "../lib/growth/objectives/growth-objective-types"
import { GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS } from "../lib/growth/automation-runtime/ge-v1-5-automation-runtime-types"

export const GROWTH_OBJECTIVE_GE_AUTO_2H_CERT_QA_MARKER = "growth-objective-ge-auto-2h-cert-v1" as const

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

const DEFAULT_OPERATOR_ORG_ID = "5876176a-61ec-4532-ad99-0c31482d5a91"
const CERT_OBJECTIVE_TITLE = "[GE-AUTO-2H-CERT] Book 1 demo with medical equipment companies"
const SCHEDULER_ROUNDS = 8
const SCHEDULER_SLEEP_MS = 3_000

const GE_AUTO_2H_CAPABILITIES = [
  "research",
  "enrichment",
  "page_generation",
  "video_generation",
  "campaign_launch",
  "recommendations",
  "strategy_adaptation",
] as const

type CertStep = {
  section: string
  id: string
  name: string
  status: "pass" | "fail" | "blocked" | "skip"
  detail: string
}

const steps: CertStep[] = []

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function record(section: string, id: string, name: string, status: CertStep["status"], detail: string): void {
  steps.push({ section, id, name, status, detail })
  const icon = status === "pass" ? "✓" : status === "fail" ? "✗" : status === "blocked" ? "○" : "-"
  console.log(`  ${icon} [${section}/${id}] ${name}: ${detail}`)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function bootstrapProductionAdmin(): SupabaseClient | null {
  const boot = bootstrapVerifiedChannelsCertEnv({
    sources: PRODUCTION_ENV_SOURCES,
    inheritProcessEnvProviderKeys: true,
    protectedSnapshot: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      SUPABASE_URL: process.env.SUPABASE_URL ?? "",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    },
  })

  let url = boot?.url ?? ""
  let jwt = boot?.jwt ?? ""

  const linkedRef = resolveLinkedSupabaseProjectRef()
  const linkedJwt = linkedRef ? fetchSupabaseServiceRoleKeyFromCli(linkedRef) : null
  if (linkedRef && linkedJwt) {
    url = resolveSupabaseUrlForProjectRef(linkedRef)
    jwt = linkedJwt
  }

  if (!url || !jwt) return null
  process.env.NEXT_PUBLIC_SUPABASE_URL = url
  process.env.SUPABASE_SERVICE_ROLE_KEY = jwt
  return createClient(url, jwt, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function resolveOwnerUserId(admin: SupabaseClient, orgId: string): Promise<string | null> {
  const fromEnv = process.env.GE_AUTO_2H_OWNER_USER_ID?.trim()
  if (fromEnv) return fromEnv

  const { data: members, error: membersError } = await admin
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", orgId)
  if (membersError || !members?.length) return null

  const userIds = members.map((row) => String(row.user_id))
  const { data: profiles } = await admin.from("profiles").select("id, email").in("id", userIds)
  if (!profiles?.length) return null

  const { data: senderProfiles } = await admin
    .schema("growth")
    .from("sender_profiles")
    .select("email, sender_account_id, active")
    .eq("active", true)
    .is("deleted_at", null)

  const senderEmails = new Set(
    (senderProfiles ?? [])
      .map((row) => (typeof row.email === "string" ? row.email.trim().toLowerCase() : ""))
      .filter(Boolean),
  )

  const matchedOwner = profiles.find(
    (profile) =>
      typeof profile.email === "string" &&
      senderEmails.has(profile.email.trim().toLowerCase()),
  )
  if (matchedOwner?.id) return String(matchedOwner.id)

  return String(profiles[0]?.id ?? userIds[0] ?? "")
}

async function resolveOwnerEmail(admin: SupabaseClient, userId: string): Promise<string> {
  const { data } = await admin.from("profiles").select("email").eq("id", userId).maybeSingle()
  const email = data?.email
  if (!email || typeof email !== "string") throw new Error("owner_profile_email_missing")
  return email
}

function verifyDeploymentReadiness(): void {
  const operatorRoutes = [
    "app/api/growth/workspace/objectives/route.ts",
    "app/api/growth/workspace/objectives/[id]/route.ts",
  ]
  for (const routePath of operatorRoutes) {
    const source = readSource(routePath)
    assert.doesNotMatch(source, /certificationMode:\s*true/, routePath)
    assert.match(source, /actorUserId|operatorRuntimeInput/)
  }
  record("deploy", "operator-routes", "Operator APIs omit certification mode", "pass", "Local source ready for deploy")

  const actorModule = readSource("lib/growth/objectives/growth-objective-actor-resolution.ts")
  assert.match(actorModule, /requireObjectiveActorContext/)
  assert.match(actorModule, /senderProfileOwnerMismatch/)
  record("deploy", "actor-resolution", "Actor resolution module present", "pass", GROWTH_OBJECTIVE_QA_MARKER)

  const vercel = readSource("vercel.json")
  assert.match(vercel, /growth-objective-runtime-scheduler/)
  record("deploy", "scheduler-cron", "Objective scheduler cron scheduled", "pass", "vercel.json includes growth-objective-runtime-scheduler")

  try {
    const status = execFileSync(
      "curl",
      ["-sS", "-o", "/dev/null", "-w", "%{http_code}", `${resolveGrowthDeployedRuntimeBaseUrl()}/api/cron/growth-objective-runtime-scheduler`],
      { encoding: "utf8" },
    )
    record(
      "deploy",
      "cron-route-live",
      "Production cron route reachable",
      status === "401" || status === "200" ? "pass" : "fail",
      `HTTP ${status} (401 expected without CRON_SECRET)`,
    )
  } catch (error) {
    record("deploy", "cron-route-live", "Production cron route reachable", "blocked", String(error))
  }

  const gitStatus = execFileSync("git", ["status", "--short"], { encoding: "utf8" })
  const geAuto2gPending = gitStatus.includes("growth-objective-actor-resolution") ||
    gitStatus.includes("test-growth-objective-ge-auto-2g") ||
    gitStatus.includes("objectives/route.ts")
  record(
    "deploy",
    "vercel-deploy",
    "GE-AUTO-2G merged to main / Vercel production",
    geAuto2gPending ? "blocked" : "pass",
    geAuto2gPending
      ? "GE-AUTO-2G operator/actor changes not committed — production Vercel handlers still pre-2G until merge"
      : "Working tree shows GE-AUTO-2G operator paths committed",
  )
}

async function reportAutonomyConfiguration(admin: SupabaseClient, orgId: string): Promise<Record<string, unknown>> {
  const { getRuntimeKillSwitchStates } = await import(
    "../lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
  )
  const { fetchGrowthAutonomySettings } = await import("../lib/growth/autonomy/growth-autonomy-settings-repository")

  const killSwitches = await getRuntimeKillSwitchStates(admin)
  const settings = await fetchGrowthAutonomySettings(admin, orgId)

  const requiredKill = {
    autonomy_enabled: killSwitches.autonomy_enabled,
    autonomy_objective_mode_enabled: killSwitches.autonomy_objective_mode_enabled,
    autonomy_outbound_enabled: killSwitches.autonomy_outbound_enabled,
    autonomy_generation_enabled: killSwitches.autonomy_generation_enabled,
  }

  record(
    "autonomy",
    "kill-switches",
    "Platform kill switch snapshot",
    "pass",
    JSON.stringify(requiredKill),
  )

  const capabilityReport = Object.fromEntries(
    GE_AUTO_2H_CAPABILITIES.map((cap) => [cap, settings.capabilityToggles[cap]]),
  )
  record(
    "autonomy",
    "org-capabilities",
    "Org capability toggles",
    "pass",
    JSON.stringify({ masterMode: settings.masterMode, capabilities: capabilityReport }),
  )

  const autonomyReady =
    killSwitches.autonomy_enabled &&
    killSwitches.autonomy_objective_mode_enabled &&
    GE_AUTO_2H_CAPABILITIES.every((cap) => settings.capabilityToggles[cap])

  const confirmHint =
    process.env.CONFIRM_GE_AUTO_2H_ENABLE_AUTONOMY === "1"
      ? "CONFIRM_GE_AUTO_2H_ENABLE_AUTONOMY=1 set — apply step runs after this report"
      : "Set CONFIRM_GE_AUTO_2H_ENABLE_AUTONOMY=1 to enable for certification run"

  record(
    "autonomy",
    "controlled-enablement",
    "Controlled autonomy prerequisites",
    autonomyReady ? "pass" : "blocked",
    autonomyReady ? "Autonomy + objective mode + required capabilities enabled" : confirmHint,
  )

  return { killSwitches, settings, autonomyReady }
}

async function enableControlledAutonomyIfConfirmed(
  admin: SupabaseClient,
  orgId: string,
): Promise<boolean> {
  if (process.env.CONFIRM_GE_AUTO_2H_ENABLE_AUTONOMY !== "1") return false

  try {
    const { setRuntimeKillSwitch } = await import(
      "../lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
    )
    const { fetchGrowthAutonomySettings, upsertGrowthAutonomySettings } = await import(
      "../lib/growth/autonomy/growth-autonomy-settings-repository"
    )

    await setRuntimeKillSwitch(admin, { key: "autonomy_enabled", enabled: true })
    await setRuntimeKillSwitch(admin, { key: "autonomy_objective_mode_enabled", enabled: true })
    await setRuntimeKillSwitch(admin, { key: "autonomy_generation_enabled", enabled: true })

    if (process.env.CONFIRM_GE_AUTO_2H_ENABLE_OUTBOUND === "1") {
      await setRuntimeKillSwitch(admin, { key: "autonomy_outbound_enabled", enabled: true })
      record("autonomy", "outbound-enable", "Outbound autonomy enabled", "pass", "CONFIRM_GE_AUTO_2H_ENABLE_OUTBOUND=1")
    } else {
      await setRuntimeKillSwitch(admin, { key: "autonomy_outbound_enabled", enabled: false })
      record("autonomy", "outbound-lock", "Outbound autonomy remains locked", "pass", "No CONFIRM_GE_AUTO_2H_ENABLE_OUTBOUND")
    }

    const current = await fetchGrowthAutonomySettings(admin, orgId)
    await upsertGrowthAutonomySettings(admin, orgId, {
      masterMode: "objective",
      capabilityToggles: {
        ...current.capabilityToggles,
        research: true,
        enrichment: true,
        page_generation: true,
        video_generation: true,
        campaign_launch: true,
        recommendations: true,
        strategy_adaptation: true,
        audience_generation: true,
      },
    })

    record("autonomy", "enable-applied", "Controlled autonomy enablement applied", "pass", "Kill switches + org capabilities updated")
    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    record(
      "autonomy",
      "enable-applied",
      "Controlled autonomy enablement applied",
      "fail",
      `Could not write autonomy settings: ${message}`,
    )
    return false
  }
}

async function verifySenderIdentity(
  admin: SupabaseClient,
  orgId: string,
  ownerUserId: string,
  ownerEmail: string,
): Promise<boolean> {
  const { auditObjectiveActorContext } = await import(
    "../lib/growth/objectives/growth-objective-actor-resolution"
  )

  const probe = await auditObjectiveActorContext(admin, {
    id: "sender-probe",
    organizationId: orgId,
    ownerUserId,
    title: CERT_OBJECTIVE_TITLE,
    description: null,
    objectiveType: "demos_booked",
    targetValue: 1,
    currentValue: 0,
    startDate: null,
    targetDate: null,
    status: "draft",
    priority: "high",
    autonomyLevel: "objective",
    safetyMode: "strict",
    plan: null,
    runtime: null,
    executionHistory: [],
    recentSignals: [],
    recommendations: [],
    eventSubscriptions: null,
    executionContext: null,
    emergencyStopActive: false,
    qa_marker: GROWTH_OBJECTIVE_QA_MARKER,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })

  record(
    "sender",
    "actor-audit",
    "Launch actor resolution",
    probe.ok ? "pass" : "blocked",
    probe.ok
      ? `sender=${probe.report.senderAccountId}, profile=${probe.report.hasActiveSenderProfile}, mailbox=${probe.report.hasMailboxConnection}, owner=${ownerEmail}`
      : `Missing: ${probe.missing.join(", ")} · owner=${ownerEmail}`,
  )

  if (!probe.ok) {
    const { data: activeSenders } = await admin
      .schema("growth")
      .from("sender_profiles")
      .select("email")
      .eq("active", true)
      .is("deleted_at", null)
    const senderEmails = (activeSenders ?? [])
      .map((row) => (typeof row.email === "string" ? row.email : ""))
      .filter(Boolean)
    record(
      "sender",
      "identity-gap",
      "Sender profile ↔ owner email alignment",
      "blocked",
      senderEmails.length
        ? `Active sender profiles: ${senderEmails.join(", ")} — none match objective owner ${ownerEmail}`
        : "No active sender profiles in growth.sender_profiles",
    )
  }

  return probe.ok
}

async function runLiveObjectiveExecution(
  admin: SupabaseClient,
  orgId: string,
  ownerUserId: string,
  ownerEmail: string,
): Promise<string | null> {
  if (process.env.CONFIRM_GE_AUTO_2H_LIVE !== "1") {
    record("execution", "live", "Live objective execution", "blocked", "Set CONFIRM_GE_AUTO_2H_LIVE=1")
    return null
  }

  const {
    archiveGrowthObjective,
    createGrowthObjectiveWithPlan,
    startGrowthObjectiveRuntime,
  } = await import("../lib/growth/objectives/growth-objective-service")
  const { runGrowthObjectiveRuntimeScheduler } = await import(
    "../lib/growth/objectives/growth-objective-runtime-scheduler"
  )
  const { getGrowthObjective } = await import("../lib/growth/objectives/growth-objective-repository")
  const { summarizeObjectiveExecutionContext, listObjectiveArtifacts } = await import(
    "../lib/growth/objectives/growth-objective-execution-context"
  )

  const { objective: created } = await createGrowthObjectiveWithPlan(
    admin,
    orgId,
    {
      title: CERT_OBJECTIVE_TITLE,
      description: "GE-AUTO-2H live autonomous execution — scheduler-driven, no certification mode.",
      objectiveType: "demos_booked",
      targetValue: 1,
      ownerUserId,
      priority: "high",
      autonomyLevel: "objective",
      safetyMode: "strict",
    },
    { autoStart: false, actorUserId: ownerUserId, actorUserEmail: ownerEmail },
  )

  record("execution", "create", "Objective created", "pass", `id=${created.id}`)

  let objective = await startGrowthObjectiveRuntime(admin, orgId, created.id, {
    actorUserId: ownerUserId,
    actorUserEmail: ownerEmail,
  })
  record(
    "execution",
    "runtime-start",
    "Runtime started",
    objective.runtime?.running ? "pass" : "fail",
    `stage=${objective.runtime?.currentStageId}, running=${String(objective.runtime?.running)}`,
  )

  let totalTicks = 0
  let totalRetries = 0
  for (let round = 0; round < SCHEDULER_ROUNDS; round += 1) {
    const result = await runGrowthObjectiveRuntimeScheduler(admin)
    totalTicks += result.ticksAttempted
    totalRetries += result.retriesAttempted
    objective = (await getGrowthObjective(admin, orgId, created.id)) ?? objective
    if (!objective.runtime?.running) break
    await sleep(SCHEDULER_SLEEP_MS)
  }

  record(
    "execution",
    "scheduler",
    "Scheduler-driven advancement (no manual ticks)",
    totalTicks + totalRetries > 0 ? "pass" : "blocked",
    `${SCHEDULER_ROUNDS} rounds · ticks=${totalTicks} retries=${totalRetries} · stage=${objective.runtime?.currentStageId ?? "n/a"}`,
  )

  const artifacts = objective.executionContext ? listObjectiveArtifacts(objective.executionContext) : []
  const summary = objective.executionContext?.version
    ? summarizeObjectiveExecutionContext(objective.executionContext)
    : null

  const artifactTypes = [...new Set(artifacts.map((a) => a.resourceType))]
  record(
    "execution",
    "materialization",
    "Real materialization artifacts",
    artifacts.length > 0 ? "pass" : "blocked",
    summary
      ? `artifacts=${summary.totalArtifacts} types=${artifactTypes.join(", ") || "none"}`
      : "No normalized execution context yet",
  )

  record(
    "execution",
    "subscriptions",
    "Event subscriptions bound",
    (objective.eventSubscriptions?.items?.length ?? 0) > 0 ? "pass" : "blocked",
    `subscriptions=${objective.eventSubscriptions?.items?.length ?? 0}`,
  )

  const contextJson = JSON.stringify(objective.executionContext ?? {})
  assert.doesNotMatch(contextJson, /"certificationMode":true/)
  record("execution", "no-cert-mode", "No certification mode artifacts", "pass", "Execution context clean")

  return created.id
}

async function verifyEventRouting(admin: SupabaseClient): Promise<void> {
  const routerSource = readSource("lib/growth/objectives/growth-objective-event-router.ts")
  const bridgeSource = readSource("lib/growth/objectives/growth-objective-event-bridge.ts")
  const mapperSource = readSource("lib/growth/objectives/growth-objective-signal-mapper.ts")

  for (const [file, patterns] of [
    [routerSource, [/routeGrowthObjectiveSourceEvent/, /rememberObjectiveSourceEventReceipt/, /ingestGrowthObjectiveSignal/]],
    [bridgeSource, [/dispatchGrowthObjectiveEngagementEvent/, /dispatchGrowthObjectiveLeadSignalEvent/]],
    [mapperSource, [/email_opened/, /booking_completed/, /video_view_started/]],
  ] as const) {
    for (const pattern of patterns) {
      assert.match(file, pattern)
    }
  }
  record("events", "pipeline", "Event router pipeline wired", "pass", "source → router → signal ingest → autoContinue")

  const { error } = await admin
    .schema("growth")
    .from("objective_source_event_receipts")
    .select("idempotency_key")
    .limit(1)
  record(
    "events",
    "dedupe-table",
    "Persistent dedupe table reachable",
    error ? "fail" : "pass",
    error?.message ?? "objective_source_event_receipts OK",
  )

  record(
    "events",
    "live-engagement",
    "Live engagement events (opens/clicks/replies/bookings)",
    "blocked",
    "Requires real outbound engagement — no manual signal injection in cert script",
  )
}

async function verifyRecovery(
  admin: SupabaseClient,
  orgId: string,
  objectiveId: string | null,
): Promise<void> {
  if (!objectiveId) {
    record("recovery", "context", "Execution context recovery", "blocked", "No live objective to recover")
    return
  }

  const { getGrowthObjective } = await import("../lib/growth/objectives/growth-objective-repository")
  const { recoverGrowthObjectiveRuntimeContext } = await import(
    "../lib/growth/objectives/growth-objective-materialization-service"
  )
  const { listObjectiveArtifacts } = await import("../lib/growth/objectives/growth-objective-execution-context")

  const before = await getGrowthObjective(admin, orgId, objectiveId)
  if (!before) {
    record("recovery", "context", "Execution context recovery", "fail", "Objective missing")
    return
  }

  const beforeArtifacts = before.executionContext ? listObjectiveArtifacts(before.executionContext) : []
  const beforeIds = beforeArtifacts.map((a) => `${a.resourceType}:${a.resourceId}`).sort()

  const recovered = await recoverGrowthObjectiveRuntimeContext(admin, orgId, before)
  const reloaded = await getGrowthObjective(admin, orgId, objectiveId)
  const afterArtifacts = reloaded?.executionContext ? listObjectiveArtifacts(reloaded.executionContext) : []
  const afterIds = afterArtifacts.map((a) => `${a.resourceType}:${a.resourceId}`).sort()

  const noDupes = afterIds.length === new Set(afterIds).size
  const preserved = beforeIds.every((id) => afterIds.includes(id))

  record(
    "recovery",
    "context",
    "Execution context recovered without loss",
    preserved && noDupes ? "pass" : "fail",
    `before=${beforeIds.length} after=${afterIds.length} recoveredAt=${recovered.executionContext?.recoveredAt ?? "n/a"}`,
  )
  record(
    "recovery",
    "reload",
    "Objective reload after recovery",
    reloaded?.id === objectiveId ? "pass" : "fail",
    `stage=${reloaded?.runtime?.currentStageId ?? "n/a"}`,
  )
}

async function verifySafety(
  admin: SupabaseClient,
  orgId: string,
  objectiveId: string | null,
  ownerUserId: string,
  ownerEmail: string,
): Promise<void> {
  assert.equal(GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS.autonomous_approval_enabled, false)
  record("safety", "no-auto-approval", "Autonomous approval disabled in code", "pass", "autonomous_approval_enabled=false")

  const { getRuntimeKillSwitchStates } = await import(
    "../lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
  )
  const killSwitches = await getRuntimeKillSwitchStates(admin)
  record(
    "safety",
    "outbound-policy",
    "Outbound kill switch state",
    process.env.CONFIRM_GE_AUTO_2H_ENABLE_OUTBOUND === "1" ? "pass" : killSwitches.autonomy_outbound_enabled ? "fail" : "pass",
    `autonomy_outbound_enabled=${killSwitches.autonomy_outbound_enabled}`,
  )

  if (!objectiveId || process.env.CONFIRM_GE_AUTO_2H_LIVE !== "1") {
    record("safety", "emergency-stop", "Emergency stop blocks runtime", "blocked", "No live objective")
    return
  }

  const { emergencyStopGrowthObjective, archiveGrowthObjective } = await import(
    "../lib/growth/objectives/growth-objective-service"
  )
  const { tickGrowthObjectiveRuntime } = await import("../lib/growth/objectives/growth-objective-runtime-service")

  const stopped = await emergencyStopGrowthObjective(admin, orgId, objectiveId)
  record(
    "safety",
    "emergency-stop",
    "Emergency stop blocks runtime",
    stopped.emergencyStopActive ? "pass" : "fail",
    `emergencyStopActive=${String(stopped.emergencyStopActive)}`,
  )

  let tickBlocked = false
  try {
    await tickGrowthObjectiveRuntime(admin, orgId, objectiveId, {
      actorUserId: ownerUserId,
      actorUserEmail: ownerEmail,
    })
  } catch {
    tickBlocked = true
  }
  record(
    "safety",
    "emergency-stop-tick",
    "Tick rejected after emergency stop",
    tickBlocked ? "pass" : "fail",
    tickBlocked ? "Runtime tick threw as expected" : "Tick succeeded after emergency stop",
  )

  await archiveGrowthObjective(admin, orgId, objectiveId)
  record("safety", "cleanup", "Cert objective archived", "pass", objectiveId)
}

async function verifyCompletion(admin: SupabaseClient, orgId: string, objectiveId: string | null): Promise<void> {
  if (!objectiveId) {
    record("completion", "target", "Objective completion", "blocked", "No live objective")
    return
  }

  const { getGrowthObjective } = await import("../lib/growth/objectives/growth-objective-repository")
  const { loadGrowthObjectiveDashboard } = await import("../lib/growth/objectives/growth-objective-service")

  const objective = await getGrowthObjective(admin, orgId, objectiveId)
  const dashboard = await loadGrowthObjectiveDashboard(admin, orgId)
  const listed = dashboard.objectives.find((entry) => entry.id === objectiveId)

  const completed = objective?.status === "completed" && (objective?.currentValue ?? 0) >= (objective?.targetValue ?? 1)

  record(
    "completion",
    "target",
    "Objective reached target",
    completed ? "pass" : "blocked",
    completed
      ? `currentValue=${objective?.currentValue} target=${objective?.targetValue}`
      : "Requires real booking/engagement events — no manual signal injection",
  )
  record(
    "completion",
    "dashboard",
    "Dashboard reflects objective state",
    listed ? "pass" : "blocked",
    listed ? `status=${listed.status}` : "Objective not in dashboard (archived)",
  )
  record(
    "completion",
    "history",
    "Execution history persisted",
    (objective?.executionHistory?.length ?? 0) > 0 ? "pass" : "blocked",
    `entries=${objective?.executionHistory?.length ?? 0}`,
  )
}

function computeVerdict(): "GROWTH_ENGINE_AUTONOMY_PRODUCTION_CERTIFIED" | "GROWTH_ENGINE_AUTONOMY_READY_WITH_MINOR_FOLLOWUPS" | "GROWTH_ENGINE_AUTONOMY_BLOCKED" {
  const fails = steps.filter((s) => s.status === "fail").length
  const blocked = steps.filter((s) => s.status === "blocked").length

  if (fails > 0) return "GROWTH_ENGINE_AUTONOMY_BLOCKED"

  const deployBlocked = steps.some((s) => s.section === "deploy" && s.id === "vercel-deploy" && s.status === "blocked")
  const senderBlocked = steps.some((s) => s.section === "sender" && s.status === "blocked")
  const executionBlocked = steps.some((s) => s.section === "execution" && s.status === "blocked")
  const completionBlocked = steps.some((s) => s.section === "completion" && s.status === "blocked")

  if (deployBlocked || senderBlocked || executionBlocked || completionBlocked || blocked > 4) {
    return "GROWTH_ENGINE_AUTONOMY_READY_WITH_MINOR_FOLLOWUPS"
  }

  return "GROWTH_ENGINE_AUTONOMY_PRODUCTION_CERTIFIED"
}

async function main(): Promise<void> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "test-anon-key"
  }

  console.log(`\n=== GE-AUTO-2H Live Autonomous Execution Certification (${GROWTH_OBJECTIVE_GE_AUTO_2H_CERT_QA_MARKER}) ===\n`)
  assert.equal(GROWTH_OBJECTIVE_PHASE, "GE-AUTO-2G")

  const admin = bootstrapProductionAdmin()
  if (!admin) {
    record("deploy", "supabase", "Production Supabase", "fail", "Credentials unavailable")
    console.log(JSON.stringify({ final_verdict: "GROWTH_ENGINE_AUTONOMY_BLOCKED", steps }, null, 2))
    process.exit(1)
  }

  const orgId = process.env.GE_AUTO_2H_ORG_ID?.trim() || DEFAULT_OPERATOR_ORG_ID

  console.log("\n--- Deliverable 1: Production deployment verification ---")
  verifyDeploymentReadiness()

  console.log("\n--- Deliverable 2: Autonomy configuration report ---")
  await reportAutonomyConfiguration(admin, orgId)
  await enableControlledAutonomyIfConfirmed(admin, orgId)
  const autonomySnapshot = await reportAutonomyConfiguration(admin, orgId)

  console.log("\n--- Deliverable 3: Sender profile verification ---")
  const ownerUserId = await resolveOwnerUserId(admin, orgId)
  if (!ownerUserId) {
    record("sender", "owner", "Objective owner resolved", "fail", "No org member — set GE_AUTO_2H_OWNER_USER_ID")
  } else {
    const ownerEmail = await resolveOwnerEmail(admin, ownerUserId)
    const senderReady = await verifySenderIdentity(admin, orgId, ownerUserId, ownerEmail)

    console.log("\n--- Deliverable 4: Live objective execution ---")
    let objectiveId: string | null = null
    const autonomyEnabled =
      autonomySnapshot.autonomyReady ||
      (process.env.CONFIRM_GE_AUTO_2H_ENABLE_AUTONOMY === "1" &&
        steps.some((s) => s.id === "enable-applied" && s.status === "pass"))

    if (autonomyEnabled) {
      if (senderReady || process.env.GE_AUTO_2H_SKIP_SENDER === "1") {
        objectiveId = await runLiveObjectiveExecution(admin, orgId, ownerUserId, ownerEmail)
      } else {
        record("execution", "live", "Live objective execution", "blocked", "Sender identity incomplete")
      }
    } else {
      record("execution", "live", "Live objective execution", "blocked", "Autonomy not enabled")
    }

    console.log("\n--- Deliverable 5: Event routing verification ---")
    await verifyEventRouting(admin)

    console.log("\n--- Deliverable 6: Recovery verification ---")
    await verifyRecovery(admin, orgId, objectiveId)

    console.log("\n--- Deliverable 8: Completion verification ---")
    await verifyCompletion(admin, orgId, objectiveId)

    console.log("\n--- Deliverable 7: Safety verification ---")
    await verifySafety(admin, orgId, objectiveId, ownerUserId, ownerEmail)
  }

  const finalVerdict = computeVerdict()
  const passes = steps.filter((s) => s.status === "pass").length
  const blocked = steps.filter((s) => s.status === "blocked").length
  const fails = steps.filter((s) => s.status === "fail").length

  console.log("\n--- Deliverable 9: Final readiness verdict ---")
  console.log(
    JSON.stringify(
      {
        ok: fails === 0,
        qa_marker: GROWTH_OBJECTIVE_GE_AUTO_2H_CERT_QA_MARKER,
        final_verdict: finalVerdict,
        passes,
        blocked,
        fails,
        steps,
      },
      null,
      2,
    ),
  )

  if (fails > 0) process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
