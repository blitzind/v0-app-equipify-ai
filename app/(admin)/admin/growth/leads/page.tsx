"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, Plus, RefreshCw, Target } from "lucide-react"
import { useAdmin } from "@/lib/admin-store"
import { Button } from "@/components/ui/button"
import { GrowthLeadFormDialog, type GrowthLeadFormValues } from "@/components/growth/growth-lead-form-dialog"
import { GrowthLeadDrawer } from "@/components/growth/growth-lead-drawer"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import { GrowthLeadsTable } from "@/components/growth/growth-leads-table"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"
import type { GrowthLead, GrowthLeadStatus } from "@/lib/growth/types"

export default function AdminGrowthLeadsPage() {
  const { sessionIdentity } = useAdmin()
  const header = usePlatformAdminHeaderIdentity({
    displayName: sessionIdentity?.displayName,
    email: sessionIdentity?.email,
    platformRoleLabel: sessionIdentity?.platformRoleLabel,
  })

  const [leads, setLeads] = useState<GrowthLead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [updatingLeadId, setUpdatingLeadId] = useState<string | null>(null)
  const [deletingLeadId, setDeletingLeadId] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
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
    setSuccessMessage(null)
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

  async function deleteLead(lead: GrowthLead) {
    setDeletingLeadId(lead.id)
    setError(null)
    setSuccessMessage(null)
    try {
      const res = await fetch(`/api/platform/growth/leads/${lead.id}`, { method: "DELETE" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        message?: string
        error?: string
      }
      if (!res.ok || !data.ok) {
        throw new Error(data.message ?? data.error ?? "Could not delete growth lead.")
      }

      setLeads((prev) => prev.filter((item) => item.id !== lead.id))
      if (selectedLead?.id === lead.id) {
        setSelectedLead(null)
        setDrawerOpen(false)
      }
      setSuccessMessage(`Deleted Growth Lead “${lead.companyName}”. Customer Prospects were not affected.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete growth lead.")
    } finally {
      setDeletingLeadId(null)
    }
  }

  return (
    <PlatformAdminPageShell header={header}>
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
        <PlatformAdminTabNav activeKey="growth_leads" />

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

        <GrowthSectionLayout>
        {error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {successMessage ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {successMessage}
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
            onDeleteLead={deleteLead}
            updatingLeadId={updatingLeadId}
            deletingLeadId={deletingLeadId}
          />
        )}
        </GrowthSectionLayout>
      </div>

      <GrowthLeadDrawer
        lead={selectedLead}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onLeadUpdated={handleLeadUpdated}
      />

      <GrowthLeadFormDialog open={createOpen} onOpenChange={setCreateOpen} onSubmit={createLead} saving={saving} />
    </PlatformAdminPageShell>
  )
}
