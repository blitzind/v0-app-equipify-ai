"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ChevronLeft, Loader2 } from "lucide-react"
import { formatSlaCoverageLabel } from "@/components/service-contracts/sla-coverage-badge"
import type { SlaCoverageLabel } from "@/lib/service-contracts/types"

type Item = {
  id: string
  issue_summary: string
  urgency: string
  created_at: string
  status_label: string
  coverage_label?: SlaCoverageLabel
}

export default function PortalServiceRequestsPage() {
  const [items, setItems] = useState<Item[]>([])
  const [contracts, setContracts] = useState<Array<{ contract_name: string; end_date: string }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch("/api/portal/service-requests", { cache: "no-store" }).then((r) =>
        r.json().then((j) => ({ ok: r.ok, j })),
      ),
      fetch("/api/portal/service-contracts", { cache: "no-store" }).then((r) =>
        r.json().then((j) => ({ ok: r.ok, j })),
      ),
    ])
      .then(([reqRes, conRes]) => {
        if (!reqRes.ok) throw new Error((reqRes.j as { error?: string }).error ?? "Could not load requests")
        setItems((reqRes.j as { items?: Item[] }).items ?? [])
        if (conRes.ok) {
          setContracts(
            ((conRes.j as { contracts?: Array<{ contract_name: string; end_date: string }> }).contracts ??
              []) as Array<{ contract_name: string; end_date: string }>,
          )
        } else {
          setContracts([])
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error"))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-xl mx-auto space-y-6 py-6 px-4">
      <div className="flex items-center gap-2 text-sm">
        <Link href="/portal/dashboard" className="flex items-center gap-1 font-medium" style={{ color: "var(--portal-accent)" }}>
          <ChevronLeft size={14} /> Back
        </Link>
      </div>
      <div>
        <h1 className="text-xl font-semibold" style={{ color: "var(--portal-foreground)" }}>
          My requests
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--portal-nav-text)" }}>
          Status updates from your service provider. Internal review steps are not shown here.
        </p>
        {!loading && !error && contracts.length > 0 ?
          <p className="text-xs mt-2" style={{ color: "var(--portal-nav-text)" }}>
            You have {contracts.length} active service agreement{contracts.length === 1 ? "" : "s"} on file
            {contracts[0]?.contract_name ? ` (e.g. ${contracts[0].contract_name})` : ""}.
          </p>
        : null}
      </div>

      {loading ?
        <div className="flex items-center gap-2 text-sm" style={{ color: "var(--portal-nav-text)" }}>
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading…
        </div>
      : error ?
        <p className="text-sm" style={{ color: "var(--portal-danger)" }}>
          {error}
        </p>
      : items.length === 0 ?
        <div className="portal-card p-6 text-sm" style={{ color: "var(--portal-nav-text)" }}>
          No requests yet. Use{" "}
          <Link href="/portal/request-repair" className="font-medium" style={{ color: "var(--portal-accent)" }}>
            Request service
          </Link>{" "}
          to submit one.
        </div>
      : <ul className="space-y-3">
          {items.map((it) => (
            <li key={it.id} className="portal-card p-4">
              <p className="font-medium text-sm" style={{ color: "var(--portal-foreground)" }}>
                {it.issue_summary}
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--portal-nav-text)" }}>
                {new Date(it.created_at).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}{" "}
                · {it.status_label} · Urgency: {it.urgency}
                {it.coverage_label ?
                  <>
                    {" "}
                    ·{" "}
                    <span className="font-medium" style={{ color: "var(--portal-foreground)" }}>
                      {formatSlaCoverageLabel(it.coverage_label)}
                    </span>
                  </>
                : null}
              </p>
            </li>
          ))}
        </ul>
      }
    </div>
  )
}
