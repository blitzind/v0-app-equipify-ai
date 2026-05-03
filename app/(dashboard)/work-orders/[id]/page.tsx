"use client"

import { use, useState, useRef, useEffect } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { useWorkOrders } from "@/lib/work-order-store"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { getWorkOrderDisplay } from "@/lib/work-orders/display"
import { missingWorkOrderNumberColumn } from "@/lib/work-orders/postgrest-fallback"
import { WO_DETAIL_PAGE_SELECT, WO_DETAIL_PAGE_SELECT_WITH_NUM } from "@/lib/work-orders/supabase-select"
import type {
  WorkOrder,
  WorkOrderStatus,
  WorkOrderPriority,
  WorkOrderType,
  Part,
  RepairLog,
} from "@/lib/mock-data"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ChevronLeft,
  Wrench,
  User,
  MapPin,
  Calendar,
  Clock,
  FileText,
  Package,
  Camera,
  PenLine,
  Trash2,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Save,
  X,
  ExternalLink,
} from "lucide-react"
import { AppointmentActions } from "@/components/appointments/appointment-actions"

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_STATUSES: WorkOrderStatus[] = ["Open", "Scheduled", "In Progress", "Completed", "Invoiced"]

const STATUS_STYLE: Record<WorkOrderStatus, string> = {
  "Open":        "bg-[color:var(--status-info)]/10 text-[color:var(--status-info)] border-[color:var(--status-info)]/30",
  "Scheduled":   "bg-[color:var(--status-info)]/15 text-[color:var(--status-info)] border-[color:var(--status-info)]/25",
  "In Progress": "bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)] border-[color:var(--status-warning)]/30",
  "Completed":   "bg-[color:var(--status-success)]/10 text-[color:var(--status-success)] border-[color:var(--status-success)]/30",
  "Invoiced":    "bg-muted text-muted-foreground border-border",
}

const PRIORITY_STYLE: Record<WorkOrderPriority, string> = {
  "Low":      "text-muted-foreground",
  "Normal":   "text-foreground",
  "High":     "text-[color:var(--status-warning)]",
  "Critical": "text-destructive font-semibold",
}

function formatDate(d: string) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function formatDateTime(d: string) {
  if (!d) return "—"
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
}

function mapDbStatus(status: string): WorkOrderStatus {
  switch (status) {
    case "open":
      return "Open"
    case "scheduled":
      return "Scheduled"
    case "in_progress":
      return "In Progress"
    case "completed":
      return "Completed"
    case "invoiced":
      return "Invoiced"
    default:
      return "Open"
  }
}

function mapDbPriority(priority: string): WorkOrderPriority {
  switch (priority) {
    case "low":
      return "Low"
    case "normal":
      return "Normal"
    case "high":
      return "High"
    case "critical":
      return "Critical"
    default:
      return "Normal"
  }
}

function mapDbType(type: string): WorkOrderType {
  switch (type) {
    case "repair":
      return "Repair"
    case "pm":
      return "PM"
    case "inspection":
      return "Inspection"
    case "install":
      return "Install"
    case "emergency":
      return "Emergency"
    default:
      return "Repair"
  }
}

function formatScheduledTime(isoOrTime: string | null): string {
  if (!isoOrTime) return ""
  const t = isoOrTime.includes("T") ? isoOrTime.slice(11, 16) : isoOrTime.slice(0, 5)
  return t || ""
}

function parseRepairLog(raw: unknown): RepairLog {
  const empty: RepairLog = {
    problemReported: "",
    diagnosis: "",
    partsUsed: [],
    laborHours: 0,
    technicianNotes: "",
    photos: [],
    signatureDataUrl: "",
    signedBy: "",
    signedAt: "",
  }
  if (!raw || typeof raw !== "object") return empty
  const o = raw as Record<string, unknown>
  return {
    problemReported: typeof o.problemReported === "string" ? o.problemReported : "",
    diagnosis: typeof o.diagnosis === "string" ? o.diagnosis : "",
    partsUsed: Array.isArray(o.partsUsed) ? (o.partsUsed as RepairLog["partsUsed"]) : [],
    laborHours: typeof o.laborHours === "number" ? o.laborHours : 0,
    technicianNotes: typeof o.technicianNotes === "string" ? o.technicianNotes : "",
    photos: Array.isArray(o.photos) ? (o.photos as string[]) : [],
    signatureDataUrl: typeof o.signatureDataUrl === "string" ? o.signatureDataUrl : "",
    signedBy: typeof o.signedBy === "string" ? o.signedBy : "",
    signedAt: typeof o.signedAt === "string" ? o.signedAt : "",
  }
}

