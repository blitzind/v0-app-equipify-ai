"use client"

import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react"
import type { GrowthAiOsOperatorSystemStatus } from "@/lib/growth/aios/operator-experience/growth-ai-os-operator-experience-types"
import { cn } from "@/lib/utils"

function statusIcon(tone: GrowthAiOsOperatorSystemStatus["tone"]) {
  if (tone === "healthy") return CheckCircle2
  if (tone === "attention") return AlertTriangle
  return XCircle
}

function statusClass(tone: GrowthAiOsOperatorSystemStatus["tone"]) {
  if (tone === "healthy") return "border-emerald-200 bg-emerald-50/60 text-emerald-950"
  if (tone === "attention") return "border-amber-200 bg-amber-50/60 text-amber-950"
  return "border-rose-200 bg-rose-50/60 text-rose-950"
}

export function GrowthAiOsOperatorSystemStatusCard({ status }: { status: GrowthAiOsOperatorSystemStatus }) {
  const Icon = statusIcon(status.tone)

  return (
    <section data-qa-section="operator-system-status" className="space-y-3">
      <h2 className="text-lg font-semibold">System Status</h2>
      <div className={cn("flex items-start gap-3 rounded-xl border px-5 py-4", statusClass(status.tone))}>
        <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
        <div>
          <p className="text-base font-semibold">{status.headline}</p>
          {status.detail ? <p className="mt-1 text-sm opacity-90">{status.detail}</p> : null}
        </div>
      </div>
    </section>
  )
}
