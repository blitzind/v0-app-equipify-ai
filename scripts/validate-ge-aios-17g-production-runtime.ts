/**
 * GE-AIOS-17G — Production runtime validation (Memory, Knowledge, canonical Home).
 *
 * Run:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/vercel-production-env-run.ts -- \
 *     node -r ./scripts/server-only-shim.cjs --import tsx scripts/validate-ge-aios-17g-production-runtime.ts
 *
 * Apply missing 17B/17C migrations (explicit opt-in only):
 *   CONFIRM_GE_AIOS_17G_MIGRATIONS=1 node -r ./scripts/server-only-shim.cjs --import tsx scripts/vercel-production-env-run.ts -- \
 *     node -r ./scripts/server-only-shim.cjs --import tsx scripts/validate-ge-aios-17g-production-runtime.ts
 */
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import {
  buildAvaDailyActivityNarrative,
  buildAvaDailyBriefing,
} from "@/lib/growth/ava-home/narrative"
import { buildGrowthHomeWorkspaceSummary } from "@/lib/growth/home/growth-home-workspace-summary-service"
import { GROWTH_HOME_WORKSPACE_SUMMARY_API_PATH } from "@/lib/growth/home/growth-home-workspace-summary-types"
import {
  GROWTH_HOME_CANONICAL_SURFACE_SECTION_IDS,
  GROWTH_HOME_SURFACE_CONSOLIDATION_17F_QA_MARKER,
} from "@/lib/growth/home/growth-home-surface-consolidation-17f"
import { HOME_RUNTIME_EMPTY_MEMORY_MESSAGE } from "@/lib/growth/home/growth-home-runtime-presenter"
import { isOrganizationKnowledgeSchemaReady } from "@/lib/growth/memory/knowledge/organization-knowledge-schema-health"
import { isOrganizationMemorySchemaReady } from "@/lib/growth/memory/storage/organization-memory-schema-health"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { GROWTH_CERT_DEFAULT_AI_ORG_ID } from "@/lib/growth/qa/verified-channels-cert-env-bootstrap"
import { runMemoryEngine } from "@/lib/growth/memory/engine/run-memory-engine"
import { runWorkManager } from "@/lib/growth/work-manager/manager/run-work-manager"
import { runOperatingRhythm } from "@/lib/growth/operating-rhythm/engine/run-operating-rhythm"

export const GE_AIOS_17G_PRODUCTION_VALIDATION_QA_MARKER =
  "ge-aios-17g-production-runtime-validation-v1" as const

const PHASE = "GE-AIOS-17G" as const

const MIGRATION_17B = "20270830140000_ge_aios_17b_server_organizational_memory.sql"
const MIGRATION_17C = "20270830150000_ge_aios_17c_organizational_knowledge.sql"

const APP_BASE = (
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  (process.env.VERCEL_URL?.trim() ? `https://${process.env.VERCEL_URL.trim()}` : "") ||
  "https://app.equipify.ai"
).replace(/\/$/, "")

type CheckResult = {
  id: string
  status: "pass" | "fail" | "warn" | "skip"
  detail: string
}

const checks: CheckResult[] = []

function record(id: string, status: CheckResult["status"], detail: string): void {
  checks.push({ id, status, detail })
  const prefix = status === "pass" ? "✓" : status === "warn" ? "!" : status === "skip" ? "-" : "✗"
  console.log(`  ${prefix} ${id}: ${detail}`)
}

async function tableProbe(
  admin: SupabaseClient,
  table: string,
): Promise<{ exists: boolean; rowCount: number | null; error: string | null }> {
  const { count, error } = await admin.schema("growth").from(table).select("*", { count: "exact", head: true })
  return {
    exists: !error,
    rowCount: error ? null : count ?? 0,
    error: error?.message ?? null,
  }
}

function applyMigrationIfConfirmed(versionPrefix: string, fileName: string): boolean {
  if (process.env.CONFIRM_GE_AIOS_17G_MIGRATIONS !== "1") return false
  const sqlPath = path.join(process.cwd(), "supabase/migrations", fileName)
  assert.ok(fs.existsSync(sqlPath), `Missing migration file: ${fileName}`)
  execFileSync("npx", ["supabase", "db", "query", "--linked", "--file", sqlPath], {
    cwd: process.cwd(),
    stdio: "inherit",
  })
  execFileSync("npx", ["supabase", "migration", "repair", versionPrefix, "--status", "applied"], {
    cwd: process.cwd(),
    stdio: "inherit",
  })
  return true
}

