import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthOpportunityPipelineSettings,
  GrowthOpportunityPipelineStage,
  GrowthOpportunityStageKey,
} from "@/lib/growth/opportunity-pipeline/pipeline-types"
import { GROWTH_OPPORTUNITY_STAGE_KEYS } from "@/lib/growth/opportunity-pipeline/pipeline-types"

type SettingsRow = {
  id: string
  stages: GrowthOpportunityPipelineStage[]
  stage_probability_overrides: Partial<Record<GrowthOpportunityStageKey, number>>
  stale_stage_days: number
  stale_activity_days: number
  updated_by: string | null
  created_at: string
  updated_at: string
}

const DEFAULT_STAGES: GrowthOpportunityPipelineStage[] = [
  { key: "new_opportunity", label: "New Opportunity", sortOrder: 1, isClosed: false, isWon: false },
  { key: "discovery", label: "Discovery", sortOrder: 2, isClosed: false, isWon: false },
  { key: "qualified", label: "Qualified", sortOrder: 3, isClosed: false, isWon: false },
  { key: "proposal", label: "Proposal", sortOrder: 4, isClosed: false, isWon: false },
  { key: "negotiation", label: "Negotiation", sortOrder: 5, isClosed: false, isWon: false },
  { key: "verbal_commit", label: "Verbal Commit", sortOrder: 6, isClosed: false, isWon: false },
  { key: "closed_won", label: "Closed Won", sortOrder: 7, isClosed: true, isWon: true },
  { key: "closed_lost", label: "Closed Lost", sortOrder: 8, isClosed: true, isWon: false },
]

function settingsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("opportunity_pipeline_settings")
}

function mapSettings(row: SettingsRow): GrowthOpportunityPipelineSettings {
  return {
    id: row.id,
    stages: row.stages?.length ? row.stages : DEFAULT_STAGES,
    stageProbabilityOverrides: row.stage_probability_overrides ?? {},
    staleStageDays: row.stale_stage_days,
    staleActivityDays: row.stale_activity_days,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function fetchGrowthOpportunityPipelineSettings(
  admin: SupabaseClient,
): Promise<GrowthOpportunityPipelineSettings> {
  const { data, error } = await settingsTable(admin)
    .select("*")
    .eq("singleton", true)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) {
    const { data: inserted, error: insertError } = await settingsTable(admin)
      .insert({ singleton: true, stages: DEFAULT_STAGES })
      .select("*")
      .single()
    if (insertError) throw new Error(insertError.message)
    return mapSettings(inserted as SettingsRow)
  }
  return mapSettings(data as SettingsRow)
}

export function resolveStageLabel(
  settings: GrowthOpportunityPipelineSettings,
  stageKey: GrowthOpportunityStageKey,
): string {
  return settings.stages.find((stage) => stage.key === stageKey)?.label ?? stageKey.replace(/_/g, " ")
}

export function isClosedStage(
  settings: GrowthOpportunityPipelineSettings,
  stageKey: GrowthOpportunityStageKey,
): boolean {
  return settings.stages.find((stage) => stage.key === stageKey)?.isClosed ?? stageKey.startsWith("closed_")
}

export function validateStageKey(stageKey: string): stageKey is GrowthOpportunityStageKey {
  return (GROWTH_OPPORTUNITY_STAGE_KEYS as readonly string[]).includes(stageKey)
}

export async function updateGrowthOpportunityPipelineSettings(
  admin: SupabaseClient,
  input: {
    stages?: GrowthOpportunityPipelineStage[]
    stageProbabilityOverrides?: Partial<Record<GrowthOpportunityStageKey, number>>
    staleStageDays?: number
    staleActivityDays?: number
    updatedBy?: string | null
  },
): Promise<GrowthOpportunityPipelineSettings> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.stages) patch.stages = input.stages
  if (input.stageProbabilityOverrides) patch.stage_probability_overrides = input.stageProbabilityOverrides
  if (input.staleStageDays != null) patch.stale_stage_days = input.staleStageDays
  if (input.staleActivityDays != null) patch.stale_activity_days = input.staleActivityDays
  if (input.updatedBy !== undefined) patch.updated_by = input.updatedBy

  const { data, error } = await settingsTable(admin)
    .update(patch)
    .eq("singleton", true)
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  return mapSettings(data as SettingsRow)
}
