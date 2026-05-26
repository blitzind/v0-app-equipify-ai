import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthEnrichmentProvider,
  GrowthEnrichmentProviderQuery,
} from "@/lib/growth/enrichment/enrichment-provider-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function channelFromObserved(
  value: string | null,
  hasEvidence: boolean,
): "not_present" | "observed" | "insufficient_evidence" {
  if (!value) return "not_present"
  return hasEvidence ? "observed" : "insufficient_evidence"
}

export function createInternalGrowthEnrichmentProvider(
  admin: SupabaseClient,
): GrowthEnrichmentProvider {
  return {
    provider_name: "internal_growth",
    provider_type: "internal_growth",
    isConfigured: () => true,
    enrich: async (input: GrowthEnrichmentProviderQuery) => {
      const contact_verifications = []
      const company_enrichments = []

      if (input.contact_candidate_id) {
        try {
          const { data } = await admin
            .schema("growth")
            .from("contact_candidates")
            .select("id, email, phone, linkedin_url, evidence, verification_state, metadata")
            .eq("id", input.contact_candidate_id)
            .maybeSingle()

          if (data) {
            const r = data as Record<string, unknown>
            const email = asString(r.email)
            const phone = asString(r.phone)
            const linkedin = asString(r.linkedin_url)
            const evidenceArr = Array.isArray(r.evidence) ? r.evidence : []
            const hasEvidence = evidenceArr.length > 0

            contact_verifications.push({
              contact_candidate_id: input.contact_candidate_id,
              email_status: channelFromObserved(email, hasEvidence && Boolean(email)),
              phone_status: channelFromObserved(phone, hasEvidence && Boolean(phone)),
              linkedin_status: channelFromObserved(linkedin, hasEvidence && Boolean(linkedin)),
              verification_confidence: hasEvidence ? 0.62 : 0.4,
              verification_reason:
                hasEvidence && (email || phone || linkedin)
                  ? "Observed PII present on internal contact candidate with stored evidence."
                  : "No observed PII on contact candidate — channels not validated.",
              evidence: [
                {
                  claim: "Internal contact candidate",
                  evidence: `verification_state=${asString(r.verification_state) || "unknown"}`,
                  source: "growth.contact_candidates",
                  tier: "observed",
                },
              ],
              source_attribution: [
                {
                  source: "growth.contact_candidates",
                  provider_type: "internal_growth",
                  provider_name: "internal_growth",
                  tier: "observed",
                  signal: "stored_contact",
                  evidence: "Read from growth.contact_candidates — not third-party guessed validation.",
                  confidence: hasEvidence ? 0.62 : 0.4,
                },
              ],
            })
          }
        } catch {
          /* optional */
        }
      }

      if (input.company_candidate_id) {
        const companyTables = [
          "real_world_company_candidates",
          "external_company_candidates",
        ] as const
        for (const table of companyTables) {
          try {
            const { data } = await admin
              .schema("growth")
              .from(table)
              .select(
                "id, company_name, domain, industry, category, description, city, state, metadata",
              )
              .eq("id", input.company_candidate_id)
              .maybeSingle()

            if (data) {
              const r = data as Record<string, unknown>
              const meta =
                r.metadata && typeof r.metadata === "object"
                  ? (r.metadata as Record<string, unknown>)
                  : {}
              const location = [asString(r.city), asString(r.state)].filter(Boolean).join(", ")
              company_enrichments.push({
                company_candidate_id: input.company_candidate_id,
                employee_estimate: null,
                revenue_estimate: null,
                industry: asString(r.industry) || null,
                subindustry: asString(r.category) || null,
                technology_signals: [],
                crm_signals:
                  meta.matched_prospect_id || meta.matched_customer_id
                    ? ["Existing CRM match (observed)"]
                    : [],
                service_signals: [
                  ...(asString(r.category) ? [asString(r.category)] : []),
                  ...(asString(r.description) ? [asString(r.description).slice(0, 120)] : []),
                ].filter(Boolean),
                location_signals: location ? [location] : [],
                confidence: 0.58,
                evidence: [
                  {
                    claim: "Company discovery candidate",
                    evidence: `company=${asString(r.company_name)} domain=${asString(r.domain)}`,
                    source: `growth.${table}`,
                    tier: "observed",
                  },
                ],
                source_attribution: [
                  {
                    source: `growth.${table}`,
                    provider_type: "internal_growth",
                    provider_name: "internal_growth",
                    tier: "observed",
                    signal: "company_record",
                    evidence: "Observed fields from company discovery store.",
                    confidence: 0.58,
                  },
                ],
              })
              break
            }
          } catch {
            /* optional */
          }
        }

        if (input.growth_lead_id) {
          try {
            const { data: lead } = await admin
              .schema("growth")
              .from("leads")
              .select("estimated_employee_count, estimated_annual_revenue, industry_detected, crm_detected, field_service_stack_detected")
              .eq("id", input.growth_lead_id)
              .maybeSingle()
            if (lead && company_enrichments[0]) {
              const l = lead as Record<string, unknown>
              const row = company_enrichments[0]
              row.employee_estimate = asString(l.estimated_employee_count) || row.employee_estimate
              row.revenue_estimate = asString(l.estimated_annual_revenue) || row.revenue_estimate
              row.industry = asString(l.industry_detected) || row.industry
              if (asString(l.crm_detected)) row.crm_signals.push(`CRM: ${asString(l.crm_detected)}`)
              if (asString(l.field_service_stack_detected)) {
                row.technology_signals.push(`Stack: ${asString(l.field_service_stack_detected)}`)
              }
              row.evidence.push({
                claim: "Growth lead enrichment",
                evidence: "Observed growth.leads estimate fields.",
                source: "growth.leads",
                tier: "observed",
              })
            }
          } catch {
            /* optional */
          }
        }
      }

      return {
        provider_name: "internal_growth",
        provider_type: "internal_growth",
        status: "success",
        message: "Internal growth observed signals applied.",
        contact_verifications,
        company_enrichments,
      }
    },
  }
}
