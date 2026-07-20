/**
 * GE-AIOS-LIVE-3A — Production Home mission projection validation (read-only).
 *
 * Run:
 *   pnpm validate:ge-aios-live-3a-home-mission-projection-production
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { projectCanonicalOperatorProgress } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-progress-1a"
import { projectSupervisedSalesProgressNarrative } from "@/lib/growth/aios/operator-experience/growth-supervised-sales-progress-narrative-1b"
import { buildAvaDailyActivityNarrative } from "@/lib/growth/ava-home/narrative/engine/build-ava-daily-activity-narrative"
import { resolveHomeOperatorEmployeeStatusFromMission } from "@/lib/growth/mission-center/growth-autonomous-lead-discovery-18g"
import { loadGrowthHomeMissionDiscoverySnapshot } from "@/lib/growth/mission-center/growth-home-mission-discovery-loader"
import { buildGrowthHomeWorkspaceSummary } from "@/lib/growth/home/growth-home-workspace-summary-service"
import {
  findActiveProductionBootstrapMission,
  isProductionBootstrapMissionReady,
} from "@/lib/growth/mission-purpose/growth-autonomous-production-mission-bootstrap-2a"
import { readCanonicalObjectiveMissionPurpose } from "@/lib/growth/mission-purpose/growth-mission-purpose-canonical-1b"
import { listGrowthObjectives } from "@/lib/growth/objectives/growth-objective-repository"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import { GROWTH_CERT_DEFAULT_AI_ORG_ID } from "@/lib/growth/qa/verified-channels-cert-env-bootstrap"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { synthesizeGrowthHomeExecutiveBriefing } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-synthesizer"
import { buildAvaHomeHero } from "@/lib/growth/workspace/executive-briefing/growth-home-ava-hero-7a"
import { GROWTH_OPERATING_RHYTHM_QA_MARKER } from "@/lib/growth/operating-rhythm/types"
import { GROWTH_WORK_MANAGER_QA_MARKER } from "@/lib/growth/work-manager/types"

const PHASE = "GE-AIOS-LIVE-3A" as const

type ValidationGate = {
  id: string
  status: "pass" | "warn" | "fail"
  detail: string
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Production Home mission projection validation (read-only)`)

  const bootstrap = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!bootstrap) {
    console.error("Bootstrap failed — run via vercel-production-env-run.ts")
    process.exit(1)
  }

  if (!process.env.GROWTH_ENGINE_AI_ORG_ID?.trim()) {
    process.env.GROWTH_ENGINE_AI_ORG_ID = GROWTH_CERT_DEFAULT_AI_ORG_ID
  }

  const admin: SupabaseClient = bootstrap.admin
  const organizationId = getGrowthEngineAiOrgId() ?? EQUIPIFY_PRODUCTION_ORG_ID
  const gates: ValidationGate[] = []

  const [workspaceSummary, objectives, killSwitches, missionDiscoveryLoader] = await Promise.all([
    buildGrowthHomeWorkspaceSummary({
      admin,
      operatorEmail: bootstrap.operatorEmail,
      actorUserId: bootstrap.actorUserId,
    }),
    listGrowthObjectives(admin, organizationId),
    getRuntimeKillSwitchStates(admin),
    loadGrowthHomeMissionDiscoverySnapshot(admin, { organizationId }),
  ])

  const missionDiscovery = workspaceSummary.missionDiscovery ?? missionDiscoveryLoader
  const activeMission = findActiveProductionBootstrapMission(objectives)
  const bootstrapReady = Boolean(activeMission && isProductionBootstrapMissionReady(activeMission))
  const portfolioDeficit = workspaceSummary.portfolioManager?.health.needsCount ?? 0

  gates.push({
    id: "active_production_mission",
    status: activeMission ? "pass" : "fail",
    detail: `activeMission=${activeMission?.id ?? "none"}; bootstrapReady=${bootstrapReady}.`,
  })

  gates.push({
    id: "mission_purpose_production",
    status:
      activeMission && readCanonicalObjectiveMissionPurpose(activeMission.executionContext) === "production"
        ? "pass"
        : "fail",
    detail: `missionPurpose=${readCanonicalObjectiveMissionPurpose(activeMission?.executionContext ?? null) ?? "missing"}.`,
  })

  gates.push({
    id: "mission_discovery_projection_present",
    status: missionDiscovery?.missionId ? "pass" : "fail",
    detail: `missionDiscovery.missionId=${missionDiscovery?.missionId ?? "none"}; lifecycle=${missionDiscovery?.lifecycleState ?? "none"}.`,
  })

  const readyForOutreachReview = workspaceSummary.avaConsole?.researchLoopSummary?.readyForOutreachReview ?? 0
  const packageCount = workspaceSummary.canonicalOperatorApproval?.outreachPackageCount ?? 0

  const briefing = synthesizeGrowthHomeExecutiveBriefing({
    dashboard: workspaceSummary.dashboard,
    missionDiscovery,
    portfolioBelowTarget: portfolioDeficit > 0,
    portfolioTargetCurrent: workspaceSummary.portfolioManager?.health.counts.activeCompanies ?? null,
    portfolioTargetGoal: workspaceSummary.portfolioManager?.target.targetActiveCompanies ?? null,
    canonicalOperatorApproval: workspaceSummary.canonicalOperatorApproval,
    canonicalOperatorTask: workspaceSummary.canonicalOperatorTask,
    canonicalActiveMissions: workspaceSummary.canonicalActiveMissions,
    canonicalOperatorFocus: workspaceSummary.canonicalOperatorFocus,
  })

  const hero = buildAvaHomeHero({
    greeting: briefing.aiOsUx.hero.greeting,
    hour: new Date().getHours(),
    employeeStatus: briefing.employeeStatus,
    aiOsUx: briefing.aiOsUx,
    researchLoopSummary: workspaceSummary.avaConsole?.researchLoopSummary ?? null,
    accomplishments: briefing.accomplishments,
    repliesWaiting: 0,
    workspaceSummary: {
      kpis: workspaceSummary.kpis,
      meetings: workspaceSummary.meetings,
      inbox: workspaceSummary.inbox,
      operatorTasks: workspaceSummary.operatorTasks,
      avaConsole: workspaceSummary.avaConsole,
      dashboard: workspaceSummary.dashboard,
      relationshipSnapshots: workspaceSummary.relationshipSnapshots,
      leadPool: workspaceSummary.leadPool,
      missionDiscovery,
      portfolioLeads: workspaceSummary.portfolioLeads,
      eligibleLeadCount: workspaceSummary.eligibleLeadCount,
      businessObjectiveLeadership: workspaceSummary.businessObjectiveLeadership,
    },
    outboundDisabled: true,
  })

  const missionStatus = resolveHomeOperatorEmployeeStatusFromMission({
    missionDiscovery,
    pendingApprovalCount: workspaceSummary.canonicalOperatorApproval?.pendingApprovalCount ?? 0,
    readyForOutreachReview: Math.max(readyForOutreachReview, packageCount),
    portfolioBelowTarget: portfolioDeficit > 0,
  })

  const supervised = projectSupervisedSalesProgressNarrative({
    approvalSnapshot: workspaceSummary.canonicalOperatorApproval,
    missionDiscovery,
    researchLoopSummary: workspaceSummary.avaConsole?.researchLoopSummary ?? null,
  })

  gates.push({
    id: "hero_status_not_idle_while_finding_leads",
    status:
      missionDiscovery?.lifecycleState === "finding_leads" && hero.statusKind !== "idle"
        ? "pass"
        : missionDiscovery?.lifecycleState === "finding_leads"
          ? "fail"
          : "warn",
    detail: `hero.statusLabel=${hero.statusLabel}; hero.statusKind=${hero.statusKind}; lifecycle=${missionDiscovery?.lifecycleState ?? "none"}.`,
  })

  gates.push({
    id: "finding_leads_label_when_no_higher_priority_work",
    status:
      missionDiscovery?.lifecycleState === "finding_leads" &&
      (workspaceSummary.canonicalOperatorApproval?.pendingApprovalCount ?? 0) === 0 &&
      readyForOutreachReview === 0 &&
      hero.statusLabel === "Finding Leads"
        ? "pass"
        : missionDiscovery?.lifecycleState === "finding_leads" &&
            (workspaceSummary.canonicalOperatorApproval?.pendingApprovalCount ?? 0) === 0 &&
            readyForOutreachReview === 0
          ? "fail"
          : "pass",
    detail: `statusLabel=${hero.statusLabel}; readyForOutreachReview=${readyForOutreachReview}; pendingApprovals=${workspaceSummary.canonicalOperatorApproval?.pendingApprovalCount ?? 0}.`,
  })

  gates.push({
    id: "home_hero_matches_mission_status",
    status: hero.statusLabel === missionStatus?.label ? "pass" : "fail",
    detail: `hero.statusLabel=${hero.statusLabel}; missionStatus=${missionStatus?.label ?? "none"}.`,
  })

  gates.push({
    id: "provider_status_does_not_override_mission",
    status:
      missionDiscovery?.lifecycleState === "finding_leads" && hero.statusKind !== "idle"
        ? "pass"
        : missionDiscovery
          ? "warn"
          : "fail",
    detail: `supervised.primaryStage=${supervised.primaryStage}; hero.statusLabel=${hero.statusLabel}.`,
  })

  const narrative = buildAvaDailyActivityNarrative({
    memorySummary: null,
    workResult: {
      qaMarker: GROWTH_WORK_MANAGER_QA_MARKER,
      active_work: null,
      work_plan: [],
      operator_queue: [],
      blocked: [],
      completed_today: [],
      deferred: [],
      interruptions: [],
      all_work_items: [],
    },
    operatingRhythm: {
      qaMarker: GROWTH_OPERATING_RHYTHM_QA_MARKER,
      current_phase: "research_cycle",
      completed_phases: [],
      next_phase: null,
      active_cycle: null,
      today_plan: [],
      phase_timeline: [],
      interruptions: [],
      waiting_on_operator: [],
      end_of_day_summary: null,
    },
    hour: new Date().getHours(),
    missionDiscovery,
  })

  gates.push({
    id: "progress_reflects_mission_work",
    status:
      narrative.working_now.length > 0 ||
      projectCanonicalOperatorProgress({
        missionDiscovery,
        portfolioTargetCurrent: workspaceSummary.portfolioManager?.health.counts.activeCompanies ?? null,
        portfolioTargetGoal: workspaceSummary.portfolioManager?.target.targetActiveCompanies ?? null,
      }).items.length > 0
        ? "pass"
        : missionDiscovery
          ? "fail"
          : "warn",
    detail: `working_now=${narrative.working_now.length}; focus=${narrative.focus}.`,
  })

  gates.push({
    id: "outbound_disabled",
    status: killSwitches.autonomy_outbound_enabled === false ? "pass" : "fail",
    detail: `autonomy_outbound_enabled=${killSwitches.autonomy_outbound_enabled}.`,
  })

  console.log("\n--- Validation Gates ---")
  for (const gate of gates) {
    const prefix = gate.status === "pass" ? "✓" : gate.status === "warn" ? "!" : "✗"
    console.log(`  ${prefix} [${gate.id}] ${gate.detail}`)
  }

  console.log("\n--- Home Projection ---")
  console.log(
    JSON.stringify(
      {
        organizationId,
        activeMissionId: activeMission?.id ?? null,
        bootstrapReady,
        portfolioDeficit,
        missionDiscovery,
        resolvedMissionStatus: missionStatus,
        hero: {
          statusLabel: hero.statusLabel,
          statusKind: hero.statusKind,
          openingFocus: hero.dailyActivityNarrative?.focus ?? null,
          supervisedPrimaryStage: hero.supervisedSalesProgress?.primaryStage ?? null,
          supervisedHeadline: hero.supervisedSalesProgress?.headline ?? null,
        },
        narrative: {
          focus: narrative.focus,
          workingNow: narrative.working_now,
          workingNext: narrative.working_next,
        },
      },
      null,
      2,
    ),
  )

  const failures = gates.filter((gate) => gate.status === "fail")
  console.log("\n--- Verdict ---")
  if (failures.length > 0) {
    console.log(`[${PHASE}] FAIL — ${failures.length} gate(s) failed`)
    process.exit(1)
  }
  console.log(`[${PHASE}] PASS`)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
