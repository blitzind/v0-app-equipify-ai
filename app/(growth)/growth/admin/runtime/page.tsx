"use client"

import { Activity } from "lucide-react"
import { useEffect, useState } from "react"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import { GrowthRuntimeObservabilityDashboard } from "@/components/growth/growth-runtime-observability-dashboard"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"

export default function GrowthRuntimeAdminPage() {
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setLoaded(true)
  }, [])

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-slate-700">
            <Activity size={17} />
          </span>
          <div>
            <h1 className={PAGE_STANDARD_PAGE_TITLE}>Runtime Guardrails</h1>
            <p className="text-sm text-muted-foreground">
              Read-only budgets, queues, throttles, and kill switch states — infrastructure hardening only.
            </p>
          </div>
        </div>
      </section>

      <GrowthSectionLayout>
        {loaded ? <GrowthRuntimeObservabilityDashboard /> : null}
      </GrowthSectionLayout>
    </div>
  )
}
