import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { evaluateEmailDiscoveryVerificationCertification } from "@/lib/growth/email-discovery/email-discovery-certification"

export class EmailDiscoveryPreflightError extends Error {
  constructor(
    message: string,
    readonly code: "missing_company_person_role" | "verification_not_certified" | "too_many_candidates",
  ) {
    super(message)
    this.name = "EmailDiscoveryPreflightError"
  }
}

export async function assertPersonCompanyRoleForDiscovery(
  admin: SupabaseClient,
  input: { company_id: string; person_id: string },
): Promise<void> {
  const { data, error } = await admin
    .schema("growth")
    .from("person_company_roles")
    .select("id")
    .eq("company_id", input.company_id)
    .eq("person_id", input.person_id)
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`assertPersonCompanyRoleForDiscovery: ${error.message}`)
  if (!data) {
    throw new EmailDiscoveryPreflightError(
      "Discovery requires an existing growth.person_company_roles row for this company_id and person_id.",
      "missing_company_person_role",
    )
  }
}

export function assertEmailDiscoveryVerificationReadyForRun(options?: {
  require_production_safe?: boolean
}): void {
  const cert = evaluateEmailDiscoveryVerificationCertification()
  if (options?.require_production_safe && !cert.production_safe) {
    throw new EmailDiscoveryPreflightError(
      cert.blockers.join(" ") || "Email verification is not production-safe.",
      "verification_not_certified",
    )
  }
}

