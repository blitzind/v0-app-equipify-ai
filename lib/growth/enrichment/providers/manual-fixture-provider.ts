import type {
  GrowthEnrichmentProvider,
  GrowthEnrichmentProviderQuery,
} from "@/lib/growth/enrichment/enrichment-provider-types"

/** Fixture signals — industry/tech labels only, no fabricated PII validation. */
export function createManualFixtureEnrichmentProvider(): GrowthEnrichmentProvider {
  return {
    provider_name: "enrichment_manual_fixture",
    provider_type: "manual_fixture",
    isConfigured: () => true,
    enrich: async (input: GrowthEnrichmentProviderQuery) => {
      const contact_verifications = []
      if (input.contact_candidate_id) {
        contact_verifications.push({
          contact_candidate_id: input.contact_candidate_id,
          email_status: input.contact_email ? "insufficient_evidence" : "not_present",
          phone_status: input.contact_phone ? "insufficient_evidence" : "not_present",
          linkedin_status: input.contact_linkedin ? "insufficient_evidence" : "not_present",
          verification_confidence: 0.35,
          verification_reason:
            "Fixture mode — PII channels require observed internal evidence; no guessed validation.",
          evidence: [
            {
              claim: "Fixture verification",
              evidence: "Manual fixture provider does not assert email/phone/LinkedIn validity.",
              source: "growth.enrichment.manual_fixture",
              tier: "provider",
            },
          ],
          source_attribution: [
            {
              source: "growth.enrichment.manual_fixture",
              provider_type: "manual_fixture",
              provider_name: "enrichment_manual_fixture",
              tier: "provider",
              signal: "fixture_verification",
              evidence: "Infrastructure placeholder for operator UI.",
              confidence: 0.35,
            },
          ],
          raw_payload: { fixture: true },
        })
      }

      const company_enrichments = []
      if (input.company_candidate_id) {
        const name = (input.company_name ?? "").toLowerCase()
        const tech: string[] = []
        const service: string[] = []
        if (name.includes("biomed") || name.includes("imaging")) {
          tech.push("Service management platform (fixture)")
          service.push("Biomedical equipment maintenance (fixture)")
        }
        if (name.includes("field") || name.includes("hvac")) {
          tech.push("Field service routing (fixture)")
          service.push("Commercial HVAC service (fixture)")
        }

        company_enrichments.push({
          company_candidate_id: input.company_candidate_id,
          employee_estimate: "21-50 (fixture band)",
          revenue_estimate: null,
          industry: input.company_name?.includes("Biomed")
            ? "Biomedical equipment service"
            : "Field service",
          subindustry: null,
          technology_signals: tech,
          crm_signals: [],
          service_signals: service,
          location_signals: input.domain ? [`Domain ${input.domain} (fixture)`] : [],
          confidence: 0.52,
          evidence: [
            {
              claim: "Fixture company enrichment",
              evidence: "Manual fixture industry and technology labels — not third-party enrichment.",
              source: "growth.enrichment.manual_fixture",
              tier: "provider",
            },
          ],
          source_attribution: [
            {
              source: "growth.enrichment.manual_fixture",
              provider_type: "manual_fixture",
              provider_name: "enrichment_manual_fixture",
              tier: "provider",
              signal: "fixture_enrichment",
              evidence: "Labeled fixture signals for Prospect Search / Operator Workspace.",
              confidence: 0.52,
            },
          ],
          raw_payload: { fixture: true },
        })
      }

      return {
        provider_name: "enrichment_manual_fixture",
        provider_type: "manual_fixture",
        status: "success",
        message: "Fixture verification and enrichment labels applied.",
        contact_verifications,
        company_enrichments,
      }
    },
  }
}
