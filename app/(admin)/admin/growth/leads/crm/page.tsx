"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Loader2, Plus, RefreshCw, Sparkles, Target, Users } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useAdmin } from "@/lib/admin-store"
import { Button } from "@/components/ui/button"
import { GrowthLeadFormDialog, type GrowthLeadFormValues } from "@/components/growth/growth-lead-form-dialog"
import { GrowthManualContactFormDialog } from "@/components/growth/growth-manual-contact-form-dialog"
import { GrowthLeadDrawer } from "@/components/growth/growth-lead-drawer"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import { GrowthLeadsTable } from "@/components/growth/growth-leads-table"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"
import type { GrowthLead } from "@/lib/growth/types"
import type { GrowthRepRosterEntry } from "@/lib/growth/assignment/assignment-types"
import { GROWTH_LEAD_ARCHIVE_SCHEMA_PUBLIC_MESSAGE, isGrowthLeadArchiveSchemaIncompleteErrorCode } from "@/lib/growth/lead-archive-api-errors"
import {
  applyGrowthCommandLeadFocusExpand,
  scrollGrowthCommandLeadFocusSection,
} from "@/lib/growth/command/command-lead-focus"

export default function AdminGrowthLeadsPage() {
  const searchParams = useSearchParams()
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
  const [manualContactOpen, setManualContactOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [archivingLeadId, setArchivingLeadId] = useState<string | null>(null)
  const [bulkArchiving, setBulkArchiving] = useState(false)
  const [assigningToMeLeadId, setAssigningToMeLeadId] = useState<string | null>(null)
  const [reps, setReps] = useState<GrowthRepRosterEntry[]>([])
  const [archiveSchemaReady, setArchiveSchemaReady] = useState(true)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [selectedLead, setSelectedLead] = useState<GrowthLead | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const drawerFocus = searchParams.get("focus")
  const deepLinkLeadId = searchParams.get("open")
  const highlightMeetingId = searchParams.get("highlight")
  const pendingReplyId = searchParams.get("replyId")
  const assignedToFilter = searchParams.get("assignedTo")
  const unassignedFilter = searchParams.get("unassigned") === "true"

  const ownerLabels = useMemo(() => {
    const map: Record<string, string> = {}
    for (const rep of reps) {
      map[rep.userId] = rep.displayName ?? rep.email
    }
    return map
  }, [reps])

  async function loadReps() {
    try {
      const res = await fetch("/api/platform/growth/assignment/reps", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; reps?: GrowthRepRosterEntry[] }
      if (res.ok && data.ok) setReps(data.reps ?? [])
    } catch {
      // Owner labels are optional display enrichment; lead list still works without them.
    }
  }

  const counts = useMemo(() => {
    return leads.reduce<Record<string, number>>((acc, lead) => {
      acc[lead.status] = (acc[lead.status] ?? 0) + 1
      return acc
    }, {})
  }, [leads])

  async function fetchLeads() {
    const params = new URLSearchParams()
    if (assignedToFilter) params.set("assignedTo", assignedToFilter)
    if (unassignedFilter) params.set("unassigned", "true")
    const query = params.toString()
    const res = await fetch(`/api/platform/growth/leads${query ? `?${query}` : ""}`, { cache: "no-store" })
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      leads?: GrowthLead[]
      meta?: { archiveSchemaReady?: boolean }
      message?: string
      error?: string
    }
    if (!res.ok || !data.ok) {
      throw new Error(data.message ?? data.error ?? "Could not load growth leads.")
    }
    return {
      leads: data.leads ?? [],
      archiveSchemaReady: data.meta?.archiveSchemaReady ?? true,
    }
  }

  async function load() {
    setLoading(true)
    setError(null)
    setSuccessMessage(null)
    try {
      const data = await fetchLeads()
      setLeads(data.leads)
      setArchiveSchemaReady(data.archiveSchemaReady)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load growth leads.")
    } finally {
      setLoading(false)
    }
  }

  async function refreshLeadsInBackground() {
    try {
      const data = await fetchLeads()
      setLeads(data.leads)
      setArchiveSchemaReady(data.archiveSchemaReady)
    } catch {
      // Keep the success dialog visible; background refresh must not unmount the table.
    }
  }

  useEffect(() => {
    void loadReps()
  }, [])

  useEffect(() => {
    void load()
  }, [assignedToFilter, unassignedFilter])

  useEffect(() => {
    if (!deepLinkLeadId || loading) return
    const lead = leads.find((item) => item.id === deepLinkLeadId)
    if (!lead) return
    if (drawerFocus) applyGrowthCommandLeadFocusExpand(drawerFocus)
    setSelectedLead(lead)
    setDrawerOpen(true)
  }, [deepLinkLeadId, drawerFocus, leads, loading])

  useEffect(() => {
    if (!drawerOpen || !drawerFocus) return
    scrollGrowthCommandLeadFocusSection(drawerFocus)
  }, [drawerOpen, drawerFocus, selectedLead?.id])

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
          assignedTo: values.assignedTo,
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

  async function assignLeadToMe(lead: GrowthLead) {
    const userId = sessionIdentity?.authUserId
    if (!userId) {
      setError("Sign in to assign leads.")
      return
    }
    setAssigningToMeLeadId(lead.id)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/leads/${lead.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedToUserId: userId }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        lead?: GrowthLead
        message?: string
        error?: string
      }
      if (!res.ok || !data.ok || !data.lead) {
        throw new Error(data.message ?? data.error ?? "Could not assign lead.")
      }
      handleLeadUpdated(lead.id, data.lead)
      setSuccessMessage(`Assigned “${lead.companyName}” to you.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not assign lead.")
    } finally {
      setAssigningToMeLeadId(null)
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

  function handleLeadSaved(lead: GrowthLead) {
    setLeads((prev) => prev.map((item) => (item.id === lead.id ? lead : item)))
    setSelectedLead((prev) => (prev && prev.id === lead.id ? lead : prev))
    setSuccessMessage(`Updated contact info for “${lead.companyName}”.`)
  }

  function archiveErrorMessage(data: { message?: string; error?: string }): string {
    if (isGrowthLeadArchiveSchemaIncompleteErrorCode(data.error)) {
      return data.message ?? GROWTH_LEAD_ARCHIVE_SCHEMA_PUBLIC_MESSAGE
    }
    return data.message ?? data.error ?? "Could not archive growth lead."
  }

  async function archiveLead(lead: GrowthLead) {
    setArchivingLeadId(lead.id)
    setError(null)
    setSuccessMessage(null)
    try {
      const res = await fetch("/api/platform/growth/leads/bulk-archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: [lead.id] }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        archivedCount?: number
        message?: string
        error?: string
      }
      if (!res.ok || !data.ok) {
        throw new Error(archiveErrorMessage(data))
      }

      setLeads((prev) => prev.filter((item) => item.id !== lead.id))
      if (selectedLead?.id === lead.id) {
        setSelectedLead(null)
        setDrawerOpen(false)
      }
      setSuccessMessage(`Archived Growth Lead “${lead.companyName}”. Timeline and call history were preserved.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not archive growth lead.")
    } finally {
      setArchivingLeadId(null)
    }
  }

  async function bulkArchiveLeads(leadIds: string[]) {
    if (leadIds.length === 0) return
    setBulkArchiving(true)
    setError(null)
    setSuccessMessage(null)
    try {
      const res = await fetch("/api/platform/growth/leads/bulk-archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        archivedCount?: number
        message?: string
        error?: string
      }
      if (!res.ok || !data.ok) {
        throw new Error(archiveErrorMessage(data))
      }

      const archivedSet = new Set(leadIds)
      setLeads((prev) => prev.filter((item) => !archivedSet.has(item.id)))
      if (selectedLead && archivedSet.has(selectedLead.id)) {
        setSelectedLead(null)
        setDrawerOpen(false)
      }
      setSuccessMessage(`Archived ${data.archivedCount ?? leadIds.length} growth leads. Timeline and call history were preserved.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not archive selected leads.")
    } finally {
      setBulkArchiving(false)
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
                  <h1 className={PAGE_STANDARD_PAGE_TITLE}>CRM Growth Leads</h1>
                  <p className="text-sm text-muted-foreground">
                    Legacy CRM lead records — separate from the intent Lead Inbox workspace.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/growth/leads">Lead Inbox</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/growth/leads/lead-engine">
                  <Sparkles className="mr-2 size-4" />
                  Lead Pipeline
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/growth/ownership">
                  <Users className="mr-2 size-4" />
                  Ownership
                </Link>
              </Button>
              <Button
                variant={unassignedFilter ? "default" : "outline"}
                size="sm"
                asChild
              >
                <Link href={unassignedFilter ? "/admin/growth/leads" : "/admin/growth/leads?unassigned=true"}>
                  Unassigned
                </Link>
              </Button>
              <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
                {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
                Refresh
              </Button>
              <Button size="sm" variant="outline" onClick={() => setManualContactOpen(true)}>
                <Plus className="mr-2 size-4" />
                Add contact manually
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

        {!archiveSchemaReady ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            {GROWTH_LEAD_ARCHIVE_SCHEMA_PUBLIC_MESSAGE} Archive actions stay disabled until the migration is applied.
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
            ownerLabels={ownerLabels}
            currentUserId={sessionIdentity?.authUserId ?? null}
            onAssignToMe={assignLeadToMe}
            assigningToMeLeadId={assigningToMeLeadId}
            onOpenLead={openLead}
            onArchiveLead={archiveLead}
            onBulkArchive={bulkArchiveLeads}
            onBulkEnrollDismissed={() => {
              setSuccessMessage("Bulk sequence enrollment completed.")
              void refreshLeadsInBackground()
            }}
            archivingLeadId={archivingLeadId}
            bulkArchiving={bulkArchiving}
            archiveAvailable={archiveSchemaReady}
          />
        )}
        </GrowthSectionLayout>
      </div>

      <GrowthLeadDrawer
        lead={selectedLead}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onLeadUpdated={handleLeadUpdated}
        onLeadSaved={handleLeadSaved}
        drawerFocus={drawerFocus}
        highlightMeetingId={highlightMeetingId}
        pendingReplyId={pendingReplyId}
      />

      <GrowthLeadFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={createLead}
        saving={saving}
        currentUserId={sessionIdentity?.authUserId ?? null}
      />

      <GrowthManualContactFormDialog
        open={manualContactOpen}
        onOpenChange={setManualContactOpen}
        onSuccess={(entry) => {
          if (entry.status === "created") {
            void load()
            setSuccessMessage("Manual contact added and linked to a new growth lead.")
          } else if (entry.status === "linked_duplicate") {
            setSuccessMessage("Matched an existing lead — no duplicate was created.")
          }
        }}
      />
    </PlatformAdminPageShell>
  )
}
