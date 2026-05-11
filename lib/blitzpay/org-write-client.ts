import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import type { BlitzPayGate } from "@/lib/blitzpay/access"

/** Owner/admin JWT updates RLS; platform admin uses service role (may lack org owner role). */
export async function supabaseForBlitzPayOrgWrite(gate: Extract<BlitzPayGate, { ok: true }>): Promise<SupabaseClient> {
  if (gate.platformAdmin) {
    return createServiceRoleSupabaseClient()
  }
  return createServerSupabaseClient()
}
