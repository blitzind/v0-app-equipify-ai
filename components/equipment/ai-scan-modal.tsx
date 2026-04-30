"use client"

import { useState, useRef, useCallback } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  X, Upload, ImageIcon, Sparkles, RefreshCw, Check,
  ChevronRight, AlertCircle,
} from "lucide-react"
import { useEquipment } from "@/lib/equipment-store"
import { customers } from "@/lib/mock-data"
import type { Equipment } from "@/lib/mock-data"

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScannedFields {
  manufacturer: string
  model: string
  serialNumber: string
  category: string
  installYear: string
  notes: string
}

type ScanStep = "upload" | "scanning" | "review" | "saving" | "done"

// ─── Mock AI extraction results keyed to plausible image names ────────────────

const MOCK_RESULTS: ScannedFields[] = [
  {
    manufacturer: "Carrier",
    model: "50XC-060-3-3",
    serialNumber: "1219A12345",
    category: "HVAC",
    installYear: "2019",
    notes: "Rooftop package unit. Refrigerant R-410A. Last filter change visible on unit label. Minor corrosion on condenser fins noted.",
  },
  {
    manufacturer: "Trane",
    model: "XR15 4TTR5048A",
    serialNumber: "202208B98765",
    category: "HVAC",
    installYear: "2022",
    notes: "Split system condenser. High-efficiency SEER 15. Capacitor replaced in prior service. Unit pad is level.",
  },
  {
    manufacturer: "York",
    model: "YZF048B4EMA",
    serialNumber: "WLYM123456",
    category: "Refrigeration",
    installYear: "2017",
    notes: "Commercial walk-in refrigeration condensing unit. R-22 system — recommend phase-out planning. Compressor cycles normally.",
  },
  {
    manufacturer: "Lennox",
    model: "XC21-060-230",
    serialNumber: "5821E21001",
    category: "HVAC",
    installYear: "2021",
    notes: "High-efficiency variable-capacity AC. Communicating system. Control board appears original. No visible leaks.",
  },
  {
    manufacturer: "Daikin",
    model: "RXL-G Series 18K",
    serialNumber: "JQ6210700123",
    category: "HVAC",
    installYear: "2020",
    notes: "Mini-split indoor unit. Heat pump capable. Filter indicator light was on — recommend cleaning. Drain pan clear.",
  },
]

function randomResult(): ScannedFields {
  return MOCK_RESULTS[Math.floor(Math.random() * MOCK_RESULTS.length)]
}

// ─── Shared form field primitives (local, matches add-equipment-modal style) ──

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-medium text-foreground mb-1">
      {children}
      {required && <span className="text-destructive ml-0.5">*</span>}
    </label>
  )
}

function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground",
        "placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors",
        className,
      )}
      {...props}
    />
  )
}

function Select({ children, className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground",
        "outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors cursor-pointer",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
}

function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={3}
      className={cn(
        "w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground",
        "placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-none",
        className,
      )}
      {...props}
    />
  )
}

const EQUIPMENT_TYPES = [
  "HVAC", "Electrical", "Plumbing", "Mechanical", "Refrigeration",
  "Fire Safety", "Security", "Lighting", "Elevator", "Generator",
  "Compressor", "Conveyor", "Pump", "Boiler", "Chiller", "Other",
]

// ─── Scanning progress animation labels ──────────────────────────────────────

const SCAN_STEPS = [
  "Detecting equipment type…",
  "Reading manufacturer markings…",
  "Extracting model number…",
  "Parsing serial number…",
  "Estimating install year…",
  "Generating service notes…",
  "Finalizing extraction…",
]

let idCounter = 2000

// ─── Main component ───────────────────────────────────────────────────────────

interface AIScanModalProps {
  open: boolean
  onClose: () => void
}

