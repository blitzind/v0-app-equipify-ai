import "server-only"

import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import type { OnboardingProductEventKey } from "@/lib/onboarding-analytics/event-keys"

function normalizeVerticalKey(raw: string | null | undefined): string | null {
  if (!raw) return null
  const s = raw.trim().toLowerCase().replace(/-/g, "_")
  if (!/^[a-z0-9_]+$/.test(s) || s.length > 64) return null
  return s
}

function normalizeSubjectKey(raw: string | null | undefined): string | null {
  if (!raw) return null
  const s = raw.trim().toLowerCase().replace(/-/g, "_")
  if (!/^[a-z0-9_]+$/.test(s) || s.length > 80) return null
  return s
}

/** Best-effort insert; failures are non-fatal for UX. */
export async function recordOnboardingProductEvent(args: {
  organizationId: string
  userId: string
  eventKey: OnboardingProductEventKey
  verticalKey?: string | null
  subjectKey?: string | null
}): Promise<void> {
  let supabase
  try {
    supabase = createServiceRoleSupabaseClient()
  } catch {
    return
  }

  const vertical = normalizeVerticalKey(args.verticalKey ?? undefined)
  const subject = normalizeSubjectKey(args.subjectKey ?? undefined)

  const { error } = await supabase.from("onboarding_product_events").insert({
    organization_id: args.organizationId,
    user_id: args.userId,
    event_key: args.eventKey,
    vertical_key: vertical,
    subject_key: subject,
  })

  if (error && process.env.NODE_ENV === "development") {
    console.warn("[onboarding_analytics] insert skipped or failed", error.message)
  }
}
