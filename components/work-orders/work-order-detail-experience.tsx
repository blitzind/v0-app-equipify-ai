"use client"

import { useRef, useState, type MouseEvent, type TouchEvent } from "react"
import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import {
  User,
  Wrench,
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
  ClipboardList,
  Hammer,
  ImageIcon,
  StickyNote,
  History,
  Pencil,
  UserPlus,
  Receipt,
  Printer,
  AlertOctagon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { Part, RepairLog, WorkOrder, WorkOrderPriority, WorkOrderStatus } from "@/lib/mock-data"
import { getWorkOrderDisplay } from "@/lib/work-orders/display"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { MaintenancePlansBrandTile } from "@/lib/navigation/module-icons"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DrawerTimeline } from "@/components/detail-drawer"
import { AppointmentActions } from "@/components/appointments/appointment-actions"

// ─── Styles (match existing WO page) ─────────────────────────────────────────

const STATUS_STYLE: Record<WorkOrderStatus, string> = {
  Open: "bg-[color:var(--status-info)]/10 text-[color:var(--status-info)] border-[color:var(--status-info)]/30",
  Scheduled: "bg-[color:var(--status-info)]/15 text-[color:var(--status-info)] border-[color:var(--status-info)]/25",
  "In Progress":
    "bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)] border-[color:var(--status-warning)]/30",
  Completed: "bg-[color:var(--status-success)]/10 text-[color:var(--status-success)] border-[color:var(--status-success)]/30",
  Invoiced: "bg-muted text-muted-foreground border-border",
}

const PRIORITY_STYLE: Record<WorkOrderPriority, string> = {
  Low: "text-muted-foreground",
  Normal: "text-foreground",
  High: "text-[color:var(--status-warning)]",
  Critical: "text-destructive font-semibold",
}

