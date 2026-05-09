"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ChevronLeft, Loader2 } from "lucide-react"

type Item = {
  id: string
  issue_summary: string
  urgency: string
  created_at: string
  status_label: string
}

export default function PortalServiceRequestsPage() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/portal/service-requests", { cache: "no-store" })
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!ok) throw new Error((j as { error?: string }).error ?? "Could not load")
        setItems((j as { items?: Item[] }).items ?? [])
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
              </p>
            </li>
          ))}
        </ul>
      }
    </div>
  )
}
