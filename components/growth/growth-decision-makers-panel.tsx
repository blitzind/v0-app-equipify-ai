"use client"

import { useEffect, useState } from "react"
import { Check, Loader2, Plus, Star, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { GrowthLeadDecisionMaker } from "@/lib/growth/decision-maker-types"
import type { GrowthLead } from "@/lib/growth/types"
import { cn } from "@/lib/utils"

type GrowthDecisionMakersPanelProps = {
  lead: GrowthLead
  onLeadUpdated?: (patch: Partial<GrowthLead>) => void
}

export function GrowthDecisionMakersPanel({ lead, onLeadUpdated }: GrowthDecisionMakersPanelProps) {
  const [decisionMakers, setDecisionMakers] = useState<GrowthLeadDecisionMaker[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [fullName, setFullName] = useState("")
  const [title, setTitle] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/leads/${lead.id}/decision-makers`, { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        decisionMakers?: GrowthLeadDecisionMaker[]
        message?: string
        error?: string
      }
      if (!res.ok || !data.ok) {
        throw new Error(data.message ?? data.error ?? "Could not load decision makers.")
      }
      setDecisionMakers(data.decisionMakers ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load decision makers.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [lead.id])

  async function patchDecisionMaker(
    dmId: string,
    body: Record<string, unknown>,
  ) {
    setSavingId(dmId)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/leads/${lead.id}/decision-makers/${dmId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        decisionMaker?: GrowthLeadDecisionMaker
        lead?: GrowthLead
        message?: string
        error?: string
      }
      if (!res.ok || !data.ok) {
        throw new Error(data.message ?? data.error ?? "Could not update decision maker.")
      }
      if (data.lead) onLeadUpdated?.(data.lead)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update decision maker.")
    } finally {
      setSavingId(null)
    }
  }

  async function createDecisionMaker() {
    setCreating(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/leads/${lead.id}/decision-makers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          title: title || null,
          phone: phone || null,
          email: email || null,
          source: "manual",
          status: "confirmed",
          isPrimary: decisionMakers.length === 0,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        lead?: GrowthLead
        message?: string
        error?: string
      }
      if (!res.ok || !data.ok) {
        throw new Error(data.message ?? data.error ?? "Could not create decision maker.")
      }
      if (data.lead) onLeadUpdated?.(data.lead)
      setFullName("")
      setTitle("")
      setPhone("")
      setEmail("")
      setShowForm(false)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create decision maker.")
    } finally {
      setCreating(false)
    }
  }

  async function deleteDecisionMaker(dmId: string) {
    setSavingId(dmId)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/leads/${lead.id}/decision-makers/${dmId}`, { method: "DELETE" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        lead?: GrowthLead
        message?: string
        error?: string
      }
      if (!res.ok || !data.ok) {
        throw new Error(data.message ?? data.error ?? "Could not delete decision maker.")
      }
      if (data.lead) onLeadUpdated?.(data.lead)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete decision maker.")
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="space-y-3">
      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" />
          Loading decision makers…
        </div>
      ) : decisionMakers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
          No decision makers identified yet. Add one manually or run research.
        </div>
      ) : (
        <div className="space-y-2">
          {decisionMakers.map((dm) => {
            const saving = savingId === dm.id
            return (
              <div
                key={dm.id}
                className={cn(
                  "rounded-xl border px-4 py-3",
                  dm.isPrimary ? "border-emerald-200 bg-emerald-50/40" : "border-border bg-background",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{dm.fullName}</p>
                      {dm.isPrimary ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">Primary</span>
                      ) : null}
                    </div>
                    {dm.title ? <p className="text-sm text-muted-foreground">{dm.title}</p> : null}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {dm.source.replace(/_/g, " ")} · {dm.status}
                      {dm.phone ? ` · ${dm.phone}` : ""}
                      {dm.email ? ` · ${dm.email}` : ""}
                    </p>
                    {dm.evidenceExcerpt ? (
                      <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{dm.evidenceExcerpt}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {dm.status !== "confirmed" ? (
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-8"
                        disabled={saving}
                        onClick={() => void patchDecisionMaker(dm.id, { status: "confirmed" })}
                      >
                        {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                      </Button>
                    ) : null}
                    {!dm.isPrimary ? (
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-8"
                        disabled={saving}
                        onClick={() => void patchDecisionMaker(dm.id, { isPrimary: true, status: "confirmed" })}
                      >
                        <Star className="size-4" />
                      </Button>
                    ) : null}
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8"
                      disabled={saving}
                      onClick={() => void patchDecisionMaker(dm.id, { status: "rejected" })}
                    >
                      <X className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8"
                      disabled={saving}
                      onClick={() => void deleteDecisionMaker(dm.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showForm ? (
        <div className="rounded-xl border border-border bg-background p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="dm-name">Full name</Label>
              <Input id="dm-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dm-title">Title</Label>
              <Input id="dm-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dm-phone">Phone</Label>
              <Input id="dm-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="dm-email">Email</Label>
              <Input id="dm-email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={creating || !fullName.trim()} onClick={() => void createDecisionMaker()}>
              {creating ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Save
            </Button>
            <Button size="sm" variant="outline" disabled={creating} onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
          <Plus className="mr-2 size-4" />
          Add decision maker
        </Button>
      )}
    </div>
  )
}
