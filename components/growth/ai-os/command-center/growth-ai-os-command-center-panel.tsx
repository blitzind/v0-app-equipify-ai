"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { GrowthAiOsCommandCenterDiagnosticsSections } from "@/components/growth/ai-os/command-center/growth-ai-os-command-center-diagnostics-sections"
import { GrowthAiOsOperationsDashboard } from "@/components/growth/ai-os/operations/growth-ai-os-operations-dashboard"
import type { AiOsCommandCenterReadModel } from "@/lib/growth/aios/ai-os-command-center-types"
import { GROWTH_AI_OS_COMMAND_CENTER_QA_MARKER } from "@/lib/growth/aios/ai-os-command-center-types"

type ApiResponse = {
  ok?: boolean
  commandCenter?: AiOsCommandCenterReadModel
  message?: string
  error?: string
}

export function GrowthAiOsCommandCenterPanel() {
  const [model, setModel] = useState<AiOsCommandCenterReadModel | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showEngineeringDiagnostics, setShowEngineeringDiagnostics] = useState(false)

  const load = useCallback(async () => {
    const response = await fetch("/api/platform/growth/ai-os/command-center", { cache: "no-store" })
    const body = (await response.json()) as ApiResponse
    if (!response.ok || !body.ok || !body.commandCenter) {
      throw new Error(body.message ?? body.error ?? "Could not load AI Operations.")
    }
    setModel(body.commandCenter)
  }, [])

  useEffect(() => {
    void load()
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "Could not load AI Operations.")
      })
      .finally(() => setLoading(false))
  }, [load])

  if (loading && !model) {
    return <p className="text-sm text-muted-foreground">Loading AI Operations…</p>
  }

  if (error && !model) {
    return <p className="text-sm text-destructive">{error}</p>
  }

  if (!model) return null

  return (
    <div className="space-y-6" data-qa-marker={GROWTH_AI_OS_COMMAND_CENTER_QA_MARKER}>
      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/20 px-4 py-3"
        data-qa-section="engineering-diagnostics-toggle"
      >
        <div>
          <p className="text-sm font-medium">Show Engineering Diagnostics</p>
          <p className="text-xs text-muted-foreground">
            Off by default — reveals full AI OS phase sections (1A–5B) for engineering review.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="growth-ai-os-engineering-diagnostics"
            checked={showEngineeringDiagnostics}
            onCheckedChange={setShowEngineeringDiagnostics}
          />
          <Label htmlFor="growth-ai-os-engineering-diagnostics" className="text-sm">
            {showEngineeringDiagnostics ? "On" : "Off"}
          </Label>
        </div>
      </div>

      <GrowthAiOsOperationsDashboard dashboard={model.operationsDashboard} />

      {showEngineeringDiagnostics ? (
        <GrowthAiOsCommandCenterDiagnosticsSections model={model} onRefresh={() => void load()} />
      ) : null}

      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/growth/objectives" className="font-medium text-indigo-600 hover:text-indigo-700">
          Growth objectives
        </Link>
      </div>

      <p className="text-xs text-muted-foreground">
        Read-only AI Operations · generated {new Date(model.generatedAt).toLocaleString()}
      </p>
    </div>
  )
}
