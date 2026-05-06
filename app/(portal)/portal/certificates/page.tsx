"use client"

import { useEffect, useState } from "react"
import { ShieldCheck, Download } from "lucide-react"
import { Button } from "@/components/ui/button"

type Cert = {
  id: string
  createdAt: string
  workOrderId: string
  equipmentName: string | null
  templateName: string
  downloadUrl: string | null
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export default function PortalCertificatesPage() {
  const [items, setItems] = useState<Cert[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/portal/certificates")
      .then((r) => r.json())
      .then((j: { items?: Cert[] }) => setItems(j.items ?? []))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: "var(--portal-foreground)" }}>
          Certificates
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--portal-nav-text)" }}>
          Calibration and compliance documents linked to your service visits.
        </p>
      </div>

      <div className="portal-card divide-y" style={{ borderColor: "var(--portal-border-light)" }}>
        {loading && <p className="p-6 text-sm" style={{ color: "var(--portal-nav-text)" }}>Loading…</p>}
        {!loading && items.length === 0 && (
          <p className="p-6 text-sm" style={{ color: "var(--portal-nav-text)" }}>No certificates on file yet.</p>
        )}
        {!loading &&
          items.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="flex items-start gap-3 min-w-0">
                <span className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0" style={{ background: "var(--portal-accent-muted)" }}>
                  <ShieldCheck size={16} style={{ color: "var(--portal-accent)" }} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--portal-foreground)" }}>
                    {c.templateName}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--portal-nav-text)" }}>
                    {c.equipmentName ?? "Equipment"} • {fmtDate(c.createdAt)}
                  </p>
                </div>
              </div>
              <Button type="button" variant="outline" size="sm" className="gap-1.5 shrink-0 text-xs" disabled={!c.downloadUrl}>
                <Download size={12} />
                Download
              </Button>
            </div>
          ))}
      </div>

      <p className="text-[11px]" style={{ color: "var(--portal-nav-text)" }}>
        Signed PDF downloads will appear here when your service provider attaches them.
      </p>
    </div>
  )
}
