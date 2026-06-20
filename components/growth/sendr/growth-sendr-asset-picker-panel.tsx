"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { GrowthSendrAssetPickerItem } from "@/lib/growth/sendr/growth-sendr-types"

type Props = {
  kind?: "media" | "video" | "booking" | "landing_page" | "all"
  onSelect: (item: GrowthSendrAssetPickerItem) => void
  selectedId?: string | null
  disabled?: boolean
}

export function GrowthSendrAssetPickerPanel({
  kind = "all",
  onSelect,
  selectedId,
  disabled,
}: Props) {
  const [items, setItems] = useState<GrowthSendrAssetPickerItem[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [filterKind, setFilterKind] = useState<string>(kind)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        kind: filterKind,
        limit: "50",
      })
      if (search.trim()) params.set("search", search.trim())
      const res = await fetch(`/api/platform/growth/sendr/assets?${params.toString()}`, {
        cache: "no-store",
      })
      const data = (await res.json()) as { ok: boolean; items?: GrowthSendrAssetPickerItem[] }
      setItems(data.items ?? [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [filterKind, search])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => items, [items])

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search assets…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={disabled}
          />
        </div>
        <Select value={filterKind} onValueChange={setFilterKind} disabled={disabled || kind !== "all"}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="video">Videos</SelectItem>
            <SelectItem value="booking">Booking</SelectItem>
            <SelectItem value="media">Media</SelectItem>
            <SelectItem value="landing_page">Pages</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading || disabled}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
        </Button>
      </div>

      <div className="max-h-64 space-y-2 overflow-y-auto">
        {loading && filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">Loading assets…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No assets found.</p>
        ) : (
          filtered.map((item) => (
            <button
              key={`${item.assetKind}-${item.id}`}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(item)}
              className={`flex w-full items-start justify-between rounded-md border p-2 text-left text-sm hover:bg-muted/50 ${
                selectedId === item.id ? "border-primary bg-muted/30" : ""
              }`}
            >
              <div>
                <p className="font-medium">{item.name}</p>
                {item.subtitle ? (
                  <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                ) : null}
              </div>
              <Badge variant="outline">{item.assetKind}</Badge>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