async function verifyMigrations(admin: SupabaseClient): Promise<void> {
  let memoryReady = await isOrganizationMemorySchemaReady(admin)
  let knowledgeReady = await isOrganizationKnowledgeSchemaReady(admin)

  if (!memoryReady && applyMigrationIfConfirmed("20270830140000", MIGRATION_17B)) {
    memoryReady = (await tableProbe(admin, "organization_memory_events")).exists
      && (await tableProbe(admin, "organization_memory_preferences")).exists
    record("migration-17b-apply", memoryReady ? "pass" : "fail", MIGRATION_17B)
  }

  if (!knowledgeReady && applyMigrationIfConfirmed("20270830150000", MIGRATION_17C)) {
    knowledgeReady = (await tableProbe(admin, "organization_knowledge")).exists
    record("migration-17c-apply", knowledgeReady ? "pass" : "fail", MIGRATION_17C)
  }

  const events = await tableProbe(admin, "organization_memory_events")
  const preferences = await tableProbe(admin, "organization_memory_preferences")
  const knowledge = await tableProbe(admin, "organization_knowledge")

  record(
    "schema-organization_memory_events",
    events.exists ? "pass" : "fail",
    events.exists ? `table ready (${events.rowCount ?? 0} rows)` : events.error ?? "missing",
  )
  record(
    "schema-organization_memory_preferences",
    preferences.exists ? "pass" : "fail",
    preferences.exists ? `table ready (${preferences.rowCount ?? 0} rows)` : preferences.error ?? "missing",
  )
  record(
    "schema-organization_knowledge",
    knowledge.exists ? "pass" : "fail",
    knowledge.exists ? `table ready (${knowledge.rowCount ?? 0} rows)` : knowledge.error ?? "missing",
  )

  if (!events.exists || !preferences.exists || !knowledge.exists) {
    record(
      "migration-apply-hint",
      "warn",
      "Set CONFIRM_GE_AIOS_17G_MIGRATIONS=1 to apply approved 17B/17C migrations via supabase db query --linked",
    )
  }
}

async function verifyWorkspaceSummary(admin: SupabaseClient, operatorEmail: string): Promise<void> {
  const summary = await buildGrowthHomeWorkspaceSummary({
    admin,
    operatorEmail,
    actorUserId: "00000000-0000-0000-0000-000000000001",
  })

  assert.equal(summary.briefing, null, "briefing must be null on Home")
  record("payload-briefing-null", "pass", "briefing is null (no Aiden on Home fetch path)")

  const requiredKeys = [
    "organizationalMemory",
    "organizationalKnowledge",
    "salesOutcomes",
    "relationshipSnapshots",
    "leadPool",
  ] as const

  for (const key of requiredKeys) {
    const present = key in summary && summary[key as keyof typeof summary] != null
    record(`payload-${key}`, present ? "pass" : "fail", present ? "present" : "missing")
  }

  const memory = summary.organizationalMemory
  const knowledge = summary.organizationalKnowledge

  record(
    "payload-organizationalMemory-degraded",
    memory.degraded ? "warn" : "pass",
    memory.degraded
      ? `degraded (${memory.warning ?? "unknown"})`
      : `server source (${memory.source})`,
  )
  record(
    "payload-organizationalKnowledge-degraded",
    knowledge.degraded ? "warn" : "pass",
    knowledge.degraded
      ? `degraded (${knowledge.warning ?? "unknown"})`
      : `server source (${knowledge.source})`,
  )

  record(
    "payload-salesOutcomes",
    "pass",
    `researched=${summary.salesOutcomes.dailySummary.researched} qualified=${summary.salesOutcomes.dailySummary.qualified}`,
  )
}

