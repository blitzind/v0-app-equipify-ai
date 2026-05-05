"use client"

import * as React from "react"
import Link from "next/link"
import { toast as toastFn } from "@/hooks/use-toast"
import { ToastAction, type ToastActionElement } from "@/components/ui/toast"
import type { RecordEligibility } from "@/lib/billing/record-eligibility"
import { maintenancePlanUpgradeMessage } from "@/lib/billing/feature-access"
import type { PlanId } from "@/lib/plans"

export const BILLING_SETTINGS_PATH = "/settings/billing"

function billingOpenToastAction(): ToastActionElement {
  return React.createElement(
    ToastAction,
    { altText: "Open billing", asChild: true },
    React.createElement(Link, { href: BILLING_SETTINGS_PATH, className: "font-medium" }, "Open billing"),
  ) as unknown as ToastActionElement
}

/**
 * When true, the create action should be aborted (toast already shown).
 * Use on primary buttons / before opening modals.
 */
export function blockCreateIfNotEligible(eligibility: RecordEligibility): boolean {
  if (eligibility.ok) return false
  toastFn({
    variant: "destructive",
    title: "Cannot create",
    description: eligibility.message,
    action: billingOpenToastAction(),
  })
  return true
}

/**
 * Maintenance plans: billing OK + Growth/Scale (or trial with feature access via entitlements).
 */
export function blockMaintenancePlanDialogIfNotEligible(
  standard: RecordEligibility,
  maintenancePlansFeatureAllowed: boolean,
): boolean {
  if (blockCreateIfNotEligible(standard)) return true
  if (!maintenancePlansFeatureAllowed) {
    toastFn({
      variant: "destructive",
      title: "Cannot create plan",
      description: maintenancePlanUpgradeMessage("solo" as PlanId),
      action: billingOpenToastAction(),
    })
    return true
  }
  return false
}

/** Submit-time guard — same rules as {@link blockCreateIfNotEligible}. */
export function toastRecordEligibilityBlocked(eligibility: RecordEligibility): boolean {
  return blockCreateIfNotEligible(eligibility)
}
