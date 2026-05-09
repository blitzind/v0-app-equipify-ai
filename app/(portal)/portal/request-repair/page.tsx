"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ChevronLeft, CheckCircle2, Wrench } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type EqOpt = { id: string; name: string }

const PRIORITY_OPTIONS = [
  { value: "Low", label: "Low" },
  { value: "Normal", label: "Normal" },
  { value: "High", label: "High" },
  { value: "Critical", label: "Critical" },
]

function RequestRepairPageInner() {
  const searchParams = useSearchParams()
  const preEquipment = searchParams.get("equipment")?.trim() ?? ""

  const [equipmentOptions, setEquipmentOptions] = useState<EqOpt[]>([])
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [equipmentId, setEquipmentId] = useState(preEquipment)
  const [priority, setPriority] = useState("Normal")
  const [message, setMessage] = useState("")

  useEffect(() => {
    fetch("/api/portal/equipment")
      .then((r) => r.json())
      .then((j: { items?: Array<{ id: string; name: string }> }) => {
        setEquipmentOptions((j.items ?? []).map((e) => ({ id: e.id, name: e.name })))
      })
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const firstLine = message.split("\n").map((l) => l.trim()).find(Boolean) ?? message
      const r = await fetch("/api/portal/service-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issue_summary: firstLine.slice(0, 200),
          description: message.trim(),
          equipmentId: equipmentId || null,
          urgency: priority,
        }),
      })
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) throw new Error(j.error ?? "Could not submit.")
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.")
    } finally {
      setBusy(false)
    }
  }

  const selectedName = equipmentOptions.find((e) => e.id === equipmentId)?.name

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto pt-12 text-center">
        <div className="portal-card p-10">
          <div
            className="flex items-center justify-center w-16 h-16 rounded-full mx-auto mb-6"
            style={{ background: "var(--portal-success-muted)" }}
          >
            <CheckCircle2 size={32} style={{ color: "var(--portal-success)" }} />
          </div>
          <h1 className="text-xl font-semibold mb-2" style={{ color: "var(--portal-foreground)" }}>
            Request received
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: "var(--portal-nav-text)" }}>
            {selectedName ?
              <>
                Your request for <strong style={{ color: "var(--portal-secondary)" }}>{selectedName}</strong> was logged.
              </>
            : "Your service request was logged."}{" "}
            Your provider will follow up using your portal contact email.
          </p>
          <div className="mt-6 flex gap-3">
            <Link href="/portal/work-orders" className="portal-btn-secondary flex-1 justify-center">
              Work orders
            </Link>
            <Link href="/portal/dashboard" className="portal-btn-primary flex-1 justify-center">
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-2 text-sm">
        <Link href="/portal/dashboard" className="flex items-center gap-1 font-medium" style={{ color: "var(--portal-accent)" }}>
          <ChevronLeft size={14} /> Back
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-semibold" style={{ color: "var(--portal-foreground)" }}>
          Request service
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--portal-nav-text)" }}>
          Describe the issue. This sends a secure note to your field service team.
        </p>
      </div>

      <form onSubmit={submit} className="portal-card p-6 space-y-5">
        <div className="space-y-1.5">
          <label className="text-xs font-medium" style={{ color: "var(--portal-foreground)" }}>
            Equipment (optional)
          </label>
          <select
            value={equipmentId}
            onChange={(e) => setEquipmentId(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
            style={{ borderColor: "var(--portal-border)", background: "var(--portal-surface)" }}
          >
            <option value="">General / multiple assets</option>
            {equipmentOptions.map((eq) => (
              <option key={eq.id} value={eq.id}>
                {eq.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium" style={{ color: "var(--portal-foreground)" }}>
            Priority
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PRIORITY_OPTIONS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPriority(p.value)}
                className={cn(
                  "rounded-md border px-2 py-2 text-xs font-medium transition-colors",
                  priority === p.value ? "border-[color:var(--portal-accent)] bg-[--portal-accent-muted]" : "",
                )}
                style={{
                  borderColor: priority === p.value ? "var(--portal-accent)" : "var(--portal-border)",
                  color: "var(--portal-foreground)",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium" style={{ color: "var(--portal-foreground)" }}>
            What should we know?
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            className="w-full rounded-md border px-3 py-2 text-sm"
            style={{ borderColor: "var(--portal-border)", background: "var(--portal-surface)" }}
            placeholder="Symptoms, error codes, site access, preferred timing…"
            required
          />
        </div>

        {error && (
          <p className="text-sm" style={{ color: "var(--portal-danger)" }}>
            {error}
          </p>
        )}

        <Button type="submit" className="w-full gap-2" disabled={busy}>
          <Wrench size={14} />
          {busy ? "Submitting…" : "Submit request"}
        </Button>
      </form>
    </div>
  )
}

export default function RequestRepairPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-xl mx-auto py-12 text-center text-sm" style={{ color: "var(--portal-nav-text)" }}>
          Loading…
        </div>
      }
    >
      <RequestRepairPageInner />
    </Suspense>
  )
}
