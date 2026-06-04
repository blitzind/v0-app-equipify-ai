import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { assertPersonCompanyRoleForDiscovery } from "@/lib/growth/email-discovery/email-discovery-preflight"

export class PhoneDiscoveryPreflightError extends Error {
  constructor(
    message: string,
    readonly code: "missing_company_person_role" | "too_many_candidates",
  ) {
    super(message)
    this.name = "PhoneDiscoveryPreflightError"
  }
}

export { assertPersonCompanyRoleForDiscovery }
