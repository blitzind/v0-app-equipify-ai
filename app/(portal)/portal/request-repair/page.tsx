"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronLeft, CheckCircle2, Wrench, Upload, X } from "lucide-react"
import { equipment } from "@/lib/mock-data"

const CUSTOMER_ID = "CUS-001"
const myEquipment = equipment.filter((e) => e.customerId === CUSTOMER_ID)

type Step = "details" | "confirm" | "submitted"

export default function RequestRepairPage() {
  const [step, setStep] = useState<Step>("details")
  const [form, setForm] = useState({
    equipmentId: "",
    priority: "Normal",
    problemDescription: "",
    preferredDate: "",
    preferredTime: "",
    contactName: "Dale Whitmore",
    contactPhone: "(614) 555-0142",
    contactEmail: "dale@riverstonelogistics.com",
    siteAccess: "",
  })
  const [photos, setPhotos] = useState<string[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})

  function set(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
    setErrors((e) => { const ne = { ...e }; delete ne[k]; return ne })
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!form.equipmentId) e.equipmentId = "Please select equipment"
    if (!form.problemDescription.trim()) e.problemDescription = "Please describe the problem"
    if (!form.preferredDate) e.preferredDate = "Please select a preferred date"
    return e
  }

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    files.forEach((file) => {
      const reader = new FileReader()
      reader.onload = (ev) => setPhotos((p) => [...p, ev.target?.result as string])
      reader.readAsDataURL(file)
    })
  }

  const selectedEquipment = myEquipment.find((e) => e.id === form.equipmentId)

  const PRIORITY_OPTIONS = [
    { value: "Low", label: "Low", desc: "Minor issue, not affecting operations" },
    { value: "Normal", label: "Normal", desc: "Operations continue with workaround" },
    { value: "High", label: "High", desc: "Impacting efficiency or safety" },
    { value: "Critical", label: "Critical", desc: "Equipment down, operations halted" },
  ]

  const PRIORITY_COLORS: Record<string, string> = {
    Low: "#6b7280", Normal: "var(--portal-accent)", High: "var(--portal-warning)", Critical: "var(--portal-danger)"
  }

  if (step === "submitted") {
    return (
      <div className="max-w-lg mx-auto pt-12 text-center">
        <div className="portal-card p-10">
          <div className="flex items-center justify-center w-16 h-16 rounded-full mx-auto mb-6"
            style={{ background: "var(--portal-success-muted)" }}>
            <CheckCircle2 size={32} style={{ color: "var(--portal-success)" }} />
          </div>
          <h1 className="text-xl font-semibold mb-2" style={{ color: "var(--portal-foreground)" }}>
            Repair Request Submitted
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: "var(--portal-nav-text)" }}>
            Your request for <strong style={{ color: "var(--portal-secondary)" }}>{selectedEquipment?.model}</strong> has been received.
            A work order will be created and your assigned technician will be in touch within 1 business day.
          </p>
          <div className="mt-6 p-4 rounded-lg text-left"
            style={{ background: "var(--portal-surface-2)", border: "1px solid var(--portal-border-light)" }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--portal-nav-text)" }}>
              Reference
            </p>
            <p className="text-sm font-mono font-medium" style={{ color: "var(--portal-accent)" }}>
              REQ-{Date.now().toString().slice(-6)}
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--portal-nav-text)" }}>
              Preferred date: {form.preferredDate} {form.preferredTime && `at ${form.preferredTime}`}
            </p>
          </div>
          <div className="mt-6 flex gap-3">
            <Link href="/portal/work-orders" className="portal-btn-secondary flex-1 justify-center">
              View Work Orders
            </Link>
            <Link href="/portal" className="portal-btn-primary flex-1 justify-center">
              Back to Overview
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (step === "confirm") {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-2 text-sm">
          <button onClick={() => setStep("details")} className="flex items-center gap-1 font-medium"
            style={{ color: "var(--portal-accent)" }}>
            <ChevronLeft size={14} /> Edit request
          </button>
        </div>

        <div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--portal-foreground)" }}>Review your request</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--portal-nav-text)" }}>
            Confirm details before submitting
          </p>
        </div>

        <div className="portal-card divide-y" style={{ borderColor: "var(--portal-border-light)" }}>
          {[
            { label: "Equipment", value: selectedEquipment?.model + " · " + selectedEquipment?.location },
            { label: "Priority", value: form.priority },
            { label: "Problem Description", value: form.problemDescription },
            { label: "Preferred Visit", value: form.preferredDate + (form.preferredTime ? ` at ${form.preferredTime}` : "") },
            { label: "Contact", value: `${form.contactName} · ${form.contactPhone}` },
          ].map(({ label, value }) => (
            <div key={label} className="px-5 py-4 flex items-start gap-6">
              <span className="w-36 shrink-0 text-xs font-medium" style={{ color: "var(--portal-nav-text)" }}>{label}</span>
              <span className="text-sm" style={{ color: "var(--portal-foreground)" }}>{value}</span>
            </div>
          ))}
          {photos.length > 0 && (
            <div className="px-5 py-4 flex items-start gap-6">
              <span className="w-36 shrink-0 text-xs font-medium" style={{ color: "var(--portal-nav-text)" }}>Photos</span>
              <div className="flex gap-2 flex-wrap">
                {photos.map((p, i) => (
                  <img key={i} src={p} alt={`Photo ${i + 1}`}
                    className="w-16 h-16 rounded-md object-cover border"
                    style={{ borderColor: "var(--portal-border)" }} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button onClick={() => setStep("details")} className="portal-btn-secondary">Edit</button>
          <button onClick={() => setStep("submitted")} className="portal-btn-primary flex-1 justify-center">
            Submit Repair Request
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-2 text-sm">
        <Link href="/portal" className="flex items-center gap-1 font-medium" style={{ color: "var(--portal-accent)" }}>
          <ChevronLeft size={14} /> Overview
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-semibold" style={{ color: "var(--portal-foreground)" }}>Request a Repair</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--portal-nav-text)" }}>
          Submit a repair ticket and we will schedule a technician visit.
        </p>
      </div>

      <div className="portal-card p-6 space-y-6">
        {/* Equipment */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide mb-2"
            style={{ color: "var(--portal-nav-text)" }}>
            Equipment <span style={{ color: "var(--portal-danger)" }}>*</span>
          </label>
          <select className="portal-select" value={form.equipmentId} onChange={e => set("equipmentId", e.target.value)}>
            <option value="">Select equipment...</option>
            {myEquipment.map((eq) => (
              <option key={eq.id} value={eq.id}>{eq.model} — {eq.location} ({eq.id})</option>
            ))}
          </select>
          {errors.equipmentId && <p className="text-xs mt-1" style={{ color: "var(--portal-danger)" }}>{errors.equipmentId}</p>}
        </div>

        {/* Priority */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide mb-2"
            style={{ color: "var(--portal-nav-text)" }}>Priority</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PRIORITY_OPTIONS.map((opt) => (
              <button key={opt.value}
                onClick={() => set("priority", opt.value)}
                className="p-3 rounded-lg border text-left transition-all"
                style={{
                  borderColor: form.priority === opt.value ? PRIORITY_COLORS[opt.value] : "var(--portal-border)",
                  background: form.priority === opt.value ? `color-mix(in oklch, ${PRIORITY_COLORS[opt.value]} 8%, white)` : "var(--portal-surface)",
                  boxShadow: form.priority === opt.value ? `0 0 0 2px ${PRIORITY_COLORS[opt.value]}22` : "none",
                }}>
                <p className="text-xs font-semibold" style={{ color: PRIORITY_COLORS[opt.value] }}>{opt.label}</p>
                <p className="text-[11px] mt-0.5 leading-tight" style={{ color: "var(--portal-nav-text)" }}>{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Problem description */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide mb-2"
            style={{ color: "var(--portal-nav-text)" }}>
            Problem Description <span style={{ color: "var(--portal-danger)" }}>*</span>
          </label>
          <textarea
            className="portal-textarea"
            rows={4}
            placeholder="Describe the issue in as much detail as possible — when it started, what symptoms you observe, any error codes..."
            value={form.problemDescription}
            onChange={e => set("problemDescription", e.target.value)}
          />
          {errors.problemDescription && <p className="text-xs mt-1" style={{ color: "var(--portal-danger)" }}>{errors.problemDescription}</p>}
        </div>

        {/* Photos */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide mb-2"
            style={{ color: "var(--portal-nav-text)" }}>Photos (optional)</label>
          <label
            className="flex flex-col items-center justify-center gap-2 p-6 rounded-lg border-2 border-dashed cursor-pointer transition-colors hover:bg-[var(--portal-surface-2)]"
            style={{ borderColor: "var(--portal-border)" }}>
            <Upload size={20} style={{ color: "var(--portal-nav-icon)" }} />
            <span className="text-xs" style={{ color: "var(--portal-nav-text)" }}>
              Click to upload or drag photos here
            </span>
            <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
          </label>
          {photos.length > 0 && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {photos.map((p, i) => (
                <div key={i} className="relative">
                  <img src={p} alt={`Photo ${i + 1}`}
                    className="w-16 h-16 rounded-md object-cover border"
                    style={{ borderColor: "var(--portal-border)" }} />
                  <button
                    onClick={() => setPhotos(photos.filter((_, j) => j !== i))}
                    className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-4 h-4 rounded-full text-white"
                    style={{ background: "var(--portal-danger)" }}>
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Preferred visit */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-2"
              style={{ color: "var(--portal-nav-text)" }}>
              Preferred Date <span style={{ color: "var(--portal-danger)" }}>*</span>
            </label>
            <input type="date" className="portal-input" value={form.preferredDate}
              onChange={e => set("preferredDate", e.target.value)} />
            {errors.preferredDate && <p className="text-xs mt-1" style={{ color: "var(--portal-danger)" }}>{errors.preferredDate}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-2"
              style={{ color: "var(--portal-nav-text)" }}>Preferred Time</label>
            <input type="time" className="portal-input" value={form.preferredTime}
              onChange={e => set("preferredTime", e.target.value)} />
          </div>
        </div>

        {/* Site access */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide mb-2"
            style={{ color: "var(--portal-nav-text)" }}>Site Access Instructions (optional)</label>
          <input type="text" className="portal-input"
            placeholder="e.g. Check in at security gate, ask for Maintenance Dept."
            value={form.siteAccess} onChange={e => set("siteAccess", e.target.value)} />
        </div>

        {/* Contact */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--portal-nav-text)" }}>
            On-site Contact
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--portal-nav-text)" }}>Name</label>
              <input type="text" className="portal-input" value={form.contactName}
                onChange={e => set("contactName", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--portal-nav-text)" }}>Phone</label>
              <input type="tel" className="portal-input" value={form.contactPhone}
                onChange={e => set("contactPhone", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--portal-nav-text)" }}>Email</label>
              <input type="email" className="portal-input" value={form.contactEmail}
                onChange={e => set("contactEmail", e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Link href="/portal" className="portal-btn-secondary">Cancel</Link>
        <button
          className="portal-btn-primary"
          onClick={() => {
            const e = validate()
            if (Object.keys(e).length > 0) { setErrors(e); return }
            setStep("confirm")
          }}>
          <Wrench size={14} /> Review Request
        </button>
      </div>
    </div>
  )
}
