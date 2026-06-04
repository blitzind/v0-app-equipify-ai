import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { isGrowthCompanyIntelligenceSchemaReady } from "@/lib/growth/company-intelligence/company-intelligence-schema-health"

export class CompanyIntelligencePreflightError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = "CompanyIntelligencePreflightError"
    this.code = code
  }
}

export async function assertCompanyIntelligencePreflight(
  admin: SupabaseClient,
  input: { company_id: string },
): Promise<void> {
  if (!(await isGrowthCompanyIntelligenceSchemaReady(admin))) {
    throw new CompanyIntelligencePreflightError(
      "schema_not_ready",
      "Company intelligence schema is not ready. Apply migration 20270717120000_growth_engine_company_intelligence_7_6a.sql.",
    )
  }

  const { data: company, error } = await admin
    .schema("growth")
    .from("companies")
    .select("id, status")
    .eq("id", input.company_id)
    .maybeSingle()

  if (error) {
    throw new CompanyIntelligencePreflightError("company_lookup_failed", error.message)
  }
  if (!company) {
    throw new CompanyIntelligencePreflightError("company_not_found", "Canonical company not found.")
  }
  if (company.status !== "active") {
    throw new CompanyIntelligencePreflightError(
      "company_not_active",
      "Company intelligence runs require an active canonical company.",
    )
  }
}
