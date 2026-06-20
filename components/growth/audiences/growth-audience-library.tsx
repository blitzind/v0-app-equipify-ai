"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, Plus, RefreshCw, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useGrowthFeaturePath } from "@/lib/growth/navigation/use-growth-feature-path"
import type { GrowthAudience } from "@/lib/growth/audiences/growth-audience-types"

type ListResponse = {
  ok: boolean
  items: GrowthAudience[]
  total: number
  message?: string
}

type SavedSearchOption = { id: string; name: string }

export function GrowthAudienceLibrary() {
  const detailBase = useGrowthFeaturePath("audiences")
  const [items, setItems] = useState<GrowthAudience[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState("")
  const [createSavedSearchId, setCreateSavedSearchId] = useState("")
  const [savedSearches, setSavedSearches] = useState<SavedSearchOption[]>([])
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/audiences?limit=100")
      const data = (await res.json()) as ListResponse
      if (!res.ok) {
        setError(data.message ?? "Failed to load audiences")
        setItems([])
        return
      }
      setItems(data.items ?? [])
    } catch {
      setError("Audiences unavailable")
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/platform/growth/prospect-search?meta=1")
        const data = (await res.json()) as { saved_searches?: Array<{ id: string; name: string }> }
        if (res.ok && data.saved_searches) {
          setSavedSearches(data.saved_searches.map((s) => ({ id: s.id, name: s.name })))
        }
      } catch {
        setSavedSearches([])
      }
    })()
  }, [])

  async function createAudience() {
    if (!createName.trim() || !createSavedSearchId) return
    setCreating(true)
    try {
      const res = await fetch("/api/platform/growth/audiences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: createName.trim(), savedSearchId: createSavedSearchId }),
      })
      const data = (await res.json()) as { ok: boolean; audience?: GrowthAudience; message?: string }
      if (!res.ok) {
        setError(data.message ?? "Create failed")
        return
      }
      setCreateOpen(false)
      setCreateName("")
      setCreateSavedSearchId("")
      await load()
    } finally {
      setCreating(false)
    }
  }

  const filtered = items.filter((item) =>
    item.name.toLowerCase().includes(search.trim().toLowerCase()),
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search audiences…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4" />
              New Audience
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create audience from saved search</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label htmlFor="audience-name">Name</Label>
                <Input
                  id="audience-name"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="Enterprise HVAC — Q2"
                />
              </div>
              <div>
                <Label>Saved search</Label>
                <Select value={createSavedSearchId} onValueChange={setCreateSavedSearchId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select saved search" />
                  </SelectTrigger>
                  <SelectContent>
                    {savedSearches.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => void createAudience()} disabled={creating || !createName.trim() || !createSavedSearchId}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {loading && items.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading audiences…
        </div>
      ) : null}

      {!loading && filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          <Users className="mx-auto mb-2 h-8 w-8 opacity-50" />
          <p>No audiences yet. Create one from a saved prospect search.</p>
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        {filtered.map((audience) => (
          <Link
            key={audience.id}
            href={`${detailBase}/${audience.id}`}
            className="rounded-lg border p-4 transition-colors hover:bg-muted/40"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-medium">{audience.name}</h3>
                {audience.description ? (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{audience.description}</p>
                ) : null}
              </div>
              <Badge variant="outline">{audience.refreshPolicy.replace("_", " ")}</Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span>{audience.memberCount ?? 0} members</span>
              <span>
                Last refresh:{" "}
                {audience.lastRefreshAt ? new Date(audience.lastRefreshAt).toLocaleString() : "Never"}
              </span>
              {audience.lastRefreshDurationMs != null ? (
                <span>{audience.lastRefreshDurationMs}ms</span>
              ) : null}
              {audience.lastRefreshStatus ? <span>Status: {audience.lastRefreshStatus}</span> : null}
            </div>
          </Link>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Audiences are manual-only: saved search → snapshot → manual refresh → manual enrollment.
      </p>
    </div>
  )
}
