/** GE-DATAMOON-1B — Selectable Growth Engine lead source registry. Client-safe. */

import {
  diagnoseDatamoonProvider,
  isDatamoonProviderConfigured,
} from "@/lib/growth/providers/datamoon"

export const GROWTH_LEAD_SOURCE_REGISTRY_QA_MARKER =
  "growth-lead-source-registry-ge-datamoon-1b-v1" as const

export const GROWTH_LEAD_SOURCE_KEYS = ["csv_import", "datamoon_audience"] as const

export type GrowthLeadSourceKey = (typeof GROWTH_LEAD_SOURCE_KEYS)[number]

export type GrowthLeadSourceRegistryEntry = {
  source_key: GrowthLeadSourceKey
  label: string
  description: string
  import_mode: "file_upload" | "provider_audience"
  provider_key: string | null
  ui_enabled: boolean
  configured: boolean
  dry_run_only: boolean
}

export function listGrowthLeadSourceRegistry(
  env: NodeJS.ProcessEnv = process.env,
): GrowthLeadSourceRegistryEntry[] {
  const datamoon = diagnoseDatamoonProvider(env)
  return [
    {
      source_key: "csv_import",
      label: "CSV Import",
      description: "Upload manual or Seamless CSV lead lists.",
      import_mode: "file_upload",
      provider_key: null,
      ui_enabled: true,
      configured: true,
      dry_run_only: false,
    },
    {
      source_key: "datamoon_audience",
      label: "Datamoon Audience",
      description: "Build and poll Datamoon audiences, preview records, and import selected leads.",
      import_mode: "provider_audience",
      provider_key: "datamoon",
      ui_enabled: true,
      configured: isDatamoonProviderConfigured(env),
      dry_run_only: datamoon.dryRunOnly,
    },
  ]
}

export function lookupGrowthLeadSourceEntry(
  sourceKey: string,
  env: NodeJS.ProcessEnv = process.env,
): GrowthLeadSourceRegistryEntry | null {
  return listGrowthLeadSourceRegistry(env).find((entry) => entry.source_key === sourceKey) ?? null
}
