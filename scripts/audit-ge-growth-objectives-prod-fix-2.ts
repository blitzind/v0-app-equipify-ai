/**
 * GE-GROWTH-OBJECTIVES-PROD-FIX-2 — reproduce objectives dashboard crashes against production data.
 */
import { createClient } from "@supabase/supabase-js"

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Missing Supabase env")

  const admin = createClient(url, key, { auth: { persistSession: false } })
  const orgs = ["5876176a-61ec-4532-ad99-0c31482d5a91", "00757488-1026-44a5-aac4-269533ac21be"]

  const { loadGrowthObjectiveDashboard } = await import(
    "../lib/growth/objectives/growth-objective-service.ts"
  )
  const stageMachine = await import("../lib/growth/objectives/growth-objective-stage-state-machine.ts")
  const executionContext = await import("../lib/growth/objectives/growth-objective-execution-context.ts")
  const signalHandler = await import("../lib/growth/objectives/growth-objective-signal-handler.ts")
  const { fetchGrowthPriorityEngineBindingReadModel, findObjectivePriorityBindingContext } =
    await import("../lib/growth/aios/priority/growth-priority-engine-binding-service.ts")

  for (const orgId of orgs) {
    console.log(`\n=== ORG ${orgId} ===`)
    try {
      const dashboard = await loadGrowthObjectiveDashboard(admin, orgId)
      console.log(`API OK: ${dashboard.objectives.length} objectives`)
      const pb = await fetchGrowthPriorityEngineBindingReadModel(admin, { organizationId: orgId })

      for (const obj of dashboard.objectives) {
        const issues: string[] = []
        try {
          stageMachine.computeObjectiveDashboardProgress(obj)
          stageMachine.isObjectiveRuntimeStalled(obj)
          if (obj.recentSignals?.length) {
            signalHandler.buildObjectiveSignalSnapshot(obj.recentSignals)
          }
          if (obj.executionContext) {
            executionContext.summarizeObjectiveExecutionContext(obj.executionContext)
            executionContext.summarizeObjectiveMaterializationHealth(obj.executionContext)
          }
          if (obj.plan?.icpStrategy) {
            if (!Array.isArray(obj.plan.stages)) issues.push("plan.stages missing")
            for (const stage of obj.plan.stages ?? []) {
              if (!Array.isArray(stage.recommendations)) issues.push(`stage ${stage.id} recommendations`)
              const rs = obj.runtime?.stageStates?.[stage.id]
              stageMachine.computeObjectiveStageDurationMs(rs)
              if (rs && !Array.isArray(rs.blockers)) issues.push(`runtime blockers ${stage.id}`)
              void (stage.recommendations?.length ?? 0)
              void (rs?.blockers?.length ?? 0)
              void (rs?.blockers?.join?.(";"))
            }
            void obj.plan.forecast.leadsNeeded
            void obj.plan.icpStrategy.summary
          }
          if (!Array.isArray(obj.recentSignals)) issues.push("recentSignals not array")
          if (!Array.isArray(obj.recommendations)) issues.push("recommendations not array")
          if (!Array.isArray(obj.executionHistory)) issues.push("executionHistory not array")
          void obj.recentSignals.length
          void obj.recommendations.length
          void obj.executionHistory.length

          const ctx = findObjectivePriorityBindingContext(pb, obj.id)
          const tb = ctx?.topBinding
          if (tb) {
            ;(tb.recommendedNextStep ?? "unknown").replaceAll("_", " ")
            ;(tb.status ?? "unknown").replaceAll("_", " ")
            tb.blockers?.some((b) => b.type === "approval")
          }
        } catch (error) {
          issues.push(`THROW: ${error instanceof Error ? error.message : String(error)}`)
          if (error instanceof Error && error.stack) {
            console.log(error.stack.split("\n").slice(0, 6).join("\n"))
          }
        }
        console.log(`  ${obj.id.slice(0, 8)} ${obj.status}: ${issues.length ? issues.join("; ") : "OK"}`)
      }
    } catch (error) {
      console.log(`API FAIL: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const { data } = await admin.schema("growth").from("organization_growth_objectives").select("*")
  console.log("\n=== RAW ROW SCAN ===")
  for (const row of data ?? []) {
    const issues: string[] = []
    const plan = row.plan as Record<string, unknown> | null
    if (plan?.icpStrategy && !Array.isArray(plan.stages)) issues.push("plan.stages")
    if (Array.isArray(plan?.stages)) {
      for (const s of plan.stages as Array<Record<string, unknown>>) {
        if (!Array.isArray(s.recommendations)) issues.push(`recs ${s.id}`)
      }
    }
    const rt = row.runtime_state as { stageStates?: Record<string, { blockers?: unknown }> } | null
    if (rt?.stageStates) {
      for (const [id, st] of Object.entries(rt.stageStates)) {
        if (st && !Array.isArray(st.blockers)) issues.push(`rt.blockers ${id}=${typeof st.blockers}`)
      }
    }
    if (row.recent_signals != null && !Array.isArray(row.recent_signals)) issues.push("recent_signals type")
    if (row.recommendations != null && !Array.isArray(row.recommendations)) issues.push("recommendations type")
    if (row.execution_history != null && !Array.isArray(row.execution_history)) issues.push("history type")
    if (issues.length) console.log(`  RAW ${String(row.id).slice(0, 8)}: ${issues.join("; ")}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
