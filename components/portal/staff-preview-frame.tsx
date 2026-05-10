"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  ClipboardList,
  Eye,
  FilePen,
  FileText,
  Folder,
  Inbox,
  LayoutDashboard,
  Receipt,
  ShieldCheck,
  ShieldAlert,
  UserCog,
  Wrench,
} from "lucide-react"
import type { ElementType } from "react"
import { Button } from "@/components/ui/button"
import { PortalWorkspaceBrand } from "@/components/portal/portal-workspace-brand"
import { ProvidedByEquipify } from "@/components/portal/provided-by-equipify"
import { StaffPortalPreviewCustomerPicker } from "@/components/portal/staff-portal-preview-customer-picker"
import type { StaffPortalPreviewSnapshot } from "@/lib/portal/staff-portal-preview-data"
import { buildStaffPreviewHref } from "@/lib/portal/staff-preview-href"
import { cn } from "@/lib/utils"

const PREVIEW_NAV: Array<{ path: string; label: string; icon: ElementType }> = [
  { path: "/portal/preview", label: "Overview", icon: LayoutDashboard },
  { path: "/portal/preview/service-requests", label: "Requests", icon: Inbox },
  { path: "/portal/preview/equipment", label: "Equipment", icon: Wrench },
  { path: "/portal/preview/work-orders", label: "Work Orders", icon: ClipboardList },
  { path: "/portal/preview/maintenance", label: "Maintenance", icon: Calendar },
  { path: "/portal/preview/invoices", label: "Invoices", icon: Receipt },
  { path: "/portal/preview/quotes", label: "Quotes", icon: FilePen },
  { path: "/portal/preview/documents", label: "Documents", icon: Folder },
  { path: "/portal/preview/reports", label: "Reports", icon: FileText },
  { path: "/portal/preview/certificates", label: "Certificates", icon: ShieldCheck },
  { path: "/portal/preview/account", label: "Account", icon: UserCog },
]

/** Longest path wins (except overview stays exact-only). */
export function staffPreviewCurrentNavPath(pathname: string): string {
  const p = pathname.split("?")[0]!.replace(/\/$/, "") || "/"
  if (p === "/portal/preview") return "/portal/preview"
  const rest = PREVIEW_NAV.filter((x) => x.path !== "/portal/preview").sort((a, b) => b.path.length - a.path.length)
  for (const { path } of rest) {
    if (p === path || p.startsWith(`${path}/`)) return path
  }
  return "/portal/preview"
}

