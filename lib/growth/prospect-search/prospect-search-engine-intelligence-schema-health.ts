/** Prospect Search — Growth Engine intelligence schema probes (Phase 7.PS-A). Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { isGrowthBuyingCommitteeIntelligenceSchemaReady } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-schema-health"
import { isGrowthCanonicalPersonSchemaReady } from "@/lib/growth/canonical-persons/canonical-person-schema-health"
import { isGrowthCompanyIntelligenceSchemaReady } from "@/lib/growth/company-intelligence/company-intelligence-schema-health"
import { isGrowthEmailDiscoverySchemaReady } from "@/lib/growth/email-discovery/email-discovery-schema-health"
import { isGrowthPhoneDiscoverySchemaReady } from "@/lib/growth/phone-discovery/phone-discovery-schema-health"
import { isGrowthSocialProfileDiscoverySchemaReady } from "@/lib/growth/social-profile-discovery/social-profile-discovery-schema-health"
import {
  mergeGrowthSchemaHealthSummaries,
  type GrowthSchemaHealthSummary,
} from "@/lib/growth/schema-health/growth-schema-health-types"
import {
  probeGrowthSchemaObjects,
  type GrowthSchemaObjectProbe,
} from "@/lib/growth/schema-health/growth-postgrest-table-probe"

export const GROWTH_PROSPECT_SEARCH_ENGINE_INTELLIGENCE_SCHEMA_OBJECTS: GrowthSchemaObjectProbe[] =
  [
    { table: "companies", columns: ["id", "primary_domain", "status"], label: "Canonical companies" },
    { table: "persons", columns: ["id", "display_name"], label: "Canonical persons" },
    { table: "person_company_roles", columns: ["person_id", "company_id"], label: "Person company roles" },
    { table: "person_emails", columns: ["person_id", "verification_status"], label: "Verified emails" },
    { table: "person_phones", columns: ["person_id", "verification_status"], label: "Verified phones" },
    { table: "person_profiles", columns: ["person_id", "verification_status"], label: "Verified profiles" },
    {
      table: "company_intelligence_snapshots",
      columns: ["company_id", "intelligence_category"],
      label: "Company intelligence snapshots",
    },
    {
      table: "buying_committee_intelligence_members",
      columns: ["company_id", "person_id", "committee_role"],
      label: "Buying committee intelligence",
    },
  ]

export async function probeProspectSearchEngineIntelligenceSchema(
  admin: SupabaseClient,
): Promise<GrowthSchemaHealthSummary> {
  const [objectProbe, canonicalReady, companyIntelReady, committeeReady] = await Promise.all([
    probeGrowthSchemaObjects(admin, {
      cacheKey: "growth:prospect-search-engine-intelligence",
      featureLabel: "Growth Engine intelligence (Prospect Search)",
      objects: [...GROWTH_PROSPECT_SEARCH_ENGINE_INTELLIGENCE_SCHEMA_OBJECTS],
    }),
    isGrowthCanonicalPersonSchemaReady(admin).catch(() => false),
    isGrowthCompanyIntelligenceSchemaReady(admin).catch(() => false),
    isGrowthBuyingCommitteeIntelligenceSchemaReady(admin).catch(() => false),
  ])

  const channelReady = await Promise.all([
    isGrowthEmailDiscoverySchemaReady(admin).catch(() => false),
    isGrowthPhoneDiscoverySchemaReady(admin).catch(() => false),
    isGrowthSocialProfileDiscoverySchemaReady(admin).catch(() => false),
  ]).then((results) => results.some(Boolean))

  const subsystemReady =
    canonicalReady && (companyIntelReady || committeeReady || channelReady || objectProbe.ready)

  const merged = mergeGrowthSchemaHealthSummaries([objectProbe])
  return {
    ...merged,
    ready: objectProbe.ready || subsystemReady,
    warning_message:
      objectProbe.ready || subsystemReady
        ? null
        : merged.warning_message ??
          "Growth Engine intelligence schema is unavailable — canonical companies, verified channels, or intelligence tables were not detected.",
  }
}