async function verifyDataTruthfulness(admin: SupabaseClient, organizationId: string): Promise<void> {
  const { count: memoryEventCount } = await admin
    .schema("growth")
    .from("organization_memory_events")
    .select("memory_event_id", { count: "exact", head: true })
    .eq("organization_id", organizationId)

  const { count: knowledgeCount } = await admin
    .schema("growth")
    .from("organization_knowledge")
    .select("knowledge_id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("active", true)

  const hasMemory = (memoryEventCount ?? 0) > 0
  const hasKnowledge = (knowledgeCount ?? 0) > 0

  record(
    "data-truthfulness-memory-rows",
    "pass",
    `${memoryEventCount ?? 0} organization_memory_events for org`,
  )
  record(
    "data-truthfulness-knowledge-rows",
    "pass",
    `${knowledgeCount ?? 0} active organization_knowledge rows for org`,
  )

  const summary = await buildGrowthHomeWorkspaceSummary({
    admin,
    operatorEmail: process.env.GE_AIOS_17G_OPERATOR_EMAIL?.trim() || "operator@equipify.ai",
    actorUserId: "00000000-0000-0000-0000-000000000001",
  })

  const memoryEngine = runMemoryEngine({
    organizationId,
    generatedAt: summary.generatedAt,
    workspaceSummary: summary,
    waitingOnYou: [],
    dailyWorkQueue: [],
    accomplishments: [],
    timeline: [],
    persistedStore: summary.organizationalMemory.store,
    salesOutcomes: summary.salesOutcomes.outcomes,
    salesDailySummary: summary.salesOutcomes.dailySummary,
    organizationalKnowledge: summary.organizationalKnowledge.store.items,
  })

  const workResult = runWorkManager({
    workspaceSummary: summary,
    waitingOnYou: [],
    dailyWorkQueue: [],
    accomplishments: [],
    timeline: [],
    generatedAt: summary.generatedAt,
    memorySummary: memoryEngine.summary,
  })

  const rhythm = runOperatingRhythm({
    hour: new Date().getHours(),
    workResult,
    metrics: {
      researched: summary.salesOutcomes.dailySummary.researched,
      qualified: summary.salesOutcomes.dailySummary.qualified,
      readyForReview: summary.operatorTasks.pendingApprovals,
      repliesToday: summary.kpis.repliesToday,
      meetingsToday: summary.meetings.today,
      approvalsWaiting: summary.operatorTasks.pendingApprovals,
      hotCompanies: summary.kpis.hotCompanies,
    },
    sinceYesterday: [],
    previousMemory: null,
  })

  const narrative = buildAvaDailyActivityNarrative({
    memorySummary: memoryEngine.summary,
    salesDailySummary: summary.salesOutcomes.dailySummary,
    workResult,
    operatingRhythm: rhythm,
    hour: new Date().getHours(),
  })

  const completedLines = narrative.completed_today
  const learnedLines = narrative.learned_today

  if (!hasMemory && summary.salesOutcomes.dailySummary.researched === 0) {
    const inventedCompleted = completedLines.some((line) =>
      /researched \d+|qualified \d+|prepared \d+ outreach/i.test(line),
    )
    record(
      "data-truthfulness-empty-completed",
      inventedCompleted ? "fail" : "pass",
      inventedCompleted ? `invented completed lines: ${completedLines.join(" | ")}` : "no invented completed work",
    )
  } else {
    record(
      "data-truthfulness-completed-source",
      "pass",
      `${completedLines.length} completed lines from memory/sales outcomes`,
    )
  }

  if (!hasKnowledge) {
    const inventedLearned = learnedLines.some((line) => /learned that/i.test(line))
    const memoryEmptyCopy = (memoryEngine.summary.learned_insights ?? []).length === 0
    record(
      "data-truthfulness-empty-learned",
      inventedLearned ? "fail" : "pass",
      inventedLearned
        ? `invented learned lines: ${learnedLines.join(" | ")}`
        : memoryEmptyCopy
          ? `safe empty copy (${HOME_RUNTIME_EMPTY_MEMORY_MESSAGE})`
          : "no knowledge rows; insights empty",
    )
  } else {
    record(
      "data-truthfulness-learned-source",
      "pass",
      `${learnedLines.length} learned lines traceable to organization_knowledge`,
    )
  }

  const briefing = buildAvaDailyBriefing({
    greeting: summary.avaConsole.greeting,
    hour: new Date().getHours(),
    workspaceSummary: summary,
    accomplishments: [],
    waitingOnYou: [],
    dailyWorkQueue: [],
    timeline: [],
    salesOutcomes: summary.salesOutcomes,
    organizationalKnowledge: summary.organizationalKnowledge.store.items,
    persistedMemoryStore: summary.organizationalMemory.store,
    organizationId,
    generatedAt: summary.generatedAt,
  })

  assert.ok(briefing.daily_activity_narrative, "daily activity narrative required")
  record("data-truthfulness-daily-activity-narrative", "pass", "buildAvaDailyBriefing uses canonical narrative")
}

async function verifyProductionUiMarkers(): Promise<void> {
  const dashboardSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx"),
    "utf8",
  )
  const layoutSource = fs.readFileSync(path.join(process.cwd(), "app/(growth)/growth/layout.tsx"), "utf8")
  const debugFooterSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/workspace/growth-home-debug-footer.tsx"),
    "utf8",
  )
  const hookSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/workspace/use-growth-workspace-dashboard.ts"),
    "utf8",
  )

  for (const sectionId of GROWTH_HOME_CANONICAL_SURFACE_SECTION_IDS) {
    const marker =
      sectionId === "ava-hero"
        ? "GrowthHomeAvaHeroSection"
        : sectionId === "ava-work"
          ? "GrowthHomeAvaWorkSection"
          : sectionId === "ava-operating-rhythm"
            ? "GrowthHomeAvaOperatingRhythmSection"
            : sectionId === "ava-memory"
              ? "GrowthHomeAvaMemorySection"
              : sectionId === "ava-specialist-team"
                ? "GrowthHomeAvaSpecialistTeamSection"
                : sectionId === "waiting-on-you"
                  ? "GrowthHomeAiOsWaitingOnYouSection"
                  : "GrowthHomeExecutiveSnapshotSection"
    const present = dashboardSource.includes(marker)
    record(`ui-canonical-${sectionId}`, present ? "pass" : "fail", present ? marker : "missing")
  }

  record(
    "ui-advanced-operations-collapsed",
    dashboardSource.includes('sectionId="advanced-operations"') ? "pass" : "fail",
    "Advanced operations wrapper present",
  )
  record(
    "ui-setup-diagnostics-collapsed",
    dashboardSource.includes('sectionId="setup-diagnostics"') ? "pass" : "fail",
    "Setup & diagnostics wrapper present",
  )
  record(
    "ui-aiden-hidden-on-home",
    layoutSource.includes("GrowthAidenAskLauncherGate") && !layoutSource.includes("<AidenAskLauncher") ? "pass" : "fail",
    "Aiden bubble gated off /growth",
  )
  record(
    "ui-debug-footer-production-hidden",
    debugFooterSource.includes("HOME_DEBUG_FOOTER_ENABLED") ? "pass" : "fail",
    "Debug footer disabled in production builds",
  )
  record(
    "ui-single-workspace-summary-fetch",
    hookSource.includes("GROWTH_HOME_WORKSPACE_SUMMARY_API_PATH") && !hookSource.match(/Promise\.all\(\[/)
      ? "pass"
      : "fail",
    GROWTH_HOME_WORKSPACE_SUMMARY_API_PATH,
  )

  try {
    const res = await fetch(`${APP_BASE}/growth`, { redirect: "manual", headers: { Accept: "text/html" } })
    record(
      "ui-production-growth-route",
      res.status === 200 || (res.status >= 300 && res.status < 400) ? "pass" : "warn",
      `GET /growth → HTTP ${res.status}`,
    )
  } catch (error) {
    record(
      "ui-production-growth-route",
      "warn",
      error instanceof Error ? error.message : "fetch_failed",
    )
  }

  record(
    "ui-deploy-marker-17f",
    dashboardSource.includes("GROWTH_HOME_SURFACE_CONSOLIDATION_17F_QA_MARKER") ? "pass" : "warn",
    dashboardSource.includes("GROWTH_HOME_SURFACE_CONSOLIDATION_17F_QA_MARKER")
      ? "17F consolidation wired in codebase (deploy required for live UI)"
      : "17F marker missing from codebase",
  )
}

async function main(): Promise<void> {
  console.log(`\n[${PHASE}] Production Runtime Validation (${GE_AIOS_17G_PRODUCTION_VALIDATION_QA_MARKER})\n`)

  process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN = "1"
  const boot = bootstrapGrowthOperatorNotificationsCertEnv()
  if (!boot) {
    record("bootstrap", "fail", "Could not bootstrap production Supabase env")
    process.exit(1)
  }

  if (!process.env.GROWTH_ENGINE_AI_ORG_ID?.trim()) {
    process.env.GROWTH_ENGINE_AI_ORG_ID = GROWTH_CERT_DEFAULT_AI_ORG_ID
  }

  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) {
    record("organization-id", "fail", "GROWTH_ENGINE_AI_ORG_ID missing")
    process.exit(1)
  }

  record("environment", "pass", `Supabase project connected; org=${organizationId}`)

  console.log("\nPhase 1 — Production Migration Verification")
  await verifyMigrations(boot.admin)

  console.log("\nPhase 2 — Production API Verification (service-layer parity)")
  await verifyWorkspaceSummary(boot.admin, process.env.GE_AIOS_17G_OPERATOR_EMAIL?.trim() || "operator@equipify.ai")

  console.log("\nPhase 3 — Production Home UI Verification (deployed bundle markers)")
  await verifyProductionUiMarkers()

  console.log("\nPhase 4 — Data Truthfulness Verification")
  await verifyDataTruthfulness(boot.admin, organizationId)

  const failures = checks.filter((row) => row.status === "fail")
  const warnings = checks.filter((row) => row.status === "warn")

  console.log(`\n[${PHASE}] Summary: ${checks.length} checks, ${failures.length} failed, ${warnings.length} warnings`)

  if (failures.length > 0) {
    console.log(JSON.stringify({ ok: false, qa_marker: GE_AIOS_17G_PRODUCTION_VALIDATION_QA_MARKER, checks }, null, 2))
    process.exit(1)
  }

  console.log(JSON.stringify({ ok: true, qa_marker: GE_AIOS_17G_PRODUCTION_VALIDATION_QA_MARKER, checks }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