export function StaffPreviewFrame({
  organizationId,
  customerId,
  organizationName,
  logoUrl,
  portalAccentCssVariables: accentVars,
  snapshot,
  children,
}: {
  organizationId: string
  customerId: string
  organizationName: string
  logoUrl: string | null
  portalAccentCssVariables: Record<string, string>
  snapshot: StaffPortalPreviewSnapshot
  children: ReactNode
}) {
  const pathname = usePathname() ?? ""
  const navPath = staffPreviewCurrentNavPath(pathname)
  const customerLabel = snapshot.previewCustomer?.companyName ?? "Customer account"
  const previewCust = snapshot.previewCustomer
  const rowBadge =
    !snapshot.hasPreviewCustomer ? "Preview"
    : previewCust?.source === "sample" ? "Sample"
    : "Live"
  const sourceBadge =
    previewCust?.source === "sample" ? "Sample customer"
    : previewCust?.source === "active" && previewCust.recordStatus === "inactive" ? "Inactive customer"
    : previewCust?.source === "active" ? "Active customer"
    : null

  const qCustomer = customerId || previewCust?.id || null

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: "var(--portal-bg)",
        ...accentVars,
      }}
    >
      <header
        className="sticky top-0 z-40 border-b"
        style={{ background: "var(--portal-surface)", borderColor: "var(--portal-border)" }}
      >
        <div className="mx-auto flex max-w-screen-xl flex-col gap-3 px-4 py-3 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <PortalWorkspaceBrand
                organizationName={organizationName}
                logoUrl={logoUrl}
                size="compact"
                equipifyVariant="onLight"
                className="min-w-0"
              />
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
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
              <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" asChild>
                <Link href="/settings/portal">
                  <ArrowLeft className="h-3 w-3" aria-hidden />
                  Portal settings
                </Link>
              </Button>
              <Link
                href="/"
                className="inline-flex items-center gap-1 text-xs font-medium underline-offset-4 hover:underline"
                style={{ color: "var(--portal-nav-text)" }}
                title="Leave preview and return to the staff app"
              >
                Exit to main app
                <ArrowRight className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
              </Link>
            </div>
          </div>

          <nav
            className="hidden flex-wrap items-center gap-0.5 border-t pt-2 md:flex"
            style={{ borderColor: "var(--portal-border)" }}
            aria-label="Preview navigation"
          >
            {PREVIEW_NAV.map(({ path, label, icon: Icon }) => {
              const href = buildStaffPreviewHref(organizationId, qCustomer, path)
              const active = navPath === path

              return (
                <Link
                  key={path}
                  href={href}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "text-[--portal-accent] bg-[--portal-accent-muted]"
                      : "text-[--portal-nav-text] hover:bg-[--portal-hover] hover:text-[--portal-foreground]",
                  )}
                >
                  <Icon size={15} className={active ? "text-[--portal-accent]" : "text-[--portal-nav-icon]"} />
                  {label}
                </Link>
              )
            })}
          </nav>

          <div
            className="flex flex-col gap-3 border-t pt-2 md:hidden"
            style={{ borderColor: "var(--portal-border)" }}
          >
            <label className="text-[10px] font-medium uppercase tracking-wide" style={{ color: "var(--portal-nav-text)" }}>
              Jump to section
            </label>
            <select
              className="h-9 w-full rounded-md border bg-background px-2 text-xs font-medium"
              style={{ borderColor: "var(--portal-border)", color: "var(--portal-foreground)" }}
              value={navPath}
              onChange={(e) => {
                window.location.href = buildStaffPreviewHref(organizationId, qCustomer, e.target.value)
              }}
            >
              {PREVIEW_NAV.map(({ path, label }) => (
                <option key={path} value={path}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div
            className="flex flex-col gap-3 border-t pt-2 md:pt-3 lg:flex-row lg:items-end lg:justify-between"
            style={{ borderColor: "var(--portal-border)" }}
          >
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium" style={{ color: "var(--portal-nav-text)" }}>
                Previewing portal as
              </p>
              <p className="truncate text-sm font-semibold" style={{ color: "var(--portal-foreground)" }}>
                {customerLabel}
              </p>
              {snapshot.hasPreviewCustomer && sourceBadge ?
                <p className="text-[11px]" style={{ color: "var(--portal-nav-text)" }}>
                  {sourceBadge}
                  {previewCust?.source === "active" ?
                    " — read-only staff view; customers still use invite sign-in."
                  : null}
                </p>
              : snapshot.customerOptions.length === 0 ?
                <p className="text-[11px]" style={{ color: "var(--portal-nav-text)" }}>
                  No customers in this workspace yet.
                </p>
              : null}
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end lg:w-auto lg:shrink-0">
              <StaffPortalPreviewCustomerPicker
                organizationId={organizationId}
                selectedCustomerId={snapshot.previewCustomer?.id ?? null}
                options={snapshot.customerOptions}
              />
              <Link
                href={buildStaffPreviewHref(organizationId, qCustomer, "/portal/preview/account")}
                className="shrink-0 self-end text-[11px] font-medium underline-offset-4 hover:underline sm:self-center"
                style={{ color: "var(--portal-nav-text)" }}
                title="Read-only account information in staff preview"
              >
                Account (preview)
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div
        role="status"
        className="mx-auto mt-4 flex w-full max-w-screen-xl gap-3 rounded-xl border px-4 py-3 text-sm leading-relaxed sm:px-6"
        style={{
          background: "color-mix(in srgb, var(--portal-accent) 8%, transparent)",
          borderColor: "color-mix(in srgb, var(--portal-accent) 28%, transparent)",
          color: "var(--portal-foreground)",
        }}
      >
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--portal-accent)" }} aria-hidden />
        <div className="min-w-0 space-y-1">
          <p className="font-medium">Staff preview — not a customer session.</p>
          <p className="text-[13px]" style={{ color: "var(--portal-nav-text)" }}>
            Navigation mirrors the customer portal. Downloads and customer actions stay disabled unless noted. Quote
            approval/decline is never available here. Data scope: <span className="font-medium">{rowBadge}</span> for{" "}
            <span className="font-medium">{customerLabel}</span>.
          </p>
        </div>
      </div>

      <main className="mx-auto w-full max-w-screen-xl flex-1 space-y-8 px-4 py-8 sm:px-6">{children}</main>

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
