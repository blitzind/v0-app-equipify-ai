"use client"

import Link from "next/link"
import { Calendar, CheckCircle2, Clock, ChevronRight, ArrowUpRight } from "lucide-react"
import { maintenancePlans } from "@/lib/mock-data"

const CUSTOMER_ID = "CUS-001"
const myPlans = maintenancePlans.filter((p) => p.customerId === CUSTOMER_ID)

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}
function daysUntil(d: string) {
  return Math.round((new Date(d).getTime() - Date.now()) / 86_400_000)
}
function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)
}

export default function PortalMaintenancePage() {
  const active  = myPlans.filter(p => p.status === "Active")
  const paused  = myPlans.filter(p => p.status === "Paused")

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--portal-foreground)" }}>Maintenance Plans</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--portal-nav-text)" }}>
            Your scheduled preventive maintenance agreements
          </p>
        </div>
        <Link href="/portal/book-maintenance" className="portal-btn-primary">
          <Calendar size={14} /> Book a Service
        </Link>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Active Plans", value: active.length, accent: true },
          { label: "Paused", value: paused.length },
          { label: "Total Completed", value: myPlans.reduce((s, p) => s + p.totalServicesCompleted, 0) },
        ].map(({ label, value, accent }) => (
          <div key={label} className="portal-card p-4 text-center">
            <p className="text-2xl font-semibold tabular-nums"
              style={{ color: accent ? "var(--portal-accent)" : "var(--portal-foreground)" }}>{value}</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--portal-nav-text)" }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Active plans */}
      {active.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold" style={{ color: "var(--portal-foreground)" }}>Active Plans</h2>
          {active.map((plan) => {
            const days = daysUntil(plan.nextDueDate)
            const estCost = plan.services.reduce((s, svc) => s + svc.estimatedCost, 0)
            const estHours = plan.services.reduce((s, svc) => s + svc.estimatedHours, 0)
            return (
              <div key={plan.id} className="portal-card p-6">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ background: "#f0fdf4", color: "#15803d" }}>Active</span>
                      <span className="text-xs px-2 py-0.5 rounded"
                        style={{ background: "var(--portal-accent-muted)", color: "var(--portal-accent-text)" }}>
                        {plan.interval}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold" style={{ color: "var(--portal-foreground)" }}>{plan.name}</h3>
                    <p className="text-sm mt-0.5" style={{ color: "var(--portal-nav-text)" }}>{plan.equipmentName}</p>
                  </div>
                  <Link href={`/portal/book-maintenance?plan=${plan.id}`} className="portal-btn-secondary shrink-0">
                    <Calendar size={13} /> Book Next Visit
                  </Link>
                </div>

                {/* Next due banner */}
                <div className="mb-5 px-4 py-3 rounded-lg flex items-center justify-between"
                  style={{
                    background: days < 0 ? "var(--portal-danger-muted)" : days <= 14 ? "var(--portal-warning-muted)" : "var(--portal-accent-muted)",
                    border: `1px solid ${days < 0 ? "#fecaca" : days <= 14 ? "#fed7aa" : "#bfdbfe"}`,
                  }}>
                  <div className="flex items-center gap-2">
                    {days <= 0 ? <Clock size={14} style={{ color: "var(--portal-danger)" }} /> :
                      <Clock size={14} style={{ color: days <= 14 ? "var(--portal-warning)" : "var(--portal-accent)" }} />}
                    <span className="text-sm font-medium"
                      style={{ color: days < 0 ? "var(--portal-danger)" : days <= 14 ? "var(--portal-warning)" : "var(--portal-accent-text)" }}>
                      {days < 0 ? `Overdue by ${Math.abs(days)} days` : `Due ${fmtDate(plan.nextDueDate)} — ${days} days from now`}
                    </span>
                  </div>
                  <span className="text-xs" style={{ color: "var(--portal-nav-text)" }}>
                    Last: {fmtDate(plan.lastServiceDate)}
                  </span>
                </div>

                {/* Services */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-3"
                    style={{ color: "var(--portal-nav-text)" }}>Included Services</p>
                  <div className="space-y-2">
                    {plan.services.map((svc) => (
                      <div key={svc.id} className="flex items-start justify-between gap-4 p-3 rounded-lg"
                        style={{ background: "var(--portal-surface-2)" }}>
                        <div className="flex items-start gap-2">
                          <CheckCircle2 size={14} className="mt-0.5 shrink-0" style={{ color: "var(--portal-success)" }} />
                          <div>
                            <p className="text-xs font-medium" style={{ color: "var(--portal-foreground)" }}>{svc.name}</p>
                            <p className="text-[11px] mt-0.5" style={{ color: "var(--portal-nav-text)" }}>{svc.description}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-medium" style={{ color: "var(--portal-foreground)" }}>
                            {fmtCurrency(svc.estimatedCost)}
                          </p>
                          <p className="text-[11px]" style={{ color: "var(--portal-nav-text)" }}>
                            {svc.estimatedHours}h
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t"
                    style={{ borderColor: "var(--portal-border-light)" }}>
                    <span className="text-xs" style={{ color: "var(--portal-nav-text)" }}>
                      Est. {estHours.toFixed(1)} hours
                    </span>
                    <span className="text-sm font-semibold" style={{ color: "var(--portal-foreground)" }}>
                      Est. {fmtCurrency(estCost)} per visit
                    </span>
                  </div>
                </div>

                {/* Notification preferences */}
                <div className="mt-5 pt-4 border-t" style={{ borderColor: "var(--portal-border-light)" }}>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-2"
                    style={{ color: "var(--portal-nav-text)" }}>Reminders</p>
                  <div className="flex flex-wrap gap-2">
                    {plan.notificationRules.filter(r => r.enabled).slice(0, 5).map((rule) => (
                      <span key={rule.id} className="text-xs px-2 py-1 rounded-md"
                        style={{ background: "var(--portal-hover)", color: "var(--portal-nav-text)" }}>
                        {rule.channel} · {rule.triggerDays}d before
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Paused */}
      {paused.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--portal-nav-text)" }}>Paused Plans</h2>
          {paused.map((plan) => (
            <div key={plan.id} className="portal-card p-5 opacity-70">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ background: "#f3f4f6", color: "#6b7280" }}>Paused</span>
                  </div>
                  <p className="text-sm font-medium" style={{ color: "var(--portal-foreground)" }}>{plan.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--portal-nav-text)" }}>{plan.equipmentName}</p>
                  <p className="text-xs mt-1 italic" style={{ color: "var(--portal-nav-text)" }}>{plan.notes}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
