import type { DatamoonAudienceMode, DatamoonProviderCapability } from "@/lib/growth/providers/datamoon/datamoon-config"

export const GROWTH_DATAMOON_PROVIDER_QA_MARKER =
  "growth-datamoon-provider-ge-datamoon-1a-v1" as const

export type DatamoonClientStatus = "success" | "failed" | "skipped" | "dry_run"

export type DatamoonApiErrorCategory =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "validation"
  | "server_error"
  | "network"
  | "disabled"
  | "missing_key"
  | "dry_run"

export type DatamoonFilterOperator =
  | "="
  | "!="
  | "<"
  | ">"
  | "<="
  | ">="
  | "between"
  | "in"
  | "not_in"
  | "contains"
  | "has_value"
  | "has_no_value"

export type DatamoonAudienceFilter = {
  field: string
  operator: DatamoonFilterOperator | string
  value?: string | string[] | null
  value_to?: string | null
}

export type DatamoonAudienceType = "advanced_search" | "b2b" | "b2c"

export type DatamoonBuildAudienceInput = {
  type: DatamoonAudienceType
  filters: DatamoonAudienceFilter[]
  topic_ids?: string[]
  record_limit?: number
  name?: string
  website_id?: string
  limit?: number
}

export type DatamoonAudienceBuildResponse = {
  id?: string
  status?: "in_progress" | "completed" | string
  record_count?: number
  [key: string]: unknown
}

export type DatamoonAudienceFetchResponse = {
  id?: string
  status?: "in_progress" | "completed" | string
  records?: unknown[]
  record_count?: number
  [key: string]: unknown
}

export type DatamoonExportAudienceInput = {
  audience_id: string
  fields?: string[]
}

export type DatamoonEnrichByEmailInput = {
  email: string
}

export type DatamoonEnrichByPhoneInput = {
  phone: string
}

export type DatamoonClientResult<T> = {
  qa_marker: typeof GROWTH_DATAMOON_PROVIDER_QA_MARKER
  status: DatamoonClientStatus
  message: string
  data: T | null
  dry_run: boolean
  audience_mode: DatamoonAudienceMode | null
  error_category: DatamoonApiErrorCategory | null
  validation_errors: Record<string, string[]> | null
  allowed_fields: string[] | null
  latency_ms: number
  http_status: number | null
}

export type DatamoonProviderDiagnostics = {
  qa_marker: typeof GROWTH_DATAMOON_PROVIDER_DIAGNOSTICS_QA_MARKER
  configured: boolean
  enabled: boolean
  dryRunOnly: boolean
  audienceMode: DatamoonAudienceMode
  availableCapabilities: DatamoonProviderCapability[]
  enrichment_key_present: boolean
  audience_ext_key_present: boolean
  audience_module_key_present: boolean
  /** CONTACT-1E — mode vs key presence without revealing secrets. */
  active_audience_key_present: boolean
  alternate_audience_key_present: boolean
  mode_key_mismatch_risk: boolean
}

export const GROWTH_DATAMOON_PROVIDER_DIAGNOSTICS_QA_MARKER =
  "growth-datamoon-provider-diagnostics-ge-datamoon-1a-v1" as const
