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

const STATUSES = ["draft", "active", "suspended", "expired", "cancelled"] as const
const COVERAGE = [
  "full_service",
  "labor_only",
  "parts_and_labor",
  "inspection_only",
  "emergency",
  "pm_only",
  "other",
] as const

export type ServiceContractFormPayload = {
  contract_name: string
  contract_number: string | null
  start_date: string
  end_date: string
  status: (typeof STATUSES)[number]
  coverage_type: (typeof COVERAGE)[number]
  customer_location_id: string | null
  equipment_id: string | null
  sla_response_hours: number | null
  sla_resolution_hours: number | null
  notes: string | null
}

type Existing = ServiceContractFormPayload & { id: string }

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  organizationId: string
  customerId: string
  locations: Array<{ id: string; name: string }>
  onSaved: () => void
  existing?: Existing | null
}

export function ServiceContractFormDialog({
  open,
  onOpenChange,
  organizationId,
  customerId,
  locations,
  onSaved,
  existing,
}: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [equipment, setEquipment] = useState<Array<{ id: string; label: string }>>([])
  const [form, setForm] = useState<ServiceContractFormPayload>(() => ({
    contract_name: "",
    contract_number: null,
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10),
    status: "active",
    coverage_type: "full_service",
    customer_location_id: null,
    equipment_id: null,
    sla_response_hours: null,
    sla_resolution_hours: null,
    notes: null,
  }))

  useEffect(() => {
    if (!open || !organizationId || !customerId) return
    let cancelled = false
    void (async () => {
      const { createBrowserSupabaseClient } = await import("@/lib/supabase/client")
      const supabase = createBrowserSupabaseClient()
      const { data: eqRows } = await supabase
        .from("equipment")
        .select("id, name, equipment_code")
        .eq("organization_id", organizationId)
        .eq("customer_id", customerId)
        .is("archived_at", null)
        .order("name", { ascending: true })
      if (cancelled) return
      setEquipment(
        (eqRows ?? []).map((r) => {
          const row = r as { id: string; name: string; equipment_code: string | null }
          const label = [row.name, row.equipment_code].filter(Boolean).join(" · ")
          return { id: row.id, label: label || row.id.slice(0, 8) }
        }),
      )
    })()
    return () => {
      cancelled = true
    }
  }, [open, organizationId, customerId])

  useEffect(() => {
    if (!open) return
    if (existing) {
      setForm({
        contract_name: existing.contract_name,
        contract_number: existing.contract_number,
        start_date: existing.start_date,
        end_date: existing.end_date,
        status: existing.status,
        coverage_type: existing.coverage_type,
        customer_location_id: existing.customer_location_id,
        equipment_id: existing.equipment_id,
        sla_response_hours: existing.sla_response_hours,
        sla_resolution_hours: existing.sla_resolution_hours,
        notes: existing.notes,
      })
    } else {
      const today = new Date().toISOString().slice(0, 10)
      setForm({
        contract_name: "",
        contract_number: null,
        start_date: today,
        end_date: today,
        status: "active",
        coverage_type: "full_service",
        customer_location_id: null,
        equipment_id: null,
        sla_response_hours: null,
        sla_resolution_hours: null,
        notes: null,
      })
    }
    setError(null)
  }, [open, existing])

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      const base = `/api/organizations/${encodeURIComponent(organizationId)}/service-contracts`
      const url = existing ? `${base}/${encodeURIComponent(existing.id)}` : base
      const method = existing ? "PATCH" : "POST"
      const body: Record<string, unknown> = existing
        ? { ...form }
        : { ...form, customer_id: customerId }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(j.error ?? res.statusText)
      onSaved()
      onOpenChange(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit service contract" : "New service contract"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <div className="space-y-1">
            <Label>Contract name</Label>
            <Input
              value={form.contract_name}
              onChange={(e) => setForm((f) => ({ ...f, contract_name: e.target.value }))}
              placeholder="e.g. 2026 Full service"
            />
          </div>
          <div className="space-y-1">
            <Label>Contract number</Label>
            <Input
              value={form.contract_number ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, contract_number: e.target.value.trim() || null }))
              }
              placeholder="Optional"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Start</Label>
              <Input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>End</Label>
              <Input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm((f) => ({ ...f, status: v as ServiceContractFormPayload["status"] }))}
              >
                <SelectTrigger>
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
            <div className="space-y-1">
              <Label>Coverage type</Label>
              <Select
                value={form.coverage_type}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, coverage_type: v as ServiceContractFormPayload["coverage_type"] }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COVERAGE.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Service site (optional)</Label>
            <Select
              value={form.customer_location_id ?? "__none__"}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, customer_location_id: v === "__none__" ? null : v }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All sites" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">All sites</SelectItem>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Equipment (optional)</Label>
            <Select
              value={form.equipment_id ?? "__none__"}
              onValueChange={(v) => setForm((f) => ({ ...f, equipment_id: v === "__none__" ? null : v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Customer-wide" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Customer-wide</SelectItem>
                {equipment.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>SLA response (hours)</Label>
              <Input
                type="number"
                min={1}
                step={1}
                value={form.sla_response_hours ?? ""}
                onChange={(e) => {
                  const n = e.target.value === "" ? null : Number(e.target.value)
                  setForm((f) => ({
                    ...f,
                    sla_response_hours: n != null && n > 0 ? n : null,
                  }))
                }}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-1">
              <Label>SLA resolution (hours)</Label>
              <Input
                type="number"
                min={1}
                step={1}
                value={form.sla_resolution_hours ?? ""}
                onChange={(e) => {
                  const n = e.target.value === "" ? null : Number(e.target.value)
                  setForm((f) => ({
                    ...f,
                    sla_resolution_hours: n != null && n > 0 ? n : null,
                  }))
                }}
                placeholder="Optional"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea
              rows={3}
              value={form.notes ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value.trim() || null }))}
              placeholder="Internal notes"
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={busy || !form.contract_name.trim()} onClick={() => void submit()}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
