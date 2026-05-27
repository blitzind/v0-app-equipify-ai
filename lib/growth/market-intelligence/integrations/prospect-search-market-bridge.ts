/** Pure Prospect Search market graph overlay helpers. Client-safe. */

import {
  buildCompanyRelationships as buildRelationships,
  type RelationshipCompanyInput,
} from "@/lib/growth/market-intelligence/company-relationship-engine"
import type { GrowthCompanyRelationship } from "@/lib/growth/market-intelligence/market-intelligence-types"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"

export function companyToRelationshipInput(company: GrowthProspectSearchCompanyResult): RelationshipCompanyInput {
  return {
    company_id: company.id,
    company_name: company.company_name,
    industry: company.industry,
    state: company.state,
    city: company.city,
    lead_engine_score: company.lead_engine_score ?? company.lead_score,
    growth_signal_score: company.growth_signal_score,
    crm_detected: company.crm_detected,
    field_service_software: company.field_service_software,
    employees: company.employees,
    signal_types: company.company_signal_summary?.growth_indicators ?? [],
  }
}

export function buildCompanyRelationships(
  anchor: GrowthProspectSearchCompanyResult,
  pool: GrowthProspectSearchCompanyResult[],
  limit = 5,
): GrowthCompanyRelationship[] {
  return buildRelationships(companyToRelationshipInput(anchor), pool.map(companyToRelationshipInput), limit)
}
