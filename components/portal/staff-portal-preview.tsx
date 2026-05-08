"use client"

import Link from "next/link"
import {
  ArrowLeft,
  Calendar,
  Eye,
  FileBadge,
  Receipt,
  ShieldAlert,
  Wrench,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { PortalWorkspaceBrand } from "@/components/portal/portal-workspace-brand"
import { ProvidedByEquipify } from "@/components/portal/provided-by-equipify"

const SAMPLE_STATS = [
  { label: "Equipment", value: "12", hint: "Sample totals — not your live data." },
  { label: "Work orders", value: "4 open", hint: "Sample preview only." },
  { label: "Invoices", value: "2 unpaid", hint: "Sample preview only." },
  { label: "Documents", value: "18 available", hint: "Sample preview only." },
] as const

/**
 * Staff-only portal preview — read-only shell; no customer portal session required.
 * Numbers and list rows are fictional placeholders (not persisted, not from customer APIs).
 */
export function StaffPortalPreview({
  organizationName,
  logoUrl,
}: {
  organizationName: string
  logoUrl: string | null
}) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--portal-bg)" }}>
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

      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8 space-y-6 flex-1 w-full">
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
              invite links or tokens — we never bypass real portal authentication for customers. Everything below is
              fictional sample content.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {SAMPLE_STATS.map(({ label, value, hint }) => (
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
              <p className="text-2xl font-semibold tabular-nums mt-2" style={{ color: "var(--portal-foreground)" }}>
                {value}
              </p>
              <p className="text-[11px] mt-2" style={{ color: "var(--portal-nav-text)" }}>
                {hint}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <section
            className="rounded-xl border p-4 flex flex-col gap-3"
            style={{
              background: "var(--portal-surface)",
              borderColor: "var(--portal-border)",
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Calendar className="h-4 w-4 shrink-0" style={{ color: "var(--portal-accent)" }} aria-hidden />
                <h2 className="text-sm font-semibold truncate" style={{ color: "var(--portal-foreground)" }}>
                  Upcoming service
                </h2>
              </div>
              <span
                className="shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border"
                style={{
                  borderColor: "var(--portal-border)",
                  color: "var(--portal-nav-text)",
                }}
              >
                Sample
              </span>
            </div>
            <div className="space-y-1 text-[13px]" style={{ color: "var(--portal-nav-text)" }}>
              <p className="font-medium" style={{ color: "var(--portal-foreground)" }}>
                Annual inspection — Truck mixers
              </p>
              <p>Tuesday, June 17 · 9:00 AM – 11:00 AM</p>
              <p className="text-[11px] pt-1">Preview appointment — not a real schedule.</p>
            </div>
          </section>

          <section
            className="rounded-xl border p-4 flex flex-col gap-3"
            style={{
              background: "var(--portal-surface)",
              borderColor: "var(--portal-border)",
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Receipt className="h-4 w-4 shrink-0" style={{ color: "var(--portal-accent)" }} aria-hidden />
                <h2 className="text-sm font-semibold truncate" style={{ color: "var(--portal-foreground)" }}>
                  Recent invoice
                </h2>
              </div>
              <span
                className="shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border"
                style={{
                  borderColor: "var(--portal-border)",
                  color: "var(--portal-nav-text)",
                }}
              >
                Sample
              </span>
            </div>
            <div className="space-y-1 text-[13px]" style={{ color: "var(--portal-nav-text)" }}>
              <p className="font-medium" style={{ color: "var(--portal-foreground)" }}>
                Invoice #2048 · Due June 5
              </p>
              <p className="tabular-nums">Balance due · $1,240.00</p>
              <p className="text-[11px] pt-1">Preview row — amounts are illustrative.</p>
            </div>
          </section>

          <section
            className="rounded-xl border p-4 flex flex-col gap-3"
            style={{
              background: "var(--portal-surface)",
              borderColor: "var(--portal-border)",
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <FileBadge className="h-4 w-4 shrink-0" style={{ color: "var(--portal-accent)" }} aria-hidden />
                <h2 className="text-sm font-semibold truncate" style={{ color: "var(--portal-foreground)" }}>
                  Certificate / document
                </h2>
              </div>
              <span
                className="shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border"
                style={{
                  borderColor: "var(--portal-border)",
                  color: "var(--portal-nav-text)",
                }}
              >
                Sample
              </span>
            </div>
            <div className="space-y-1 text-[13px]" style={{ color: "var(--portal-nav-text)" }}>
              <p className="font-medium" style={{ color: "var(--portal-foreground)" }}>
                Annual safety certification
              </p>
              <p>PDF · Issued May 1 · Valid through April 30 next year</p>
              <p className="text-[11px] pt-1">Preview document — not an actual file.</p>
            </div>
          </section>

          <section
            className="rounded-xl border p-4 flex flex-col gap-3"
            style={{
              background: "var(--portal-surface)",
              borderColor: "var(--portal-border)",
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Wrench className="h-4 w-4 shrink-0" style={{ color: "var(--portal-accent)" }} aria-hidden />
                <h2 className="text-sm font-semibold truncate" style={{ color: "var(--portal-foreground)" }}>
                  Equipment
                </h2>
              </div>
              <span
                className="shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border"
                style={{
                  borderColor: "var(--portal-border)",
                  color: "var(--portal-nav-text)",
                }}
              >
                Sample
              </span>
            </div>
            <div className="space-y-1 text-[13px]" style={{ color: "var(--portal-nav-text)" }}>
              <p className="font-medium" style={{ color: "var(--portal-foreground)" }}>
                Forklift · Bay 3
              </p>
              <p>Model FX-200 · Serial ending in ···482</p>
              <p className="text-[11px] pt-1">Preview equipment — not from your fleet.</p>
            </div>
          </section>
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

      <footer
        className="mt-auto border-t px-4 py-3 sm:px-6 flex items-center justify-center"
        style={{
          borderColor: "rgba(255, 255, 255, 0.06)",
          background: "#0F172A",
        }}
      >
        <ProvidedByEquipify variant="onDark" size="lg" logoHref="https://equipify.ai" />
      </footer>
    </div>
  )
}
