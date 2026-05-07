"use client"

import Link from "next/link"
import { use, useEffect, useState } from "react"
import { ChevronLeft, Download, Receipt, ShieldCheck } from "lucide-react"
import { ServiceLifecycleTimeline } from "@/components/lifecycle/service-lifecycle-timeline"
import type { ServiceTimelineEvent } from "@/lib/lifecycle/service-timeline"

function fmtDate(d: string | null | undefined) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function fmtCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100)
}

type CertItem = {
  id: string
  templateName: string
  unlocked: boolean
  reasonLabel: string
  downloadPath: string | null
}

type WoRow = {
  id: string
  display: string
  title: string
  statusLabel: string
  typeLabel: string
  scheduledOn: string | null
  completedAt: string | null
  equipmentName: string
  technicianName: string | null
}

type DetailPayload = {
  invoice: {
    id: string
    invoiceNumber: string
    title: string
    amountCents: number
    statusLabel: string
    status: string
    issuedAt: string
    paidAt: string | null
    dueDate: string | null
    equipmentId: string | null
    equipmentName: string | null
    portalCertificateReleaseOverride: string | null
  }
  workOrders: WoRow[]
  certificates: CertItem[]
  timeline: ServiceTimelineEvent[]
}

export default function PortalInvoiceDetailPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = use(params)
  const [data, setData] = useState<DetailPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/portal/invoices/${invoiceId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Not found")
        return r.json() as Promise<DetailPayload>
      })
      .then(setData)
      .catch(() => setError("Invoice not found."))
  }, [invoiceId])

  if (error) {
    return (
      <div className="portal-card py-20 text-center">
        <p className="text-sm font-medium" style={{ color: "var(--portal-foreground)" }}>
          {error}
        </p>
        <Link href="/portal/invoices" className="text-sm mt-2 inline-flex items-center gap-1" style={{ color: "var(--portal-accent)" }}>
          <ChevronLeft size={14} /> Back to invoices
        </Link>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="portal-card py-20 text-center text-sm" style={{ color: "var(--portal-nav-text)" }}>
        Loading invoice…
      </div>
    )
  }

  const inv = data.invoice
  const overdue = inv.status === "overdue"

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm">
        <Link href="/portal/invoices" className="flex items-center gap-1 font-medium" style={{ color: "var(--portal-accent)" }}>
          <ChevronLeft size={14} /> Invoices
        </Link>
        <span style={{ color: "var(--portal-nav-icon)" }}>/</span>
        <span style={{ color: "var(--portal-nav-text)" }} className="font-mono text-xs">
          {inv.invoiceNumber}
        </span>
      </div>

      <div className="portal-card overflow-hidden">
        <div className="p-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex items-center justify-center w-11 h-11 rounded-xl shrink-0" style={{ background: "var(--portal-accent-muted)" }}>
              <Receipt size={20} style={{ color: "var(--portal-accent)" }} />
            </span>
            <div>
              <p className="text-xs font-mono font-medium" style={{ color: "var(--portal-nav-text)" }}>
                {inv.invoiceNumber}
              </p>
              <h1 className="text-xl font-semibold mt-0.5" style={{ color: "var(--portal-foreground)" }}>
                {inv.title}
              </h1>
              <p className="text-sm mt-1" style={{ color: "var(--portal-nav-text)" }}>
                Issued {fmtDate(inv.issuedAt)}
                {inv.dueDate ? ` · Due ${fmtDate(inv.dueDate)}` : ""}
                {inv.paidAt ? ` · Paid ${fmtDate(inv.paidAt)}` : ""}
              </p>
              {inv.equipmentName ? (
                <p className="text-xs mt-1" style={{ color: "var(--portal-secondary)" }}>
                  Equipment: {inv.equipmentName}
                </p>
              ) : null}
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold tabular-nums" style={{ color: "var(--portal-foreground)" }}>
              {fmtCurrency(inv.amountCents)}
            </p>
            <span
              className="inline-flex mt-1 px-2 py-0.5 rounded-full text-xs font-medium"
              style={{
                background:
                  inv.statusLabel === "Paid" ? "var(--portal-success-muted)"
                  : overdue ? "var(--portal-danger-muted)"
                  : "var(--portal-warning-muted)",
                color:
                  inv.statusLabel === "Paid" ? "var(--portal-success)"
                  : overdue ? "var(--portal-danger)"
                  : "var(--portal-warning)",
              }}
            >
              {inv.statusLabel}
            </span>
          </div>
        </div>
      </div>

      {data.timeline.length > 0 ? (
        <div>
          <h2 className="text-sm font-semibold mb-2" style={{ color: "var(--portal-foreground)" }}>
            Activity
          </h2>
          <ServiceLifecycleTimeline title="Invoice timeline" events={data.timeline} />
        </div>
      ) : null}

      {data.workOrders.length > 0 ? (
        <div className="portal-card">
          <div className="px-5 py-4 border-b" style={{ borderColor: "var(--portal-border-light)" }}>
            <h2 className="text-sm font-semibold" style={{ color: "var(--portal-foreground)" }}>
              Related service visits
            </h2>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--portal-border-light)" }}>
            {data.workOrders.map((wo) => (
              <div key={wo.id} className="px-5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <p className="text-xs font-mono" style={{ color: "var(--portal-nav-text)" }}>
                    {wo.display}
                  </p>
                  <p className="text-sm font-medium" style={{ color: "var(--portal-foreground)" }}>
                    {wo.title}
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: "var(--portal-nav-text)" }}>
                    {wo.equipmentName} · {wo.typeLabel}
                    {wo.technicianName ? ` · ${wo.technicianName}` : ""}
                  </p>
                </div>
                <div className="text-left sm:text-right text-[11px]" style={{ color: "var(--portal-nav-text)" }}>
                  <span>{wo.statusLabel}</span>
                  {wo.scheduledOn ? <span className="block">{fmtDate(wo.scheduledOn)}</span> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="portal-card">
        <div className="px-5 py-4 border-b flex items-center justify-between gap-2" style={{ borderColor: "var(--portal-border-light)" }}>
          <h2 className="text-sm font-semibold" style={{ color: "var(--portal-foreground)" }}>
            Certificates & compliance
          </h2>
          <Link href="/portal/certificates" className="text-xs font-medium" style={{ color: "var(--portal-accent)" }}>
            Archive
          </Link>
        </div>
        {data.certificates.length === 0 ? (
          <p className="p-5 text-sm" style={{ color: "var(--portal-nav-text)" }}>
            No certificates linked to this invoice yet.
          </p>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--portal-border-light)" }}>
            {data.certificates.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="flex items-start gap-2 min-w-0">
                  <ShieldCheck size={16} className="shrink-0 mt-0.5" style={{ color: "var(--portal-accent)" }} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--portal-foreground)" }}>
                      {c.templateName}
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: "var(--portal-nav-text)" }}>
                      {c.reasonLabel}
                    </p>
                  </div>
                </div>
                {c.downloadPath ? (
                  <a
                    href={c.downloadPath}
                    className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium shrink-0"
                    style={{ borderColor: "var(--portal-border-light)", color: "var(--portal-accent)" }}
                  >
                    <Download size={12} /> Download
                  </a>
                ) : (
                  <span className="text-[11px] shrink-0" style={{ color: "var(--portal-nav-text)" }}>
                    Locked
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-[11px]" style={{ color: "var(--portal-nav-text)" }}>
        Certificate availability follows your service provider&apos;s release rules (payment, immediate, or manual release).
        {inv.portalCertificateReleaseOverride ? (
          <span> This invoice may override the default policy when configured.</span>
        ) : null}
      </p>
    </div>
  )
}
