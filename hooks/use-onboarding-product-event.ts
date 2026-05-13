"use client"

import type { OnboardingProductEventKey } from "@/lib/onboarding-analytics/event-keys"

export function sendOnboardingProductEvent(
  organizationId: string | null | undefined,
  eventKey: OnboardingProductEventKey,
  subjectKey?: string | null,
): void {
  if (!organizationId) return
  void fetch(`/api/organizations/${encodeURIComponent(organizationId)}/onboarding-analytics`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventKey,
      subjectKey: subjectKey && subjectKey.length > 0 ? subjectKey : null,
    }),
  }).catch(() => {
    /* non-fatal */
  })
}
