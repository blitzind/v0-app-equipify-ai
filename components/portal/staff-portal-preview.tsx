"use client"

import Link from "next/link"
import { ArrowLeft, Eye, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PortalWorkspaceBrand } from "@/components/portal/portal-workspace-brand"

/**
 * Staff-only portal preview — read-only shell; no customer portal session required.
 */
export function StaffPortalPreview({
  organizationName,
  logoUrl,
}: {
  organizationName: string
  logoUrl: string | null
}) {
  return (
    <div className="min-h-screen" style={{ background: "var(--portal-bg)" }}>
      <header
        className="sticky top-0 z-40 border-b"
        style={{ background: "var(--portal-surface)", borderColor: "var(--portal-border)" }}
      >
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <PortalWorkspaceBrand
              organizationName={organizationName}
              logoUrl={logoUrl}
              size="compact"
              equipifyVariant="onLight"
              className="min-w-0"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <span
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
              style={{
                borderColor: "color-mix(in srgb, var(--portal-accent) 35%, transparent)",
                color: "var(--portal-accent)",
                background: "color-mix(in srgb, var(--portal-accent) 10%, transparent)",
              }}
            >
              <Eye className="h-3 w-3" aria-hidden />
              Staff preview
            </span>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1" asChild>
              <Link href="/settings/portal">
                <ArrowLeft className="h-3 w-3" aria-hidden />
                Portal settings
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div
          role="status"
          className="rounded-xl border px-4 py-3 flex gap-3 text-sm leading-relaxed"
          style={{
            background: "color-mix(in srgb, var(--portal-accent) 8%, transparent)",
            borderColor: "color-mix(in srgb, var(--portal-accent) 28%, transparent)",
            color: "var(--portal-foreground)",
          }}
        >
          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "var(--portal-accent)" }} aria-hidden />
          <div className="min-w-0 space-y-1">
            <p className="font-medium">This is not a customer sign-in session.</p>
            <p className="text-[13px]" style={{ color: "var(--portal-nav-text)" }}>
              You are viewing how the customer portal looks for your workspace. Customer accounts still sign in from
              invite links or tokens — we never bypass real portal authentication for customers.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {["Equipment", "Work orders", "Invoices", "Documents"].map((label) => (
            <div
              key={label}
              className="rounded-xl border px-4 py-5 text-center"
              style={{
                background: "var(--portal-surface)",
                borderColor: "var(--portal-border)",
              }}
            >
              <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--portal-nav-text)" }}>
                {label}
              </p>
              <p className="text-2xl font-semibold tabular-nums mt-2" style={{ color: "var(--portal-nav-text)" }}>
                —
              </p>
              <p className="text-[11px] mt-2" style={{ color: "var(--portal-nav-text)" }}>
                Preview only — live totals appear after customer sign-in.
              </p>
            </div>
          ))}
        </div>

        <div
          className="rounded-xl border px-4 py-5"
          style={{
            background: "var(--portal-surface)",
            borderColor: "var(--portal-border)",
          }}
        >
          <p className="text-sm font-semibold" style={{ color: "var(--portal-foreground)" }}>
            Customer experience
          </p>
          <p className="text-[13px] mt-2 leading-relaxed" style={{ color: "var(--portal-nav-text)" }}>
            Customers see workspace branding at the top of every portal screen. Invite links continue to use secure,
            time-bound tokens — this preview does not grant access to customer records.
          </p>
        </div>
      </main>
    </div>
  )
}
