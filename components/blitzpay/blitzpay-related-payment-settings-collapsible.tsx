"use client"

import Link from "next/link"
import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import { blitzpayFccHref } from "@/lib/navigation/blitzpay-financial-command-center-nav"

/**
 * Cross-links between BlitzPay Financial Command Center sections and Settings → Payments (configuration).
 */
export function BlitzpayRelatedPaymentSettingsCollapsible() {
  const [open, setOpen] = useState(false)

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-xl border border-border bg-white dark:bg-card shadow-sm">
      <CollapsibleTrigger
        type="button"
        className={cn(
          "flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-foreground",
          "hover:bg-muted/40 rounded-xl transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
      >
        <span>Where these tools live</span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180")}
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden">
        <div className="border-t border-border px-4 pb-4 pt-1">
          <ul className="space-y-2.5 text-sm text-muted-foreground leading-relaxed list-none">
            <li>
              <Link href={blitzpayFccHref("command-center-data")} className="text-primary underline-offset-2 hover:underline font-medium">
                Command center data
              </Link>{" "}
              and related financial workspaces are on this BlitzPay page (use the section navigation).
            </li>
            <li>
              Executive business health (deterministic, no AI):{" "}
              <Link href={blitzpayFccHref("executive-health")} className="text-primary underline-offset-2 hover:underline font-medium">
                Executive Health
              </Link>
              .
            </li>
            <li>
              Collections copilot &amp; engine:{" "}
              <Link href={blitzpayFccHref("collections")} className="text-primary underline-offset-2 hover:underline font-medium">
                Collections
              </Link>
              .
            </li>
            <li>
              Recurring revenue:{" "}
              <Link href={blitzpayFccHref("recurring-revenue")} className="text-primary underline-offset-2 hover:underline font-medium">
                Recurring Revenue &amp; Renewals
              </Link>
              .
            </li>
            <li>
              Payroll &amp; commissions:{" "}
              <Link href={blitzpayFccHref("payroll-commissions")} className="text-primary underline-offset-2 hover:underline font-medium">
                Payroll &amp; Commissions
              </Link>
              .
            </li>
            <li>
              Internal books (trial balance &amp; chart):{" "}
              <Link href={blitzpayFccHref("internal-books")} className="text-primary underline-offset-2 hover:underline font-medium">
                Internal Books
              </Link>
              .
            </li>
            <li>
              Vendor bills &amp; pay planning:{" "}
              <Link href={blitzpayFccHref("vendor-bills")} className="text-primary underline-offset-2 hover:underline font-medium">
                Vendor Bills &amp; Pay Planning
              </Link>
              .
            </li>
            <li>
              Tax &amp; compliance:{" "}
              <Link href={blitzpayFccHref("tax-compliance")} className="text-primary underline-offset-2 hover:underline font-medium">
                Tax &amp; Compliance
              </Link>
              .
            </li>
            <li>
              Financing marketplace:{" "}
              <Link href={blitzpayFccHref("financing-marketplace")} className="text-primary underline-offset-2 hover:underline font-medium">
                Financing Marketplace
              </Link>
              .
            </li>
            <li>
              Procurement &amp; inventory finance:{" "}
              <Link href={blitzpayFccHref("procurement-inventory")} className="text-primary underline-offset-2 hover:underline font-medium">
                Procurement &amp; Inventory Finance
              </Link>
              .
            </li>
            <li>
              Stripe Connect onboarding, fees, payment methods, and reminders:{" "}
              <Link href="/settings/payments" className="text-primary underline-offset-2 hover:underline font-medium">
                Settings → Payments
              </Link>
              .
            </li>
            <li>
              Contractor treasury, payout ledger sync, and operating cash:{" "}
              <Link href={blitzpayFccHref("operating-cash")} className="text-primary underline-offset-2 hover:underline font-medium">
                Operating cash
              </Link>
              .
            </li>
          </ul>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
