import type { ElementType, ReactNode } from "react"
import Link from "next/link"
import {
  ArrowRight,
  Calendar,
  ClipboardList,
  Clock,
  FileText,
  Folder,
  Inbox,
  LayoutDashboard,
  Receipt,
  ShieldAlert,
  Wrench,
} from "lucide-react"
import { buildStaffPreviewHref } from "@/components/portal/staff-preview-frame"
import { modeLabel } from "@/lib/portal/certificate-release-staff"
import { normalizeReleaseMode } from "@/lib/portal/certificate-release"
import type { StaffPortalPreviewSnapshot } from "@/lib/portal/staff-portal-preview-data"

function fmtDate(d: string | null | undefined) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function fmtCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    cents / 100,
  )
}

function fmtTime(hhmm: string | null | undefined) {
  if (!hhmm) return null
  const [h, m] = hhmm.split(":")
  const hour = Number.parseInt(h ?? "", 10)
  if (!Number.isFinite(hour)) return null
  const d = new Date()
  d.setHours(hour, Number.parseInt(m ?? "0", 10) || 0, 0, 0)
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string }> = {
    Open: { bg: "var(--portal-accent-muted)", text: "var(--portal-accent-text)" },
    "In Progress": { bg: "#fff7ed", text: "#c2410c" },
    Scheduled: { bg: "#f0fdf4", text: "#15803d" },
    Completed: { bg: "var(--portal-success-muted)", text: "var(--portal-success)" },
    Invoiced: { bg: "#f5f3ff", text: "#6d28d9" },
    Unpaid: { bg: "var(--portal-warning-muted)", text: "var(--portal-warning)" },
    Overdue: { bg: "var(--portal-danger-muted)", text: "var(--portal-danger)" },
    Paid: { bg: "var(--portal-success-muted)", text: "var(--portal-success)" },
    Active: { bg: "var(--portal-success-muted)", text: "var(--portal-success)" },
    "Awaiting Signature": { bg: "var(--portal-warning-muted)", text: "var(--portal-warning)" },
    "Pending Approval": { bg: "var(--portal-warning-muted)", text: "var(--portal-warning)" },
  }
  const s = map[status] ?? { bg: "#f3f4f6", text: "#6b7280" }
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ background: s.bg, color: s.text }}
    >
      {status}
    </span>
  )
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string
  value: string | number
  sub?: string
  icon: ElementType
  accent?: boolean
}) {
  return (
    <div className="portal-card scroll-mt-28 p-5 flex items-start justify-between">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--portal-nav-text)" }}>
          {label}
        </p>
        <p className="mt-1 text-2xl font-semibold tabular-nums" style={{ color: "var(--portal-foreground)" }}>
          {value}
        </p>
        {sub ? (
          <p className="mt-0.5 text-xs" style={{ color: "var(--portal-nav-text)" }}>
            {sub}
          </p>
        ) : null}
      </div>
      <span
        className="flex h-9 w-9 items-center justify-center rounded-lg"
        style={{ background: accent ? "var(--portal-accent-muted)" : "var(--portal-surface-2)" }}
      >
        <Icon size={18} style={{ color: accent ? "var(--portal-accent)" : "var(--portal-nav-icon)" }} />
      </span>
    </div>
  )
}

