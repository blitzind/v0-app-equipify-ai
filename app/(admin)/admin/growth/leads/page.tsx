"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, ChevronRight, Loader2, Plus, RefreshCw, Target } from "lucide-react"
import { BrandLogo } from "@/components/brand-logo"
import { Button } from "@/components/ui/button"
import { GrowthLeadFormDialog, type GrowthLeadFormValues } from "@/components/growth/growth-lead-form-dialog"
import { GrowthLeadDrawer } from "@/components/growth/growth-lead-drawer"
import { GrowthLeadsTable } from "@/components/growth/growth-leads-table"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"
import type { GrowthLead, GrowthLeadStatus } from "@/lib/growth/types"

export default function AdminGrowthLeadsPage() {
  const [leads, setLeads] = useState<GrowthLead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [updatingLeadId, setUpdatingLeadId] = useState<string | null>(null)
  const [selectedLead, setSelectedLead] = useState<GrowthLead | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const counts = useMemo(() => {
    return leads.reduce<Record<string, number>>((acc, lead) => {
      acc[lead.status] = (acc[lead.status] ?? 0) + 1
      return acc
    }, {})
  }, [leads])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/leads", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        leads?: GrowthLead[]
        message?: string
        error?: string
      }
      if (!res.ok || !data.ok) {
        throw new Error(data.message ?? data.error ?? "Could not load growth leads.")
      }
      setLeads(data.leads ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load growth leads.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function createLead(values: GrowthLeadFormValues) {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceKind: values.sourceKind,
          sourceDetail: values.sourceDetail || null,
          companyName: values.companyName,
          contactName: values.contactName || null,
          contactEmail: values.contactEmail || null,
          contactPhone: values.contactPhone || null,
          website: values.website || null,
          city: values.city || null,
          state: values.state || null,
          status: values.status,
          researchPriority: values.researchPriority,
          notes: values.notes || null,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        lead?: GrowthLead
        message?: string
        error?: string
      }
      if (!res.ok || !data.ok || !data.lead) {
        throw new Error(data.message ?? data.error ?? "Could not create growth lead.")
      }
      setLeads((prev) => [data.lead!, ...prev])
      setCreateOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create growth lead.")
    } finally {
      setSaving(false)
    }
  }

  async function updateLeadStatus(leadId: string, status: GrowthLeadStatus) {
    setUpdatingLeadId(leadId)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        lead?: GrowthLead
        message?: string
        error?: string
      }
      if (!res.ok || !data.ok || !data.lead) {
        throw new Error(data.message ?? data.error ?? "Could not update growth lead.")
      }
      setLeads((prev) => prev.map((lead) => (lead.id === leadId ? data.lead! : lead)))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update growth lead.")
      void load()
    } finally {
      setUpdatingLeadId(null)
    }
  }

  function openLead(lead: GrowthLead) {
    setSelectedLead(lead)
    setDrawerOpen(true)
  }

  function handleLeadUpdated(leadId: string, patch: Partial<GrowthLead>) {
    setLeads((prev) => prev.map((lead) => (lead.id === leadId ? { ...lead, ...patch } : lead)))
    setSelectedLead((prev) => (prev && prev.id === leadId ? { ...prev, ...patch } : prev))
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex h-14 shrink-0 flex-wrap items-center gap-4 border-b border-white/10 bg-[#0F172A] px-6">
        <div className="flex items-center gap-2">
          <BrandLogo className="h-7 max-h-7 w-auto" priority />
          <span className="ml-2 rounded-full border border-emerald-400/25 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-emerald-200">
            Growth Engine
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
                <span className="flex size-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <Target size={17} />
                </span>
                <div>
                  <h1 className={PAGE_STANDARD_PAGE_TITLE}>Growth Leads</h1>
                  <p className="text-sm text-muted-foreground">
                    Internal lead inbox for Equipify/Blitz. Separate from customer Prospects.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
                {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
                Refresh
              </Button>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 size-4" />
                Add lead
              </Button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {["new", "qualified", "in_outreach", "call_ready", "converted"].map((status) => (
              <div key={status} className="rounded-xl border border-border bg-background p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{status.replace(/_/g, " ")}</p>
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

        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" />
            Loading growth leads…
          </div>
        ) : (
          <GrowthLeadsTable
            leads={leads}
            onStatusChange={updateLeadStatus}
            onOpenLead={openLead}
            updatingLeadId={updatingLeadId}
          />
        )}
      </main>

      <GrowthLeadDrawer
        lead={selectedLead}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onLeadUpdated={handleLeadUpdated}
      />

      <GrowthLeadFormDialog open={createOpen} onOpenChange={setCreateOpen} onSubmit={createLead} saving={saving} />
    </div>
  )
}