function formatDate(d: string) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function formatDateTime(d: string) {
  if (!d) return "—"
  return new Date(d).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export type WorkOrderActivityItem = {
  date: string
  label: string
  description?: string
  accent?: "muted" | "success" | "warning"
}

export function buildWorkOrderActivityItems(wo: WorkOrder): WorkOrderActivityItem[] {
  const items: WorkOrderActivityItem[] = [
    {
      date: formatDate(wo.createdAt.slice(0, 10)),
      label: "Work order created",
      description: "Recorded in your workspace",
      accent: "muted",
    },
  ]
  if (wo.scheduledDate) {
    items.push({
      date: formatDate(wo.scheduledDate),
      label: `Scheduled${wo.scheduledTime ? ` at ${wo.scheduledTime}` : ""}`,
      description: `Technician: ${wo.technicianName}`,
      accent: "muted",
    })
  }
  if (wo.completedDate) {
    items.push({
      date: formatDate(wo.completedDate),
      label: "Completed",
      description: wo.repairLog.technicianNotes?.slice(0, 120) || "Service completed",
      accent: "success",
    })
  }
  if (wo.invoiceNumber) {
    items.push({
      date: "—",
      label: `Invoiced — ${wo.invoiceNumber}`,
      accent: "success",
    })
  }
  return items
}

function planServiceLabel(s: unknown, i: number): string {
  if (typeof s === "string") return s
  if (s && typeof s === "object") {
    const o = s as Record<string, unknown>
    if (typeof o.name === "string") return o.name
    if (typeof o.label === "string") return o.label
    if (typeof o.description === "string") return o.description
  }
  try {
    return JSON.stringify(s)
  } catch {
    return `Service ${i + 1}`
  }
}

// ─── Parts table (shared with page behavior) ──────────────────────────────────

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
    onChange([...parts, { id: `P-${Date.now()}`, name: "", partNumber: "", quantity: 1, unitCost: 0 }])
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
                <TableCell
                  colSpan={editable ? 6 : 5}
                  className="text-center text-muted-foreground text-sm py-6"
                >
                  No parts recorded.
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
                  ) : (
                    <span className="text-sm">{p.name || "—"}</span>
                  )}
                </TableCell>
                <TableCell>
                  {editable ? (
                    <Input
                      value={p.partNumber}
                      onChange={(e) => update(p.id, "partNumber", e.target.value)}
                      placeholder="PN-0000"
                      className="h-8 text-sm font-mono"
                    />
                  ) : (
                    <span className="text-sm font-mono text-muted-foreground">{p.partNumber || "—"}</span>
                  )}
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
                  ) : (
                    <span className="text-sm">{p.quantity}</span>
                  )}
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
                  ) : (
                    <span className="text-sm">${p.unitCost.toFixed(2)}</span>
                  )}
                </TableCell>
                <TableCell className="text-right text-sm font-medium">
                  ${(p.quantity * p.unitCost).toFixed(2)}
                </TableCell>
                {editable && (
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => remove(p.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
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
          Parts total:{" "}
          <span className="text-foreground font-semibold tabular-nums">${total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  )
}

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
        if (ev.target?.result) onChange([...photos, ev.target.result as string])
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ""
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        {photos.map((src, i) => (
          <div
            key={i}
            className="relative group w-28 h-28 rounded-lg overflow-hidden border border-border bg-muted"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`Attachment ${i + 1}`} className="w-full h-full object-cover" />
            {editable && (
              <button
                type="button"
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
            <span className="text-xs text-center leading-tight">Add photo</span>
            <input type="file" accept="image/*" multiple className="hidden" onChange={handleFile} />
          </label>
        )}
      </div>
      {photos.length === 0 && !editable && (
        <p className="text-sm text-muted-foreground">No photos or image attachments.</p>
      )}
    </div>
  )
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: LucideIcon
  children: React.ReactNode
}) {
  return (
    <Card className="border-border shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
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

// ─── Signature (canvas) — same behavior as page ───────────────────────────────

function SignatureCanvas({
  existing,
  onSave,
  signedBy,
  signedAt,
  readOnly,
}: {
  existing: string
  onSave: (dataUrl: string, name: string) => void
  signedBy: string
  signedAt: string
  readOnly?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [drawing, setDrawing] = useState(false)
  const [hasStrokes, setHasStrokes] = useState(false)
  const [signerName, setSignerName] = useState(signedBy || "")
  const [mode, setMode] = useState<"view" | "capture">(existing ? "view" : "capture")

  const getPos = (e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) => {
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

  function startDraw(e: MouseEvent | TouchEvent) {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!
    const pos = getPos(e, canvas)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
    setDrawing(true)
  }

  function draw(e: MouseEvent | TouchEvent) {
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

  function endDraw() {
    setDrawing(false)
  }

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

  if (readOnly) {
    if (!existing) {
      return <p className="text-sm text-muted-foreground">No signature captured.</p>
    }
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
            // eslint-disable-next-line @next/next/no-img-element
            <img src={existing} alt="Customer signature" className="max-h-24 object-contain" />
          )}
        </div>
        {signedBy && (
          <p className="text-xs text-muted-foreground">
            Signed by <strong>{signedBy}</strong> on {formatDateTime(signedAt)}
          </p>
        )}
      </div>
    )
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
            // eslint-disable-next-line @next/next/no-img-element
            <img src={existing} alt="Customer signature" className="max-h-24 object-contain" />
          )}
        </div>
        {signedBy && (
          <p className="text-xs text-muted-foreground">
            Signed by <strong>{signedBy}</strong> on {formatDateTime(signedAt)}
          </p>
        )}
        <Button variant="outline" size="sm" className="w-fit" onClick={() => setMode("capture")}>
          <PenLine className="w-3.5 h-3.5 mr-1.5" />
          Re-capture signature
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <Input
        placeholder="Signer&apos;s full name"
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
      <p className="text-xs text-muted-foreground">Draw signature using mouse or touch</p>
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

export interface WorkOrderDetailExperienceProps {
  workOrder: WorkOrder
  internalNotes: string
  onInternalNotesChange?: (v: string) => void
  internalNotesEditable?: boolean
  planServices: unknown[] | null
  activityItems: WorkOrderActivityItem[]
  /** Repair log fields (controlled) */
  problemReported: string
  onProblemReportedChange: (v: string) => void
  diagnosis: string
  onDiagnosisChange: (v: string) => void
  technicianNotes: string
  onTechnicianNotesChange: (v: string) => void
  parts: Part[]
  onPartsChange: (parts: Part[]) => void
  laborHours: number
  onLaborHoursChange: (n: number) => void
  laborRatePerHour: number
  photos: string[]
  onPhotosChange: (photos: string[]) => void
  tasks: { id: string; label: string; done: boolean }[]
  onTasksChange: (tasks: { id: string; label: string; done: boolean }[]) => void
  sigData: string
  signedBy: string
  signedAt: string
  onSignatureSave: (dataUrl: string, name: string) => void
  /** Field editors */
  fieldsEditable: boolean
  /** When false, problem reported stays read-only even if `fieldsEditable` (e.g. drawer). */
  problemEditable?: boolean
  partsPhotosEditable: boolean
  signatureEditable: boolean
  tasksEditable: boolean
  /** Quick actions */
  onEditWorkOrder: () => void
  onAssignTechnician: () => void
  onMarkComplete: () => void | Promise<void>
  quoteHref: string
  onInvoicePlaceholder: () => void
  onPrint?: () => void
  onArchive?: () => void
  /** Optional link to full page (drawer) */
  fullPageHref?: string
  /** Leading slot (e.g. back button on page) */
  leading?: React.ReactNode
  /** `drawer` aligns chrome with `EquipmentDrawer` (underline tabs, KPI cards, quick actions). */
  layout?: "page" | "drawer"
}

export function WorkOrderDetailExperience({
  workOrder,
  internalNotes,
  onInternalNotesChange,
  internalNotesEditable = false,
  planServices,
  activityItems,
  problemReported,
  onProblemReportedChange,
  diagnosis,
  onDiagnosisChange,
  technicianNotes,
  onTechnicianNotesChange,
  parts,
  onPartsChange,
  laborHours,
  onLaborHoursChange,
  laborRatePerHour,
  photos,
  onPhotosChange,
  tasks,
  onTasksChange,
  sigData,
  signedBy,
  signedAt,
  onSignatureSave,
  fieldsEditable,
  problemEditable,
  partsPhotosEditable,
  signatureEditable,
  tasksEditable,
  onEditWorkOrder,
  onAssignTechnician,
  onMarkComplete,
  quoteHref,
  onInvoicePlaceholder,
  onPrint,
  onArchive,
  fullPageHref,
  leading,
  layout = "page",
}: WorkOrderDetailExperienceProps) {
  const isDrawer = layout === "drawer"
  const laborCost = laborHours * laborRatePerHour
  const partsCost = parts.reduce((s, p) => s + p.quantity * p.unitCost, 0)
  const canMarkComplete = workOrder.status !== "Completed" && workOrder.status !== "Invoiced"
  const canEditProblem = problemEditable ?? fieldsEditable
  const qaVariant = isDrawer ? "secondary" : "outline"
  const qaBtnClass = isDrawer ? "h-8 gap-1.5 text-xs shadow-sm" : "gap-1.5"
  const kpiCellClass = isDrawer
    ? "bg-card rounded-xl border border-border p-3 flex flex-col gap-1 shadow-[0_1px_3px_rgba(0,0,0,0.06)] min-h-[88px]"
    : "flex items-start gap-2.5 p-3 rounded-lg bg-card border border-border"
  const kpiLabelClass = isDrawer
    ? "text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
    : "text-xs text-muted-foreground"
  const kpiValueClass = isDrawer ? "text-xl font-bold tracking-tight text-foreground truncate" : "text-sm font-medium text-foreground truncate"

  function toggleTask(id: string) {
    onTasksChange(tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)))
  }

  function addTask() {
    const label = window.prompt("Task description")
    if (!label?.trim()) return
    onTasksChange([...tasks, { id: `task-${Date.now()}`, label: label.trim(), done: false }])
  }

  const tabListClass = isDrawer
    ? "h-auto min-h-0 w-full flex flex-nowrap overflow-x-auto overflow-y-hidden overscroll-x-contain justify-start gap-0 rounded-none bg-background p-0 border-0 border-b border-border shrink-0 z-[11] px-5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    : "h-auto min-h-10 w-full flex flex-wrap justify-start gap-1 rounded-xl bg-muted/60 p-1 border border-border"

  const tabTriggerClass = (extra?: string) =>
    cn(
      "text-xs font-medium gap-1.5 whitespace-nowrap shrink-0 transition-colors",
      isDrawer
        ? cn(
            "grow-0 basis-auto",
            "rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 py-2.5 shadow-none",
            "data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none",
            "text-muted-foreground hover:text-foreground hover:border-border",
            extra,
          )
        : cn(
            "data-[state=active]:bg-card rounded-md border border-transparent px-2 py-1",
            extra,
          ),
    )

  const tabScrollWrapClass = isDrawer
    ? "flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-5 py-5 space-y-5"
    : undefined

  return (
    <div
      className={cn(
        "flex flex-col",
        isDrawer ? "min-h-0 flex-1 gap-0 overflow-hidden" : "gap-5",
      )}
    >
      {leading}

      {!isDrawer && (
        <>
          {/* Premium header (full page) */}
          <div className="rounded-xl border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] p-4 sm:p-5">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                      {getWorkOrderDisplay(workOrder)}
                    </h1>
                    <Badge variant="secondary" className={cn("border text-xs", STATUS_STYLE[workOrder.status])}>
                      {workOrder.status}
                    </Badge>
                    <span className={cn("text-xs font-semibold uppercase tracking-wide", PRIORITY_STYLE[workOrder.priority])}>
                      {workOrder.priority} priority
                    </span>
                    <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                      {workOrder.type}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground leading-snug">{workOrder.description}</p>
                </div>
                {fullPageHref && (
                  <Button variant="outline" size="sm" className="shrink-0" asChild>
                    <Link href={fullPageHref}>Open full page</Link>
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/25 border border-border/80">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Customer</p>
                    <Link
                      href={`/customers?open=${workOrder.customerId}`}
                      className="text-sm font-semibold text-primary hover:underline block truncate"
                    >
                      {workOrder.customerName}
                    </Link>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/25 border border-border/80">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Wrench className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Equipment</p>
                    <Link
                      href={`/equipment/${workOrder.equipmentId}`}
                      className="text-sm font-semibold text-primary hover:underline block truncate"
                    >
                      {workOrder.equipmentName}
                    </Link>
                    {workOrder.location ? (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{workOrder.location}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {workOrder.maintenancePlanId && !isDrawer && (
        <div className="rounded-xl border border-border bg-muted/20 px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <MaintenancePlansBrandTile size="xs" />
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Maintenance plan source
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/maintenance-plans?open=${workOrder.maintenancePlanId}`}
              className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1"
            >
              {workOrder.maintenancePlanName?.trim() || "View plan"}
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </Link>
            <span className="text-xs text-muted-foreground">· Created from this recurring plan</span>
          </div>
        </div>
      )}

      {!isDrawer && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={qaVariant} className={qaBtnClass} onClick={onEditWorkOrder}>
            <Pencil className="w-3.5 h-3.5" />
            Edit work order
          </Button>
          <Button size="sm" variant={qaVariant} className={qaBtnClass} onClick={onAssignTechnician}>
            <UserPlus className="w-3.5 h-3.5" />
            Assign technician
          </Button>
          {canMarkComplete && (
            <Button size="sm" variant={qaVariant} className={qaBtnClass} onClick={() => void onMarkComplete()}>
              <CheckCircle2 className="w-3.5 h-3.5" />
              Mark complete
            </Button>
          )}
          <Button size="sm" variant={qaVariant} className={qaBtnClass} asChild>
            <Link href={quoteHref}>
              <FileText className="w-3.5 h-3.5" />
              Create quote
            </Link>
          </Button>
          <Button
            size="sm"
            variant={qaVariant}
            className={cn(qaBtnClass, !isDrawer && "opacity-70")}
            type="button"
            onClick={onInvoicePlaceholder}
            title="Invoice creation from work orders is not wired yet"
          >
            <Receipt className="w-3.5 h-3.5" />
            Create invoice
          </Button>
          {onPrint && (
            <Button size="sm" variant={qaVariant} className={qaBtnClass} type="button" onClick={onPrint}>
              <Printer className="w-3.5 h-3.5" />
              Print
            </Button>
          )}
          {onArchive && (
            <Button
              size="sm"
              variant={qaVariant}
              className={cn(
                qaBtnClass,
                "border-destructive/40 text-destructive hover:bg-destructive/10",
              )}
              type="button"
              onClick={onArchive}
            >
              <AlertOctagon className="w-3.5 h-3.5" />
              Archive
            </Button>
          )}
        </div>
      )}

      <Tabs
        defaultValue="overview"
        className={cn(isDrawer ? "flex min-h-0 flex-1 flex-col gap-0 overflow-hidden" : "gap-4")}
      >
        <TabsList className={tabListClass}>
          <TabsTrigger value="overview" className={tabTriggerClass()}>
            <ClipboardList className="w-3.5 h-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="tasks" className={tabTriggerClass()}>
            <Hammer className="w-3.5 h-3.5" />
            Tasks
          </TabsTrigger>
          <TabsTrigger value="parts" className={tabTriggerClass()}>
            <Package className="w-3.5 h-3.5" />
            Parts / Materials
          </TabsTrigger>
          <TabsTrigger value="labor" className={tabTriggerClass()}>
            <Clock className="w-3.5 h-3.5" />
            Labor
          </TabsTrigger>
          <TabsTrigger value="photos" className={tabTriggerClass()}>
            <ImageIcon className="w-3.5 h-3.5" />
            Photos
          </TabsTrigger>
          <TabsTrigger value="notes" className={tabTriggerClass()}>
            <StickyNote className="w-3.5 h-3.5" />
            Notes
          </TabsTrigger>
          <TabsTrigger value="activity" className={tabTriggerClass()}>
            <History className="w-3.5 h-3.5" />
            Activity
          </TabsTrigger>
        </TabsList>

        <div className={tabScrollWrapClass}>

        <TabsContent value="overview" className="space-y-4 mt-0">
          {isDrawer && workOrder.description?.trim() && (
            <p className="text-sm text-muted-foreground leading-snug">{workOrder.description}</p>
          )}

          {isDrawer && workOrder.maintenancePlanId && (
            <div className="rounded-xl border border-border bg-muted/20 px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <MaintenancePlansBrandTile size="xs" />
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Maintenance plan source
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/maintenance-plans?open=${workOrder.maintenancePlanId}`}
                  className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1"
                >
                  {workOrder.maintenancePlanName?.trim() || "View plan"}
                  <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                </Link>
                <span className="text-xs text-muted-foreground">· Created from this recurring plan</span>
              </div>
            </div>
          )}

          {workOrder.priority === "Critical" && (
            <div className="flex items-center gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm font-medium text-destructive">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Critical priority — dispatch and document promptly.
            </div>
          )}

          {isDrawer && !fieldsEditable && (
            <div className="rounded-xl border border-border bg-muted/20 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Quick actions</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" className="h-8 gap-1.5 text-xs shadow-sm" onClick={onEditWorkOrder}>
                  <Pencil className="w-3.5 h-3.5" />
                  Edit work order
                </Button>
                <Button size="sm" variant="secondary" className="h-8 gap-1.5 text-xs shadow-sm" onClick={onAssignTechnician}>
                  <UserPlus className="w-3.5 h-3.5" />
                  Assign technician
                </Button>
                {canMarkComplete && (
                  <Button size="sm" variant="secondary" className="h-8 gap-1.5 text-xs shadow-sm" onClick={() => void onMarkComplete()}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Mark complete
                  </Button>
                )}
                <Button size="sm" variant="secondary" className="h-8 gap-1.5 text-xs shadow-sm" asChild>
                  <Link href={quoteHref}>
                    <FileText className="w-3.5 h-3.5" />
                    Create quote
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8 gap-1.5 text-xs shadow-sm opacity-80"
                  type="button"
                  onClick={onInvoicePlaceholder}
                  title="Invoice creation from work orders is not wired yet"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  Create invoice
                </Button>
                {onPrint && (
                  <Button size="sm" variant="secondary" className="h-8 gap-1.5 text-xs shadow-sm" type="button" onClick={onPrint}>
                    <Printer className="w-3.5 h-3.5" />
                    Print
                  </Button>
                )}
                {onArchive && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-8 gap-1.5 text-xs shadow-sm border-destructive/40 text-destructive hover:bg-destructive/10"
                    type="button"
                    onClick={onArchive}
                  >
                    <AlertOctagon className="w-3.5 h-3.5" />
                    Archive
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className={cn("grid", isDrawer ? "grid-cols-2 lg:grid-cols-4 gap-2" : "grid-cols-2 lg:grid-cols-4 gap-3")}>
            {[
              { icon: MapPin, label: "Site / location", value: workOrder.location || "—", sub: "" },
              { icon: User, label: "Technician", value: workOrder.technicianName, sub: "" },
              {
                icon: Calendar,
                label: "Scheduled",
                value: formatDate(workOrder.scheduledDate),
                sub: workOrder.scheduledTime ? `at ${workOrder.scheduledTime}` : "",
              },
              { icon: Clock, label: "Created", value: formatDate(workOrder.createdAt.slice(0, 10)), sub: "" },
            ].map(({ icon: Icon, label, value, sub }) =>
              isDrawer ? (
                <div key={label} className={kpiCellClass}>
                  <p className={kpiLabelClass}>{label}</p>
                  <p className={kpiValueClass}>{value}</p>
                  {sub ? <p className="text-[10px] text-muted-foreground leading-snug">{sub}</p> : null}
                </div>
              ) : (
                <div key={label} className={kpiCellClass}>
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className={kpiLabelClass}>{label}</p>
                      <p className={kpiValueClass}>{value}</p>
                      {sub && <p className="text-xs text-muted-foreground truncate">{sub}</p>}
                    </div>
                  </div>
                </div>
              ),
            )}
          </div>

          {workOrder.location && (
            <AppointmentActions
              address={workOrder.location}
              emailParams={{
                customerName: workOrder.customerName,
                equipmentName: workOrder.equipmentName,
                technicianName: workOrder.technicianName,
                scheduledDate: workOrder.scheduledDate,
                scheduledTime: workOrder.scheduledTime,
                address: workOrder.location,
                workOrderId: workOrder.id,
                workOrderNumber: workOrder.workOrderNumber ?? null,
                workOrderTitle: workOrder.description,
                ccEmails: ["service@equipify.ai"],
              }}
            />
          )}

          <div className={cn("grid grid-cols-1 sm:grid-cols-3", isDrawer ? "gap-2" : "gap-3")}>
            <div
              className={
                isDrawer
                  ? "bg-card rounded-xl border border-border p-3 flex flex-col gap-1 shadow-[0_1px_3px_rgba(0,0,0,0.06)] min-h-[88px]"
                  : "p-3 rounded-lg bg-card border border-border"
              }
            >
              <p className={cn(isDrawer ? "text-[10px] font-semibold uppercase tracking-wide text-muted-foreground" : "text-xs text-muted-foreground mb-1")}>
                Labor (est.)
              </p>
              <p className={cn(isDrawer ? "text-xl font-bold tracking-tight tabular-nums" : "text-lg font-bold tabular-nums")}>
                ${laborCost.toFixed(2)}
              </p>
              <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">
                {laborHours} hrs × ${laborRatePerHour}/hr
              </p>
            </div>
            <div
              className={
                isDrawer
                  ? "bg-card rounded-xl border border-border p-3 flex flex-col gap-1 shadow-[0_1px_3px_rgba(0,0,0,0.06)] min-h-[88px]"
                  : "p-3 rounded-lg bg-card border border-border"
              }
            >
              <p className={cn(isDrawer ? "text-[10px] font-semibold uppercase tracking-wide text-muted-foreground" : "text-xs text-muted-foreground mb-1")}>
                Parts (line items)
              </p>
              <p className={cn(isDrawer ? "text-xl font-bold tracking-tight tabular-nums" : "text-lg font-bold tabular-nums")}>
                ${partsCost.toFixed(2)}
              </p>
            </div>
            <div
              className={
                isDrawer
                  ? "bg-card rounded-xl border border-border p-3 flex flex-col gap-1 shadow-[0_1px_3px_rgba(0,0,0,0.06)] min-h-[88px]"
                  : "p-3 rounded-lg bg-card border border-border"
              }
            >
              <p className={cn(isDrawer ? "text-[10px] font-semibold uppercase tracking-wide text-muted-foreground" : "text-xs text-muted-foreground mb-1")}>
                Stored totals
              </p>
              <p className={cn(isDrawer ? "text-xl font-bold tracking-tight tabular-nums" : "text-lg font-bold tabular-nums")}>
                ${(workOrder.totalLaborCost + workOrder.totalPartsCost).toFixed(2)}
              </p>
              <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">Labor + parts on work order</p>
            </div>
          </div>

          <Section title="Problem reported" icon={AlertTriangle}>
            {canEditProblem ? (
              <Textarea
                value={problemReported}
                onChange={(e) => onProblemReportedChange(e.target.value)}
                rows={3}
                placeholder="Describe the problem reported by the customer…"
              />
            ) : (
              <p className="text-sm text-foreground leading-relaxed">
                {problemReported || <span className="text-muted-foreground">Not recorded.</span>}
              </p>
            )}
          </Section>

          <Section title="Customer signature" icon={PenLine}>
            <SignatureCanvas
              existing={sigData}
              onSave={onSignatureSave}
              signedBy={signedBy}
              signedAt={signedAt}
              readOnly={!signatureEditable}
            />
          </Section>
        </TabsContent>

        <TabsContent value="tasks" className="space-y-4 mt-0">
          {planServices && planServices.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Plan services (source)</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Lines from the maintenance plan that generated this visit.
                </p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {planServices.map((s, i) => (
                    <li
                      key={i}
                      className="flex gap-2 text-sm border border-border rounded-lg px-3 py-2.5 bg-muted/20"
                    >
                      <span className="text-muted-foreground font-mono text-xs shrink-0 w-6">{i + 1}.</span>
                      <span className="text-foreground leading-snug">{planServiceLabel(s, i)}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-sm">Work order tasks</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Checklist stored on the work order</p>
              </div>
              {tasksEditable && (
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={addTask}>
                  <Plus className="w-3 h-3 mr-1" />
                  Add task
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              {tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No tasks yet. Add tasks when editing this work order.</p>
              ) : (
                tasks.map((t) => (
                  <label
                    key={t.id}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border border-border px-3 py-2.5 cursor-pointer hover:bg-muted/30",
                      !tasksEditable && "cursor-default",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-1 rounded border-input"
                      checked={t.done}
                      disabled={!tasksEditable}
                      onChange={() => tasksEditable && toggleTask(t.id)}
                    />
                    <span className={cn("text-sm", t.done && "line-through text-muted-foreground")}>{t.label}</span>
                  </label>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="parts" className="mt-0">
          <Section title="Parts / materials" icon={Package}>
            <PartsTable parts={parts} editable={partsPhotosEditable} onChange={onPartsChange} />
          </Section>
        </TabsContent>

        <TabsContent value="labor" className="mt-0 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Labor hours</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {partsPhotosEditable ? (
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={laborHours}
                  onChange={(e) => onLaborHoursChange(Number(e.target.value))}
                  className="max-w-[10rem] h-10 text-lg font-semibold"
                />
              ) : (
                <p className="text-2xl font-bold tabular-nums">{laborHours} hrs</p>
              )}
              <p className="text-xs text-muted-foreground">
                Estimated labor value at ${laborRatePerHour}/hr:{" "}
                <span className="font-semibold text-foreground">${laborCost.toFixed(2)}</span>
              </p>
              <p className="text-xs text-muted-foreground border-t border-border pt-3">
                Stored labor total on work order:{" "}
                <span className="font-medium text-foreground tabular-nums">
                  ${workOrder.totalLaborCost.toFixed(2)}
                </span>
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="photos" className="mt-0">
          <Section title="Photos / attachments" icon={Camera}>
            <PhotoSection photos={photos} editable={partsPhotosEditable} onChange={onPhotosChange} />
          </Section>
        </TabsContent>

        <TabsContent value="notes" className="space-y-4 mt-0">
          <Section title="Diagnosis" icon={FileText}>
            {fieldsEditable ? (
              <Textarea
                value={diagnosis}
                onChange={(e) => onDiagnosisChange(e.target.value)}
                rows={4}
                placeholder="Technician diagnosis and root cause…"
              />
            ) : (
              <p className="text-sm text-foreground leading-relaxed">
                {diagnosis || <span className="text-muted-foreground">Not recorded.</span>}
              </p>
            )}
          </Section>
          <Section title="Technician notes" icon={PenLine}>
            {fieldsEditable ? (
              <Textarea
                value={technicianNotes}
                onChange={(e) => onTechnicianNotesChange(e.target.value)}
                rows={4}
                placeholder="Internal notes, follow-up recommendations…"
              />
            ) : (
              <p className="text-sm text-foreground leading-relaxed">
                {technicianNotes || <span className="text-muted-foreground">No notes.</span>}
              </p>
            )}
          </Section>
          <Section title="Internal notes (work order)" icon={StickyNote}>
            {internalNotesEditable && onInternalNotesChange ? (
              <Textarea
                value={internalNotes}
                onChange={(e) => onInternalNotesChange(e.target.value)}
                rows={4}
                placeholder="Office / dispatcher notes…"
              />
            ) : (
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {internalNotes || <span className="text-muted-foreground">None.</span>}
              </p>
            )}
          </Section>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4 mt-0">
          <Section title="Timeline" icon={History}>
            <DrawerTimeline items={activityItems} />
          </Section>
        </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
