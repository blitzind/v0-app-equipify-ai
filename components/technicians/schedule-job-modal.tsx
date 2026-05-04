"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import type { Technician } from "@/lib/mock-data"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { normalizeTimeForDb, uiPriorityToDb } from "@/lib/work-orders/db-map"
import { buildSchedulePatch } from "@/lib/work-orders/schedule-patch"
import { getWorkOrderDisplay } from "@/lib/work-orders/display"
import { missingWorkOrderNumberColumn } from "@/lib/work-orders/postgrest-fallback"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { AmPmTimePicker } from "@/components/scheduling/am-pm-time-picker"
import {
  Check,
  ChevronsUpDown,
  Clock,
  Loader2,
  Plus,
  X,
} from "lucide-react"

type CustomerOption = { id: string; company_name: string }

type JobTypeRow = {
  id: string
  name: string
  work_order_type: string
  sort_order: number
}

/** Local fallback when `organization_job_types` is missing or unreachable (stable synthetic ids). */
const FALLBACK_JOB_TYPES: JobTypeRow[] = [
  { id: "fallback-pm", name: "Preventive Maintenance", work_order_type: "pm", sort_order: 10 },
  { id: "fallback-er", name: "Emergency Repair", work_order_type: "emergency", sort_order: 20 },
  { id: "fallback-cal", name: "Calibration", work_order_type: "inspection", sort_order: 30 },
  { id: "fallback-insp", name: "Inspection", work_order_type: "inspection", sort_order: 40 },
  { id: "fallback-inst", name: "Installation", work_order_type: "install", sort_order: 50 },
  { id: "fallback-war", name: "Warranty Service", work_order_type: "repair", sort_order: 60 },
  { id: "fallback-qv", name: "Quote Visit", work_order_type: "repair", sort_order: 70 },
]

function isJobTypesTableUnavailable(err: { message?: string; code?: string }): boolean {
  const msg = (err.message ?? "").toLowerCase()
  if (msg.includes("organization_job_types") && msg.includes("schema cache")) return true
  if (msg.includes("could not find") && msg.includes("organization_job_types")) return true
  if (msg.includes("does not exist") && msg.includes("organization_job_types")) return true
  if (msg.includes("relation") && msg.includes("organization_job_types") && msg.includes("does not exist"))
    return true
  if (err.code === "PGRST205") return true
  return false
}

/** Popovers must stack above the Schedule Job modal shell (`z-[110]`). */
const SCHEDULE_POPOVER_Z = "z-[120]"

const WO_DB_TYPES = ["repair", "pm", "inspection", "install", "emergency"] as const

const WO_TYPE_LABEL: Record<(typeof WO_DB_TYPES)[number], string> = {
  repair: "Repair",
  pm: "Preventive Maintenance",
  inspection: "Inspection",
  install: "Installation",
  emergency: "Emergency",
}

function localDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

type ExistingWoRow = {
  id: string
  work_order_number?: number | null
  customer_id: string
  equipment_id: string
  title: string
  status: string
  type: string
  scheduled_on: string | null
  scheduled_time: string | null
  notes: string | null
}

function timeHhMmFromDb(t: string | null | undefined): string {
  if (!t || !t.trim()) return "09:00"
  const s = t.trim()
  return s.length >= 5 && s.includes(":") ? s.slice(0, 5) : "09:00"
}

interface ScheduleJobModalProps {
  tech: Technician
  onClose: () => void
  onSave: (msg: string) => void
  /** Prefill schedule date (YYYY-MM-DD). */
  initialDate?: string
  /** Prefill time (HH:mm). */
  initialTimeHhMm?: string
  /** When set, update this work order (assign + schedule) instead of creating a new one. */
  existingWorkOrderId?: string | null
}

