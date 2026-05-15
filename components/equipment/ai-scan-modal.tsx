"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { DRAWER_PANEL_SURFACE } from "@/components/detail-drawer"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import {
  X,
  Sparkles,
  RefreshCw,
  Check,
  ChevronRight,
  AlertCircle,
  FileText,
  ImageIcon,
} from "lucide-react"
import { enforceCanCreateRecord } from "@/app/actions/org-create-enforcement"
import { extractEquipmentFromScanUploadAction } from "@/app/actions/equipment-ai-scan"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { toastRecordEligibilityBlocked } from "@/lib/billing/guard-toast"
import type { RecordEligibility } from "@/lib/billing/record-eligibility"
import { toast } from "@/hooks/use-toast"
import {
  EQUIPMENT_SCAN_MAX_BYTES_IMAGE,
  EQUIPMENT_SCAN_MAX_BYTES_PDF,
} from "@/lib/equipment/equipment-scan-upload-validate"
import {
  equipmentScanClientHints,
  equipmentScanDiag,
} from "@/lib/equipment/equipment-scan-diagnostics"
import {
  messageForPrepareError,
  prepareFileForEquipmentScanUpload,
} from "@/lib/equipment/equipment-scan-client-prepare"
import { mapEquipmentScanTransportError } from "@/lib/equipment/equipment-scan-client-errors"
import {
  EQUIPMENT_SCAN_DEBUG_MIN_JPEG_BASE64,
  parseEquipmentScanActionResult,
  sanitizeScanClientError,
} from "@/lib/equipment/equipment-scan-client-parse"
import { formatCustomerLocationSelectLabel } from "@/lib/customer-locations/format"
import { useEquipmentFormIndustryUi } from "@/hooks/use-equipment-form-industry-ui"
import { useEquipmentTypes, equipmentCategorySelectOptions } from "@/lib/equipment-type-store"

const STATUSES = ["Active", "Needs Service", "In Repair", "Out of Service"] as const
type EquipmentStatus = (typeof STATUSES)[number]

type ScanStep = "upload" | "scanning" | "review" | "saving" | "done"

type CustomerOption = { id: string; company_name: string }

const ACCEPT_ATTR =
  "image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,application/pdf,.pdf,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif"

const ACCEPT_CAMERA_ATTR = "image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"

const EXTRACTION_TIMEOUT_MS = 120_000

const SCAN_DEBUG_PUBLIC =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_DEBUG_EQUIPMENT_SCAN === "true"

const SCAN_LABELS = [
  "Checking file…",
  "Preparing upload…",
  "Running AI extraction…",
  "Validating fields…",
]

const INITIAL_FORM = {
  name: "",
  equipmentType: "",
  subcategory: "",
  manufacturer: "",
  model: "",
  serialNumber: "",
  customerId: "",
  serviceSiteId: "",
  location: "",
  installDate: "",
  warrantyExpiration: "",
  lastServiceDate: "",
  nextServiceDue: "",
  nextCalibrationDue: "",
  calibrationIntervalMonths: "",
  serviceInterval: "",
  status: "Active" as EquipmentStatus,
  notes: "",
}

type FormState = typeof INITIAL_FORM

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-medium text-foreground mb-1">
      {children}
      {required && <span className="text-destructive ml-0.5">*</span>}
    </label>
  )
}

function validateClientFile(file: File): string | null {
  const lower = file.name.toLowerCase()
  const isPdf = file.type === "application/pdf" || lower.endsWith(".pdf")
  const max = isPdf ? EQUIPMENT_SCAN_MAX_BYTES_PDF : EQUIPMENT_SCAN_MAX_BYTES_IMAGE
  if (file.size > max) {
    return isPdf
      ? "This PDF is too large. Maximum size is 12 MB."
      : "This image is too large. Maximum size is 12 MB."
  }
  if (file.size === 0) {
    return "This file appears to be empty."
  }
  return null
}

type AIScanModalProps = {
  open: boolean
  onClose: () => void
  organizationId: string | null
  orgReady: boolean
  equipmentCreateEligibility: RecordEligibility
  onSaved?: () => void
}

