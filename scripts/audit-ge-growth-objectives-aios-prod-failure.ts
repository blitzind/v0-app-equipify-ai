/**
 * GE-GROWTH-OBJECTIVES-AIOS-PROD-FAILURE-AUDIT — capture first server throws.
 * Run: pnpm exec tsx scripts/audit-ge-growth-objectives-aios-prod-failure.ts
 */
import { createClient } from "@supabase/supabase-js"

const ORG_ID = process.env.GROWTH_ENGINE_AI_ORG_ID ?? "00757488-1026-44a5-aac4-269533ac21be"

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}\n${error.stack?.split("\n").slice(0, 12).join("\n") ?? ""}`
  }
  return String(error)
}

async function tryCall(label: string, fn: () => Promise<unknown>): Promise<unknown | null> {
  try {
    const result = await fn()
    const marker =
      typeof result === "object" && result !== null && "qa_marker" in result
        ? String((result as { qa_marker: unknown }).qa_marker)
        : "loaded"
    console.log(`[PASS] ${label}: ${marker}`)
    return result
  } catch (error) {
    console.log(`[FAIL] ${label}`)
    console.log(formatError(error))
    return null
  }
}

function auditObjectiveUiCrashFields(objectives: Array<Record<string, unknown>>): void {
  console.log("\n--- Objective UI crash field audit ---")
  for (const obj of objectives) {
    const issues: string[] = []
    const id = String(obj.id ?? "").slice(0, 8)
    const plan = obj.plan as Record<string, unknown> | null | undefined
    const runtime = obj.runtime as Record<string, unknown> | null | undefined

    if (plan?.icpStrategy && !Array.isArray(plan.stages)) {
      issues.push("plan.icpStrategy set but plan.stages missing")
    }
    if (Array.isArray(plan?.stages)) {
      for (const stage of plan.stages as Array<Record<string, unknown>>) {
        if (!Array.isArray(stage.recommendations)) {
          issues.push(`stage ${stage.id} recommendations not array`)
        }
      }
    }
    const stageStates = runtime?.stageStates as Record<string, Record<string, unknown>> | undefined
    if (stageStates) {
      for (const [stageId, state] of Object.entries(stageStates)) {
        if (state && !Array.isArray(state.blockers)) {
          issues.push(`runtime.stageStates.${stageId}.blockers not array (${typeof state.blockers})`)
        }
      }
    }
    if (!Array.isArray(obj.recentSignals)) issues.push("recentSignals not array")
    if (!Array.isArray(obj.recommendations)) issues.push("recommendations not array")

    console.log(`${id}: ${issues.length ? issues.join("; ") : "OK"}`)
  }
}

async function auditObjectiveClientSimulation(
  objectives: Array<Record<string, unknown>>,
): Promise<void> {
  console.log("\n--- Objective client simulation ---")
  const { summarizeObjectiveMaterializationHealth } = await import(
    "../lib/growth/objectives/growth-objective-execution-context.ts"
  )
  const { computeObjectiveDashboardProgress, isObjectiveRuntimeStalled } = await import(
    "../lib/growth/objectives/growth-objective-stage-state-machine.ts"
  )
  const { buildObjectiveSignalSnapshot } = await import(
    "../lib/growth/objectives/growth-objective-signal-handler.ts"
  )

  for (const raw of objectives) {
    const id = String(raw.id ?? "").slice(0, 8)
    if (raw.status === "archived") continue
    try {
      const objective = raw as never
      if (raw.executionContext) {
        summarizeObjectiveMaterializationHealth(raw.executionContext as never)
      }
      computeObjectiveDashboardProgress(objective)
      isObjectiveRuntimeStalled(objective)
      buildObjectiveSignalSnapshot((raw.recentSignals as never[]) ?? [])
      const plan = raw.plan as { stages?: Array<{ recommendations?: string[] }> } | null
      if (plan?.stages) {
        for (const stage of plan.stages) {
          if ((stage.recommendations?.length ?? 0) > 0) {
            void stage.recommendations?.[0]
          }
        }
      }
      console.log(`${id}: OK`)
    } catch (error) {
      console.log(`${id}: FAIL ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

async function auditPriorityBinding(
  admin: ReturnType<typeof createClient>,
  orgId: string,
  objectiveIds: string[],
): Promise<void> {
  console.log("\n--- Priority binding audit ---")
  const { fetchGrowthPriorityEngineBindingReadModel, findObjectivePriorityBindingContext } =
    await import("../lib/growth/aios/priority/growth-priority-engine-binding-service.ts")

  const readModel = await fetchGrowthPriorityEngineBindingReadModel(admin, { organizationId: orgId })
  for (const objectiveId of objectiveIds) {
    const ctx = findObjectivePriorityBindingContext(readModel, objectiveId)
    const tb = ctx?.topBinding
    if (!tb) {
      console.log(`${objectiveId.slice(0, 8)}: no topBinding`)
      continue
    }
    const issues: string[] = []
    if (tb.recommendedNextStep == null) issues.push("recommendedNextStep null")
    if (tb.status == null) issues.push("status null")
    if (!Array.isArray(tb.blockers)) issues.push(`blockers not array (${typeof tb.blockers})`)
    console.log(`${objectiveId.slice(0, 8)}: ${issues.length ? issues.join("; ") : "OK"}`)
  }
}

