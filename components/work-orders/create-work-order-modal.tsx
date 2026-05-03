"use client"

import { useEffect, useState, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { WorkOrderPriority, WorkOrderType } from "@/lib/mock-data"
import { normalizeTimeForDb, uiPriorityToDb, uiTypeToDb } from "@/lib/work-orders/db-map"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { AddEquipmentModal } from "@/components/equipment/add-equipment-modal"
import { getEquipmentDisplayPrimary, getEquipmentSecondaryLine } from "@/lib/equipment/display"

interface Props {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

const PRIORITIES: WorkOrderPriority[] = ["Low", "Normal", "High", "Critical"]
const TYPES: WorkOrderType[] = ["Repair", "PM", "Inspection", "Install", "Emergency"]

type CustomerOption = { id: string; company_name: string }
type EquipmentOption = {
  id: string
  name: string
  equipment_code: string | null
  serial_number: string | null
  category: string | null
}
type TechnicianOption = { id: string; label: string }

export function CreateWorkOrderModal({ open, onClose, onSuccess }: Props) {
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [equipmentList, setEquipmentList] = useState<EquipmentOption[]>([])
  const [equipmentLoading, setEquipmentLoading] = useState(false)
  const [technicians, setTechnicians] = useState<TechnicianOption[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [addEquipmentOpen, setAddEquipmentOpen] = useState(false)

  const [customerId, setCustomerId] = useState("")
  const [equipmentId, setEquipmentId] = useState("")
  const [technicianId, setTechnicianId] = useState("")
  const [type, setType] = useState<WorkOrderType>("Repair")
  const [priority, setPriority] = useState<WorkOrderPriority>("Normal")
  const [scheduledDate, setScheduledDate] = useState("")
  const [scheduledTime, setScheduledTime] = useState("08:00")
  const [description, setDescription] = useState("")
  const [problemReported, setProblemReported] = useState("")

  useEffect(() => {
    if (!open) return

    let cancelled = false
    const supabase = createBrowserSupabaseClient()

    void (async () => {
      setLoadError(null)
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user || cancelled) {
        if (!cancelled) {
          setOrganizationId(null)
          setCustomers([])
          setTechnicians([])
        }
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("default_organization_id")
        .eq("id", user.id)
        .single()

      if (profileError || !profile?.default_organization_id) {
        if (!cancelled) {
          setOrganizationId(null)
          setCustomers([])
          setTechnicians([])
          setLoadError(profileError?.message ?? "No default organization.")
        }
        return
      }

      const orgId = profile.default_organization_id
      if (!cancelled) setOrganizationId(orgId)

      const { data: custRows, error: custError } = await supabase
        .from("customers")
        .select("id, company_name")
        .eq("organization_id", orgId)
        .eq("status", "active")
        .eq("is_archived", false)
        .order("company_name")

      if (custError || cancelled) {
        if (!cancelled) setLoadError(custError?.message ?? "Failed to load customers.")
        return
      }

      if (!cancelled) setCustomers((custRows as CustomerOption[]) ?? [])

      const { data: memberRows, error: memberError } = await supabase
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", orgId)
        .eq("status", "active")
        .in("role", ["owner", "admin", "manager", "tech"])

      if (memberError || cancelled) {
        if (!cancelled && memberError) setLoadError(memberError.message)
        return
      }

      const userIds = [...new Set((memberRows ?? []).map((m: { user_id: string }) => m.user_id))]
      let techOptions: TechnicianOption[] = []

      if (userIds.length > 0) {
        const { data: profRows } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds)

        techOptions =
          ((profRows as Array<{ id: string; full_name: string | null; email: string | null }> | null) ?? []).map(
            (p) => ({
              id: p.id,
              label:
                (p.full_name && p.full_name.trim()) || (p.email && p.email.trim()) || p.id.slice(0, 8),
            })
          )
        techOptions.sort((a, b) => a.label.localeCompare(b.label))
      }

      if (!cancelled) setTechnicians(techOptions)
    })()

    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      setAddEquipmentOpen(false)
    }
  }, [open])

  const refreshEquipmentForCustomer = useCallback(
    async (opts?: { organizationId: string; customerId: string; selectEquipmentId?: string }) => {
      const orgId = opts?.organizationId ?? organizationId
      const custId = opts?.customerId ?? customerId
      const selectId = opts?.selectEquipmentId
      if (!orgId || !custId) return

      const supabase = createBrowserSupabaseClient()
      const { data: eqRows, error: eqError } = await supabase
        .from("equipment")
        .select("id, name, equipment_code, serial_number, category")
        .eq("organization_id", orgId)
        .eq("customer_id", custId)
        .eq("status", "active")
        .eq("is_archived", false)
        .order("name")

      if (eqError) {
        setEquipmentList([])
        return
      }
      const list = (eqRows as EquipmentOption[]) ?? []
      setEquipmentList(list)
      if (selectId && list.some((e) => e.id === selectId)) {
        setEquipmentId(selectId)
      }
    },
    [organizationId, customerId]
  )

  useEffect(() => {
    if (!open || !organizationId || !customerId) {
      if (!customerId) {
        setEquipmentList([])
        setEquipmentLoading(false)
      }
      return
    }

    let cancelled = false
    setEquipmentLoading(true)
    void (async () => {
      await refreshEquipmentForCustomer({ organizationId, customerId })
      if (!cancelled) setEquipmentLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [open, organizationId, customerId, refreshEquipmentForCustomer])

  const selectedCustomerName = customers.find((c) => c.id === customerId)?.company_name ?? ""

  async function handleSubmit() {
    if (!customerId || !equipmentId || !technicianId || !scheduledDate || !description.trim()) return
    if (!organizationId) return

    setSubmitError(null)
    setSubmitting(true)

    const supabase = createBrowserSupabaseClient()

    const notesCombined = problemReported.trim() || null

    const { error: insertError } = await supabase.from("work_orders").insert({
      organization_id: organizationId,
      customer_id: customerId,
      equipment_id: equipmentId,
      title: description.trim(),
      status: "open",
      priority: uiPriorityToDb(priority),
      type: uiTypeToDb(type),
      scheduled_on: scheduledDate,
      scheduled_time: normalizeTimeForDb(scheduledTime),
      notes: notesCombined,
      assigned_user_id: technicianId,
    })

    setSubmitting(false)

    if (insertError) {
      setSubmitError(insertError.message)
      return
    }

    onSuccess?.()
    handleClose()
  }

  function handleClose() {
    setAddEquipmentOpen(false)
    setCustomerId("")
    setEquipmentId("")
    setTechnicianId("")
    setType("Repair")
    setPriority("Normal")
    setScheduledDate("")
    setScheduledTime("08:00")
    setDescription("")
    setProblemReported("")
    setSubmitError(null)
    setLoadError(null)
    onClose()
  }

  function handleOpenAddEquipment() {
    if (!customerId) return
    setAddEquipmentOpen(true)
  }

  function handleAddEquipmentClose() {
    setAddEquipmentOpen(false)
  }

  async function handleAddEquipmentSuccess(newId?: string) {
    if (organizationId && customerId) {
      await refreshEquipmentForCustomer({
        organizationId,
        customerId,
        selectEquipmentId: newId,
      })
    }
  }

  const valid =
    organizationId &&
    customerId &&
    equipmentId &&
    technicianId &&
    scheduledDate &&
    description.trim() &&
    !loadError

  const woDialogOpen = open && !addEquipmentOpen

  return (
    <>
    <Dialog
      open={woDialogOpen}
      onOpenChange={(v) => {
        if (!v && !addEquipmentOpen) handleClose()
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Work Order</DialogTitle>
        </DialogHeader>

        <div className="grid gap-5 py-2">
          {loadError && (
            <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
              {loadError}
            </p>
          )}

          {/* Row 1: Customer + Equipment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>
                Customer <span className="text-destructive">*</span>
              </Label>
              <Select
                value={customerId}
                onValueChange={(v) => {
                  setCustomerId(v)
                  setEquipmentId("")
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>
                Equipment <span className="text-destructive">*</span>
              </Label>
              <Select
                value={equipmentId}
                onValueChange={setEquipmentId}
                disabled={!customerId || equipmentLoading || equipmentList.length === 0}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      !customerId
                        ? "Select customer first"
                        : equipmentLoading
                          ? "Loading equipment…"
                          : equipmentList.length === 0
                            ? "No equipment yet"
                            : "Select equipment"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {equipmentList.map((e) => (
                    <SelectItem key={e.id} value={e.id} textValue={getEquipmentDisplayPrimary(e)}>
                      <span className="block font-medium leading-tight">
                        {getEquipmentDisplayPrimary(e)}
                      </span>
                      <span className="block text-xs text-muted-foreground leading-tight mt-0.5">
                        {getEquipmentSecondaryLine(e, selectedCustomerName)}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {customerId && !equipmentLoading && equipmentList.length === 0 && (
                <div className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-3 space-y-2">
                  <p className="text-sm text-muted-foreground">No equipment found for this customer.</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={handleOpenAddEquipment}
                  >
                    + Add Equipment
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Row 2: Type + Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>
                Type <span className="text-destructive">*</span>
              </Label>
              <Select value={type} onValueChange={(v) => setType(v as WorkOrderType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>
                Priority <span className="text-destructive">*</span>
              </Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as WorkOrderPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 3: Technician */}
          <div className="flex flex-col gap-1.5">
            <Label>
              Assign Technician <span className="text-destructive">*</span>
            </Label>
            <Select value={technicianId} onValueChange={setTechnicianId}>
              <SelectTrigger>
                <SelectValue placeholder="Select technician" />
              </SelectTrigger>
              <SelectContent>
                {technicians.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Row 4: Scheduled Date + Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>
                Scheduled Date <span className="text-destructive">*</span>
              </Label>
              <Input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Scheduled Time</Label>
              <Input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
              />
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <Label>
              Work Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              placeholder="Describe the work to be performed..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* Problem Reported */}
          <div className="flex flex-col gap-1.5">
            <Label>Problem Reported</Label>
            <Textarea
              placeholder="What problem did the customer report?"
              value={problemReported}
              onChange={(e) => setProblemReported(e.target.value)}
              rows={2}
            />
          </div>

          {submitError && (
            <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
              {submitError}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={!valid || submitting}>
            Create Work Order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AddEquipmentModal
      open={addEquipmentOpen}
      onClose={handleAddEquipmentClose}
      onSuccess={(id) => handleAddEquipmentSuccess(id)}
      prefilledCustomerId={customerId || null}
      offerMaintenancePlanNext={false}
    />
    </>
  )
}
