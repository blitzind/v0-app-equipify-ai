"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { AlertTriangle, X } from "lucide-react"
import { useState } from "react"
import { useBillingAccessOptional } from "@/lib/billing-access-context"
import {
  getBillingWarningMessage,
  shouldShowBillingWarning,
} from "@/lib/billing/access"
import { getTrialDaysRemaining, isTrialActive } from "@/lib/billing/subscriptions"
import { BR_STACK_CLEAR_AIDEN } from "@/lib/layout/aiden-safe-area"
import { cn } from "@/lib/utils"

/**
 * Subtle dashboard strip for trial / payment / cancel reminders.
 * Hidden on billing settings (user is already there).
 */
export function BillingWarningBanner() {
  const ctx = useBillingAccessOptional()
  const pathname = usePathname()
  const [dismissed, setDismissed] = useState(false)

  if (!ctx || ctx.status !== "ready" || dismissed) return null
  if (pathname?.startsWith("/settings/billing")) return null

  const sub = ctx.subscription
  if (!shouldShowBillingWarning(sub)) return null
  const trialLive = isTrialActive(sub)
  const trialDaysLeft = trialLive ? getTrialDaysRemaining(sub) : 0
  if (trialLive && trialDaysLeft > 6) return null

  const trialExpired = !!sub && sub.status === "trialing" && !trialLive
  const message = trialExpired
    ? "Your trial has ended. Choose a plan now to restore access and continue creating records."
    : getBillingWarningMessage(sub)
  if (!message) return null
  const trialTone =
    trialLive && trialDaysLeft <= 2
      ? "urgent"
      : trialLive && trialDaysLeft <= 6
      ? "warning"
      : trialExpired
      ? "urgent"
      : "warning"
  const showStickyTrialPrompt = trialLive && trialDaysLeft <= 6

  const toneClasses =
    trialTone === "urgent"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : trialTone === "info"
      ? "border-[color:var(--ds-info-border)] bg-[color:var(--ds-info-bg)] text-[color:var(--ds-info-text)]"
      : "border-amber-500/25 bg-amber-500/10 text-amber-950 dark:text-amber-100"

  const iconClasses =
    trialTone === "urgent"
      ? "text-destructive"
      : trialTone === "info"
      ? "text-[color:var(--ds-info-text)]"
      : "text-amber-600 dark:text-amber-400"

  const linkClasses =
    trialTone === "urgent"
      ? "text-destructive underline-offset-2 hover:underline"
      : trialTone === "info"
      ? "text-[color:var(--ds-info-text)] underline-offset-2 hover:underline"
      : "text-amber-900 dark:text-amber-50 underline-offset-2 hover:underline"

  const closeClasses =
    trialTone === "urgent"
      ? "hover:bg-destructive/20 text-destructive"
      : trialTone === "info"
      ? "hover:bg-[color:var(--ds-info-bg)] text-[color:var(--ds-info-text)]"
      : "hover:bg-amber-500/20 text-amber-800 dark:text-amber-200"

  return (
    <>
      <div
        className={cn(
          "relative z-[220] shrink-0 flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5",
          "border-b",
          toneClasses,
          "text-xs sm:text-sm",
        )}
      >
        <AlertTriangle className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0", iconClasses)} />
        <p className="flex-1 min-w-0 leading-relaxed">
          {message}{" "}
          <Link
            href="/settings/billing"
            className={cn("font-semibold", linkClasses)}
          >
            Open billing
          </Link>
        </p>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => setDismissed(true)}
          className={cn("shrink-0 p-1 rounded-md", closeClasses)}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {showStickyTrialPrompt && (
        <div
          className={cn(
            BR_STACK_CLEAR_AIDEN,
            "z-[230] max-w-[310px] rounded-lg border border-[color:var(--status-warning)] bg-background shadow-lg p-3",
          )}
        >
          <p className="text-xs text-foreground leading-relaxed">
            Your trial ends soon. Choose a plan to keep access.
          </p>
          <Link
            href="/settings/billing#plan-comparison"
            className="mt-2 inline-flex items-center justify-center h-8 px-3 rounded-md text-xs font-semibold bg-cta text-cta-foreground hover:bg-cta-hover"
          >
            Choose plan
          </Link>
        </div>
      )}
    </>
  )
}
