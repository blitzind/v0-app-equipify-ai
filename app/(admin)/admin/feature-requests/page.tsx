"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, ChevronRight, Loader2, RefreshCw, Sparkles } from "lucide-react"
import { BrandLogo } from "@/components/brand-logo"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

const STATUSES = ["new", "reviewed", "planned", "in_progress", "released", "declined"] as const

type FeatureRequestStatus = (typeof STATUSES)[number]

type FeatureRequestRow = {
  id: string
  organizationId: string
  organizationName: string
  organizationSlug: string | null
  submittedBy: string | null
  submittedByName: string | null
  submittedByEmail: string | null
  source: string
  title: string
  originalQuestion: string
  module: string | null
  currentPath: string | null
  currentLimitation: string | null
  suggestedImprovement: string | null
  businessValue: string | null
  status: FeatureRequestStatus
  priority: string
  internalNotes: string | null
  createdAt: string
  updatedAt: string
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ")
}

function statusClass(status: string) {
  switch (status) {
    case "new":
      return "bg-sky-50 text-sky-700 border-sky-200"
    case "planned":
    case "in_progress":
      return "bg-violet-50 text-violet-700 border-violet-200"
    case "released":
      return "bg-emerald-50 text-emerald-700 border-emerald-200"
    case "declined":
      return "bg-slate-100 text-slate-600 border-slate-200"
    default:
      return "bg-amber-50 text-amber-700 border-amber-200"
  }
}

function formatDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "Unknown"
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

export default function AdminFeatureRequestsPage() {
  const [requests, setRequests] = useState<FeatureRequestRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<FeatureRequestRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [statusDraft, setStatusDraft] = useState<FeatureRequestStatus>("new")
  const [notesDraft, setNotesDraft] = useState("")

  const counts = useMemo(() => {
    return requests.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = (acc[row.status] ?? 0) + 1
      return acc
    }, {})
  }, [requests])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/feature-requests", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        requests?: FeatureRequestRow[]
        message?: string
        error?: string
      }
      if (!res.ok || !data.ok) {
        throw new Error(data.message ?? data.error ?? "Could not load feature requests.")
      }
      setRequests(data.requests ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load feature requests.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  function openDetails(row: FeatureRequestRow) {
    setSelected(row)
    setStatusDraft(row.status)
    setNotesDraft(row.internalNotes ?? "")
  }

  async function saveSelected() {
    if (!selected) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/feature-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selected.id,
          status: statusDraft,
          internalNotes: notesDraft,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; error?: string }
      if (!res.ok || !data.ok) {
        throw new Error(data.message ?? data.error ?? "Could not update feature request.")
      }
      setRequests((prev) =>
        prev.map((row) =>
          row.id === selected.id
            ? { ...row, status: statusDraft, internalNotes: notesDraft || null, updatedAt: new Date().toISOString() }
            : row,
        ),
      )
      setSelected((prev) =>
        prev ? { ...prev, status: statusDraft, internalNotes: notesDraft || null, updatedAt: new Date().toISOString() } : prev,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update feature request.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex h-14 shrink-0 flex-wrap items-center gap-4 border-b border-white/10 bg-[#0F172A] px-6">
        <div className="flex items-center gap-2">
          <BrandLogo className="h-7 max-h-7 w-auto" priority />
          <span className="ml-2 rounded-full border border-sky-400/25 bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-sky-200">
            Feature Requests
          </span>
        </div>
        <div className="flex-1" />
        <Link href="/admin" className="flex items-center gap-1 text-xs text-slate-400 transition-colors hover:text-white">
          <ArrowLeft size={14} />
          Platform Admin
        </Link>
        <Link href="/" className="flex items-center gap-1.5 text-xs text-slate-400 transition-colors hover:text-white">
          App <ChevronRight size={12} />
        </Link>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex size-9 items-center justify-center rounded-full bg-sky-50 text-sky-600">
                  <Sparkles size={17} />
                </span>
                <div>
                  <h1 className="text-xl font-semibold">AIden Feature Requests</h1>
                  <p className="text-sm text-muted-foreground">
                    Lightweight product suggestions captured from unresolved AIden conversations.
                  </p>
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
              Refresh
            </Button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {STATUSES.map((status) => (
              <div key={status} className="rounded-xl border border-border bg-background p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{statusLabel(status)}</p>
                <p className="mt-1 text-2xl font-semibold">{counts[status] ?? 0}</p>
              </div>
            ))}
          </div>
        </section>

        {error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="grid grid-cols-[1.4fr_1fr_0.7fr_0.7fr_0.7fr] gap-3 border-b border-border bg-muted/40 px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <span>Request</span>
            <span>Organization</span>
            <span>Module</span>
            <span>Status</span>
            <span>Created</span>
          </div>
          {loading ? (
            <div className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading feature requests...
            </div>
          ) : requests.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              No AIden feature requests yet.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {requests.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className="grid w-full grid-cols-[1.4fr_1fr_0.7fr_0.7fr_0.7fr] gap-3 px-4 py-3 text-left text-sm transition hover:bg-muted/40"
                  onClick={() => openDetails(row)}
                >
                  <span>
                    <span className="block font-medium">{row.title}</span>
                    <span className="line-clamp-1 text-xs text-muted-foreground">{row.originalQuestion}</span>
                  </span>
                  <span>
                    <span className="block">{row.organizationName}</span>
                    <span className="text-xs text-muted-foreground">{row.submittedByEmail ?? row.submittedByName ?? "Unknown submitter"}</span>
                  </span>
                  <span className="text-muted-foreground">{row.module ?? "Equipify"}</span>
                  <span>
                    <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs capitalize", statusClass(row.status))}>
                      {statusLabel(row.status)}
                    </span>
                  </span>
                  <span className="text-muted-foreground">{formatDate(row.createdAt)}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      </main>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle>{selected.title}</DialogTitle>
              </DialogHeader>
              <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1 text-sm">
                <div className="grid gap-3 rounded-xl border border-border bg-muted/30 p-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Organization</p>
                    <p className="font-medium">{selected.organizationName}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Submitted By</p>
                    <p className="font-medium">{selected.submittedByEmail ?? selected.submittedByName ?? "Unknown"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Module</p>
                    <p className="font-medium">{selected.module ?? "Equipify"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Path</p>
                    <p className="font-mono text-xs">{selected.currentPath ?? "Unknown"}</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Original Question</p>
                  <p className="mt-1 rounded-lg bg-muted/40 p-3">{selected.originalQuestion}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Current Limitation</p>
                  <p className="mt-1">{selected.currentLimitation ?? "Not provided"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Suggested Improvement</p>
                  <p className="mt-1">{selected.suggestedImprovement ?? "Not provided"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Business Value</p>
                  <p className="mt-1">{selected.businessValue ?? "Not provided"}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">Status</span>
                    <select
                      value={statusDraft}
                      onChange={(e) => setStatusDraft(e.target.value as FeatureRequestStatus)}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {statusLabel(status)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="space-y-1">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">Priority</span>
                    <p className="h-10 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm capitalize">
                      {selected.priority}
                    </p>
                  </div>
                </div>

                <label className="block space-y-1">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">Internal Notes</span>
                  <Textarea
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    placeholder="Optional notes for product review..."
                    className="min-h-24"
                  />
                </label>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelected(null)}>
                  Close
                </Button>
                <Button onClick={() => void saveSelected()} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  Save Status
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
