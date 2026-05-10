"use client"

import { useCallback, useEffect, useState } from "react"
import { FilePen, FileX2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

type QuoteRow = {
  id: string
  quoteNumber: string
  title: string
  amountCents: number
  statusLabel: string
  statusDb: string
  createdAt: string
  expiresAt: string | null
  expiredByDate?: boolean
  canApprove: boolean
  canDecline: boolean
}

function fmtCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100)
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export default function PortalQuotesPage() {
  const [items, setItems] = useState<QuoteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [declineTarget, setDeclineTarget] = useState<QuoteRow | null>(null)
  const [declineNote, setDeclineNote] = useState("")

  const reload = useCallback(() => {
    setLoadError(null)
    return fetch("/api/portal/quotes")
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as { error?: string; items?: QuoteRow[] }
        if (!r.ok) {
          throw new Error(j.error ?? "Could not load quotes.")
        }
        setItems(j.items ?? [])
      })
      .catch((e) => {
        setLoadError(e instanceof Error ? e.message : "Could not load quotes.")
        setItems([])
      })
  }, [])

  useEffect(() => {
    void reload().finally(() => setLoading(false))
  }, [reload])

  async function approve(id: string) {
    setBusyId(id)
    try {
      const r = await fetch(`/api/portal/quotes/${id}/approve`, { method: "POST" })
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) throw new Error(j.error ?? "Could not approve quote.")
      toast.success("Quote approved.")
      await reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Approval failed.")
    } finally {
      setBusyId(null)
    }
  }

  async function confirmDecline() {
    if (!declineTarget) return
    setBusyId(declineTarget.id)
    try {
      const r = await fetch(`/api/portal/quotes/${declineTarget.id}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: declineNote.trim() || undefined }),
      })
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) throw new Error(j.error ?? "Could not decline quote.")
      toast.success("Quote declined.")
      setDeclineTarget(null)
      setDeclineNote("")
      await reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not decline quote.")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: "var(--portal-foreground)" }}>
          Quotes
        </h1>
        <p className="mt-0.5 text-sm" style={{ color: "var(--portal-nav-text)" }}>
          Review estimates from your service provider. You can approve or decline when a quote is open for your
          decision.
        </p>
      </div>

      <div className="portal-card overflow-hidden">
        <div
          className="flex items-center gap-2 border-b px-5 py-4"
          style={{ borderColor: "var(--portal-border-light)" }}
        >
          <FilePen size={16} style={{ color: "var(--portal-accent)" }} />
          <span className="text-sm font-semibold" style={{ color: "var(--portal-foreground)" }}>
            Your quotes
          </span>
        </div>
        {loading ? (
          <p className="p-6 text-sm" style={{ color: "var(--portal-nav-text)" }}>
            Loading…
          </p>
        ) : null}
        {!loading && loadError ? (
          <div className="space-y-3 p-6">
            <p className="text-sm" style={{ color: "var(--portal-foreground)" }}>
              {loadError}
            </p>
            <Button type="button" size="sm" variant="outline" className="text-xs" onClick={() => void reload()}>
              Try again
            </Button>
          </div>
        ) : null}
        {!loading && !loadError && items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <FilePen className="h-10 w-10 opacity-25" style={{ color: "var(--portal-nav-text)" }} />
            <p className="text-sm font-medium" style={{ color: "var(--portal-foreground)" }}>
              No quotes to show
            </p>
            <p className="max-w-sm text-xs leading-relaxed" style={{ color: "var(--portal-nav-text)" }}>
              When your provider sends an estimate, it will appear here for review.
            </p>
          </div>
        ) : null}
        {!loading && !loadError && items.length > 0 ? (
          <div className="divide-y" style={{ borderColor: "var(--portal-border-light)" }}>
            {items.map((q) => (
              <div
                key={q.id}
                className="flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center"
              >
                <div className="min-w-0">
                  <p className="font-mono text-xs font-medium" style={{ color: "var(--portal-nav-text)" }}>
                    {q.quoteNumber}
                  </p>
                  <p className="mt-0.5 text-sm font-medium" style={{ color: "var(--portal-foreground)" }}>
                    {q.title}
                  </p>
                  <p className="mt-1 text-[11px]" style={{ color: "var(--portal-nav-text)" }}>
                    {fmtDate(q.createdAt)}
                    {q.expiresAt ? ` · Expires ${fmtDate(q.expiresAt)}` : ""}
                  </p>
                  <p className="mt-1 text-[11px] font-medium" style={{ color: "var(--portal-accent)" }}>
                    {q.statusLabel}
                    {q.expiredByDate ? " — past valid date; contact your provider." : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <span
                    className="text-sm font-semibold tabular-nums"
                    style={{ color: "var(--portal-foreground)" }}
                  >
                    {fmtCurrency(q.amountCents)}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    className="text-xs min-h-[36px]"
                    disabled={!q.canApprove || busyId === q.id}
                    onClick={() => approve(q.id)}
                  >
                    {busyId === q.id ? "Saving…" : q.canApprove ? "Approve" : "—"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="text-xs min-h-[36px] border-rose-500/40 text-rose-800 hover:bg-rose-500/10 dark:text-rose-200"
                    disabled={!q.canDecline || busyId === q.id}
                    onClick={() => {
                      setDeclineTarget(q)
                      setDeclineNote("")
                    }}
                  >
                    <FileX2 className="mr-1 h-3.5 w-3.5" />
                    Decline
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <Dialog
        open={declineTarget !== null}
        onOpenChange={(o) => {
          if (!o) {
            setDeclineTarget(null)
            setDeclineNote("")
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Decline this quote?</DialogTitle>
            <DialogDescription>
              Your provider will see that this estimate was declined
              {declineNote.trim() ? " along with your optional note." : "."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <Label htmlFor="decline-note" className="text-xs text-muted-foreground">
              Note (optional)
            </Label>
            <Textarea
              id="decline-note"
              value={declineNote}
              onChange={(e) => setDeclineNote(e.target.value)}
              placeholder="e.g. timing, scope, or budget — helps your provider follow up."
              rows={4}
              maxLength={2000}
              className="text-sm"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDeclineTarget(null)
                setDeclineNote("")
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busyId === declineTarget?.id}
              onClick={() => void confirmDecline()}
            >
              {busyId === declineTarget?.id ? "Saving…" : "Decline quote"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
