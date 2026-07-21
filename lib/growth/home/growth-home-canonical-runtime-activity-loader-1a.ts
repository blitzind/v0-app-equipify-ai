/** GE-AIOS-RUNTIME-THROUGHPUT-1A — Canonical autonomous runtime activity (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { withGrowthHomeLoaderBudget } from "@/lib/growth/home/growth-home-workspace-loader-budget"
import type {
  GrowthHomeCanonicalRuntimeActivity,
  GrowthHomeCanonicalRuntimeActivityPayload,
} from "@/lib/growth/home/growth-home-runtime-trust-types-1b"
import { GROWTH_RUNTIME_THROUGHPUT_1A_QA_MARKER } from "@/lib/growth/specialists/execution/growth-runtime-throughput-1a"
import { mapProspectResearchRunRow } from "@/lib/growth/research/research-repository"

const RUN_SELECT =
  "id, organization_id, lead_id, status, company_name, completed_at, created_at"

function pickLatestActivity(
  candidates: GrowthHomeCanonicalRuntimeActivity[],
): GrowthHomeCanonicalRuntimeActivity | null {
  return (
    [...candidates]
      .filter((row) => Number.isFinite(Date.parse(row.occurredAt)))
      .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))[0] ?? null
  )
}

export async function loadGrowthHomeCanonicalRuntimeActivity(input: {
  admin: SupabaseClient
  organizationId: string
  generatedAt: string
  lastSchedulerRunAt?: string | null
  budgetMs?: number
}): Promise<GrowthHomeCanonicalRuntimeActivityPayload> {
  const since24h = new Date(Date.parse(input.generatedAt) - 24 * 60 * 60 * 1000).toISOString()
  const budgetMs = input.budgetMs ?? 2_500

  const step = await withGrowthHomeLoaderBudget({
    label: "canonical_runtime_activity",
    budgetMs,
    fn: async () => {
      const [completedRuns, activeRuns, memoryEvents, completedCountResult] = await Promise.all([
        input.admin
          .schema("growth")
          .from("research_runs")
          .select(RUN_SELECT)
          .eq("organization_id", input.organizationId)
          .eq("status", "completed")
          .gte("completed_at", since24h)
          .order("completed_at", { ascending: false })
          .limit(12),
        input.admin
          .schema("growth")
          .from("research_runs")
          .select(RUN_SELECT)
          .eq("organization_id", input.organizationId)
          .in("status", ["queued", "running"])
          .order("created_at", { ascending: false })
          .limit(3),
        input.admin
          .schema("growth")
          .from("organization_memory_events")
          .select("occurred_at, summary, event_source")
          .eq("organization_id", input.organizationId)
          .gte("occurred_at", since24h)
          .order("occurred_at", { ascending: false })
          .limit(12),
        input.admin
          .schema("growth")
          .from("research_runs")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", input.organizationId)
          .eq("status", "completed")
          .gte("completed_at", since24h),
      ])

      return {
        completedRuns: completedRuns.data ?? [],
        activeRuns: activeRuns.data ?? [],
        memoryEvents: memoryEvents.data ?? [],
        completedCount24h: completedCountResult.count ?? 0,
      }
    },
    fallback: {
      completedRuns: [],
      activeRuns: [],
      memoryEvents: [],
      completedCount24h: 0,
    },
  })

  const activities: GrowthHomeCanonicalRuntimeActivity[] = []

  for (const row of step.value.completedRuns) {
    const mapped = mapProspectResearchRunRow(row as Parameters<typeof mapProspectResearchRunRow>[0])
    if (!mapped.completedAt) continue
    const company = mapped.companyName?.trim() || "company"
    activities.push({
      occurredAt: mapped.completedAt,
      label: `Finished researching ${company}`,
      source: "research_run_completed",
    })
  }

  for (const row of step.value.activeRuns) {
    const mapped = mapProspectResearchRunRow(row as Parameters<typeof mapProspectResearchRunRow>[0])
    const company = mapped.companyName?.trim() || "company"
    activities.push({
      occurredAt: mapped.createdAt,
      label: `Started researching ${company}`,
      source: "research_run_claimed",
    })
  }

  for (const row of step.value.memoryEvents) {
    const occurredAt = typeof row.occurred_at === "string" ? row.occurred_at : null
    const summary = typeof row.summary === "string" ? row.summary.trim() : ""
    if (!occurredAt || !summary) continue
    activities.push({
      occurredAt,
      label: summary,
      source: "organization_memory_event",
    })
  }

  if (input.lastSchedulerRunAt) {
    activities.push({
      occurredAt: input.lastSchedulerRunAt,
      label: "Scheduler cycle completed",
      source: "scheduler_cycle",
    })
  }

  const activeRow = step.value.activeRuns[0]
  const activeMapped = activeRow
    ? mapProspectResearchRunRow(activeRow as Parameters<typeof mapProspectResearchRunRow>[0])
    : null

  return {
    qaMarker: GROWTH_RUNTIME_THROUGHPUT_1A_QA_MARKER,
    lastMeaningfulActivity: pickLatestActivity(
      activities.filter((row) => row.source !== "scheduler_cycle"),
    ),
    activeClaim:
      activeMapped && (activeMapped.status === "queued" || activeMapped.status === "running")
        ? {
            runId: activeMapped.id,
            leadId: activeMapped.leadId,
            companyName: activeMapped.companyName,
            claimedAt: activeMapped.createdAt,
            status: activeMapped.status,
          }
        : null,
    recentCompletedResearchCount24h: step.value.completedCount24h,
  }
}
