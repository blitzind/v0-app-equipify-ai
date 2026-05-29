import "server-only"

import { createHash } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  findBrowserIntakeExistingLeads,
  pickBestBrowserIntakeLeadMatch,
} from "@/lib/growth/browser-intake/browser-intake-lead-lookup"
import type {
  GrowthBrowserIntakeSimilarCompaniesResult,
  GrowthBrowserIntakeSimilarCompaniesSeed,
} from "@/lib/growth/browser-intake/browser-intake-similar-companies-types"
import { mapBrowserIntakeRelationshipToSimilarCompany } from "@/lib/growth/browser-intake/browser-intake-similar-companies-types"
import { normalizeCompanyName } from "@/lib/growth/import/normalize"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import {
  buildCompanyRelationships,
  type RelationshipCompanyInput,
} from "@/lib/growth/market-intelligence/company-relationship-engine"

type LeadPoolRow = {
  id: string
  company_name: string
  website: string | null
  city: string | null
  state: string | null
  score: number | null
  crm_detected: string | null
  field_service_stack_detected: string | null
  estimated_employee_count: string | null
  metadata: Record<string, unknown> | null
}

function growthLeadsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("leads")
}

function syntheticCompanyId(seedKey: string): string {
  return createHash("sha256").update(`browser-intake-seed:${seedKey}`).digest("hex").slice(0, 32)
}

function leadIndustryFromMetadata(metadata: Record<string, unknown> | null | undefined): string | null {
  if (!metadata || typeof metadata !== "object") return null
  const research = metadata.prospect_research
  if (research && typeof research === "object") {
    const industry = (research as Record<string, unknown>).industry_guess
    if (typeof industry === "string" && industry.trim()) return industry.trim()
  }
  const importMeta = metadata.import
  if (importMeta && typeof importMeta === "object") {
    const industry = (importMeta as Record<string, unknown>).industry
    if (typeof industry === "string" && industry.trim()) return industry.trim()
  }
  return null
}

function leadToRelationshipInput(row: LeadPoolRow): RelationshipCompanyInput {
  return {
    company_id: row.id,
    company_name: row.company_name,
    industry: leadIndustryFromMetadata(row.metadata),
    state: row.state,
    city: row.city,
    lead_engine_score: row.score,
    crm_detected: row.crm_detected,
    field_service_software: row.field_service_stack_detected,
    employees: row.estimated_employee_count,
    signal_types: [],
  }
}

async function resolveSeedLead(
  admin: SupabaseClient,
  input: {
    lead_id?: string | null
    company_name?: string | null
    website?: string | null
    linkedin_url?: string | null
    email?: string | null
    industry?: string | null
    state?: string | null
    city?: string | null
  },
): Promise<{ lead: LeadPoolRow | null; seed: GrowthBrowserIntakeSimilarCompaniesSeed }> {
  let leadId = input.lead_id ?? null

  if (!leadId) {
    const matches = await findBrowserIntakeExistingLeads(admin, {
      company_name: input.company_name,
      website: input.website,
      linkedin_url: input.linkedin_url,
      email: input.email,
      limit: 5,
    })
    const best = pickBestBrowserIntakeLeadMatch(matches)
    if (best && best.confidence >= 0.7) {
      leadId = best.lead_id
    }
  }

  if (leadId) {
    const lead = await fetchGrowthLeadById(admin, leadId)
    if (lead) {
      return {
        lead: {
          id: lead.id,
          company_name: lead.companyName,
          website: lead.website,
          city: lead.city,
          state: lead.state,
          score: lead.score,
          crm_detected: lead.crmDetected,
          field_service_stack_detected: lead.fieldServiceStackDetected,
          estimated_employee_count: lead.estimatedEmployeeCount,
          metadata: lead.metadata,
        },
        seed: {
          lead_id: lead.id,
          company_name: lead.companyName,
          website: lead.website,
          industry: input.industry?.trim() || leadIndustryFromMetadata(lead.metadata),
          state: lead.state ?? input.state ?? null,
          city: lead.city ?? input.city ?? null,
        },
      }
    }
  }

  const companyName = (input.company_name ?? "").trim()
  if (!companyName) {
    throw new Error("seed_company_required")
  }

  const seedKey = normalizeCompanyName(companyName) || companyName.toLowerCase()
  return {
    lead: null,
    seed: {
      lead_id: null,
      company_name: companyName,
      website: input.website?.trim() || null,
      industry: input.industry?.trim() || null,
      state: input.state?.trim() || null,
      city: input.city?.trim() || null,
    },
  }
}

export async function discoverBrowserIntakeSimilarCompanies(
  admin: SupabaseClient,
  input: {
    lead_id?: string | null
    company_name?: string | null
    website?: string | null
    linkedin_url?: string | null
    email?: string | null
    industry?: string | null
    state?: string | null
    city?: string | null
    limit?: number
  },
): Promise<GrowthBrowserIntakeSimilarCompaniesResult> {
  const limit = Math.max(1, Math.min(input.limit ?? 5, 10))
  const { lead, seed } = await resolveSeedLead(admin, input)

  const anchor: RelationshipCompanyInput = lead
    ? leadToRelationshipInput(lead)
    : {
        company_id: syntheticCompanyId(seed.company_name),
        company_name: seed.company_name,
        industry: seed.industry,
        state: seed.state,
        city: seed.city,
        lead_engine_score: null,
        signal_types: [],
      }

  const { data, error } = await growthLeadsTable(admin)
    .select(
      "id, company_name, website, city, state, score, crm_detected, field_service_stack_detected, estimated_employee_count, metadata",
    )
    .neq("id", anchor.company_id)
    .order("score", { ascending: false, nullsFirst: false })
    .limit(400)

  if (error) throw new Error(error.message)

  const poolRows = (data ?? []) as LeadPoolRow[]
  const pool = poolRows.map(leadToRelationshipInput)
  const relationships = buildCompanyRelationships(anchor, pool, limit)

  const rowById = new Map(poolRows.map((row) => [row.id, row]))

  const matches = relationships.map((relationship) => {
    const relatedLead = rowById.get(relationship.related_company_id)
    return mapBrowserIntakeRelationshipToSimilarCompany({
      related_company_name: relationship.related_company_name,
      relationship_strength: relationship.relationship_strength,
      evidence_excerpt: relationship.evidence_excerpt,
      relationship_type: relationship.relationship_type,
      website: relatedLead?.website ?? null,
      city: relatedLead?.city ?? null,
      state: relatedLead?.state ?? null,
      lead_id: relatedLead?.id ?? null,
    })
  })

  return { seed, matches }
}
