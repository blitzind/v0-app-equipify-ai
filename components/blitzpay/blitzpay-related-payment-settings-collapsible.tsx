"use client"

import Link from "next/link"
import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

/**
 * Cross-links to Settings → Payments anchors (same destinations as before the FCC route split).
 */
export function BlitzpayRelatedPaymentSettingsCollapsible() {
  const [open, setOpen] = useState(false)

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-xl border border-border bg-card/80 shadow-sm">
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
              The same command center lives under{" "}
              <Link href="/settings/payments#blitzpay-financial-command-center-anchor" className="text-primary underline-offset-2 hover:underline font-medium">
                Settings → Payments
              </Link>
              .
            </li>
            <li>
              Executive business health (deterministic, no AI) is at{" "}
              <Link href="/settings/payments#blitzpay-executive-dashboard-anchor" className="text-primary underline-offset-2 hover:underline font-medium">
                Settings → Payments → Executive business health
              </Link>
              .
            </li>
            <li>
              Collections copilot:{" "}
              <Link href="/settings/payments#blitzpay-collections-copilot-anchor" className="text-primary underline-offset-2 hover:underline font-medium">
                Settings → Payments → Collections copilot
              </Link>
              .
            </li>
            <li>
              Recurring revenue:{" "}
              <Link href="/settings/payments#blitzpay-recurring-revenue-anchor" className="text-primary underline-offset-2 hover:underline font-medium">
                Settings → Payments → Recurring revenue
              </Link>
              .
            </li>
            <li>
              Payroll accruals:{" "}
              <Link href="/settings/payments#blitzpay-payroll-anchor" className="text-primary underline-offset-2 hover:underline font-medium">
                Settings → Payments → Payroll
              </Link>
              .
            </li>
            <li>
              Internal books (trial balance &amp; chart):{" "}
              <Link href="/settings/payments#blitzpay-accounting-overview-anchor" className="text-primary underline-offset-2 hover:underline font-medium">
                Settings → Payments → Internal books
              </Link>
              .
            </li>
            <li>
              Vendor bills &amp; pay planning:{" "}
              <Link href="/settings/payments#blitzpay-ap-bill-pay-anchor" className="text-primary underline-offset-2 hover:underline font-medium">
                Settings → Payments → Vendor bills &amp; pay planning
              </Link>
              .
            </li>
            <li>
              Tax &amp; compliance:{" "}
              <Link href="/settings/payments#blitzpay-tax-compliance-anchor" className="text-primary underline-offset-2 hover:underline font-medium">
                Settings → Payments → Tax &amp; compliance
              </Link>
              .
            </li>
            <li>
              Financing marketplace:{" "}
              <Link href="/settings/payments#blitzpay-financing-marketplace-anchor" className="text-primary underline-offset-2 hover:underline font-medium">
                Settings → Payments → Financing marketplace
              </Link>
              .
            </li>
            <li>
              Procurement &amp; inventory finance:{" "}
              <Link href="/settings/payments#blitzpay-procurement-inventory-anchor" className="text-primary underline-offset-2 hover:underline font-medium">
                Settings → Payments → Procurement &amp; inventory finance
              </Link>
              .
            </li>
          </ul>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
