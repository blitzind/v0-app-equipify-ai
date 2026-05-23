import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  listGrowthAiCopilotGenerations,
  fetchGrowthCopilotSettings,
} from "@/lib/growth/ai-copilot-repository"
import type { GrowthAiCopilotGeneration } from "@/lib/growth/ai-copilot-types"

function effectivenessTable(admin: SupabaseClient) {
  return admin.schema("growth").from("ai_copilot_effectiveness")
}

function leadsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("leads")
}

export async function fetchGrowthAiCopilotDashboard(admin: SupabaseClient) {
  const [recentGenerations, approvalQueue, settings] = await Promise.all([
    listGrowthAiCopilotGenerations(admin, { limit: 20 }),
    listGrowthAiCopilotGenerations(admin, { status: "draft", limit: 20 }),
    fetchGrowthCopilotSettings(admin),
  ])

  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: effectivenessRows, error } = await effectivenessTable(admin)
    .select("generation_type, prompt_variant, outcome, classification_primary, effectiveness_score, recorded_at")
    .gte("recorded_at", since30d)
    .order("recorded_at", { ascending: false })
    .limit(500)

  if (error) throw new Error(error.message)

  const rows = effectivenessRows ?? []
  const classificationCounts: Record<string, number> = {}
  const variantScores: Record<string, { total: number; count: number }> = {}
  const outcomeCounts = { generated: 0, approved: 0, discarded: 0, expired: 0 }

  for (const row of rows) {
    const outcome = row.outcome as keyof typeof outcomeCounts
    if (outcome in outcomeCounts) outcomeCounts[outcome] += 1

    const primary = (row.classification_primary as string | null) ?? "unknown"
    classificationCounts[primary] = (classificationCounts[primary] ?? 0) + 1

    const variant = (row.prompt_variant as string) ?? "default"
    if (!variantScores[variant]) variantScores[variant] = { total: 0, count: 0 }
    variantScores[variant].total += (row.effectiveness_score as number) ?? 0
    variantScores[variant].count += 1
  }

  const leadIds = [...new Set(recentGenerations.map((entry) => entry.leadId))]
  const { data: leadRows } = await leadsTable(admin)
    .select("id, company_name")
    .in("id", leadIds.length > 0 ? leadIds : ["00000000-0000-4000-8000-000000000000"])

  const companyByLead = new Map(
    (leadRows ?? []).map((row) => [row.id as string, row.company_name as string]),
  )

  const enrich = (generation: GrowthAiCopilotGeneration) => ({
    ...generation,
    companyName: companyByLead.get(generation.leadId) ?? "Unknown lead",
  })

  const approvedRate =
    outcomeCounts.approved + outcomeCounts.discarded > 0
      ? Math.round(
          (outcomeCounts.approved / (outcomeCounts.approved + outcomeCounts.discarded)) * 100,
        )
      : 0

  return {
    settings,
    recentGenerations: recentGenerations.map(enrich),
    approvalQueue: approvalQueue.map(enrich),
    topClassifications: Object.entries(classificationCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([key, count]) => ({ key, count })),
    generationEffectiveness: {
      approvedRate,
      outcomeCounts,
      variantAverages: Object.entries(variantScores).map(([variant, stats]) => ({
        variant,
        averageScore: stats.count > 0 ? Math.round(stats.total / stats.count) : 0,
        count: stats.count,
      })),
    },
  }
}
