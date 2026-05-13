"use client"

import { useEffect } from "react"
import { sendOnboardingProductEvent } from "@/hooks/use-onboarding-product-event"

type Counts = {
  customersNonSample?: number
  equipmentNonSample?: number
  workOrdersNonSample?: number
  quotesNonSample?: number
  invoicesNonDraftNonSample?: number
  maintenancePlansNonSample?: number
}

/**
 * Emits milestone analytics once per browser session when org counts cross thresholds (org-scoped keys only).
 */
export function OnboardingMilestoneTelemetry({
  organizationId,
  counts,
}: {
  organizationId: string | null
  counts: Counts | undefined
}) {
  useEffect(() => {
    if (!organizationId || !counts || typeof window === "undefined") return

    const sessionKey = (suffix: string) => `equipify_onb_milestone_${organizationId}_${suffix}`

    const tryFire = (suffix: string, event: Parameters<typeof sendOnboardingProductEvent>[1], cond: boolean) => {
      if (!cond || sessionStorage.getItem(sessionKey(suffix))) return
      sessionStorage.setItem(sessionKey(suffix), "1")
      sendOnboardingProductEvent(organizationId, event)
    }

    tryFire("eq", "onboarding_first_equipment_created", (counts.equipmentNonSample ?? 0) >= 1)
    tryFire("wo", "onboarding_first_work_order_created", (counts.workOrdersNonSample ?? 0) >= 1)
    tryFire("mp", "onboarding_first_pm_plan_created", (counts.maintenancePlansNonSample ?? 0) >= 1)
    tryFire(
      "invq",
      "onboarding_first_invoice_or_quote_created",
      (counts.invoicesNonDraftNonSample ?? 0) >= 1 || (counts.quotesNonSample ?? 0) >= 1,
    )
  }, [organizationId, counts])

  return null
}
