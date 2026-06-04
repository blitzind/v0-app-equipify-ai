/** Prospect Search contact + signal schema health aggregation. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { probeGrowthCompanyContactsSchema } from "@/lib/growth/contact-discovery/company-contact-schema-health"
import { probeGrowthContactDiscoverySchema } from "@/lib/growth/contact-discovery/contact-schema-health"
import { probeProspectSearchEngineIntelligenceSchema } from "@/lib/growth/prospect-search/prospect-search-engine-intelligence-schema-health"
import {
  mergeGrowthSchemaHealthSummaries,
  type GrowthSchemaHealthSummary,
} from "@/lib/growth/schema-health/growth-schema-health-types"

export async function probeProspectSearchContactIntelligenceSchema(
  admin: SupabaseClient,
): Promise<GrowthSchemaHealthSummary> {
  const [contactDiscovery, companyContacts] = await Promise.all([
    probeGrowthContactDiscoverySchema(admin),
    probeGrowthCompanyContactsSchema(admin),
  ])

  const merged = mergeGrowthSchemaHealthSummaries([contactDiscovery, companyContacts])
  return {
    ...merged,
    ready: contactDiscovery.ready || companyContacts.ready,
    warning_message:
      contactDiscovery.ready || companyContacts.ready
        ? null
        : merged.warning_message ??
          "Contact intelligence schema is unavailable — contact discovery and company contacts tables were not detected.",
  }
}

/** Contact + Growth Engine intelligence schema probes for Prospect Search (7.PS-A). */
export async function probeProspectSearchIntelligenceSchema(
  admin: SupabaseClient,
): Promise<GrowthSchemaHealthSummary> {
  const [contact, engine] = await Promise.all([
    probeProspectSearchContactIntelligenceSchema(admin),
    probeProspectSearchEngineIntelligenceSchema(admin),
  ])

  const merged = mergeGrowthSchemaHealthSummaries([contact, engine])
  return {
    ...merged,
    ready: contact.ready || engine.ready,
    warning_message:
      contact.ready || engine.ready
        ? null
        : merged.warning_message ??
          "Prospect Search intelligence schema is unavailable — contact discovery, company contacts, or Growth Engine intelligence tables were not detected.",
  }
}