async function auditOperatorSynthesizer(model: Record<string, unknown>): Promise<void> {
  console.log("\n--- Operator experience synthesizer audit ---")
  try {
    const { synthesizeGrowthAiOsOperatorExperience } = await import(
      "../lib/growth/aios/operator-experience/growth-ai-os-operator-experience-synthesizer.ts"
    )
    const view = synthesizeGrowthAiOsOperatorExperience({
      dashboard: model.operationsDashboard as never,
      dailyBriefing: model.dailyBriefing as never,
      needsAttention: model.needsAttention as never,
      revenueDirector: model.revenueDirector as never,
      humanApprovalCenter: model.humanApprovalCenter as never,
      communicationEngine: model.communicationEngine as never,
      boundedAutonomousOutbound: model.boundedAutonomousOutbound as never,
      adaptiveCalibration: model.adaptiveCalibration as never,
      closedLoopLearning: model.closedLoopLearning as never,
    })
    console.log(`[PASS] synthesizeGrowthAiOsOperatorExperience: ${view.qaMarker}`)
  } catch (error) {
    console.log("[FAIL] synthesizeGrowthAiOsOperatorExperience")
    console.log(formatError(error))
  }
}

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }

  const admin = createClient(url, key, { auth: { persistSession: false } })
  console.log(`Auditing org ${ORG_ID}`)

  const { loadGrowthObjectiveDashboard } = await import(
    "../lib/growth/objectives/growth-objective-service.ts"
  )
  const { fetchAiOsCommandCenterReadModel } = await import(
    "../lib/growth/aios/ai-os-command-center-service.ts"
  )

  const dashboard = (await tryCall("loadGrowthObjectiveDashboard", () =>
    loadGrowthObjectiveDashboard(admin, ORG_ID),
  )) as { objectives: Array<Record<string, unknown>> } | null

  if (dashboard?.objectives) {
    auditObjectiveUiCrashFields(dashboard.objectives)
    await auditPriorityBinding(
      admin,
      ORG_ID,
      dashboard.objectives.map((entry) => String(entry.id)),
    )
    await auditObjectiveClientSimulation(dashboard.objectives)
  }

  const commandCenter = (await tryCall("fetchAiOsCommandCenterReadModel", () =>
    fetchAiOsCommandCenterReadModel(admin, { organizationId: ORG_ID }),
  )) as Record<string, unknown> | null

  if (commandCenter) {
    await auditOperatorSynthesizer(commandCenter)
    await auditDailyWorkQueueShape(commandCenter)
  }

  process.env.GROWTH_COMMUNICATION_STRATEGY = "true"
  process.env.GROWTH_NATIVE_DECISION_ENGINE = "true"
  await auditWithCommunicationStrategyEnabled(admin, ORG_ID)
}

async function auditDailyWorkQueueShape(model: Record<string, unknown>): Promise<void> {
  console.log("\n--- Daily work queue shape audit ---")
  const queue = model.dailyRevenueWorkQueue as Record<string, unknown> | null | undefined
  const display = model.dailyRevenueWorkQueueDisplay as Record<string, unknown> | null | undefined
  if (!queue || !display) {
    console.log("queue or display null — client section skipped")
    return
  }
  const issues: string[] = []
  for (const bucket of ["critical", "high", "medium", "waiting", "blocked", "low", "completed"]) {
    if (!Array.isArray(queue[bucket])) issues.push(`queue.${bucket} missing`)
  }
  if (!Array.isArray(display.top_items)) issues.push("display.top_items missing")
  console.log(issues.length ? issues.join("; ") : "OK")
}

async function auditWithCommunicationStrategyEnabled(
  admin: ReturnType<typeof createClient>,
  orgId: string,
): Promise<void> {
  if (process.env.GROWTH_COMMUNICATION_STRATEGY !== "true") return
  console.log("\n--- Communication strategy enabled path ---")
  const { fetchDailyRevenueWorkQueue } = await import(
    "../lib/growth/daily-work-queue/daily-revenue-work-queue-resolver.ts"
  )
  await tryCall("fetchDailyRevenueWorkQueue", () => fetchDailyRevenueWorkQueue(admin, { limit: 100 }))
  await tryCall("fetchAiOsCommandCenterReadModel (comm strategy on)", () =>
    import("../lib/growth/aios/ai-os-command-center-service.ts").then(({ fetchAiOsCommandCenterReadModel }) =>
      fetchAiOsCommandCenterReadModel(admin, { organizationId: orgId }),
    ),
  )
}

main().catch((error) => {
  console.error("[FATAL]", formatError(error))
  process.exit(1)
})