export function AIScanModal({
  open,
  onClose,
  organizationId,
  orgReady,
  equipmentCreateEligibility,
  onSaved,
}: AIScanModalProps) {
  const { ui } = useEquipmentFormIndustryUi(organizationId, orgReady, open)
  const { types: orgEquipmentTypes, loading: equipmentTypesLoading } = useEquipmentTypes()
  const [step, setStep] = useState<ScanStep>("upload")
  const [uploadKind, setUploadKind] = useState<"image" | "pdf" | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [pendingFileName, setPendingFileName] = useState<string>("")
  const [scanLabel, setScanLabel] = useState(SCAN_LABELS[0])
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [serviceSiteOptions, setServiceSiteOptions] = useState<Array<{ id: string; label: string }>>([])
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [documentCustomerHint, setDocumentCustomerHint] = useState("")
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [saving, setSaving] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const previewObjectUrlRef = useRef<string | null>(null)
  const scanTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([])

  const revokePreviewObjectUrl = useCallback(() => {
    const u = previewObjectUrlRef.current
    if (u && u.startsWith("blob:")) {
      URL.revokeObjectURL(u)
    }
    previewObjectUrlRef.current = null
  }, [])

  const runDebugScanProbe = useCallback(async () => {
    if (!organizationId || !orgReady) return
    const fd = new FormData()
    fd.set("organizationId", organizationId)
    const bin = Uint8Array.from(atob(EQUIPMENT_SCAN_DEBUG_MIN_JPEG_BASE64), (c) => c.charCodeAt(0))
    fd.set("file", new File([bin], "probe.jpg", { type: "image/jpeg" }))
    console.info("[equipment_scan_debug] probe_start", { org_id_length: organizationId.length })
    try {
      const raw = await extractEquipmentFromScanUploadAction(fd)
      const parsed = parseEquipmentScanActionResult(raw)
      console.info("[equipment_scan_debug] probe_raw_json", JSON.stringify(raw))
      console.info("[equipment_scan_debug] probe_parsed_json", JSON.stringify(parsed))
    } catch (e) {
      console.info("[equipment_scan_debug] probe_rejected", sanitizeScanClientError(e))
    }
  }, [organizationId, orgReady])

  const equipmentTypeOptions = useMemo(
    () => equipmentCategorySelectOptions(orgEquipmentTypes, form.equipmentType),
    [orgEquipmentTypes, form.equipmentType],
  )

  useEffect(() => {
    if (!open) return
    setForm((prev) => {
      const v = prev.equipmentType.trim()
      if (!v) return prev
      if (orgEquipmentTypes.some((t) => t.name === v)) return prev
      return { ...prev, equipmentType: "" }
    })
  }, [open, orgEquipmentTypes])

  const clearScanTimers = useCallback(() => {
    for (const t of scanTimersRef.current) clearTimeout(t)
    scanTimersRef.current = []
  }, [])

  function resetAll() {
    clearScanTimers()
    revokePreviewObjectUrl()
    setStep("upload")
    setUploadKind(null)
    setImagePreview(null)
    setPendingFileName("")
    setScanLabel(SCAN_LABELS[0])
    setForm(INITIAL_FORM)
    setDocumentCustomerHint("")
    setUploadError(null)
    setIsDragging(false)
    setSaving(false)
    setServiceSiteOptions([])
  }

  function handleClose() {
    resetAll()
    onClose()
  }

  useEffect(() => {
    if (!open || !organizationId || !orgReady) {
      if (!open) setCustomers([])
      return
    }
    const supabase = createBrowserSupabaseClient()
    void (async () => {
      const { data } = await supabase
        .from("customers")
        .select("id, company_name")
        .eq("organization_id", organizationId)
        .eq("status", "active")
        .is("archived_at", null)
        .order("company_name", { ascending: true })
      setCustomers((data as CustomerOption[] | null) ?? [])
    })()
  }, [open, organizationId, orgReady])

  useEffect(() => {
    if (!open || !organizationId || !orgReady || !form.customerId) {
      setServiceSiteOptions([])
      return
    }
    const supabase = createBrowserSupabaseClient()
    void (async () => {
      const { data, error } = await supabase
        .from("customer_locations")
        .select("id, name, address_line1, address_line2, city, state, postal_code, is_default")
        .eq("organization_id", organizationId)
        .eq("customer_id", form.customerId)
        .is("archived_at", null)
        .order("is_default", { ascending: false })
        .order("name", { ascending: true })
      if (error) {
        setServiceSiteOptions([])
        return
      }
      const rows =
        (data ?? []) as Array<{
          id: string
          name: string
          address_line1: string
          address_line2: string | null
          city: string
          state: string
          postal_code: string
          is_default: boolean | null
        }>
      const opts = rows.map((r) => ({
        id: r.id,
        label: formatCustomerLocationSelectLabel({
          name: r.name,
          address_line1: r.address_line1,
          address_line2: r.address_line2,
          city: r.city,
          state: r.state,
          postal_code: r.postal_code,
        }),
      }))
      setServiceSiteOptions(opts)
      setForm((prev) => {
        if (opts.length === 0) return { ...prev, serviceSiteId: "" }
        const stillValid = opts.some((o) => o.id === prev.serviceSiteId)
        if (stillValid) return prev
        const def = rows.find((r) => r.is_default)?.id ?? opts[0]?.id ?? ""
        return { ...prev, serviceSiteId: def }
      })
    })()
  }, [open, organizationId, orgReady, form.customerId])

  useEffect(() => {
    if (!open) {
      revokePreviewObjectUrl()
      setImagePreview(null)
    }
  }, [open, revokePreviewObjectUrl])

  const runExtraction = useCallback(
    async (file: File) => {
      const hints = equipmentScanClientHints()
      const ext = (() => {
        const i = file.name.lastIndexOf(".")
        return i >= 0 ? file.name.slice(i + 1, i + 9).toLowerCase() : ""
      })()
      const sizeMb = Math.round((file.size / (1024 * 1024)) * 100) / 100

      equipmentScanDiag("upload_start", {
        os_family: hints.osFamily,
        browser_family: hints.browserFamily,
      })
      equipmentScanDiag("client_file_selected", {
        ext: ext || "none",
        os_family: hints.osFamily,
        browser_family: hints.browserFamily,
      })
      equipmentScanDiag("file_type", { reported_mime: file.type || "empty" })
      equipmentScanDiag("file_size_mb", { value: sizeMb })

      const reportedHeic =
        (file.type || "").toLowerCase().includes("heic") ||
        (file.type || "").toLowerCase().includes("heif") ||
        /\.hei[cf]$/i.test(file.name)
      if (hints.isIos && hints.isSafari && reportedHeic) {
        equipmentScanDiag("safari_heic_detected", { value: true })
      }

      if (!organizationId) {
        setUploadError("No workspace selected.")
        return
      }
      if (toastRecordEligibilityBlocked(equipmentCreateEligibility)) return

      setUploadError(null)

      let uploadFile: File
      equipmentScanDiag("client_compression_start", { bytes: file.size })
      try {
        const prepared = await prepareFileForEquipmentScanUpload(file)
        uploadFile = prepared.file
        equipmentScanDiag("client_compression_end", {
          skipped: prepared.meta.compressionSkipped,
          final_bytes: prepared.meta.finalBytes,
          kind: prepared.meta.kind,
        })
        if (prepared.meta.compressionSkipped) {
          equipmentScanDiag("compression_skipped", {
            kind: prepared.meta.kind,
            final_bytes: prepared.meta.finalBytes,
          })
        } else {
          equipmentScanDiag("compression_done", {
            kind: prepared.meta.kind,
            original_bytes: prepared.meta.originalBytes,
            final_bytes: prepared.meta.finalBytes,
            converted_jpeg: prepared.meta.convertedToJpeg,
          })
        }
      } catch (prepErr) {
        const code = prepErr instanceof Error ? prepErr.message : "UNKNOWN"
        equipmentScanDiag("compression_failed", { code })
        equipmentScanDiag("client_compression_end", { skipped: false, error: true })
        setUploadError(messageForPrepareError(code))
        return
      }

      const clientErr = validateClientFile(uploadFile)
      if (clientErr) {
        setUploadError(clientErr)
        return
      }

      const isPdf =
        uploadFile.type === "application/pdf" || uploadFile.name.toLowerCase().endsWith(".pdf")
      setUploadKind(isPdf ? "pdf" : "image")
      setPendingFileName(uploadFile.name)

      revokePreviewObjectUrl()
      setImagePreview(null)
      if (!isPdf) {
        const url = URL.createObjectURL(uploadFile)
        previewObjectUrlRef.current = url
        setImagePreview(url)
      }

      setStep("scanning")
      let i = 0
      const tick = () => {
        setScanLabel(SCAN_LABELS[Math.min(i, SCAN_LABELS.length - 1)]!)
        i++
      }
      tick()
      const t1 = setTimeout(tick, 400)
      const t2 = setTimeout(tick, 900)
      scanTimersRef.current.push(t1, t2)

      const fd = new FormData()
      fd.set("organizationId", organizationId)
      fd.set("file", uploadFile)

      equipmentScanDiag("client_action_start", {
        upload_bytes: uploadFile.size,
        kind: isPdf ? "pdf" : "image",
      })
      equipmentScanDiag("extraction_started", {})

      try {
        let extractionTimer: ReturnType<typeof setTimeout> | undefined
        const actionPromise = extractEquipmentFromScanUploadAction(fd).finally(() => {
          if (extractionTimer !== undefined) {
            clearTimeout(extractionTimer)
            extractionTimer = undefined
          }
        })
        const timeoutPromise = new Promise<never>((_, reject) => {
          extractionTimer = window.setTimeout(() => reject(new Error("EXTRACTION_TIMEOUT")), EXTRACTION_TIMEOUT_MS)
        })
        const raw = await Promise.race([actionPromise, timeoutPromise])
        clearScanTimers()

        const parsed = parseEquipmentScanActionResult(raw)
        equipmentScanDiag("upload_response_received", { tag: parsed.tag })

        if (parsed.tag === "err") {
          equipmentScanDiag("upload_response_ok", { ok: false })
          equipmentScanDiag("upload_response_error", {
            stage: parsed.stage,
            code: parsed.code,
            outcome: "structured_error",
          })
          equipmentScanDiag("extraction_failed", { stage: parsed.stage, code: parsed.code })
          const suffix = SCAN_DEBUG_PUBLIC ? ` [debug: code=${parsed.code} | stage=${parsed.stage}]` : ""
          setUploadError(`${parsed.message}${suffix}`)
          setStep("upload")
          revokePreviewObjectUrl()
          setImagePreview(null)
          setUploadKind(null)
          if (SCAN_DEBUG_PUBLIC) {
            console.info("[equipment_scan_debug] action_ok_false", JSON.stringify(parsed))
          }
          return
        }

        if (parsed.tag === "malformed") {
          equipmentScanDiag("upload_response_error", {
            tag: "malformed",
            detail: parsed.detail,
            outcome: "malformed_payload",
          })
          if (SCAN_DEBUG_PUBLIC) {
            console.warn("[equipment_scan_debug] malformed_action_payload", JSON.stringify(raw))
          }
          setUploadError(
            `Server returned an unexpected scan response (${parsed.detail}). If you recently deployed, hard-refresh the page.${SCAN_DEBUG_PUBLIC ? " Raw payload logged above as [equipment_scan_debug] malformed_action_payload." : ""}`,
          )
          setStep("upload")
          revokePreviewObjectUrl()
          setImagePreview(null)
          setUploadKind(null)
          return
        }

        equipmentScanDiag("upload_response_ok", { ok: true })
        if (SCAN_DEBUG_PUBLIC) {
          console.info("[equipment_scan_debug] action_ok_true", JSON.stringify({ sourceKind: parsed.sourceKind }))
        }

        const f = parsed.fields
        setUploadKind(parsed.sourceKind)
        setForm({
          name: f.name,
          equipmentType: f.equipmentType,
          subcategory: f.subcategory,
          manufacturer: f.manufacturer,
          model: f.model,
          serialNumber: f.serialNumber,
          customerId: "",
          serviceSiteId: "",
          location: "",
          installDate: f.installDate,
          warrantyExpiration: f.warrantyExpiration,
          lastServiceDate: f.lastServiceDate,
          nextServiceDue: f.nextServiceDue,
          nextCalibrationDue: f.nextCalibrationDue,
          calibrationIntervalMonths: f.calibrationIntervalMonths,
          serviceInterval: f.serviceInterval,
          status: "Active",
          notes: f.notes,
        })
        setDocumentCustomerHint(f.documentCustomerHint)
        setScanLabel("Extraction complete")
        setStep("review")
      } catch (err) {
        clearScanTimers()
        const isTimeout = err instanceof Error && err.message === "EXTRACTION_TIMEOUT"
        const detail = sanitizeScanClientError(err)
        if (isTimeout) {
          equipmentScanDiag("timeout_hit", { ms: EXTRACTION_TIMEOUT_MS })
          setUploadError(
            `AI extraction timed out. Try again with a smaller file or better signal.${SCAN_DEBUG_PUBLIC ? ` [debug: ${detail}]` : ""}`,
          )
        } else {
          equipmentScanDiag("upload_failed", { outcome: "throw_before_structured", detail })
          console.info("[equipment_scan]", JSON.stringify({ ns: "equipment_scan", event: "action_rejected", detail }))
          const transportHint = mapEquipmentScanTransportError(err)
          setUploadError(
            SCAN_DEBUG_PUBLIC
              ? `Upload failed before the server could return details. [debug: ${detail}] (transport hint: ${transportHint})`
              : "Upload failed before the server could return details.",
          )
        }
        setStep("upload")
        revokePreviewObjectUrl()
        setImagePreview(null)
        setUploadKind(null)
      }
    },
    [organizationId, equipmentCreateEligibility, clearScanTimers, revokePreviewObjectUrl],
  )

  function consumePickedFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (file) void runExtraction(file)
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files?.[0]
      if (file) void runExtraction(file)
    },
    [runExtraction],
  )

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    if (!form.customerId.trim()) {
      toast({ variant: "destructive", title: "Customer required", description: "Select a customer before saving." })
      return
    }
    if (!form.name.trim() || !form.equipmentType.trim()) {
      toast({
        variant: "destructive",
        title: "Required fields",
        description: "Equipment name and type are required.",
      })
      return
    }
    if (!organizationId) return
    if (toastRecordEligibilityBlocked(equipmentCreateEligibility)) return

    const gate = await enforceCanCreateRecord(organizationId, "equipment")
    if (!gate.ok) {
      toast({ variant: "destructive", title: "Cannot save", description: gate.message })
      return
    }

    setSaving(true)
    setStep("saving")
    const supabase = createBrowserSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setSaving(false)
      setStep("review")
      toast({ variant: "destructive", title: "Sign in required", description: "You must be logged in to save." })
      return
    }

    const statusMap: Record<EquipmentStatus, "active" | "needs_service" | "in_repair" | "out_of_service"> = {
      Active: "active",
      "Needs Service": "needs_service",
      "In Repair": "in_repair",
      "Out of Service": "out_of_service",
    }

    const { error } = await supabase.from("equipment").insert({
      organization_id: organizationId,
      customer_id: form.customerId,
      name: (form.model || form.name).trim(),
      manufacturer: form.manufacturer.trim() || null,
      category: form.equipmentType.trim(),
      subcategory: form.subcategory.trim() || null,
      serial_number: form.serialNumber.trim() || null,
      status: statusMap[form.status],
      install_date: form.installDate || null,
      warranty_expires_at: form.warrantyExpiration || null,
      last_service_at: form.lastServiceDate || null,
      next_due_at: form.nextServiceDue || null,
      next_calibration_due_at: form.nextCalibrationDue.trim() ? form.nextCalibrationDue.trim() : null,
      calibration_interval_months: (() => {
        const n = parseInt(form.calibrationIntervalMonths.trim(), 10)
        return Number.isFinite(n) && n > 0 ? n : null
      })(),
      location_label: form.location.trim() || null,
      customer_location_id: form.serviceSiteId.trim() || null,
      notes: form.notes.trim() || null,
    })

    setSaving(false)
    if (error) {
      setStep("review")
      toast({
        variant: "destructive",
        title: "Could not save equipment",
        description: "Check required fields and try again.",
      })
      return
    }

    onSaved?.()
    setStep("done")
  }

  if (!open) return null

  const orgBlocked = !orgReady || !organizationId

  return (
    <>
      <div
        aria-hidden="true"
        onClick={handleClose}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Scan Equipment with AI"
        className="fixed inset-0 z-50 flex items-start justify-center pt-8 sm:pt-12 px-3 sm:px-4 pb-8"
      >
        <div
          className={cn(
            "relative w-full max-w-2xl rounded-xl shadow-2xl flex flex-col max-h-[calc(100dvh-4rem)] sm:max-h-[calc(100vh-6rem)]",
            DRAWER_PANEL_SURFACE,
          )}
        >
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border dark:border-[#25324C] shrink-0 gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-[color:var(--ds-info-subtle)] flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-foreground">Scan Equipment with AI</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Upload a photo, nameplate image, calibration certificate, spec sheet, or PDF — then review before
                  saving.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close"
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            {orgBlocked ? (
              <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                Select a workspace to use AI equipment scan.
              </div>
            ) : null}

            {!orgBlocked && step === "upload" && (
              <div className="px-4 sm:px-6 py-6 sm:py-8 flex flex-col items-center gap-5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPT_ATTR}
                  className="sr-only"
                  onChange={consumePickedFile}
                  aria-label="Upload equipment photo or document"
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept={ACCEPT_CAMERA_ATTR}
                  capture="environment"
                  className="sr-only"
                  onChange={consumePickedFile}
                  aria-label="Take equipment photo with camera"
                />

                {uploadError ? (
                  <p className="text-xs text-destructive text-center max-w-md flex items-start gap-2" role="alert">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
                    <span>{uploadError}</span>
                  </p>
                ) : null}

                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="text-xs font-medium text-[color:var(--ds-info-text)] underline-offset-2 hover:underline cursor-pointer px-3 py-1.5 rounded-md border border-[color:var(--ds-info-border)] bg-[color:var(--ds-info-bg)]"
                >
                  Use camera (photos only)
                </button>

                {SCAN_DEBUG_PUBLIC ? (
                  <button
                    type="button"
                    onClick={() => void runDebugScanProbe()}
                    className="text-[10px] font-mono text-muted-foreground border border-dashed border-border rounded-md px-2 py-1 hover:bg-muted/50 cursor-pointer"
                  >
                    Debug: run 1×1 JPEG probe + log full action result to console
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setIsDragging(true)
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={cn(
                    "w-full max-w-md rounded-xl border-2 border-dashed transition-all cursor-pointer",
                    "flex flex-col items-center justify-center gap-4 py-12 sm:py-14 px-6 sm:px-8 text-center",
                    isDragging
                      ? "border-[color:var(--ds-info-subtle)] bg-[color:var(--ds-info-bg)]"
                      : "border-border bg-muted/30 hover:border-[color:var(--ds-info-border)] hover:bg-[color:var(--ds-info-bg)]",
                  )}
                >
                  <div
                    className={cn(
                      "w-14 h-14 rounded-xl flex items-center justify-center transition-colors",
                      isDragging ? "bg-[color:var(--ds-info-subtle)]" : "bg-muted",
                    )}
                  >
                    <ImageIcon className={cn("w-7 h-7", isDragging ? "text-white" : "text-muted-foreground")} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Drop a file or click to upload</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      JPG, PNG, HEIC, WebP, GIF, or PDF (certificates and spec sheets supported)
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[color:var(--ds-info-bg)] border border-[color:var(--ds-info-border)]">
                    <Sparkles className="w-3.5 h-3.5 text-[color:var(--ds-info-subtle)] shrink-0" />
                    <span className="text-xs font-semibold text-[color:var(--ds-info-text)] text-left">
                      AI suggests fields — you confirm before anything is saved
                    </span>
                  </div>
                </button>

                <p className="text-[10px] text-muted-foreground text-center max-w-sm leading-relaxed">
                  AI extraction is approximate and may miss or misread labels. Always review manufacturer, model, serial,
                  dates, and customer assignment before saving. Maximum file size 12 MB.
                </p>
              </div>
            )}

            {!orgBlocked && step === "scanning" && (
              <div className="px-6 py-10 flex flex-col items-center gap-6">
                {uploadKind === "image" && imagePreview ? (
                  <div className="relative w-48 h-36 rounded-xl overflow-hidden border border-border shadow-sm shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imagePreview} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-[color:var(--ds-info-bg)]/60 flex items-center justify-center">
                      <RefreshCw className="w-8 h-8 text-[color:var(--ds-info-subtle)] animate-spin" />
                    </div>
                  </div>
                ) : (
                  <div className="relative w-48 h-36 rounded-xl border border-border bg-muted/40 flex flex-col items-center justify-center gap-2">
                    <FileText className="w-10 h-10 text-muted-foreground" aria-hidden />
                    <p className="text-[10px] text-muted-foreground px-2 text-center truncate max-w-[10rem]">
                      {pendingFileName || "Document"}
                    </p>
                    <div className="absolute inset-0 bg-[color:var(--ds-info-bg)]/50 flex items-center justify-center">
                      <RefreshCw className="w-8 h-8 text-[color:var(--ds-info-subtle)] animate-spin" />
                    </div>
                  </div>
                )}

                <div className="w-full max-w-sm flex flex-col items-center gap-3">
                  <div className="flex items-center gap-2 text-center">
                    <Sparkles className="w-3.5 h-3.5 text-[color:var(--ds-info-subtle)] shrink-0" />
                    <p className="text-xs font-medium text-[color:var(--ds-info-text)]">{scanLabel}</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground text-center">
                    {uploadKind === "pdf"
                      ? "Reading PDF text securely, then extracting equipment details…"
                      : "Analyzing the image with Equipify AI…"}
                  </p>
                </div>
              </div>
            )}

            {!orgBlocked && step === "review" && (
              <div className="px-4 sm:px-6 py-5 space-y-5">
                <div className="flex items-start gap-3 p-3.5 rounded-lg bg-[color:var(--ds-info-bg)] border border-[color:var(--ds-info-border)]">
                  <div className="w-6 h-6 rounded-md bg-[color:var(--ds-info-subtle)] flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[color:var(--ds-info-text)]">Review AI suggestions</p>
                    <p className="text-[10px] text-[color:var(--ds-info-text)] opacity-80 mt-0.5 leading-relaxed">
                      Values below are best-effort from your {uploadKind === "pdf" ? "PDF" : "image"}. Correct any
                      mistakes, assign the customer, then save. Nothing is written to your equipment list until you
                      confirm.
                    </p>
                  </div>
                </div>

                {documentCustomerHint ? (
                  <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
                    <span className="font-medium text-foreground">Document listed customer:</span> {documentCustomerHint}
                    <span className="block mt-1">Match this to the customer record below if it belongs to this asset.</span>
                  </div>
                ) : null}

                <div className="flex items-center gap-3">
                  {uploadKind === "image" && imagePreview ? (
                    <div className="w-16 h-12 rounded-lg overflow-hidden border border-border shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imagePreview} alt="" className="w-full h-full object-cover" />
                    </div>
                  ) : uploadKind === "pdf" ? (
                    <div className="w-16 h-12 rounded-lg border border-border bg-muted/40 flex items-center justify-center shrink-0">
                      <FileText className="w-6 h-6 text-muted-foreground" aria-hidden />
                    </div>
                  ) : null}
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{pendingFileName || "Uploaded file"}</p>
                    <button
                      type="button"
                      onClick={() => {
                        resetAll()
                      }}
                      className="text-[10px] text-muted-foreground hover:text-primary transition-colors underline underline-offset-2"
                    >
                      Use a different file
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-foreground">Equipment details</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <Label required>Equipment name</Label>
                      <Input
                        value={form.name}
                        onChange={(e) => setField("name", e.target.value)}
                        placeholder={ui.placeholders.name}
                      />
                    </div>
                    <div>
                      <Label required>Equipment type</Label>
                      <NativeSelect
                        value={form.equipmentType}
                        onChange={(e) => setField("equipmentType", e.target.value)}
                        disabled={equipmentTypesLoading}
                      >
                        {equipmentTypesLoading ? (
                          <option value="">Loading types…</option>
                        ) : (
                          <>
                            <option value="">Select type…</option>
                            {equipmentTypeOptions.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </>
                        )}
                      </NativeSelect>
                    </div>
                    <div>
                      <Label>Subcategory</Label>
                      <Input
                        value={form.subcategory}
                        onChange={(e) => setField("subcategory", e.target.value)}
                        placeholder={ui.placeholders.subcategory}
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">{ui.subcategoryHint}</p>
                    </div>
                    <div>
                      <Label>Manufacturer</Label>
                      <Input
                        value={form.manufacturer}
                        onChange={(e) => setField("manufacturer", e.target.value)}
                        placeholder={ui.placeholders.manufacturer}
                      />
                    </div>
                    <div>
                      <Label>Model</Label>
                      <Input
                        value={form.model}
                        onChange={(e) => setField("model", e.target.value)}
                        placeholder={ui.placeholders.model}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Serial number</Label>
                      <Input
                        value={form.serialNumber}
                        onChange={(e) => setField("serialNumber", e.target.value)}
                        placeholder={ui.placeholders.serialNumber}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <Label required>Customer</Label>
                    <NativeSelect value={form.customerId} onChange={(e) => setField("customerId", e.target.value)}>
                      <option value="">Select customer…</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.company_name}
                        </option>
                      ))}
                    </NativeSelect>
                    {!form.customerId ? (
                      <p className="flex items-center gap-1 text-[10px] text-[color:var(--status-warning)] mt-1">
                        <AlertCircle className="w-3 h-3 shrink-0" aria-hidden />
                        Required before saving.
                      </p>
                    ) : null}
                  </div>
                  {form.customerId && serviceSiteOptions.length > 0 ? (
                    <div className="sm:col-span-2">
                      <Label>Service site</Label>
                      <NativeSelect
                        value={form.serviceSiteId}
                        onChange={(e) => setField("serviceSiteId", e.target.value)}
                      >
                        <option value="">Select site…</option>
                        {serviceSiteOptions.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.label}
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                  ) : null}
                  <div className="sm:col-span-2">
                    <Label>Room / area label</Label>
                    <Input
                      value={form.location}
                      onChange={(e) => setField("location", e.target.value)}
                      placeholder={ui.placeholders.location}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Install date</Label>
                    <Input type="date" value={form.installDate} onChange={(e) => setField("installDate", e.target.value)} />
                  </div>
                  <div>
                    <Label>Warranty expiration</Label>
                    <Input
                      type="date"
                      value={form.warrantyExpiration}
                      onChange={(e) => setField("warrantyExpiration", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Last service date</Label>
                    <Input
                      type="date"
                      value={form.lastServiceDate}
                      onChange={(e) => setField("lastServiceDate", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Next service due</Label>
                    <Input type="date" value={form.nextServiceDue} onChange={(e) => setField("nextServiceDue", e.target.value)} />
                  </div>
                  <div>
                    <Label>{ui.calibrationDueLabel}</Label>
                    <Input
                      type="date"
                      value={form.nextCalibrationDue}
                      onChange={(e) => setField("nextCalibrationDue", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Calibration interval (months)</Label>
                    <Input
                      type="number"
                      min={1}
                      placeholder={ui.calibrationIntervalPlaceholder}
                      value={form.calibrationIntervalMonths}
                      onChange={(e) => setField("calibrationIntervalMonths", e.target.value)}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Service interval</Label>
                    <Input
                      value={form.serviceInterval}
                      onChange={(e) => setField("serviceInterval", e.target.value)}
                      placeholder={ui.placeholders.serviceInterval}
                    />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <NativeSelect value={form.status} onChange={(e) => setField("status", e.target.value as EquipmentStatus)}>
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                </div>

                <div>
                  <Label>Notes</Label>
                  <Textarea
                    rows={3}
                    className="resize-none"
                    value={form.notes}
                    onChange={(e) => setField("notes", e.target.value)}
                    placeholder={ui.placeholders.notes}
                  />
                </div>
              </div>
            )}

            {!orgBlocked && step === "saving" && (
              <div className="px-6 py-16 flex flex-col items-center gap-4">
                <RefreshCw className="w-8 h-8 text-[color:var(--ds-info-subtle)] animate-spin" />
                <p className="text-sm font-medium text-foreground">Saving equipment record…</p>
              </div>
            )}

            {!orgBlocked && step === "done" && (
              <div className="px-6 py-16 flex flex-col items-center gap-5 text-center">
                <div className="w-16 h-16 rounded-full bg-[color:var(--status-success)]/15 flex items-center justify-center">
                  <Check className="w-8 h-8 text-[color:var(--status-success)]" />
                </div>
                <div>
                  <p className="text-base font-semibold text-foreground">Equipment added</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    <span className="font-medium text-foreground">{(form.model || form.name).trim() || "Equipment"}</span>{" "}
                    is now in your list.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                  <Button variant="outline" onClick={handleClose} className="cursor-pointer w-full sm:w-auto">
                    Close
                  </Button>
                  <Button onClick={handleClose} className="gap-1.5 cursor-pointer w-full sm:w-auto">
                    Done <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {(step === "upload" || step === "review") && !orgBlocked ? (
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 px-4 sm:px-6 py-4 border-t border-border shrink-0">
              <Button variant="ghost" onClick={handleClose} className="cursor-pointer text-muted-foreground w-full sm:w-auto">
                Cancel
              </Button>
              {step === "review" ? (
                <Button
                  onClick={() => void handleSave()}
                  disabled={!form.customerId || saving}
                  className="gap-2 cursor-pointer w-full sm:w-auto"
                >
                  <Check className="w-4 h-4" />
                  Save equipment
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </>
  )
}