function SectionCard({
  id,
  title,
  icon: Icon,
  badge,
  children,
}: {
  id?: string
  title: string
  icon: ElementType
  badge?: string
  children: ReactNode
}) {
  return (
    <section
      id={id}
      className="portal-card scroll-mt-28 flex flex-col gap-3 p-4"
      style={{ borderColor: "var(--portal-border)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="h-4 w-4 shrink-0" style={{ color: "var(--portal-accent)" }} aria-hidden />
          <h2 className="truncate text-sm font-semibold" style={{ color: "var(--portal-foreground)" }}>
            {title}
          </h2>
        </div>
        {badge ? (
          <span
            className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
            style={{
              borderColor: "var(--portal-border)",
              color: "var(--portal-nav-text)",
            }}
          >
            {badge}
          </span>
        ) : null}
      </div>
      {children}
    </section>
  )
}

export function StaffPortalPreviewDashboard({
  organizationId,
  customerId,
  snapshot,
  organizationPortalDefaults,
}: {
  organizationId: string
  customerId: string
  snapshot: StaffPortalPreviewSnapshot
  organizationPortalDefaults: {
    portalCertificateReleaseMode: string | null
    portalConsolidatedDocumentsDefault: boolean
  }
}) {
  const d = snapshot.dashboard
  const hasLive = snapshot.hasPreviewCustomer && d && !snapshot.showLayoutFallback
  const rowBadge =
    !snapshot.hasPreviewCustomer ? "Preview"
    : snapshot.previewCustomer?.source === "sample" ? "Sample"
    : "Live"
  const customerLabel = snapshot.previewCustomer?.companyName ?? "Customer account"
  const previewCust = snapshot.previewCustomer

  const stats = d?.stats
  const equipTotal = stats?.equipmentTotal ?? 0
  const openWo = stats?.openWorkOrders ?? 0
  const unpaidCount = stats?.unpaidInvoiceCount ?? 0
  const outstandingLabel = d?.formatters.currency.outstandingLabel ?? fmtCurrency(0)
  const dueSoon = stats?.equipmentDueSoon ?? 0

  const recentWo = d?.recentWorkOrders[0]
  const recentInv = d?.recentInvoices[0]
  const nextAppt = d?.nextAppointment
  const recentDone = d?.recentCompletedService
  const nextPlan = d?.nextScheduledService

  const href = (path: string) => buildStaffPreviewHref(organizationId, customerId || null, path)

  return (
    <div className="space-y-8">
      <div className="portal-card p-4 space-y-2">
        <p className="text-[13px] leading-relaxed" style={{ color: "var(--portal-nav-text)" }}>
          {snapshot.hasPreviewCustomer && hasLive ?
            <>
              Figures below are read-only snapshots for <strong style={{ color: "var(--portal-foreground)" }}>{customerLabel}</strong> in this workspace. Use the top navigation to open full lists (invoices, work orders, documents, etc.). Downloads and customer actions stay disabled here.
            </>
          : snapshot.hasPreviewCustomer ?
            <>
              Previewing <strong style={{ color: "var(--portal-foreground)" }}>{customerLabel}</strong>
              {previewCust?.recordStatus === "inactive" ?
                " (inactive customer — no active customers were available)."
              : ""}
              . Sections below reflect current portal visibility rules; empty areas mean nothing is released to the portal for this account yet.
            </>
          : <>
              This workspace does not have any non-archived customers yet. Add a customer or seed sample data, then open
              preview again.
            </>
          }
        </p>
        {snapshot.workspacePortalContext ?
          <ul className="list-inside list-disc space-y-0.5 text-[12px]" style={{ color: "var(--portal-nav-text)" }}>
            <li>
              <span className="font-medium" style={{ color: "var(--portal-foreground)" }}>
                Certificates (effective for this customer):
              </span>{" "}
              {snapshot.workspacePortalContext.effectiveCertificateReleaseLabel}
              <span className="text-[11px] opacity-90">
                {" "}
                (org default:{" "}
                {modeLabel(normalizeReleaseMode(organizationPortalDefaults.portalCertificateReleaseMode))})
              </span>
            </li>
            <li>
              <span className="font-medium" style={{ color: "var(--portal-foreground)" }}>
                Document library scope:
              </span>{" "}
              {snapshot.workspacePortalContext.documentSchemaMigrationPending ?
                "Schema update pending — preview uses single-customer scope."
              : snapshot.workspacePortalContext.documentRollupEnabled ?
                "Consolidated — parent account + linked sub-accounts (when configured)."
              : "This customer only."}{" "}
              <span className="text-[11px] opacity-90">
                (org default for new customers:{" "}
                {organizationPortalDefaults.portalConsolidatedDocumentsDefault ? "rollup on" : "rollup off"})
              </span>
            </li>
          </ul>
        : null}
      </div>

      <div className="scroll-mt-28 space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <h1 className="text-balance text-xl font-semibold" style={{ color: "var(--portal-foreground)" }}>
              Overview
            </h1>
            <p className="mt-0.5 text-sm" style={{ color: "var(--portal-nav-text)" }}>
              {customerLabel} — Customer portal
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span
              className="portal-btn-primary inline-flex cursor-not-allowed items-center gap-1.5 opacity-60"
              title="Service requests are submitted by signed-in portal users."
            >
              <Wrench size={14} />
              Request service
            </span>
            <Link href={href("/portal/preview/equipment")} className="portal-btn-secondary inline-flex items-center gap-1.5">
              <Wrench size={14} />
              View equipment
            </Link>
            <Link href={href("/portal/preview/work-orders")} className="portal-btn-secondary inline-flex items-center gap-1.5">
              <Calendar size={14} />
              View visits
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            label="Equipment"
            value={equipTotal}
            sub={dueSoon > 0 ? `${dueSoon} due soon` : undefined}
            icon={Wrench}
            accent
          />
          <StatCard label="Open work orders" value={openWo} icon={ClipboardList} />
          <StatCard
            label="Unpaid invoices"
            value={unpaidCount}
            sub={unpaidCount > 0 ? `${outstandingLabel} outstanding` : "None outstanding"}
            icon={Receipt}
          />
          <StatCard
            label="Documents"
            value={snapshot.documentsAvailable}
            sub={
              d ?
                `${d.certificateSummary.unlocked} certificates available · ${d.certificateSummary.locked} pending`
              : undefined
            }
            icon={Folder}
          />
          <StatCard
            label="Open requests"
            value={snapshot.openServiceRequests}
            sub="Awaiting shop response"
            icon={Inbox}
          />
        </div>
      </div>

      {(d?.alerts.overdueInvoice || d?.alerts.pendingQuote) && (
        <div className="space-y-2">
          {d.alerts.overdueInvoice ? (
            <div
              className="flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 text-sm"
              style={{
                background: "var(--portal-danger-muted)",
                borderColor: "#fecaca",
                color: "var(--portal-danger)",
              }}
            >
              <ShieldAlert size={15} className="shrink-0" />
              <span>
                An invoice for {fmtCurrency(d.alerts.overdueInvoice.amountCents)} is{" "}
                <strong>{d.alerts.overdueInvoice.statusLabel}</strong>.
              </span>
              <Link
                href={href("/portal/preview/invoices")}
                className="ml-auto inline-flex items-center gap-1 text-xs font-medium underline underline-offset-2 hover:no-underline"
              >
                View <ArrowRight size={12} />
              </Link>
            </div>
          ) : null}
          {d?.alerts.pendingQuote ?
            <div
              className="flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 text-sm"
              style={{
                background: "var(--portal-warning-muted)",
                borderColor: "#fed7aa",
                color: "var(--portal-warning)",
              }}
            >
              <Clock size={15} className="shrink-0" />
              <span>
                Quote <strong>{d.alerts.pendingQuote.title}</strong> for{" "}
                {fmtCurrency(d.alerts.pendingQuote.amountCents)} awaits your approval.
              </span>
              <span
                className="ml-auto text-xs font-medium opacity-80"
                title="Quote approval is disabled in staff preview. Use the live portal as a customer."
              >
                Approve in live portal only
              </span>
            </div>
          : null}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="portal-card scroll-mt-28 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold" style={{ color: "var(--portal-foreground)" }}>
              Next service visit
            </h3>
            <Link href={href("/portal/preview/work-orders")} className="text-xs font-medium" style={{ color: "var(--portal-accent)" }}>
              Work orders
            </Link>
          </div>
          {nextAppt ?
            <div className="block rounded-md px-1 py-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium" style={{ color: "var(--portal-foreground)" }}>
                    {nextAppt.title}
                  </p>
                  <p className="mt-1 text-xs" style={{ color: "var(--portal-nav-text)" }}>
                    {[nextAppt.display, nextAppt.equipmentName, nextAppt.locationLabel].filter(Boolean).join(" · ")}
                  </p>
                  <p className="mt-1 text-xs font-medium" style={{ color: "var(--portal-secondary)" }}>
                    {fmtDate(nextAppt.scheduledOn)}
                    {fmtTime(nextAppt.scheduledTime) ? ` at ${fmtTime(nextAppt.scheduledTime)}` : ""}
                  </p>
                  {nextAppt.technicianName ?
                    <p className="mt-1 text-[11px]" style={{ color: "var(--portal-nav-text)" }}>
                      Technician: {nextAppt.technicianName}
                    </p>
                  : null}
                </div>
                <StatusBadge status={nextAppt.statusLabel} />
              </div>
            </div>
          : <p className="text-xs" style={{ color: "var(--portal-nav-text)" }}>No upcoming scheduled visits.</p>}
        </div>

        <div className="portal-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold" style={{ color: "var(--portal-foreground)" }}>
              Recent service
            </h3>
          </div>
          {recentDone ?
            <div className="block rounded-md px-1 py-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium" style={{ color: "var(--portal-foreground)" }}>
                    {recentDone.title}
                  </p>
                  <p className="mt-1 text-xs" style={{ color: "var(--portal-nav-text)" }}>
                    {[recentDone.display, recentDone.equipmentName, recentDone.locationLabel].filter(Boolean).join(" · ")}
                  </p>
                  <p className="mt-1 text-xs font-medium" style={{ color: "var(--portal-secondary)" }}>
                    Completed {fmtDate(recentDone.completedAt)}
                  </p>
                </div>
                <StatusBadge status={recentDone.statusLabel} />
              </div>
            </div>
          : <p className="text-xs" style={{ color: "var(--portal-nav-text)" }}>No completed visits yet.</p>}
        </div>
      </div>

      <div className="scroll-mt-28">
        {nextPlan ?
          <div className="portal-card p-5">
            <h3 className="text-sm font-semibold" style={{ color: "var(--portal-foreground)" }}>
              Upcoming maintenance
            </h3>
            <p className="mt-1 text-sm" style={{ color: "var(--portal-nav-text)" }}>
              <span className="font-medium" style={{ color: "var(--portal-foreground)" }}>
                {nextPlan.planName}
              </span>{" "}
              · {nextPlan.equipmentName}
            </p>
            <p className="mt-1 text-xs" style={{ color: "var(--portal-secondary)" }}>
              Next due {fmtDate(nextPlan.nextDueDate)}
            </p>
            <p className="mt-2 text-[11px]" style={{ color: "var(--portal-nav-text)" }}>
              <Link href={href("/portal/preview/maintenance")} className="font-medium" style={{ color: "var(--portal-accent)" }}>
                Open maintenance section
              </Link>
            </p>
          </div>
        : (
          <div className="portal-card p-5">
            <h3 className="text-sm font-semibold" style={{ color: "var(--portal-foreground)" }}>
              Maintenance plans
            </h3>
            <p className="mt-1 text-xs" style={{ color: "var(--portal-nav-text)" }}>
              No active maintenance plans for this preview customer yet.
            </p>
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold" style={{ color: "var(--portal-foreground)" }}>
          At a glance
        </h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <SectionCard title="Equipment spotlight" icon={Wrench} badge={rowBadge}>
            {snapshot.equipmentSpotlight ?
              <div className="space-y-1 text-[13px]" style={{ color: "var(--portal-nav-text)" }}>
                <p className="font-medium" style={{ color: "var(--portal-foreground)" }}>
                  {snapshot.equipmentSpotlight.name}
                </p>
                {snapshot.equipmentSpotlight.detail ? <p>{snapshot.equipmentSpotlight.detail}</p> : null}
                <p className="pt-1">
                  <Link href={href("/portal/preview/equipment")} className="text-xs font-medium" style={{ color: "var(--portal-accent)" }}>
                    View all equipment
                  </Link>
                </p>
              </div>
            : (
              <p className="text-xs" style={{ color: "var(--portal-nav-text)" }}>
                No equipment for this preview customer yet.
              </p>
            )}
          </SectionCard>

          <SectionCard title="Recent work order" icon={ClipboardList} badge={rowBadge}>
            {recentWo ?
              <div className="space-y-1 text-[13px]" style={{ color: "var(--portal-nav-text)" }}>
                <p className="font-medium" style={{ color: "var(--portal-foreground)" }}>{recentWo.title}</p>
                <p>
                  {recentWo.display} · {recentWo.equipmentName}
                </p>
                <div className="pt-1">
                  <StatusBadge status={recentWo.statusLabel} />
                </div>
                <p className="pt-1">
                  <Link href={href("/portal/preview/work-orders")} className="text-xs font-medium" style={{ color: "var(--portal-accent)" }}>
                    View work orders
                  </Link>
                </p>
              </div>
            : (
              <p className="text-xs" style={{ color: "var(--portal-nav-text)" }}>No work orders yet.</p>
            )}
          </SectionCard>

          <SectionCard title="Recent invoice" icon={Receipt} badge={rowBadge}>
            {recentInv ?
              <div className="space-y-1 text-[13px]" style={{ color: "var(--portal-nav-text)" }}>
                <p className="font-medium" style={{ color: "var(--portal-foreground)" }}>
                  #{recentInv.number} · {recentInv.title}
                </p>
                <p className="tabular-nums">{fmtCurrency(recentInv.amountCents)}</p>
                <div className="pt-1">
                  <StatusBadge status={recentInv.statusLabel} />
                </div>
                <p className="text-[11px]">Issued {fmtDate(recentInv.issuedAt)}</p>
                <p className="pt-1">
                  <Link href={href("/portal/preview/invoices")} className="text-xs font-medium" style={{ color: "var(--portal-accent)" }}>
                    View invoices
                  </Link>
                </p>
              </div>
            : (
              <p className="text-xs" style={{ color: "var(--portal-nav-text)" }}>No invoices yet.</p>
            )}
          </SectionCard>

          <SectionCard title="Recent document" icon={FileText} badge={rowBadge}>
            {snapshot.recentDocument ?
              <div className="space-y-1 text-[13px]" style={{ color: "var(--portal-nav-text)" }}>
                <p className="font-medium capitalize" style={{ color: "var(--portal-foreground)" }}>
                  {snapshot.recentDocument.title}
                </p>
                <p className="text-[11px] uppercase tracking-wide">{snapshot.recentDocument.kind}</p>
                <p className="text-[11px]">{snapshot.recentDocument.statusLabel}</p>
                <p className="text-[11px]">{fmtDate(snapshot.recentDocument.occurredAt)}</p>
                <p className="pt-1">
                  <Link href={href("/portal/preview/documents")} className="text-xs font-medium" style={{ color: "var(--portal-accent)" }}>
                    Open document library
                  </Link>
                </p>
              </div>
            : (
              <p className="text-xs" style={{ color: "var(--portal-nav-text)" }}>
                No released documents in the library for this customer yet.
              </p>
            )}
          </SectionCard>

          <SectionCard title="Recent service request" icon={Inbox} badge={rowBadge}>
            {snapshot.recentServiceRequest ?
              <div className="space-y-1 text-[13px]" style={{ color: "var(--portal-nav-text)" }}>
                <p className="font-medium" style={{ color: "var(--portal-foreground)" }}>
                  {snapshot.recentServiceRequest.summary}
                </p>
                <p>{snapshot.recentServiceRequest.statusLabel}</p>
                <p className="text-[11px]">{fmtDate(snapshot.recentServiceRequest.createdAt)}</p>
                <p className="pt-1">
                  <Link href={href("/portal/preview/service-requests")} className="text-xs font-medium" style={{ color: "var(--portal-accent)" }}>
                    Service requests (preview limits)
                  </Link>
                </p>
              </div>
            : (
              <p className="text-xs" style={{ color: "var(--portal-nav-text)" }}>No service requests yet.</p>
            )}
          </SectionCard>

          <SectionCard title="Quick links" icon={LayoutDashboard}>
            <ul className="space-y-2 text-sm" style={{ color: "var(--portal-nav-text)" }}>
              <li>
                <Link href={href("/portal/preview/documents")} className="font-medium" style={{ color: "var(--portal-accent)" }}>
                  Documents
                </Link>
                <span className="block text-[11px]">Released files and certificates (read-only)</span>
              </li>
              <li>
                <Link href={href("/portal/preview/invoices")} className="font-medium" style={{ color: "var(--portal-accent)" }}>
                  Invoices
                </Link>
                <span className="block text-[11px]">Balances and payment status</span>
              </li>
              <li>
                <Link href={href("/portal/preview/quotes")} className="font-medium" style={{ color: "var(--portal-accent)" }}>
                  Quotes
                </Link>
                <span className="block text-[11px]">Approval disabled in preview</span>
              </li>
            </ul>
          </SectionCard>
        </div>
      </div>

      <div className="scroll-mt-28 portal-card p-5">
        <h3 className="text-sm font-semibold" style={{ color: "var(--portal-foreground)" }}>
          Account &amp; settings
        </h3>
        <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--portal-nav-text)" }}>
          Customers manage contacts and preferences from{" "}
          <Link href={href("/portal/preview/account")} className="font-medium" style={{ color: "var(--portal-accent)" }}>
            Account
          </Link>{" "}
          in preview (informational only) or after signing in to the live portal.
        </p>
      </div>

      {snapshot.showLayoutFallback ?
        <div
          className="rounded-xl border border-dashed px-4 py-4 text-sm"
          style={{ borderColor: "var(--portal-border)", color: "var(--portal-nav-text)" }}
        >
          <p className="font-medium" style={{ color: "var(--portal-foreground)" }}>
            Layout reference
          </p>
          <p className="mt-2 text-[13px] leading-relaxed">
            When your workspace has more portal activity, this page fills with real appointments, invoices, documents,
            and equipment tied to the preview customer. The navigation above mirrors customer routes; data always stays
            scoped to the selected customer.
          </p>
        </div>
      : null}
    </div>
  )
}
