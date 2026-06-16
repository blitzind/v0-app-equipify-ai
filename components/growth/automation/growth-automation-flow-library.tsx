"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, Plus, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GrowthAutomationFlowCard } from "@/components/growth/automation/growth-automation-flow-card"
import {
  GROWTH_AUTOMATION_BUILDER_QA_MARKER,
  GROWTH_AUTOMATION_FLOW_STATUSES,
  type GrowthAutomationFlow,
} from "@/lib/growth/automation/growth-automation-types"

type ListResponse = {
  ok: boolean
  items: GrowthAutomationFlow[]
  total: number
  message?: string
}

export function GrowthAutomationFlowLibrary() {
  const [items, setItems] = useState<GrowthAutomationFlow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set("status", statusFilter)
      if (search.trim()) params.set("search", search.trim())
      params.set("limit", "100")

      const res = await fetch(`/api/platform/growth/automation?${params.toString()}`)
      const data = (await res.json()) as ListResponse
      if (!res.ok) {
        setError(data.message ?? "Failed to load automation flows")
        setItems([])
        return
      }
      setItems(data.items ?? [])
    } catch {
      setError("Automation flows unavailable")
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

  useEffect(() => {
    void load()
  }, [load])

  async function archiveFlow(flow: GrowthAutomationFlow) {
    setBusyId(flow.id)
    setMessage(null)
    try {
      const res = await fetch(`/api/platform/growth/automation/${flow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archive: true }),
      })
      const data = (await res.json()) as { ok: boolean; message?: string }
      if (!res.ok) {
        setMessage(data.message ?? "Archive failed")
        return
      }
      setMessage("Flow archived.")
      await load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6" data-qa-marker={GROWTH_AUTOMATION_BUILDER_QA_MARKER}>
      <p className="text-sm text-muted-foreground">
        Draft automation graphs with metadata-only publish gates. No SR-3 runtime activation in S5-F.
      </p>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search flows…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="max-w-xs"
          />
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="">All statuses</option>
            {GROWTH_AUTOMATION_FLOW_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Refresh
          </Button>
          <Button size="sm" asChild>
            <Link href="/admin/growth/automation/new">
              <Plus className="size-4" />
              New flow
            </Link>
          </Button>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading flows…
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No automation flows yet.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {items.map((flow) => (
              <GrowthAutomationFlowCard
                key={flow.id}
                flow={flow}
                busy={busyId === flow.id}
                onArchive={() => void archiveFlow(flow)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