export function ScheduleJobModal({
  tech,
  onClose,
  onSave,
  initialDate,
  initialTimeHhMm,
  existingWorkOrderId,
}: ScheduleJobModalProps) {
  const router = useRouter()
  const { organizationId: activeOrgId, status: orgStatus } = useActiveOrganization()

  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [jobTypes, setJobTypes] = useState<JobTypeRow[]>([])
  const [jobTypesFromFallback, setJobTypesFromFallback] = useState(false)

  const [customerId, setCustomerId] = useState("")
  const [jobTypeId, setJobTypeId] = useState("")
  const [date, setDate] = useState(() => initialDate ?? localDateString(new Date()))
  const [timeHhMm, setTimeHhMm] = useState(() => initialTimeHhMm ?? "09:00")
  const [notes, setNotes] = useState("")

  const [custOpen, setCustOpen] = useState(false)
  const [jtOpen, setJtOpen] = useState(false)

  const [addJobTypeOpen, setAddJobTypeOpen] = useState(false)
  const [newJobTypeName, setNewJobTypeName] = useState("")
  const [newJobTypeWo, setNewJobTypeWo] = useState<(typeof WO_DB_TYPES)[number]>("repair")
  const [addJobTypeBusy, setAddJobTypeBusy] = useState(false)
  const [addJobTypeErr, setAddJobTypeErr] = useState<string | null>(null)

  const [existingWo, setExistingWo] = useState<ExistingWoRow | null>(null)
  const [existingLoadError, setExistingLoadError] = useState<string | null>(null)
  const [existingLoading, setExistingLoading] = useState(false)

  const isAssignExisting = Boolean(existingWorkOrderId?.trim())

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose])

  useEffect(() => {
    if (!isAssignExisting || !existingWorkOrderId || !activeOrgId || orgStatus !== "ready") {
      setExistingWo(null)
      setExistingLoadError(null)
      setExistingLoading(false)
      return
    }

    let cancelled = false
    const supabase = createBrowserSupabaseClient()
    const selNoNum =
      "id, customer_id, equipment_id, title, status, type, scheduled_on, scheduled_time, notes"
    const selWithNum =
      "id, work_order_number, customer_id, equipment_id, title, status, type, scheduled_on, scheduled_time, notes"

    void (async () => {
      setExistingLoading(true)
      setExistingLoadError(null)
      let res = await supabase
        .from("work_orders")
        .select(selWithNum)
        .eq("id", existingWorkOrderId)
        .eq("organization_id", activeOrgId)
        .maybeSingle()
      if (res.error && missingWorkOrderNumberColumn(res.error)) {
        res = await supabase
          .from("work_orders")
          .select(selNoNum)
          .eq("id", existingWorkOrderId)
          .eq("organization_id", activeOrgId)
          .maybeSingle()
      }
      if (cancelled) return
      if (res.error) {
        setExistingLoadError(res.error.message)
        setExistingWo(null)
        setExistingLoading(false)
        return
      }
      const row = res.data as ExistingWoRow | null
      if (!row) {
        setExistingLoadError("Work order not found.")
        setExistingWo(null)
        setExistingLoading(false)
        return
      }
      setExistingWo(row)
      setCustomerId(row.customer_id)
      setDate((initialDate && initialDate.trim()) || row.scheduled_on?.slice(0, 10) || localDateString(new Date()))
      setTimeHhMm(
        (initialTimeHhMm && initialTimeHhMm.trim()) || timeHhMmFromDb(row.scheduled_time),
      )
      setNotes(row.notes?.trim() ?? "")
      setExistingLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [isAssignExisting, existingWorkOrderId, activeOrgId, orgStatus, initialDate, initialTimeHhMm])

  useEffect(() => {
    if (!existingWo || jobTypes.length === 0) return
    const match = jobTypes.find((j) => j.work_order_type === existingWo.type)
    if (match) {
      setJobTypeId(match.id)
    } else {
      const fb = FALLBACK_JOB_TYPES.find((j) => j.work_order_type === existingWo.type)
      if (fb) setJobTypeId(fb.id)
    }
  }, [existingWo, jobTypes])

  useEffect(() => {
    let cancelled = false
    const supabase = createBrowserSupabaseClient()

    void (async () => {
      setLoadError(null)

      if (orgStatus !== "ready" || !activeOrgId) {
        if (!cancelled) {
          setCustomers([])
          setJobTypes([])
          setJobTypesFromFallback(false)
          setLoadError(
            orgStatus === "ready" && !activeOrgId ? "No organization selected." : "Loading organization…",
          )
        }
        return
      }

      const orgId = activeOrgId

      const [{ data: custRows, error: custErr }, { data: jtRows, error: jtErr }] = await Promise.all([
        supabase
          .from("customers")
          .select("id, company_name")
          .eq("organization_id", orgId)
          .eq("status", "active")
          .eq("is_archived", false)
          .order("company_name"),
        supabase
          .from("organization_job_types")
          .select("id, name, work_order_type, sort_order")
          .eq("organization_id", orgId)
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true }),
      ])

      if (cancelled) return

      if (custErr) {
        setLoadError(custErr.message)
        setCustomers([])
      } else {
        setCustomers((custRows as CustomerOption[]) ?? [])
      }

      if (jtErr && isJobTypesTableUnavailable(jtErr)) {
        setJobTypes(FALLBACK_JOB_TYPES)
        setJobTypesFromFallback(true)
        setJobTypeId((prev) => {
          if (prev && FALLBACK_JOB_TYPES.some((r) => r.id === prev)) return prev
          return FALLBACK_JOB_TYPES[0]?.id ?? ""
        })
      } else if (jtErr) {
        setLoadError((prev) => prev ?? jtErr.message)
        setJobTypes([])
        setJobTypesFromFallback(false)
        setJobTypeId("")
      } else {
        setJobTypesFromFallback(false)
        const rows = (jtRows as JobTypeRow[]) ?? []
        setJobTypes(rows)
        setJobTypeId((prev) => {
          if (prev && rows.some((r) => r.id === prev)) return prev
          return rows[0]?.id ?? ""
        })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [activeOrgId, orgStatus])

  const selectedCustomerLabel = customers.find((c) => c.id === customerId)?.company_name ?? ""
  const selectedJobType = useMemo(() => {
    const j = jobTypes.find((x) => x.id === jobTypeId)
    if (j) return j
    return FALLBACK_JOB_TYPES.find((x) => x.id === jobTypeId) ?? null
  }, [jobTypes, jobTypeId])

  const formValid = useMemo(() => {
    if (isAssignExisting && (existingLoading || !existingWo || existingLoadError)) return false
    if (!customerId.trim() || !jobTypeId.trim() || !date.trim()) return false
    if (!normalizeTimeForDb(timeHhMm)) return false
    const typesSource = jobTypes.length > 0 ? jobTypes : jobTypesFromFallback ? FALLBACK_JOB_TYPES : []
    if (!typesSource.some((j) => j.id === jobTypeId)) return false
    return true
  }, [
    customerId,
    jobTypeId,
    date,
    timeHhMm,
    jobTypes,
    jobTypesFromFallback,
    isAssignExisting,
    existingLoading,
    existingWo,
    existingLoadError,
  ])

  async function submitNewJobType() {
    const name = newJobTypeName.trim()
    if (!name || !activeOrgId) return
    setAddJobTypeBusy(true)
    setAddJobTypeErr(null)
    const supabase = createBrowserSupabaseClient()
    const nextSort =
      jobTypes.length === 0 ? 100 : Math.max(...jobTypes.map((j) => j.sort_order), 0) + 10

    const { data, error } = await supabase
      .from("organization_job_types")
      .insert({
        organization_id: activeOrgId,
        name,
        work_order_type: newJobTypeWo,
        is_seed: false,
        sort_order: nextSort,
      })
      .select("id, name, work_order_type, sort_order")
      .single()

    setAddJobTypeBusy(false)

    if (error) {
      setAddJobTypeErr(error.message)
      return
    }

    const row = data as JobTypeRow
    setJobTypesFromFallback(false)
    setJobTypes((prev) => [...prev, row].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)))
    setJobTypeId(row.id)
    setNewJobTypeName("")
    setNewJobTypeWo("repair")
    setAddJobTypeOpen(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)

    if (!customerId || !jobTypeId || !selectedJobType) {
      setSubmitError("Select a customer and job type.")
      return
    }
    if (!activeOrgId || orgStatus !== "ready") {
      setSubmitError("Organization not ready.")
      return
    }

    const timeDb = normalizeTimeForDb(timeHhMm)
    if (!timeDb) {
      setSubmitError("Choose a valid time.")
      return
    }

    setLoading(true)

    const supabase = createBrowserSupabaseClient()

    if (existingWo) {
      const patch = {
        ...buildSchedulePatch({
          scheduledOn: date,
          scheduledTimeHhMm: timeHhMm,
          assignedUserId: tech.id,
          previousStatus: existingWo.status,
        }),
        notes: notes.trim() || null,
      }
      const { error: upErr } = await supabase
        .from("work_orders")
        .update(patch)
        .eq("id", existingWo.id)
        .eq("organization_id", activeOrgId)

      setLoading(false)

      if (upErr) {
        setSubmitError(upErr.message)
        return
      }

      onSave(`Assigned to ${tech.name}`)
      return
    }

    const { data: eqRow, error: eqErr } = await supabase
      .from("equipment")
      .select("id")
      .eq("organization_id", activeOrgId)
      .eq("customer_id", customerId)
      .eq("status", "active")
      .eq("is_archived", false)
      .order("name")
      .limit(1)
      .maybeSingle()

    if (eqErr || !eqRow) {
      setLoading(false)
      setSubmitError(
        eqErr?.message ??
          "No active equipment found for this customer. Add equipment before scheduling.",
      )
      return
    }

    const title =
      `${selectedJobType.name} — ${selectedCustomerLabel || "Customer"}`.slice(0, 500)

    const notesCombined = notes.trim() || null
    const problemReported = notes.trim() || title

    const { error: insertErr } = await supabase.from("work_orders").insert({
      organization_id: activeOrgId,
      customer_id: customerId,
      equipment_id: eqRow.id,
      title,
      status: "scheduled",
      priority: uiPriorityToDb("Normal"),
      type: selectedJobType.work_order_type,
      scheduled_on: date,
      scheduled_time: timeDb,
      notes: notesCombined,
      problem_reported: problemReported,
      assigned_user_id: tech.id,
      repair_log: {
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
    })

    setLoading(false)

    if (insertErr) {
      setSubmitError(insertErr.message)
      return
    }

    onSave(`Job assigned to ${tech.name}`)
  }

  function goAddCustomer() {
    setCustOpen(false)
    router.push("/customers?action=new-customer")
  }

  return (
    <>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
        <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-background shadow-2xl">
          <div className="flex items-center justify-between border-b border-border p-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {isAssignExisting ? "Assign work order" : "Schedule Job"}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {isAssignExisting && existingWo ? (
                  <>
                    <span className="font-mono text-primary">
                      {getWorkOrderDisplay({
                        id: existingWo.id,
                        workOrderNumber: existingWo.work_order_number ?? null,
                      })}
                    </span>
                    {" · "}
                    <span className="line-clamp-2">{existingWo.title}</span>
                    {" · "}
                  </>
                ) : null}
                Assigning to <strong>{tech.name}</strong>
              </p>
            </div>
            <Button variant="ghost" size="icon-sm" type="button" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <form onSubmit={(ev) => void handleSubmit(ev)} className="space-y-4 p-6">
            {existingLoadError ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {existingLoadError}
              </p>
            ) : null}
            {isAssignExisting && existingLoading ? (
              <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading work order…
              </p>
            ) : null}
            {loadError ? (
              <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                {loadError}
              </p>
            ) : null}
            {jobTypesFromFallback ? (
              <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
                Job types database unavailable—using built-in defaults to schedule. Apply migrations so custom types sync.
              </p>
            ) : null}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="sched-date">
                  Date <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="sched-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  Time <span className="text-destructive">*</span>
                </Label>
                <AmPmTimePicker
                  id="sched-time"
                  valueHhMm={timeHhMm}
                  onChangeHhMm={setTimeHhMm}
                  disabled={loading}
                  popoverContentClassName={SCHEDULE_POPOVER_Z}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>
                Customer <span className="text-destructive">*</span>
              </Label>
              {isAssignExisting && existingWo ? (
                <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground">
                  {selectedCustomerLabel || existingWo.customer_id}
                </div>
              ) : null}
              {!isAssignExisting || !existingWo ? (
              <Popover open={custOpen} onOpenChange={setCustOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={custOpen}
                    className="h-9 w-full justify-between font-normal"
                    disabled={loading}
                  >
                    <span className="truncate">
                      {customerId ? selectedCustomerLabel : "Search or select customer…"}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className={cn("w-[var(--radix-popover-trigger-width)] p-0", SCHEDULE_POPOVER_Z)}
                  align="start"
                >
                  <Command>
                    <CommandInput placeholder="Search customers…" />
                    <CommandList>
                      <CommandEmpty>No customer found.</CommandEmpty>
                      <CommandGroup>
                        {customers.map((c) => (
                          <CommandItem
                            key={c.id}
                            value={`${c.company_name} ${c.id}`}
                            onSelect={() => {
                              setCustomerId(c.id)
                              setCustOpen(false)
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                customerId === c.id ? "opacity-100" : "opacity-0",
                              )}
                            />
                            <span className="truncate">{c.company_name}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                      <CommandSeparator />
                      <CommandGroup>
                        <CommandItem
                          value="__add_customer"
                          onSelect={() => goAddCustomer()}
                          className="text-primary"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add New Customer
                        </CommandItem>
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label>
                Job type <span className="text-destructive">*</span>
              </Label>
              {isAssignExisting && existingWo && selectedJobType ? (
                <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground flex items-center gap-2 flex-wrap">
                  <span>{selectedJobType.name}</span>
                  <Badge variant="secondary" className="font-normal text-[10px]">
                    {WO_TYPE_LABEL[selectedJobType.work_order_type as (typeof WO_DB_TYPES)[number]] ??
                      selectedJobType.work_order_type}
                  </Badge>
                </div>
              ) : null}
              {(!isAssignExisting || !existingWo) ? (
              <Popover open={jtOpen} onOpenChange={setJtOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={jtOpen}
                    className="h-9 w-full justify-between font-normal"
                    disabled={loading || jobTypes.length === 0}
                  >
                    <span className="truncate">
                      {selectedJobType ? (
                        <span className="flex items-center gap-2">
                          {selectedJobType.name}
                          <Badge variant="secondary" className="font-normal text-[10px]">
                            {WO_TYPE_LABEL[selectedJobType.work_order_type as (typeof WO_DB_TYPES)[number]] ??
                              selectedJobType.work_order_type}
                          </Badge>
                        </span>
                      ) : (
                        "Search or select job type…"
                      )}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className={cn("w-[var(--radix-popover-trigger-width)] p-0", SCHEDULE_POPOVER_Z)}
                  align="start"
                >
                  <Command>
                    <CommandInput placeholder="Search job types…" />
                    <CommandList>
                      <CommandEmpty>No job type found.</CommandEmpty>
                      <CommandGroup>
                        {jobTypes.map((j) => (
                          <CommandItem
                            key={j.id}
                            value={`${j.name} ${j.id}`}
                            onSelect={() => {
                              setJobTypeId(j.id)
                              setJtOpen(false)
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                jobTypeId === j.id ? "opacity-100" : "opacity-0",
                              )}
                            />
                            <span className="flex flex-1 items-center justify-between gap-2">
                              <span className="truncate">{j.name}</span>
                              <span className="shrink-0 text-[10px] text-muted-foreground">
                                {WO_TYPE_LABEL[j.work_order_type as (typeof WO_DB_TYPES)[number]] ?? j.work_order_type}
                              </span>
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                      <CommandSeparator />
                      <CommandGroup>
                        <CommandItem
                          value="__add_job_type"
                          onSelect={() => {
                            setJtOpen(false)
                            setAddJobTypeOpen(true)
                          }}
                          className="text-primary"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add New Job Type
                        </CommandItem>
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sched-notes">Notes</Label>
              <Textarea
                id="sched-notes"
                placeholder="Any special instructions…"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {submitError ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {submitError}
              </p>
            ) : null}

            <div className="flex gap-2 border-t border-border pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={loading || !formValid}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Assigning…
                  </>
                ) : (
                  "Assign Job"
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>

      <Dialog open={addJobTypeOpen} onOpenChange={setAddJobTypeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add job type</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="new-jt-name">Name</Label>
              <Input
                id="new-jt-name"
                value={newJobTypeName}
                onChange={(e) => setNewJobTypeName(e.target.value)}
                placeholder="e.g. Annual certification"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Maps to work order category</Label>
              <Select value={newJobTypeWo} onValueChange={(v) => setNewJobTypeWo(v as (typeof WO_DB_TYPES)[number])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WO_DB_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {WO_TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Stored for your organization. Work orders use this category in the database.
              </p>
            </div>
            {addJobTypeErr ? (
              <p className="text-sm text-destructive">{addJobTypeErr}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddJobTypeOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={addJobTypeBusy || !newJobTypeName.trim()} onClick={() => void submitNewJobType()}>
              {addJobTypeBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
