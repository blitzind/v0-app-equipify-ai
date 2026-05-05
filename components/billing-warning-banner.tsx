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

  const message = getBillingWarningMessage(sub)
  if (!message) return null

  return (
    <div
      className={cn(
        "shrink-0 flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5",
        "border-b border-amber-500/25 bg-amber-500/10 text-amber-950 dark:text-amber-100",
        "text-xs sm:text-sm",
      )}
    >
      <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <p className="flex-1 min-w-0 leading-relaxed">
        {message}{" "}
        <Link
          href="/settings/billing"
          className="font-semibold text-amber-900 dark:text-amber-50 underline-offset-2 hover:underline"
        >
          Open billing
        </Link>
      </p>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setDismissed(true)}
        className="shrink-0 p-1 rounded-md hover:bg-amber-500/20 text-amber-800 dark:text-amber-200"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
