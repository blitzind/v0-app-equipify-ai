"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Loader2 } from "lucide-react"
import type { EquipmentWarrantyRow } from "@/lib/equipment-warranties/types"

const STATUSES = ["active", "expired", "void"] as const

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  organizationId: string
  equipmentId: string
  onSaved: () => void
  existing?: EquipmentWarrantyRow | null
}

export function EquipmentWarrantyFormDialog({
  open,
  onOpenChange,
  organizationId,
  equipmentId,
  onSaved,
  existing,
}: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [provider, setProvider] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("active")
  const [coverageSummary, setCoverageSummary] = useState("")
  const [referenceNumber, setReferenceNumber] = useState("")
  const [notes, setNotes] = useState("")

  useEffect(() => {
    if (!open) return
    setError(null)
    if (existing) {
      setProvider(existing.warranty_provider)
      setStartDate(existing.start_date?.slice(0, 10) ?? "")
      setEndDate(existing.end_date.slice(0, 10))
      setStatus(existing.status)
      setCoverageSummary(existing.coverage_summary ?? "")
      setReferenceNumber(existing.reference_number ?? "")
      setNotes(existing.notes ?? "")
    } else {
      const today = new Date().toISOString().slice(0, 10)
      setProvider("")
      setStartDate("")
      setEndDate(today)
      setStatus("active")
      setCoverageSummary("")
      setReferenceNumber("")
      setNotes("")
    }
  }, [open, existing])

  async function submit() {
    setError(null)
    const p = provider.trim()
    if (!p) {
      setError("Provider / manufacturer is required.")
      return
    }
    const end = endDate.trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(end)) {
      setError("End date is required.")
      return
    }
    const start = startDate.trim()
    if (start && /^\d{4}-\d{2}-\d{2}$/.test(start) && start > end) {
      setError("Start date cannot be after end date.")
      return
    }

    setBusy(true)
    try {
      const base = `/api/organizations/${encodeURIComponent(organizationId)}/equipment-warranties`
      const payload = {
        equipment_id: equipmentId,
        warranty_provider: p,
        start_date: start && /^\d{4}-\d{2}-\d{2}$/.test(start) ? start : null,
        end_date: end,
        status,
        coverage_summary: coverageSummary.trim() || null,
        reference_number: referenceNumber.trim() || null,
        notes: notes.trim() || null,
      }
      const res = await fetch(existing ? `${base}/${encodeURIComponent(existing.id)}` : base, {
        method: existing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const j = (await res.json()) as { error?: string }
      if (!res.ok) {
        setError(j.error ?? "Could not save warranty.")
        return
      }
      onSaved()
      onOpenChange(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit warranty" : "Add warranty record"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          {error ?
            <p className="text-sm text-destructive">{error}</p>
          : null}
          <div>
            <Label className="text-xs">Provider / manufacturer</Label>
            <Input value={provider} onChange={(e) => setProvider(e.target.value)} className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Start date (optional)</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">End date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as (typeof STATUSES)[number])}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Coverage summary (optional)</Label>
            <Input
              value={coverageSummary}
              onChange={(e) => setCoverageSummary(e.target.value)}
              className="mt-1"
              placeholder="e.g. Parts & labor, depot service"
            />
          </div>
          <div>
            <Label className="text-xs">Reference / contract # (optional)</Label>
            <Input
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Internal notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 min-h-[72px]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={busy} className="gap-2">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
