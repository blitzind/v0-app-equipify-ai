"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { GrowthAutomationCanvasLayout } from "@/components/growth/automation/growth-automation-canvas-layout"
import { useGrowthBreadcrumbDetail } from "@/components/growth/shell/growth-breadcrumb-context"
import {
  type GrowthAutomationEdge,
  type GrowthAutomationFlow,
  type GrowthAutomationFlowVersion,
  type GrowthAutomationNode,
} from "@/lib/growth/automation/growth-automation-types"

type FlowResponse = {
  ok: boolean
  flow: GrowthAutomationFlow
  version: GrowthAutomationFlowVersion
  nodes: GrowthAutomationNode[]
  edges: GrowthAutomationEdge[]
  message?: string
}

export function GrowthAutomationFlowEditor({ flowId }: { flowId: string }) {
  const [flow, setFlow] = useState<GrowthAutomationFlow | null>(null)
  const [version, setVersion] = useState<GrowthAutomationFlowVersion | null>(null)
  const [nodes, setNodes] = useState<GrowthAutomationNode[]>([])
  const [edges, setEdges] = useState<GrowthAutomationEdge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/automation/${flowId}`)
      const data = (await res.json()) as FlowResponse
      if (!res.ok) {
        setError(data.message ?? "Failed to load flow")
        return
      }
      setFlow(data.flow)
      setVersion(data.version)
      setNodes(data.nodes ?? [])
      setEdges(data.edges ?? [])
    } catch {
      setError("Automation flow unavailable")
    } finally {
      setLoading(false)
    }
  }, [flowId])

  useEffect(() => {
    void load()
  }, [load])

  useGrowthBreadcrumbDetail(flow?.name, loading)

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading flow…
      </div>
    )
  }

  if (error || !flow || !version) {
    return <p className="text-sm text-destructive">{error ?? "Flow not found"}</p>
  }

  return (
    <GrowthAutomationCanvasLayout
      flowId={flowId}
      flow={flow}
      version={version}
      nodes={nodes}
      edges={edges}
      readOnly={flow.status === "archived"}
    />
  )
}