// ─── Signature canvas ─────────────────────────────────────────────────────────

function SignatureCanvas({
  existing,
  onSave,
  signedBy,
  signedAt,
}: {
  existing: string
  onSave: (dataUrl: string, name: string) => void
  signedBy: string
  signedAt: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [drawing, setDrawing] = useState(false)
  const [hasStrokes, setHasStrokes] = useState(false)
  const [signerName, setSignerName] = useState(signedBy || "")
  const [mode, setMode] = useState<"view" | "capture">(existing ? "view" : "capture")

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ("touches" in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      }
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!
    const pos = getPos(e, canvas)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
    setDrawing(true)
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!
    const pos = getPos(e, canvas)
    ctx.lineWidth = 2.5
    ctx.lineCap = "round"
    ctx.strokeStyle = "#1a1a2e"
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    setHasStrokes(true)
  }

  function endDraw() { setDrawing(false) }

  function clear() {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height)
    setHasStrokes(false)
  }

  function save() {
    const canvas = canvasRef.current
    if (!canvas || !hasStrokes) return
    onSave(canvas.toDataURL(), signerName)
    setMode("view")
  }

  if (mode === "view" && existing) {
    return (
      <div className="flex flex-col gap-3">
        <div className="border border-border rounded-lg p-4 bg-muted/20">
          {existing === "SIGNED" ? (
            <div className="flex items-center gap-2 h-20">
              <CheckCircle2 className="w-5 h-5 text-[color:var(--status-success)]" />
              <div>
                <p className="text-sm font-medium text-foreground">Signed by {signedBy}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(signedAt)}</p>
              </div>
            </div>
          ) : (
            <img src={existing} alt="Customer signature" className="max-h-24 object-contain" />
          )}
        </div>
        {signedBy && <p className="text-xs text-muted-foreground">Signed by <strong>{signedBy}</strong> on {formatDateTime(signedAt)}</p>}
        <Button variant="outline" size="sm" className="w-fit" onClick={() => setMode("capture")}>
          <PenLine className="w-3.5 h-3.5 mr-1.5" />
          Re-capture Signature
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <Input
        placeholder="Signer's full name"
        value={signerName}
        onChange={(e) => setSignerName(e.target.value)}
        className="max-w-72"
      />
      <div className="border-2 border-dashed border-border rounded-lg overflow-hidden bg-white touch-none select-none">
        <canvas
          ref={canvasRef}
          width={600}
          height={160}
          className="w-full cursor-crosshair"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
      </div>
      <p className="text-xs text-muted-foreground">Draw signature above using mouse or touch</p>
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={!hasStrokes || !signerName.trim()}>
          <Save className="w-3.5 h-3.5 mr-1.5" />
          Save Signature
        </Button>
        <Button size="sm" variant="outline" onClick={clear}>
          <X className="w-3.5 h-3.5 mr-1.5" />
          Clear
        </Button>
        {existing && (
          <Button size="sm" variant="ghost" onClick={() => setMode("view")}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  )
}

// ─── Parts table ────────────────────────────────────���────────────────────────

function PartsTable({
  parts,
  editable,
  onChange,
}: {
  parts: Part[]
  editable: boolean
  onChange: (parts: Part[]) => void
}) {
  function update(id: string, field: keyof Part, value: string | number) {
    onChange(parts.map((p) => (p.id === id ? { ...p, [field]: value } : p)))
  }
  function remove(id: string) {
    onChange(parts.filter((p) => p.id !== id))
  }
  function addRow() {
    onChange([
      ...parts,
      { id: `P-${Date.now()}`, name: "", partNumber: "", quantity: 1, unitCost: 0 },
    ])
  }

  const total = parts.reduce((sum, p) => sum + p.quantity * p.unitCost, 0)

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead>Part Name</TableHead>
              <TableHead>Part #</TableHead>
              <TableHead className="w-20 text-right">Qty</TableHead>
              <TableHead className="w-28 text-right">Unit Cost</TableHead>
              <TableHead className="w-28 text-right">Total</TableHead>
              {editable && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {parts.length === 0 && (
              <TableRow>
                <TableCell colSpan={editable ? 6 : 5} className="text-center text-muted-foreground text-sm py-6">
                  No parts added yet.
                </TableCell>
              </TableRow>
            )}
            {parts.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  {editable ? (
                    <Input
                      value={p.name}
                      onChange={(e) => update(p.id, "name", e.target.value)}
                      placeholder="Part name"
                      className="h-8 text-sm"
                    />
                  ) : <span className="text-sm">{p.name}</span>}
                </TableCell>
                <TableCell>
                  {editable ? (
                    <Input
                      value={p.partNumber}
                      onChange={(e) => update(p.id, "partNumber", e.target.value)}
                      placeholder="PN-0000"
                      className="h-8 text-sm font-mono"
                    />
                  ) : <span className="text-sm font-mono text-muted-foreground">{p.partNumber}</span>}
                </TableCell>
                <TableCell className="text-right">
                  {editable ? (
                    <Input
                      type="number"
                      min={1}
                      value={p.quantity}
                      onChange={(e) => update(p.id, "quantity", Number(e.target.value))}
                      className="h-8 text-sm text-right w-16 ml-auto"
                    />
                  ) : <span className="text-sm">{p.quantity}</span>}
                </TableCell>
                <TableCell className="text-right">
                  {editable ? (
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={p.unitCost}
                      onChange={(e) => update(p.id, "unitCost", Number(e.target.value))}
                      className="h-8 text-sm text-right w-24 ml-auto"
                    />
                  ) : <span className="text-sm">${p.unitCost.toFixed(2)}</span>}
                </TableCell>
                <TableCell className="text-right text-sm font-medium">
                  ${(p.quantity * p.unitCost).toFixed(2)}
                </TableCell>
                {editable && (
                  <TableCell>
                    <Button variant="ghost" size="icon-sm" onClick={() => remove(p.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        {editable && (
          <Button variant="outline" size="sm" onClick={addRow} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Add Part
          </Button>
        )}
        <div className="ml-auto text-sm font-medium">
          Parts Total: <span className="text-foreground font-semibold">${total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Photo grid ───────────────────────────────────────────────────────────────

function PhotoSection({
  photos,
  editable,
  onChange,
}: {
  photos: string[]
  editable: boolean
  onChange: (photos: string[]) => void
}) {
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    files.forEach((file) => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        if (ev.target?.result) {
          onChange([...photos, ev.target.result as string])
        }
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ""
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        {photos.map((src, i) => (
          <div key={i} className="relative group w-28 h-28 rounded-lg overflow-hidden border border-border bg-muted">
            <img src={src} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
            {editable && (
              <button
                onClick={() => onChange(photos.filter((_, j) => j !== i))}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
        {editable && (
          <label className="flex flex-col items-center justify-center w-28 h-28 rounded-lg border-2 border-dashed border-border bg-muted/30 hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer text-muted-foreground hover:text-primary">
            <Camera className="w-5 h-5 mb-1" />
            <span className="text-xs text-center leading-tight">Add Photo</span>
            <input type="file" accept="image/*" multiple className="hidden" onChange={handleFile} />
          </label>
        )}
      </div>
      {photos.length === 0 && !editable && (
        <p className="text-sm text-muted-foreground">No photos attached.</p>
      )}
    </div>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="w-4 h-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function WorkOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { getById, updateStatus, updateRepairLog, updateWorkOrder } = useWorkOrders()

  const storeWo = getById(id)
  const [dbWo, setDbWo] = useState<WorkOrder | null | undefined>(undefined)
  const [dbLoadFailed, setDbLoadFailed] = useState(false)

  useEffect(() => {
    let active = true
    setDbWo(undefined)
    setDbLoadFailed(false)

    async function loadFromSupabase() {
      const supabase = createBrowserSupabaseClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        if (active) setDbWo(null)
        return
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("default_organization_id")
        .eq("id", user.id)
        .single()
      const orgId = profile?.default_organization_id
      if (!orgId) {
        if (active) setDbWo(null)
        return
      }

      let woRes = await supabase
        .from("work_orders")
        .select(WO_DETAIL_PAGE_SELECT_WITH_NUM)
        .eq("id", id)
        .eq("organization_id", orgId)
        .eq("is_archived", false)
        .maybeSingle()

      if (woRes.error && missingWorkOrderNumberColumn(woRes.error)) {
        woRes = await supabase
          .from("work_orders")
          .select(WO_DETAIL_PAGE_SELECT)
          .eq("id", id)
          .eq("organization_id", orgId)
          .eq("is_archived", false)
          .maybeSingle()
      }

      const { data: row, error } = woRes

      if (!active) return
      if (error || !row) {
        setDbWo(null)
        if (error) setDbLoadFailed(true)
        return
      }

      const w = row as {
        id: string
        work_order_number?: number | null
        customer_id: string
        equipment_id: string
        title: string
        status: string
        priority: string
        type: string
        scheduled_on: string | null
        scheduled_time: string | null
        completed_at: string | null
        assigned_user_id: string | null
        created_at: string
        invoice_number: string | null
        total_labor_cents: number
        total_parts_cents: number
        notes: string | null
        repair_log: unknown
        maintenance_plan_id: string | null
      }

      const [{ data: cust }, { data: eq }, { data: assigneeProf }, { data: planRow }] = await Promise.all([
        supabase
          .from("customers")
          .select("company_name")
          .eq("id", w.customer_id)
          .eq("organization_id", orgId)
          .maybeSingle(),
        supabase
          .from("equipment")
          .select("name, location_label")
          .eq("id", w.equipment_id)
          .eq("organization_id", orgId)
          .maybeSingle(),
        w.assigned_user_id
          ? supabase
              .from("profiles")
              .select("full_name, email")
              .eq("id", w.assigned_user_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        w.maintenance_plan_id
          ? supabase
              .from("maintenance_plans")
              .select("name")
              .eq("id", w.maintenance_plan_id)
              .eq("organization_id", orgId)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ])

      if (!active) return

      const customerName = (cust as { company_name: string } | null)?.company_name ?? "Unknown Customer"
      const eqRow = eq as { name: string; location_label: string | null } | null
      const equipmentName = eqRow?.name ?? "Equipment"
      const location = eqRow?.location_label ?? ""
      const ap = assigneeProf as { full_name: string | null; email: string | null } | null
      const techName = w.assigned_user_id
        ? (ap?.full_name && ap.full_name.trim()) || (ap?.email && ap.email.trim()) || "Unknown"
        : "Unassigned"
      const techId = w.assigned_user_id ?? "unassigned"
      const planMeta = planRow as { name: string } | null
      const planName = w.maintenance_plan_id ? (planMeta?.name ?? null) : null

      const mapped: WorkOrder = {
        id: w.id,
        workOrderNumber: w.work_order_number ?? undefined,
        customerId: w.customer_id,
        customerName,
        equipmentId: w.equipment_id,
        equipmentName,
        location,
        type: mapDbType(w.type),
        status: mapDbStatus(w.status),
        priority: mapDbPriority(w.priority),
        technicianId: techId,
        technicianName: techName,
        scheduledDate: w.scheduled_on ?? "",
        scheduledTime: formatScheduledTime(w.scheduled_time),
        completedDate: w.completed_at ? w.completed_at.slice(0, 10) : "",
        createdAt: w.created_at,
        createdBy: "",
        description: w.title,
        repairLog: parseRepairLog(w.repair_log),
        totalLaborCost: w.total_labor_cents / 100,
        totalPartsCost: w.total_parts_cents / 100,
        invoiceNumber: w.invoice_number ?? "",
        maintenancePlanId: w.maintenance_plan_id,
        maintenancePlanName: planName,
      }

      setDbWo(mapped)
    }

    void loadFromSupabase()
    return () => {
      active = false
    }
  }, [id])

  const wo = dbWo ?? storeWo
  const resolved = dbWo !== undefined || Boolean(storeWo)
  const loading = !resolved

  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)

  // Local repair log state
  const [problemReported, setProblemReported] = useState("")
  const [diagnosis, setDiagnosis] = useState("")
  const [parts, setParts] = useState<Part[]>([])
  const [laborHours, setLaborHours] = useState(0)
  const [techNotes, setTechNotes] = useState("")
  const [photos, setPhotos] = useState<string[]>([])
  const [sigData, setSigData] = useState("")
  const [signedBy, setSignedBy] = useState("")
  const [signedAt, setSignedAt] = useState("")

  // Populate from work order
  useEffect(() => {
    if (!wo) return
    const rl = wo.repairLog
    setProblemReported(rl.problemReported)
    setDiagnosis(rl.diagnosis)
    setParts(rl.partsUsed)
    setLaborHours(rl.laborHours)
    setTechNotes(rl.technicianNotes)
    setPhotos(rl.photos)
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
  const laborCost = laborHours * 95 // $95/hr rate

  const editable = editing && ["Open", "Scheduled", "In Progress"].includes(workOrder.status)

  function handleSave() {
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
    })
    updateWorkOrder(workOrder.id, {
      totalLaborCost: laborCost,
      totalPartsCost: partsCost,
    })
    setSaved(true)
    setEditing(false)
    setTimeout(() => setSaved(false), 3000)
  }

  function handleSignature(dataUrl: string, name: string) {
    setSigData(dataUrl)
    setSignedBy(name)
    setSignedAt(new Date().toISOString())
  }

  const nextStatus: Partial<Record<WorkOrderStatus, WorkOrderStatus>> = {
    "Open": "Scheduled",
    "Scheduled": "In Progress",
    "In Progress": "Completed",
    "Completed": "Invoiced",
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Link href="/work-orders">
            <Button variant="ghost" size="icon" className="mt-0.5 h-8 w-8 shrink-0">
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold text-foreground">{getWorkOrderDisplay(workOrder)}</h1>
              {workOrder.maintenancePlanId && (
                <>
                  <Badge
                    variant="secondary"
                    className="text-[10px] border bg-[color:var(--status-success)]/10 text-[color:var(--status-success)] border-[color:var(--status-success)]/25"
                  >
                    Preventive Maintenance
                  </Badge>
                  <Badge
                    variant="secondary"
                    className="text-[10px] font-mono border bg-[color:var(--status-success)]/10 text-[color:var(--status-success)] border-[color:var(--status-success)]/25"
                  >
                    PM
                  </Badge>
                </>
              )}
              <Badge variant="secondary" className={cn("border text-xs", STATUS_STYLE[workOrder.status])}>
                {workOrder.status}
              </Badge>
              <span className={cn("text-xs font-medium", PRIORITY_STYLE[workOrder.priority])}>
                {workOrder.priority} priority
              </span>
              <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                {workOrder.type}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">{workOrder.description}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pl-11 sm:pl-0 shrink-0">
          {saved && (
            <div className="flex items-center gap-1.5 text-xs text-[color:var(--status-success)] bg-[color:var(--status-success)]/10 border border-[color:var(--status-success)]/20 rounded-md px-3 py-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Saved
            </div>
          )}
          {!editing ? (
            <>
              {nextStatus[workOrder.status] && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateStatus(workOrder.id, nextStatus[workOrder.status]!)}
                >
                  Move to {nextStatus[workOrder.status]}
                </Button>
              )}
              {["Open", "Scheduled", "In Progress"].includes(workOrder.status) && (
                <Button size="sm" onClick={() => setEditing(true)}>
                  <PenLine className="w-3.5 h-3.5 mr-1.5" />
                  Edit Repair Log
                </Button>
              )}
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSave}>
                <Save className="w-3.5 h-3.5 mr-1.5" />
                Save Changes
              </Button>
            </>
          )}
        </div>
      </div>

      {workOrder.maintenancePlanId && (
        <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Maintenance plan</p>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/maintenance-plans?open=${workOrder.maintenancePlanId}`}
              className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1"
            >
              {workOrder.maintenancePlanName?.trim() || "View plan"}
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </Link>
            <span className="text-xs text-muted-foreground">· Created from this plan</span>
          </div>
        </div>
      )}

      {/* Customer & equipment — explicit links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-card border border-border">
          <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Customer</p>
            <Link href={`/customers?open=${workOrder.customerId}`} className="text-sm font-medium text-primary hover:underline block truncate">
              {workOrder.customerName}
            </Link>
            <p className="text-xs text-muted-foreground font-mono truncate">{workOrder.customerId}</p>
          </div>
        </div>
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-card border border-border">
          <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
            <Wrench className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Equipment</p>
            <Link href={`/equipment?open=${workOrder.equipmentId}`} className="text-sm font-medium text-primary hover:underline block truncate">
              {workOrder.equipmentName}
            </Link>
            <p className="text-xs text-muted-foreground font-mono truncate">{workOrder.equipmentId}</p>
          </div>
        </div>
      </div>

      {/* Info strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: MapPin, label: "Site / location", value: workOrder.location || "—", sub: "" },
          { icon: User, label: "Technician", value: workOrder.technicianName, sub: "" },
          { icon: Calendar, label: "Scheduled", value: formatDate(workOrder.scheduledDate), sub: workOrder.scheduledTime ? `at ${workOrder.scheduledTime}` : "" },
          { icon: Clock, label: "Created", value: formatDate(workOrder.createdAt.slice(0, 10)), sub: "" },
        ].map(({ icon: Icon, label, value, sub }) => (
          <div key={label} className="flex items-start gap-2.5 p-3 rounded-lg bg-card border border-border">
            <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-sm font-medium text-foreground truncate">{value}</p>
              {sub && <p className="text-xs text-muted-foreground truncate">{sub}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* Appointment navigation + email actions */}
      {workOrder.location && (
        <AppointmentActions
          address={workOrder.location}
          emailParams={{
            customerName:  workOrder.customerName,
            equipmentName: workOrder.equipmentName,
            technicianName: workOrder.technicianName,
            scheduledDate:  workOrder.scheduledDate,
            scheduledTime:  workOrder.scheduledTime,
            address:        workOrder.location,
            workOrderId:    workOrder.id,
            ccEmails:       ["service@equipify.ai"],
          }}
        />
      )}

      {/* Cost summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Labor Hours", value: editable ? null : `${laborHours} hrs`, edit: true },
          { label: "Labor Cost", value: `$${laborCost.toFixed(2)}`, edit: false },
          { label: "Parts Cost", value: `$${partsCost.toFixed(2)}`, edit: false },
        ].map(({ label, value }) => (
          <div key={label} className="p-3 rounded-lg bg-card border border-border">
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            {label === "Labor Hours" && editable ? (
              <Input
                type="number"
                min={0}
                step={0.5}
                value={laborHours}
                onChange={(e) => setLaborHours(Number(e.target.value))}
                className="h-8 text-lg font-bold w-28"
              />
            ) : (
              <p className="text-lg font-bold text-foreground">{value}</p>
            )}
          </div>
        ))}
      </div>

      {/* Repair Log — Problem Reported */}
      <Section title="Problem Reported" icon={AlertTriangle}>
        {editable ? (
          <Textarea
            value={problemReported}
            onChange={(e) => setProblemReported(e.target.value)}
            rows={3}
            placeholder="Describe the problem reported by the customer..."
          />
        ) : (
          <p className="text-sm text-foreground leading-relaxed">{problemReported || <span className="text-muted-foreground">Not recorded.</span>}</p>
        )}
      </Section>

      {/* Diagnosis */}
      <Section title="Diagnosis" icon={FileText}>
        {editable ? (
          <Textarea
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.target.value)}
            rows={4}
            placeholder="Technician diagnosis and root cause..."
          />
        ) : (
          <p className="text-sm text-foreground leading-relaxed">{diagnosis || <span className="text-muted-foreground">Not recorded.</span>}</p>
        )}
      </Section>

      {/* Parts */}
      <Section title="Parts Used" icon={Package}>
        <PartsTable parts={parts} editable={editable} onChange={setParts} />
      </Section>

      {/* Technician Notes */}
      <Section title="Technician Notes" icon={PenLine}>
        {editable ? (
          <Textarea
            value={techNotes}
            onChange={(e) => setTechNotes(e.target.value)}
            rows={3}
            placeholder="Internal notes, follow-up recommendations..."
          />
        ) : (
          <p className="text-sm text-foreground leading-relaxed">{techNotes || <span className="text-muted-foreground">No notes.</span>}</p>
        )}
      </Section>

      {/* Photos */}
      <Section title="Photos" icon={Camera}>
        <PhotoSection photos={photos} editable={editable} onChange={setPhotos} />
      </Section>

      {/* Signature */}
      <Section title="Customer Signature" icon={PenLine}>
        <SignatureCanvas
          existing={sigData}
          onSave={handleSignature}
          signedBy={signedBy}
          signedAt={signedAt}
        />
      </Section>

      {/* Footer actions */}
      {editing && (
        <div className="flex justify-end gap-2 pb-6">
          <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
          <Button onClick={handleSave}>
            <Save className="w-3.5 h-3.5 mr-1.5" />
            Save Repair Log
          </Button>
        </div>
      )}
    </div>
  )
}
