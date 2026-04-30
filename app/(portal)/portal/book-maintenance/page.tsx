"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronLeft, CheckCircle2, Calendar, ChevronRight } from "lucide-react"
import { equipment, maintenancePlans } from "@/lib/mock-data"

const CUSTOMER_ID = "CUS-001"
const myEquipment = equipment.filter((e) => e.customerId === CUSTOMER_ID)
const myPlans     = maintenancePlans.filter((p) => p.customerId === CUSTOMER_ID && p.status === "Active")

type Step = "select" | "schedule" | "submitted"

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}
function daysUntil(d: string) {
  return Math.round((new Date(d).getTime() - Date.now()) / 86_400_000)
}

const TIME_SLOTS = [
  "08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM",
  "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM",
]

export default function BookMaintenancePage() {
  const [step, setStep] = useState<Step>("select")
  const [form, setForm] = useState({
    planId: "",
    equipmentId: "",
    date: "",
    timeSlot: "",
    notes: "",
    contactName: "Dale Whitmore",
    contactPhone: "(614) 555-0142",
  })

  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })) }

  const selectedPlan  = myPlans.find((p) => p.id === form.planId)
  const selectedEq    = myEquipment.find((e) => e.id === form.equipmentId)
  const refId = `BK-${Date.now().toString().slice(-6)}`

  if (step === "submitted") {
    return (
      <div className="max-w-lg mx-auto pt-12 text-center">
        <div className="portal-card p-10">
          <div className="flex items-center justify-center w-16 h-16 rounded-full mx-auto mb-6"
            style={{ background: "#f0fdf4" }}>
            <CheckCircle2 size={32} style={{ color: "var(--portal-success)" }} />
          </div>
          <h1 className="text-xl font-semibold mb-2" style={{ color: "var(--portal-foreground)" }}>
            Service Booked
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: "var(--portal-nav-text)" }}>
            Your maintenance visit has been scheduled. You will receive a confirmation via email and the technician will be assigned shortly.
          </p>
          <div className="mt-6 p-4 rounded-lg text-left"
            style={{ background: "var(--portal-surface-2)", border: "1px solid var(--portal-border-light)" }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--portal-nav-text)" }}>
              Booking Reference
            </p>
            <p className="text-sm font-mono font-medium" style={{ color: "var(--portal-accent)" }}>{refId}</p>
            <p className="text-xs mt-1.5" style={{ color: "var(--portal-secondary)" }}>
              {form.date && fmtDate(form.date)} {form.timeSlot && `at ${form.timeSlot}`}
            </p>
            {selectedPlan && (
              <p className="text-xs mt-0.5" style={{ color: "var(--portal-nav-text)" }}>{selectedPlan.name}</p>
            )}
          </div>
          <div className="mt-6 flex gap-3">
            <Link href="/portal/maintenance" className="portal-btn-secondary flex-1 justify-center">
              Maintenance Plans
            </Link>
            <Link href="/portal" className="portal-btn-primary flex-1 justify-center">
              Back to Overview
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (step === "schedule") {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <button onClick={() => setStep("select")} className="flex items-center gap-1 text-sm font-medium"
          style={{ color: "var(--portal-accent)" }}>
          <ChevronLeft size={14} /> Back
        </button>
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--portal-foreground)" }}>Choose a Date & Time</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--portal-nav-text)" }}>
            {selectedPlan ? selectedPlan.name : selectedEq?.model}
          </p>
        </div>

        {/* Date */}
        <div className="portal-card p-6 space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-2"
              style={{ color: "var(--portal-nav-text)" }}>
              Date <span style={{ color: "var(--portal-danger)" }}>*</span>
            </label>
            <input type="date" className="portal-input w-64" value={form.date} onChange={e => set("date", e.target.value)} />
          </div>

          {/* Time slots */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-3"
              style={{ color: "var(--portal-nav-text)" }}>Preferred Time</label>
            <div className="grid grid-cols-4 gap-2">
              {TIME_SLOTS.map((t) => (
                <button key={t}
                  onClick={() => set("timeSlot", t)}
                  className="py-2 px-3 text-xs rounded-lg border transition-all font-medium"
                  style={{
                    borderColor: form.timeSlot === t ? "var(--portal-accent)" : "var(--portal-border)",
                    background: form.timeSlot === t ? "var(--portal-accent-muted)" : "var(--portal-surface)",
                    color: form.timeSlot === t ? "var(--portal-accent-text)" : "var(--portal-secondary)",
                    boxShadow: form.timeSlot === t ? "0 0 0 2px #2563eb22" : "none",
                  }}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-2"
              style={{ color: "var(--portal-nav-text)" }}>Additional Notes</label>
            <textarea className="portal-textarea" rows={3}
              placeholder="Any special instructions for the technician..."
              value={form.notes} onChange={e => set("notes", e.target.value)} />
          </div>

          {/* Contact */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-3"
              style={{ color: "var(--portal-nav-text)" }}>On-site Contact</label>
            <div className="grid grid-cols-2 gap-3">
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
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button onClick={() => setStep("select")} className="portal-btn-secondary">Back</button>
          <button
            disabled={!form.date}
            className="portal-btn-primary"
            style={{ opacity: !form.date ? 0.5 : 1, cursor: !form.date ? "not-allowed" : "pointer" }}
            onClick={() => setStep("submitted")}>
            <Calendar size={14} /> Confirm Booking
          </button>
        </div>
      </div>
    )
  }

  // Step 1: Select plan or equipment
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link href="/portal" className="flex items-center gap-1 text-sm font-medium mb-4"
          style={{ color: "var(--portal-accent)" }}>
          <ChevronLeft size={14} /> Overview
        </Link>
        <h1 className="text-xl font-semibold" style={{ color: "var(--portal-foreground)" }}>Book a Maintenance Visit</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--portal-nav-text)" }}>
          Select a maintenance plan or choose equipment for an ad-hoc service visit.
        </p>
      </div>

      {/* Plans */}
      {myPlans.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--portal-nav-text)" }}>
            Your Maintenance Plans
          </h2>
          <div className="space-y-3">
            {myPlans.map((plan) => {
              const days = daysUntil(plan.nextDueDate)
              return (
                <button key={plan.id}
                  onClick={() => { set("planId", plan.id); set("equipmentId", ""); setStep("schedule") }}
                  className="portal-card p-4 w-full text-left flex items-center justify-between group hover:shadow-md transition-shadow">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 rounded font-medium"
                        style={{ background: "var(--portal-accent-muted)", color: "var(--portal-accent-text)" }}>
                        {plan.interval}
                      </span>
                      <span className="text-xs" style={{
                        color: days <= 0 ? "var(--portal-danger)" : days <= 14 ? "var(--portal-warning)" : "var(--portal-nav-text)"
                      }}>
                        Due {fmtDate(plan.nextDueDate)} {days >= 0 && `(${days}d)`}
                      </span>
                    </div>
                    <p className="text-sm font-medium" style={{ color: "var(--portal-foreground)" }}>{plan.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--portal-nav-text)" }}>{plan.equipmentName}</p>
                  </div>
                  <ChevronRight size={16} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: "var(--portal-accent)" }} />
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Ad-hoc */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--portal-nav-text)" }}>
          Ad-hoc Service Visit
        </h2>
        <div className="portal-card p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-2"
              style={{ color: "var(--portal-nav-text)" }}>Select Equipment</label>
            <select className="portal-select" value={form.equipmentId} onChange={e => set("equipmentId", e.target.value)}>
              <option value="">Choose equipment...</option>
              {myEquipment.map((eq) => (
                <option key={eq.id} value={eq.id}>{eq.model} — {eq.location}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end">
            <button
              disabled={!form.equipmentId}
              className="portal-btn-primary"
              style={{ opacity: !form.equipmentId ? 0.5 : 1, cursor: !form.equipmentId ? "not-allowed" : "pointer" }}
              onClick={() => { set("planId", ""); setStep("schedule") }}>
              Continue <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
