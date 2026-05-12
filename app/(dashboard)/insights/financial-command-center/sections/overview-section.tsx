"use client"

import { BlitzpayRelatedPaymentSettingsCollapsible } from "@/components/blitzpay/blitzpay-related-payment-settings-collapsible"

export function OverviewSection() {
  return (
    <div className="flex flex-col gap-5 min-w-0">
      <BlitzpayRelatedPaymentSettingsCollapsible />
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] space-y-3 text-sm text-muted-foreground leading-relaxed">
        <p className="text-foreground font-medium">Command center overview</p>
        <p>
          BlitzPay is orchestration and advisory: it helps you see cash, receivables, payables, renewals, and operational
          financial health in one place.{" "}
          <span className="text-foreground font-medium">Stripe remains the source of truth</span> for actual money
          movement, balances, payouts, and settlement — review outcomes in Stripe and your bank where applicable.
        </p>
        <p>
          Use the section navigation to open one workspace at a time. Only the section you are viewing loads its
          heavier data and panels, so the page stays responsive.
        </p>
      </div>
    </div>
  )
}
