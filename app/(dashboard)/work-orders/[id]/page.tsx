"use client"

import { use, useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { getWorkOrderDisplay } from "@/lib/work-orders/display"
import { loadWorkOrderDetailForOrg } from "@/lib/work-orders/detail-load"
import { serializeRepairLog } from "@/lib/work-orders/parse-repair-log"
import { useWorkOrders } from "@/lib/work-order-store"
import type { WorkOrder, WorkOrderStatus } from "@/lib/mock-data"
import type { Part } from "@/lib/mock-data"
import { Button } from "@/components/ui/button"
import { ChevronLeft, CheckCircle2, PenLine, Save, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  WorkOrderDetailExperience,
  buildWorkOrderActivityItems,
} from "@/components/work-orders/work-order-detail-experience"
import { useToast } from "@/hooks/use-toast"

function uiStatusToDb(s: WorkOrderStatus): string {
  const m: Record<WorkOrderStatus, string> = {
    Open: "open",
    Scheduled: "scheduled",
    "In Progress": "in_progress",
    Completed: "completed",
    Invoiced: "invoiced",
  }
  return m[s]
}

const LABOR_RATE = 95

const nextStatus: Partial<Record<WorkOrderStatus, WorkOrderStatus>> = {
  Open: "Scheduled",
  Scheduled: "In Progress",
  "In Progress": "Completed",
  Completed: "Invoiced",
}

export default function WorkOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { toast } = useToast()
  const activeOrg = useActiveOrganization()
  const { getById, updateStatus, updateRepairLog, updateWorkOrder } = useWorkOrders()

  const storeWo = getById(id)
  const [dbWo, setDbWo] = useState<WorkOrder | null | undefined>(undefined)
  const [internalNotes, setInternalNotes] = useState("")
  const [planServices, setPlanServices] = useState<unknown[] | null>(null)
  const [dbLoadFailed, setDbLoadFailed] = useState(false)

  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)

  const [problemReported, setProblemReported] = useState("")
  const [diagnosis, setDiagnosis] = useState("")
  const [parts, setParts] = useState<Part[]>([])
  const [laborHours, setLaborHours] = useState(0)
  const [techNotes, setTechNotes] = useState("")
  const [photos, setPhotos] = useState<string[]>([])
  const [tasks, setTasks] = useState<{ id: string; label: string; done: boolean }[]>([])
  const [sigData, setSigData] = useState("")
  const [signedBy, setSignedBy] = useState("")
  const [signedAt, setSignedAt] = useState("")

  const reload = useCallback(async () => {
    const supabase = createBrowserSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setDbWo(null)
      return
    }
    if (activeOrg.status !== "ready" || !activeOrg.organizationId) {
      setDbWo(null)
      return
    }
    const orgId = activeOrg.organizationId
    const res = await loadWorkOrderDetailForOrg(supabase, orgId, id)
    if (!res.ok) {
      setDbWo(null)
      if (!res.notFound) setDbLoadFailed(true)
      return
    }
    setDbLoadFailed(false)
    setDbWo(res.data.workOrder)
    setInternalNotes(res.data.notes)
    setPlanServices(res.data.planServices)
  }, [id, activeOrg.status, activeOrg.organizationId])

  useEffect(() => {
    void reload()
  }, [reload])

  const wo = dbWo ?? storeWo
  const resolved = dbWo !== undefined || Boolean(storeWo)
  const loading = !resolved

  useEffect(() => {
    if (!wo) return
    const rl = wo.repairLog
    setProblemReported(rl.problemReported)
    setDiagnosis(rl.diagnosis)
    setParts(rl.partsUsed)
    setLaborHours(rl.laborHours)
    setTechNotes(rl.technicianNotes)
    setPhotos(rl.photos)
    setTasks(rl.tasks ?? [])
    setSigData(rl.signatureDataUrl)
    setSignedBy(rl.signedBy)
    setSignedAt(rl.signedAt)
  }, [wo?.id])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-sm text-muted-foreground">Loading work order…</p>
      </div>
    )
  }

  if (!wo) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertTriangle className="w-8 h-8 text-muted-foreground" />
        <p className="text-muted-foreground">
          {dbLoadFailed ? "Could not load this work order." : "Work order not found."}
        </p>
        <Link href="/work-orders">
          <Button variant="outline">Back to Work Orders</Button>
        </Link>
      </div>
    )
  }

  const workOrder = wo
  const partsCost = parts.reduce((s, p) => s + p.quantity * p.unitCost, 0)
  const laborCost = laborHours * LABOR_RATE
  const editable = editing && ["Open", "Scheduled", "In Progress"].includes(workOrder.status)

  async function persistUpdate(payload: Record<string, unknown>) {
    if (!activeOrg.organizationId) {
      toast({ title: "Not signed in", description: "Save your session and try again.", variant: "destructive" })
      return false
    }
    const supabase = createBrowserSupabaseClient()
    const { error } = await supabase
      .from("work_orders")
      .update(payload)
      .eq("id", workOrder.id)
      .eq("organization_id", activeOrg.organizationId)
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" })
      return false
    }
    await reload()
    return true
  }

  async function handleSave() {
    const repairLog = serializeRepairLog({
      problemReported,
      diagnosis,
      partsUsed: parts,
      laborHours,
      technicianNotes: techNotes,
      photos,
      signatureDataUrl: sigData,
      signedBy,
      signedAt,
      tasks,
    })
    const ok = await persistUpdate({
      repair_log: repairLog,
      total_labor_cents: Math.round(laborCost * 100),
      total_parts_cents: Math.round(partsCost * 100),
      notes: internalNotes.trim() || null,
    })
    if (!ok) return

    updateRepairLog(workOrder.id, {
      problemReported,
      diagnosis,
      partsUsed: parts,
      laborHours,
      technicianNotes: techNotes,
      photos,
      signatureDataUrl: sigData,
      signedBy,
      signedAt,
      tasks,
    })
    updateWorkOrder(workOrder.id, {
      totalLaborCost: laborCost,
      totalPartsCost: partsCost,
    })
    setSaved(true)
    setEditing(false)
    setTimeout(() => setSaved(false), 3000)
  }

  async function handleStatusAdvance(next: WorkOrderStatus) {
    const payload: Record<string, unknown> = { status: uiStatusToDb(next) }
    if (next === "Completed") {
      payload.completed_at = new Date().toISOString()
    }
    const ok = await persistUpdate(payload)
    if (!ok) return
    updateStatus(workOrder.id, next)
  }

  async function handleMarkComplete() {
    await handleStatusAdvance("Completed")
  }

  function handleSignature(dataUrl: string, name: string) {
    setSigData(dataUrl)
    setSignedBy(name)
    setSignedAt(new Date().toISOString())
  }

  const quoteHref = `/quotes?action=new-quote&customerId=${encodeURIComponent(workOrder.customerId)}&equipmentId=${encodeURIComponent(workOrder.equipmentId)}`

  return (
    <div className="flex flex-col gap-4 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/work-orders">
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </Link>
          {saved && (
            <div className="flex items-center gap-1.5 text-xs text-[color:var(--status-success)] bg-[color:var(--status-success)]/10 border border-[color:var(--status-success)]/20 rounded-md px-3 py-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              All changes saved
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!editing ? (
            <>
              {nextStatus[workOrder.status] && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleStatusAdvance(nextStatus[workOrder.status]!)}
                >
                  Move to {nextStatus[workOrder.status]}
                </Button>
              )}
              {["Open", "Scheduled", "In Progress"].includes(workOrder.status) && (
                <Button size="sm" onClick={() => setEditing(true)}>
                  <PenLine className="w-3.5 h-3.5 mr-1.5" />
                  Edit repair log
                </Button>
              )}
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => void handleSave()}>
                <Save className="w-3.5 h-3.5 mr-1.5" />
                Save changes
              </Button>
            </>
          )}
        </div>
      </div>

      <WorkOrderDetailExperience
        workOrder={workOrder}
        internalNotes={internalNotes}
        onInternalNotesChange={setInternalNotes}
        internalNotesEditable={editable}
        planServices={planServices}
        activityItems={buildWorkOrderActivityItems(workOrder)}
        problemReported={problemReported}
        onProblemReportedChange={setProblemReported}
        diagnosis={diagnosis}
        onDiagnosisChange={setDiagnosis}
        technicianNotes={techNotes}
        onTechnicianNotesChange={setTechNotes}
        parts={parts}
        onPartsChange={setParts}
        laborHours={laborHours}
        onLaborHoursChange={setLaborHours}
        laborRatePerHour={LABOR_RATE}
        photos={photos}
        onPhotosChange={setPhotos}
        tasks={tasks}
        onTasksChange={setTasks}
        sigData={sigData}
        signedBy={signedBy}
        signedAt={signedAt}
        onSignatureSave={handleSignature}
        fieldsEditable={editable}
        partsPhotosEditable={editable}
        signatureEditable={editable}
        tasksEditable={editable}
        onEditWorkOrder={() => setEditing(true)}
        onAssignTechnician={() => router.push(`/work-orders?open=${encodeURIComponent(workOrder.id)}`)}
        onMarkComplete={handleMarkComplete}
        quoteHref={quoteHref}
        onInvoicePlaceholder={() =>
          toast({
            title: "Invoices",
            description: "Creating an invoice from this work order is not connected yet.",
          })
        }
        leading={
          <p className="text-[10px] text-muted-foreground font-mono">
            {getWorkOrderDisplay(workOrder)} · {workOrder.id}
          </p>
        }
      />

      {editing && (
        <div className={cn("flex justify-end gap-2 pb-8 border-t border-border pt-4")}>
          <Button variant="outline" onClick={() => setEditing(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()}>
            <Save className="w-3.5 h-3.5 mr-1.5" />
            Save repair log
          </Button>
        </div>
      )}
    </div>
  )
}
