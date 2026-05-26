import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthContactDiscoveryProvider,
  GrowthContactDiscoveryProviderQuery,
  GrowthContactDiscoveryProviderRawContact,
} from "@/lib/growth/contact-discovery/contact-discovery-provider-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export function createInternalGrowthContactDiscoveryProvider(
  admin: SupabaseClient,
): GrowthContactDiscoveryProvider {
  return {
    provider_name: "internal_growth",
    provider_type: "internal_growth",
    isConfigured: () => true,
    discover: async (input: GrowthContactDiscoveryProviderQuery) => {
      const leadId = input.growth_lead_id
      if (!leadId) {
        return {
          provider_name: "internal_growth",
          provider_type: "internal_growth",
          status: "skipped",
          message: "No matched Growth lead for internal contact index.",
          contacts: [],
        }
      }

      try {
        const { data } = await admin
          .schema("growth")
          .from("lead_decision_makers")
          .select("id, full_name, title, email, phone, linkedin_url, confidence, evidence_excerpt, status")
          .eq("lead_id", leadId)
          .neq("status", "rejected")
          .order("is_primary", { ascending: false })
          .limit(input.limit ?? 20)

        const contacts: GrowthContactDiscoveryProviderRawContact[] = []
        for (const row of data ?? []) {
          const r = row as Record<string, unknown>
          const full_name = asString(r.full_name)
          if (!full_name) continue
          const hasPii = Boolean(asString(r.email) || asString(r.phone) || asString(r.linkedin_url))
          contacts.push({
            full_name,
            job_title: asString(r.title) || null,
            email: asString(r.email) || null,
            phone: asString(r.phone) || null,
            linkedin_url: asString(r.linkedin_url) || null,
            pii_observed: hasPii,
            confidence: typeof r.confidence === "number" ? r.confidence : 0.65,
            evidence: [
              {
                claim: "Growth lead decision maker",
                evidence:
                  asString(r.evidence_excerpt) ||
                  `Observed on growth.lead_decision_makers (${asString(r.status) || "suspected"}).`,
                source: "growth.lead_decision_makers",
              },
            ],
            source_attribution: [
              {
                source: "growth.lead_decision_makers",
                provider_type: "internal_growth",
                provider_name: "internal_growth",
                signal: "decision_maker_record",
                evidence: `Lead ${leadId} decision maker ${asString(r.id)}.`,
                confidence: typeof r.confidence === "number" ? r.confidence : 0.65,
              },
            ],
            metadata: { lead_decision_maker_id: asString(r.id), lead_id: leadId },
          })
        }

        return {
          provider_name: "internal_growth",
          provider_type: "internal_growth",
          status: contacts.length ? "success" : "success",
          message:
            contacts.length > 0
              ? `${contacts.length} contact(s) from Growth lead decision makers.`
              : "No decision makers on matched Growth lead.",
          contacts,
        }
      } catch (err) {
        return {
          provider_name: "internal_growth",
          provider_type: "internal_growth",
          status: "failed",
          message: err instanceof Error ? err.message : "Internal growth provider failed.",
          contacts: [],
          error: err instanceof Error ? err.message : String(err),
        }
      }
    },
  }
}
