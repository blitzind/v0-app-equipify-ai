/** Mint a platform-admin Supabase bearer for deployed Growth API probes. */

import { createClient } from "@supabase/supabase-js"
import { getPlatformAdminEmails } from "@/lib/platform-admin-policy"

export const GROWTH_PLATFORM_ADMIN_BEARER_PROBE_QA_MARKER =
  "growth-platform-admin-bearer-probe-v14-3f" as const

export async function mintGrowthPlatformAdminBearerToken(input: {
  supabase_url: string
  service_role_key: string
  anon_key: string
  admin_email?: string | null
}): Promise<{ access_token: string | null; email: string | null; error: string | null }> {
  const email = (input.admin_email ?? getPlatformAdminEmails()[0] ?? "").trim().toLowerCase()
  if (!email) {
    return { access_token: null, email: null, error: "no_platform_admin_email_configured" }
  }

  const admin = createClient(input.supabase_url, input.service_role_key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const anon = createClient(input.supabase_url, input.anon_key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const link = await admin.auth.admin.generateLink({ type: "magiclink", email })
  const hashed_token = link.data?.properties?.hashed_token
  if (link.error || !hashed_token) {
    return {
      access_token: null,
      email,
      error: link.error?.message ?? "generate_link_failed",
    }
  }

  const verified = await anon.auth.verifyOtp({
    token_hash: hashed_token,
    type: "email",
  })

  const access_token = verified.data.session?.access_token ?? null
  if (!access_token) {
    return {
      access_token: null,
      email,
      error: verified.error?.message ?? "verify_otp_failed",
    }
  }

  return { access_token, email, error: null }
}