export function AIScanModal({ open, onClose }: AIScanModalProps) {
  const { addEquipment } = useEquipment()

  const [step, setStep] = useState<ScanStep>("upload")
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [scanProgress, setScanProgress] = useState(0)
  const [scanLabel, setScanLabel] = useState(SCAN_STEPS[0])
  const [scanned, setScanned] = useState<ScannedFields | null>(null)
  const [customerId, setCustomerId] = useState("")
  const [location, setLocation] = useState("")
  const [isDragging, setIsDragging] = useState(false)
  const [fields, setFields] = useState<ScannedFields>({
    manufacturer: "", model: "", serialNumber: "", category: "", installYear: "", notes: "",
  })

  const fileInputRef = useRef<HTMLInputElement>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function handleClose() {
    // clear interval if scanning
    if (intervalRef.current) clearInterval(intervalRef.current)
    // reset all state
    setStep("upload")
    setImagePreview(null)
    setScanProgress(0)
    setScanLabel(SCAN_STEPS[0])
    setScanned(null)
    setCustomerId("")
    setLocation("")
    setIsDragging(false)
    setFields({ manufacturer: "", model: "", serialNumber: "", category: "", installYear: "", notes: "" })
    onClose()
  }

  function loadImageFile(file: File) {
    const reader = new FileReader()
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string)
      startScan()
    }
    reader.readAsDataURL(file)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) loadImageFile(file)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith("image/")) loadImageFile(file)
  }, [])

  function startScan() {
    setStep("scanning")
    setScanProgress(0)
    setScanLabel(SCAN_STEPS[0])

    let progress = 0
    let labelIndex = 0

    intervalRef.current = setInterval(() => {
      progress += Math.random() * 14 + 4
      labelIndex = Math.min(Math.floor((progress / 100) * SCAN_STEPS.length), SCAN_STEPS.length - 1)

      setScanProgress(Math.min(progress, 97))
      setScanLabel(SCAN_STEPS[labelIndex])

      if (progress >= 97) {
        clearInterval(intervalRef.current!)
        setTimeout(() => {
          setScanProgress(100)
          setScanLabel("Extraction complete")
          const result = randomResult()
          setScanned(result)
          setFields(result)
          setTimeout(() => setStep("review"), 400)
        }, 500)
      }
    }, 220)
  }

  function setField(key: keyof ScannedFields, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }))
  }

  function handleSave() {
    if (!customerId) return
    setStep("saving")

    setTimeout(() => {
      const customer = customers.find((c) => c.id === customerId)
      const today = new Date().toISOString().slice(0, 10)
      const installDate = fields.installYear
        ? `${fields.installYear}-01-01`
        : today

      const newId = `EQ-${String(++idCounter).padStart(4, "0")}`

      const newEquipment: Equipment = {
        id: newId,
        customerId,
        customerName: customer?.company ?? "",
        model: fields.model || "Unknown Model",
        manufacturer: fields.manufacturer,
        category: fields.category || "HVAC",
        serialNumber: fields.serialNumber,
        installDate,
        warrantyExpiration: "",
        lastServiceDate: today,
        nextDueDate: today,
        status: "Active",
        notes: fields.notes,
        location,
        photos: imagePreview ? [imagePreview] : [],
        manuals: [],
        serviceHistory: [],
      }

      addEquipment(newEquipment)
      setStep("done")
    }, 900)
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={handleClose}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]"
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Scan Equipment with AI"
        className="fixed inset-0 z-50 flex items-start justify-center pt-12 px-4 pb-8"
      >
        <div className="relative w-full max-w-2xl bg-background rounded-xl border border-border shadow-2xl flex flex-col max-h-[calc(100vh-6rem)]">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[color:var(--ds-info-subtle)] flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">Scan Equipment with AI</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Upload a photo — AI will extract equipment details automatically.
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              aria-label="Close"
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">

            {/* ── Step: upload ── */}
            {step === "upload" && (
              <div className="px-6 py-8 flex flex-col items-center gap-5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleFileChange}
                  aria-label="Upload equipment photo"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={cn(
                    "w-full max-w-md rounded-xl border-2 border-dashed transition-all cursor-pointer",
                    "flex flex-col items-center justify-center gap-4 py-14 px-8 text-center",
                    isDragging
                      ? "border-[color:var(--ds-info-subtle)] bg-[color:var(--ds-info-bg)]"
                      : "border-border bg-muted/30 hover:border-[color:var(--ds-info-border)] hover:bg-[color:var(--ds-info-bg)]",
                  )}
                >
                  <div className={cn(
                    "w-14 h-14 rounded-xl flex items-center justify-center transition-colors",
                    isDragging
                      ? "bg-[color:var(--ds-info-subtle)]"
                      : "bg-muted",
                  )}>
                    <ImageIcon className={cn("w-7 h-7", isDragging ? "text-white" : "text-muted-foreground")} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Drop a photo or click to upload
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      JPG, PNG, HEIC — nameplate, label, or unit photo
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[color:var(--ds-info-bg)] border border-[color:var(--ds-info-border)]">
                    <Sparkles className="w-3.5 h-3.5 text-[color:var(--ds-info-subtle)]" />
                    <span className="text-xs font-semibold text-[color:var(--ds-info-text)]">
                      AI extracts: manufacturer, model, serial, type, age, notes
                    </span>
                  </div>
                </button>

                <p className="text-[10px] text-muted-foreground text-center max-w-xs">
                  Best results with a clear photo of the equipment nameplate or data label.
                  AI extraction is approximate — review all fields before saving.
                </p>
              </div>
            )}

            {/* ── Step: scanning ── */}
            {step === "scanning" && (
              <div className="px-6 py-10 flex flex-col items-center gap-6">
                {imagePreview && (
                  <div className="relative w-48 h-36 rounded-xl overflow-hidden border border-border shadow-sm shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imagePreview} alt="Uploaded equipment" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-[color:var(--ds-info-bg)]/60 flex items-center justify-center">
                      <RefreshCw className="w-8 h-8 text-[color:var(--ds-info-subtle)] animate-spin" />
                    </div>
                  </div>
                )}

                <div className="w-full max-w-sm flex flex-col items-center gap-4">
                  {/* Progress bar */}
                  <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[color:var(--ds-info-subtle)] transition-all duration-300"
                      style={{ width: `${scanProgress}%` }}
                    />
                  </div>

                  {/* Step label */}
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-[color:var(--ds-info-subtle)] shrink-0" />
                    <p className="text-xs font-medium text-[color:var(--ds-info-text)]">{scanLabel}</p>
                  </div>

                  <p className="text-[10px] text-muted-foreground text-center">
                    Analyzing image with Equipify AI…
                  </p>
                </div>
              </div>
            )}

            {/* ── Step: review ── */}
            {step === "review" && scanned && (
              <div className="px-6 py-5 space-y-5">
                {/* AI success banner */}
                <div className="flex items-start gap-3 p-3.5 rounded-lg bg-[color:var(--ds-info-bg)] border border-[color:var(--ds-info-border)]">
                  <div className="w-6 h-6 rounded-md bg-[color:var(--ds-info-subtle)] flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[color:var(--ds-info-text)]">
                      AI extraction complete
                    </p>
                    <p className="text-[10px] text-[color:var(--ds-info-text)] opacity-75 mt-0.5">
                      Fields are pre-filled from the photo. Review and correct any details before saving.
                    </p>
                  </div>
                </div>

                {/* Image thumbnail */}
                {imagePreview && (
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-12 rounded-lg overflow-hidden border border-border shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imagePreview} alt="Scanned equipment" className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-foreground">Scanned photo</p>
                      <button
                        type="button"
                        onClick={() => { setStep("upload"); setImagePreview(null) }}
                        className="text-[10px] text-muted-foreground hover:text-primary transition-colors underline underline-offset-2"
                      >
                        Use a different photo
                      </button>
                    </div>
                  </div>
                )}

                {/* Extracted fields */}
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-foreground">Extracted Equipment Details</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Manufacturer</Label>
                      <Input
                        value={fields.manufacturer}
                        onChange={(e) => setField("manufacturer", e.target.value)}
                        placeholder="e.g. Carrier"
                      />
                    </div>
                    <div>
                      <Label>Model</Label>
                      <Input
                        value={fields.model}
                        onChange={(e) => setField("model", e.target.value)}
                        placeholder="e.g. 50XC-060"
                      />
                    </div>
                    <div>
                      <Label>Serial Number</Label>
                      <Input
                        value={fields.serialNumber}
                        onChange={(e) => setField("serialNumber", e.target.value)}
                        placeholder="e.g. SN-1234567"
                      />
                    </div>
                    <div>
                      <Label>Equipment Type</Label>
                      <Select
                        value={fields.category}
                        onChange={(e) => setField("category", e.target.value)}
                      >
                        <option value="">Select type…</option>
                        {EQUIPMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </Select>
                    </div>
                    <div>
                      <Label>Install Year</Label>
                      <Input
                        value={fields.installYear}
                        onChange={(e) => setField("installYear", e.target.value)}
                        placeholder="e.g. 2019"
                        maxLength={4}
                      />
                    </div>
                    <div>
                      <Label>Location</Label>
                      <Input
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="e.g. Rooftop, Building A"
                      />
                    </div>
                  </div>
                  <div className="mt-1">
                    <Label>AI Notes</Label>
                    <Textarea
                      value={fields.notes}
                      onChange={(e) => setField("notes", e.target.value)}
                      placeholder="Service observations and notes…"
                    />
                  </div>
                </div>

                {/* Customer assignment */}
                <div>
                  <Label required>Assign to Customer</Label>
                  <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                    <option value="">Select customer…</option>
                    {customers.map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}
                  </Select>
                  {!customerId && (
                    <p className="flex items-center gap-1 text-[10px] text-[color:var(--status-warning)] mt-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      Customer is required before saving.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ── Step: saving ── */}
            {step === "saving" && (
              <div className="px-6 py-16 flex flex-col items-center gap-4">
                <RefreshCw className="w-8 h-8 text-[color:var(--ds-info-subtle)] animate-spin" />
                <p className="text-sm font-medium text-foreground">Saving equipment record…</p>
              </div>
            )}

            {/* ── Step: done ── */}
            {step === "done" && (
              <div className="px-6 py-16 flex flex-col items-center gap-5 text-center">
                <div className="w-16 h-16 rounded-full bg-[color:var(--status-success)]/15 flex items-center justify-center">
                  <Check className="w-8 h-8 text-[color:var(--status-success)]" />
                </div>
                <div>
                  <p className="text-base font-semibold text-foreground">Equipment added</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    <span className="font-medium text-foreground">{fields.model}</span> has been added to your equipment list.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Button variant="outline" onClick={handleClose} className="cursor-pointer">
                    Close
                  </Button>
                  <Button onClick={handleClose} className="gap-1.5 cursor-pointer">
                    View Equipment <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          {(step === "upload" || step === "review") && (
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-border shrink-0">
              <Button variant="ghost" onClick={handleClose} className="cursor-pointer text-muted-foreground">
                Cancel
              </Button>
              {step === "review" && (
                <Button
                  onClick={handleSave}
                  disabled={!customerId}
                  className="gap-2 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  Save Equipment
                </Button>
              )}
            </div>
          )}

        </div>
      </div>
    </>
  )
}
