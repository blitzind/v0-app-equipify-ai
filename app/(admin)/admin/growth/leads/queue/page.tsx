"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, PhoneCall, RefreshCw } from "lucide-react"
import { useAdmin } from "@/lib/admin-store"
import { Button } from "@/components/ui/button"
import { GrowthCallQueueTable } from "@/components/growth/growth-call-queue-table"
import { GrowthLeadDrawer } from "@/components/growth/growth-lead-drawer"
import { GrowthLeadsSubnav } from "@/components/growth/growth-leads-subnav"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"
import { cn } from "@/lib/utils"
import {
  GROWTH_CALL_QUEUE_FILTERS,
  type GrowthCallQueueFilter,
  type GrowthCallQueueRow,
  type GrowthLeadCallDisposition,
} from "@/lib/growth/call-types"
import type { GrowthLead } from "@/lib/growth/types"

const FILTER_LABELS: Record<GrowthCallQueueFilter, string> = {
  call_ready: "Call Ready",
  high_fit: "High Fit",
  needs_research: "Needs Research",
  needs_website_research: "Needs Website Research",
  hot: "Hot",
  engaged: "Engaged",
  dormant: "Dormant",
  recently_active: "Recently Active",
  decision_maker_engaged: "DM Engaged",
}

export default function AdminGrowthCallQueuePage() {
  const { sessionIdentity } = useAdmin()
  const header = usePlatformAdminHeaderIdentity({
    displayName: sessionIdentity?.displayName,
    email: sessionIdentity?.email,
    platformRoleLabel: sessionIdentity?.platformRoleLabel,
  })

  const [filter, setFilter] = useState<GrowthCallQueueFilter>("call_ready")
  const [rows, setRows] = useState<GrowthCallQueueRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [recordingLeadId, setRecordingLeadId] = useState<string | null>(null)
  const [selectedLead, setSelectedLead] = useState<GrowthLead | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [openingLeadId, setOpeningLeadId] = useState<string | null>(null)

  const load = useCallback(async (activeFilter: GrowthCallQueueFilter) => {
    setLoading(true)
    setError(null)
    setSuccessMessage(null)
    try {
      const res = await fetch(`/api/platform/growth/call-queue?filter=${activeFilter}`, { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        rows?: GrowthCallQueueRow[]
        message?: string
        error?: string
      }
      if (!res.ok || !data.ok) {
        throw new Error(data.message ?? data.error ?? "Could not load call queue.")
      }
      setRows(data.rows ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load call queue.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(filter)
  }, [filter, load])

  async function openLead(leadId: string) {
    setOpeningLeadId(leadId)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/leads/${leadId}`, { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        lead?: GrowthLead
        message?: string
        error?: string
      }
      if (!res.ok || !data.ok || !data.lead) {
        throw new Error(data.message ?? data.error ?? "Could not load lead.")
      }
      setSelectedLead(data.lead)
      setDrawerOpen(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load lead.")
    } finally {
      setOpeningLeadId(null)
    }
  }

  async function recordDisposition(
    leadId: string,
    input: { disposition: GrowthLeadCallDisposition; note?: string | null; followUpAt?: string | null },
  ) {
    setRecordingLeadId(leadId)
    setError(null)
    setSuccessMessage(null)
    try {
      const res = await fetch(`/api/platform/growth/leads/${leadId}/call-events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        lead?: GrowthLead
        message?: string
        error?: string
      }
      if (!res.ok || !data.ok) {
        throw new Error(data.message ?? data.error ?? "Could not record call disposition.")
      }

      setSuccessMessage("Call disposition saved.")
      if (selectedLead?.id === leadId && data.lead) {
        setSelectedLead(data.lead)
      }
      await load(filter)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record call disposition.")
    } finally {
      setRecordingLeadId(null)
    }
  }

  function handleLeadUpdated(leadId: string, patch: Partial<GrowthLead>) {
    setSelectedLead((prev) => (prev && prev.id === leadId ? { ...prev, ...patch } : prev))
  }

  return (
    <PlatformAdminPageShell header={header}>
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
        <PlatformAdminTabNav activeKey="growth_leads" />

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex size-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <PhoneCall size={17} />
                </span>
                <div>
                  <h1 className={PAGE_STANDARD_PAGE_TITLE}>Call Queue</h1>
                  <p className="text-sm text-muted-foreground">
                    Ranked Growth Leads worth calling next, based on research fit and workflow signals.
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <GrowthLeadsSubnav />
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => void load(filter)} disabled={loading}>
              {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
              Refresh
            </Button>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {GROWTH_CALL_QUEUE_FILTERS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                  filter === item
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-border bg-background text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                )}
              >
                {FILTER_LABELS[item]}
              </button>
            ))}
          </div>
        </section>

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
            Loading call queue…
          </div>
        ) : (
          <GrowthCallQueueTable
            rows={rows}
            onOpenLead={openLead}
            onRecordDisposition={recordDisposition}
            onLeadUpdated={() => void load(filter)}
            recordingLeadId={recordingLeadId ?? openingLeadId}
          />
        )}
      </div>

      <GrowthLeadDrawer
        lead={selectedLead}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onLeadUpdated={handleLeadUpdated}
      />
    </PlatformAdminPageShell>
  )
}
