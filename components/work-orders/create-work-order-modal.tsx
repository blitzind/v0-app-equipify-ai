"use client"

import { useState } from "react"
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
import { customers, equipment, technicians } from "@/lib/mock-data"
import type { WorkOrder, WorkOrderPriority, WorkOrderType } from "@/lib/mock-data"
import { useWorkOrders } from "@/lib/work-order-store"

interface Props {
  open: boolean
  onClose: () => void
}

const PRIORITIES: WorkOrderPriority[] = ["Low", "Normal", "High", "Critical"]
const TYPES: WorkOrderType[] = ["Repair", "PM", "Inspection", "Install", "Emergency"]

function generateId() {
  const max = Math.max(...Object.values({ a: 2041 }))
  return `WO-${max + Math.floor(Math.random() * 100) + 1}`
}

export function CreateWorkOrderModal({ open, onClose }: Props) {
  const { createWorkOrder } = useWorkOrders()

  const [customerId, setCustomerId] = useState("")
  const [equipmentId, setEquipmentId] = useState("")
  const [technicianId, setTechnicianId] = useState("")
  const [type, setType] = useState<WorkOrderType>("Repair")
  const [priority, setPriority] = useState<WorkOrderPriority>("Normal")
  const [scheduledDate, setScheduledDate] = useState("")
  const [scheduledTime, setScheduledTime] = useState("08:00")
  const [description, setDescription] = useState("")
  const [problemReported, setProblemReported] = useState("")

  const selectedCustomer = customers.find((c) => c.id === customerId)
  const customerEquipment = equipment.filter((e) => e.customerId === customerId)
  const selectedEquipment = equipment.find((e) => e.id === equipmentId)
  const selectedTechnician = technicians.find((t) => t.id === technicianId)

  function handleSubmit() {
    if (!customerId || !equipmentId || !technicianId || !scheduledDate || !description) return

    const newWO: WorkOrder = {
      id: `WO-${Date.now().toString().slice(-4)}`,
      customerId,
      customerName: selectedCustomer?.company ?? "",
      equipmentId,
      equipmentName: selectedEquipment ? `${selectedEquipment.model}` : "",
      location: selectedEquipment?.location ?? "",
      type,
      status: "Open",
      priority,
      technicianId,
      technicianName: selectedTechnician?.name ?? "",
      scheduledDate,
      scheduledTime,
      completedDate: "",
      createdAt: new Date().toISOString(),
      createdBy: "Admin",
      description,
      totalLaborCost: 0,
      totalPartsCost: 0,
      invoiceNumber: "",
      repairLog: {
        problemReported,
        diagnosis: "",
        partsUsed: [],
        laborHours: 0,
        technicianNotes: "",
        photos: [],
        signatureDataUrl: "",
        signedBy: "",
        signedAt: "",
      },
    }

    createWorkOrder(newWO)
    handleClose()
  }

  function handleClose() {
    setCustomerId("")
    setEquipmentId("")
    setTechnicianId("")
    setType("Repair")
    setPriority("Normal")
    setScheduledDate("")
    setScheduledTime("08:00")
    setDescription("")
    setProblemReported("")
    onClose()
  }

  const valid = customerId && equipmentId && technicianId && scheduledDate && description.trim()

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Work Order</DialogTitle>
        </DialogHeader>

        <div className="grid gap-5 py-2">
          {/* Row 1: Customer + Equipment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Customer <span className="text-destructive">*</span></Label>
              <Select value={customerId} onValueChange={(v) => { setCustomerId(v); setEquipmentId("") }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.filter((c) => c.status === "Active").map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.company}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Equipment <span className="text-destructive">*</span></Label>
              <Select value={equipmentId} onValueChange={setEquipmentId} disabled={!customerId}>
                <SelectTrigger>
                  <SelectValue placeholder={customerId ? "Select equipment" : "Select customer first"} />
                </SelectTrigger>
                <SelectContent>
                  {customerEquipment.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.model} ({e.id})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 2: Type + Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Type <span className="text-destructive">*</span></Label>
              <Select value={type} onValueChange={(v) => setType(v as WorkOrderType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Priority <span className="text-destructive">*</span></Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as WorkOrderPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 3: Technician */}
          <div className="flex flex-col gap-1.5">
            <Label>Assign Technician <span className="text-destructive">*</span></Label>
            <Select value={technicianId} onValueChange={setTechnicianId}>
              <SelectTrigger><SelectValue placeholder="Select technician" /></SelectTrigger>
              <SelectContent>
                {technicians.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} — {t.active} active WOs
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Row 4: Scheduled Date + Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Scheduled Date <span className="text-destructive">*</span></Label>
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
            <Label>Work Description <span className="text-destructive">*</span></Label>
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!valid}>Create Work Order</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
