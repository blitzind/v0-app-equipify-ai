"use client"

import { useState } from "react"
import { Loader2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { GROWTH_INTENT_SIGNALS_WATCHLISTS_QA_MARKER } from "@/components/growth/intent-signals/intent-signals-ux-constants"
import {
  GROWTH_SIGNAL_WATCHLIST_EXAMPLE_PAYLOAD,
  GROWTH_SIGNAL_WATCHLIST_SIGNAL_TYPES,
  type GrowthSignalWatchlistRow,
} from "@/lib/growth/signals/signal-watchlist-types"

const SIGNAL_TYPE_LABELS: Record<string, string> = {
  news_event: "News",
  job_posting: "Jobs",
  hire: "Hires",
  website_visitor: "Website visitors",
}

export function IntentSignalsWatchlistDrawer({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (watchlist: GrowthSignalWatchlistRow) => void
}) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [signalTypes, setSignalTypes] = useState<string[]>(["news_event", "job_posting", "hire"])
  const [minimumScore, setMinimumScore] = useState("")
  const [category, setCategory] = useState("")
  const [department, setDepartment] = useState("")
  const [hiringIntensity, setHiringIntensity] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleSignalType(value: string) {
    setSignalTypes((prev) => (prev.includes(value) ? prev.filter((entry) => entry !== value) : [...prev, value]))
  }

  async function handleSave() {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError("Name is required.")
      return
    }

    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/signals/watchlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          description: description.trim() || null,
          signal_types: signalTypes,
          filters: {
            minimum_signal_score: minimumScore.trim() ? Number(minimumScore) : null,
            category: category.trim() || null,
            department: department.trim() || null,
            hiring_intensity: hiringIntensity.trim() || null,
            suppression_state: "active",
          },
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        watchlist?: GrowthSignalWatchlistRow
        message?: string
      }
      if (!res.ok || !data.ok || !data.watchlist) {
        throw new Error(data.message ?? "Could not create watchlist.")
      }
      onCreated(data.watchlist)
      onOpenChange(false)
      setName("")
      setDescription("")
      setMinimumScore("")
      setCategory("")
      setDepartment("")
      setHiringIntensity("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg" data-qa-marker={GROWTH_INTENT_SIGNALS_WATCHLISTS_QA_MARKER}>
        <SheetHeader>
          <SheetTitle>Create watchlist</SheetTitle>
          <SheetDescription>
            Save signal filters for monitoring. No autonomous outreach or sequence enrollment.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="watchlist-name">Name</Label>
            <Input
              id="watchlist-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={GROWTH_SIGNAL_WATCHLIST_EXAMPLE_PAYLOAD.name}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="watchlist-description">Description</Label>
            <Input
              id="watchlist-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional operator notes"
            />
          </div>

          <div className="space-y-2">
            <Label>Signal types</Label>
            <div className="flex flex-wrap gap-2">
              {GROWTH_SIGNAL_WATCHLIST_SIGNAL_TYPES.filter((type) =>
                ["news_event", "job_posting", "hire", "website_visitor"].includes(type),
              ).map((type) => (
                <Button
                  key={type}
                  type="button"
                  size="sm"
                  variant={signalTypes.includes(type) ? "default" : "outline"}
                  onClick={() => toggleSignalType(type)}
                >
                  {SIGNAL_TYPE_LABELS[type] ?? type}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="watchlist-min-score">Minimum score</Label>
              <Input
                id="watchlist-min-score"
                inputMode="numeric"
                value={minimumScore}
                onChange={(event) => setMinimumScore(event.target.value)}
                placeholder="40"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="watchlist-intensity">Hiring intensity</Label>
              <Input
                id="watchlist-intensity"
                value={hiringIntensity}
                onChange={(event) => setHiringIntensity(event.target.value)}
                placeholder="medium"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="watchlist-category">Category</Label>
              <Input
                id="watchlist-category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                placeholder="Field Service"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="watchlist-department">Department</Label>
              <Input
                id="watchlist-department"
                value={department}
                onChange={(event) => setDepartment(event.target.value)}
                placeholder="Biomedical"
              />
            </div>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <Button type="button" className="w-full gap-2" disabled={saving} onClick={() => void handleSave()}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save watchlist
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
