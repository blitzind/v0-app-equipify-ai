/** People Data Labs API types — acquisition provider layer. Client-safe. */

export const GROWTH_PDL_PROVIDER_QA_MARKER = "growth-pdl-provider-v1" as const

export type PdlPersonPhoneNumber = {
  number?: string | null
}

export type PdlPersonRecord = {
  id?: string | null
  full_name?: string | null
  first_name?: string | null
  last_name?: string | null
  job_title?: string | null
  job_title_role?: string | null
  job_title_sub_role?: string | null
  job_title_levels?: string[] | null
  job_company_name?: string | null
  job_company_website?: string | null
  work_email?: string | null
  recommended_personal_email?: string | null
  emails?: Array<{ address?: string | null; type?: string | null }> | null
  phone_numbers?: PdlPersonPhoneNumber[] | null
  mobile_phone?: string | null
  linkedin_url?: string | null
  location_name?: string | null
  location_locality?: string | null
  location_region?: string | null
  location_country?: string | null
  likelihood?: number | null
}

export type PdlPersonSearchResponse = {
  status?: number
  data?: PdlPersonRecord[]
  total?: number
  error?: string | { message?: string; type?: string } | null
}

export type PdlPersonSearchInput = {
  company_name: string
  domain: string | null
  industry?: string | null
  limit?: number
  prefer_reachable?: boolean
}

export type PdlPersonSearchResult = {
  qa_marker: typeof GROWTH_PDL_PROVIDER_QA_MARKER
  status: "success" | "skipped" | "failed"
  message: string
  people: PdlPersonRecord[]
  total: number
  sandbox: boolean
  query_summary: string
  error?: string | null
}

export type PdlCompanyRecord = {
  id?: string | null
  name?: string | null
  website?: string | null
  industry?: string | null
  size?: string | null
  employee_count?: number | null
  inferred_revenue?: string | null
  location?: {
    name?: string | null
    locality?: string | null
    region?: string | null
    country?: string | null
  } | null
  linkedin_url?: string | null
  tags?: string[] | null
  tech?: string[] | null
  summary?: string | null
}

export type PdlCompanyEnrichInput = {
  domain?: string | null
  company_name?: string | null
  website?: string | null
}

export type PdlCompanyEnrichResult = {
  qa_marker: typeof GROWTH_PDL_PROVIDER_QA_MARKER
  status: "success" | "skipped" | "failed"
  message: string
  company: PdlCompanyRecord | null
  sandbox: boolean
  query_summary: string
  error?: string | null
}

export type PdlPersonEnrichInput = {
  email?: string | null
  phone?: string | null
  linkedin_url?: string | null
  name?: string | null
  company?: string | null
  domain?: string | null
}

export type PdlPersonEnrichResult = {
  qa_marker: typeof GROWTH_PDL_PROVIDER_QA_MARKER
  status: "success" | "skipped" | "failed"
  message: string
  person: PdlPersonRecord | null
  sandbox: boolean
  query_summary: string
  likelihood: number | null
  error?: string | null
}
