import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { isGrowthBuyingCommitteeIntelligenceSchemaReady } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-schema-health"
import { GROWTH_BUYING_COMMITTEE_INTELLIGENCE_MIGRATION } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-types"

export class BuyingCommitteeIntelligencePreflightError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = "BuyingCommitteeIntelligencePreflightError"
    this.code = code
  }
}

export async function assertBuyingCommitteeIntelligencePreflight(
  admin: SupabaseClient,
  input: { company_id: string },
): Promise<void> {
  if (!(await isGrowthBuyingCommitteeIntelligenceSchemaReady(admin))) {
    throw new BuyingCommitteeIntelligencePreflightError(
      "schema_not_ready",
      `Buying committee intelligence schema is not ready. Apply migration ${GROWTH_BUYING_COMMITTEE_INTELLIGENCE_MIGRATION}.`,
    )
  }

  const { data: company, error } = await admin
    .schema("growth")
    .from("companies")
    .select("id, status")
    .eq("id", input.company_id)
    .maybeSingle()

  if (error) {
    throw new BuyingCommitteeIntelligencePreflightError("company_lookup_failed", error.message)
  }
  if (!company) {
    throw new BuyingCommitteeIntelligencePreflightError("company_not_found", "Canonical company not found.")
  }
  if (company.status !== "active") {
    throw new BuyingCommitteeIntelligencePreflightError(
      "company_not_active",
      "Buying committee intelligence runs require an active canonical company.",
    )
  }
}
