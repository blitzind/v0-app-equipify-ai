"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import type { ReactFlowInstance } from "reactflow"
import { ArrowLeft, Copy, Download, Loader2, Save, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GrowthAutomationPublishPanel } from "@/components/growth/automation/growth-automation-publish-panel"
import { GrowthAutomationPublishStatusBadge } from "@/components/growth/automation/growth-automation-publish-status-badge"
import { GrowthAutomationCompilerPanel } from "@/components/growth/automation/growth-automation-compiler-panel"
import { GrowthAutomationEnrollmentPanel } from "@/components/growth/automation/growth-automation-enrollment-panel"
import { GrowthAutomationRuntimePreviewPanel } from "@/components/growth/automation/growth-automation-runtime-preview-panel"
import { GrowthAutomationRuntimeStatusPanel } from "@/components/growth/automation/growth-automation-runtime-status-panel"
import { GrowthAutomationObservabilityPanel } from "@/components/growth/automation/growth-automation-observability-panel"
import { GrowthAutomationAnalyticsPanel } from "@/components/growth/automation/growth-automation-analytics-panel"
import { GrowthAutomationSimulationPanel } from "@/components/growth/automation/growth-automation-simulation-panel"
import { GrowthAutomationEdgeToolbar } from "@/components/growth/automation/growth-automation-edge-toolbar"
import {
  GrowthAutomationHistoryProvider,
  useGrowthAutomationHistory,
} from "@/components/growth/automation/growth-automation-history-provider"
import { GrowthAutomationNodeCreationMenu } from "@/components/growth/automation/growth-automation-node-creation-menu"
import { GrowthAutomationNodeInspector } from "@/components/growth/automation/growth-automation-node-inspector"
import { GrowthAutomationNodeToolbar } from "@/components/growth/automation/growth-automation-node-toolbar"
import { GrowthAutomationReactFlow } from "@/components/growth/automation/growth-automation-react-flow"
import { GrowthAutomationValidationPanel } from "@/components/growth/automation/growth-automation-validation-panel"
import { autoLayoutCanvasNodes } from "@/lib/growth/automation/growth-automation-canvas-layout"
import {
  GROWTH_AUTOMATION_CANVAS_QA_MARKER,
  GROWTH_AUTOMATION_CANVAS_SAFETY_FLAGS,
  type AutomationCanvasEdge,
  type AutomationCanvasNode,
  type GrowthAutomationCanvasEdgeType,
  type GrowthAutomationCanvasLayoutMode,
  type GrowthAutomationCanvasNodeType,
} from "@/lib/growth/automation/growth-automation-canvas-types"
import {
  applyValidationOverlays,
  exportCanvasState,
  flowToReactFlow,
  importCanvasState,
  reactFlowToPersistence,
} from "@/lib/growth/automation/growth-automation-canvas-serialization"
import {
  canvasSnapshotsEqual,
  cloneCanvasState,
  createCanvasNode,
  filterCanvasNodesBySearch,
  sameSelectedNodeIds,
} from "@/lib/growth/automation/growth-automation-canvas-utils"
import {
  GROWTH_AUTOMATION_API_SAFETY_FLAGS,
  type GrowthAutomationEdge,
  type GrowthAutomationFlow,
  type GrowthAutomationFlowVersion,
  type GrowthAutomationNode,
  type GrowthAutomationValidationResult,
} from "@/lib/growth/automation/growth-automation-types"
import type { GrowthAutomationCompileResult } from "@/lib/growth/automation/growth-automation-compiler-types"
import type {
  GrowthAutomationSimulationInput,
  GrowthAutomationSimulationResult,
} from "@/lib/growth/automation/growth-automation-simulation-types"

type FlowResponse = {
  ok: boolean
  flow: GrowthAutomationFlow
  version: GrowthAutomationFlowVersion
  nodes: GrowthAutomationNode[]
  edges: GrowthAutomationEdge[]
}

function mapInspectorNode(node: AutomationCanvasNode | null): GrowthAutomationNode | null {
  if (!node) return null
  return {
    id: node.data.persistenceNodeId ?? node.id,
    versionId: "",
    nodeType:
      node.data.canvasNodeType === "goal"
        ? "exit"
        : node.data.canvasNodeType === "condition"
          ? "condition"
          : (node.data.canvasNodeType as GrowthAutomationNode["nodeType"]),
    label: node.data.label,
    positionX: node.position.x,
    positionY: node.position.y,
    configJson: node.data.config,
    validationState: node.data.validation,
    compiledPatternStepId: null,
    createdAt: "",
    updatedAt: "",
  }
}

function CanvasEditorInner({
  flowId,
  flow,
  version,
  readOnly,
}: {
  flowId: string
  flow: GrowthAutomationFlow
  version: GrowthAutomationFlowVersion
  readOnly: boolean
}) {
  const { snapshot, setSnapshot, undo, redo, canUndo, canRedo } = useGrowthAutomationHistory()
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([])
  const [selectedEdgeType, setSelectedEdgeType] = useState<GrowthAutomationCanvasEdgeType>("default")
  const [search, setSearch] = useState("")
  const [validation, setValidation] = useState<GrowthAutomationValidationResult | null>(null)
  const [compile, setCompile] = useState<GrowthAutomationCompileResult | null>(null)
  const [simulation, setSimulation] = useState<GrowthAutomationSimulationResult | null>(null)
  const [validating, setValidating] = useState(false)
  const [compiling, setCompiling] = useState(false)
  const [simulating, setSimulating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const clipboardRef = useRef<{ nodes: AutomationCanvasNode[]; edges: AutomationCanvasEdge[] } | null>(null)
  const reactFlowRef = useRef<ReactFlowInstance | null>(null)

  const nodes = snapshot.nodes
  const edges = snapshot.edges

  const selectedNode = useMemo(
    () => nodes.find((node) => selectedNodeIds.includes(node.id)) ?? null,
    [nodes, selectedNodeIds],
  )

  const visibleNodes = useMemo(() => filterCanvasNodesBySearch(nodes, search), [nodes, search])

  const updateCanvas = useCallback(
    (nextNodes: AutomationCanvasNode[], nextEdges: AutomationCanvasEdge[], recordHistory = true) => {
      if (canvasSnapshotsEqual({ nodes, edges }, { nodes: nextNodes, edges: nextEdges })) return
      setSnapshot({ nodes: nextNodes, edges: nextEdges }, recordHistory)
    },
    [edges, nodes, setSnapshot],
  )

  const handleNodesChange = useCallback(
    (nextNodes: AutomationCanvasNode[], options?: { recordHistory?: boolean }) => {
      updateCanvas(nextNodes, edges, options?.recordHistory ?? true)
    },
    [edges, updateCanvas],
  )

  const handleEdgesChange = useCallback(
    (nextEdges: AutomationCanvasEdge[], options?: { recordHistory?: boolean }) => {
      updateCanvas(nodes, nextEdges, options?.recordHistory ?? true)
    },
    [nodes, updateCanvas],
  )

  const handleSelectionChange = useCallback(({ nodeIds }: { nodeIds: string[]; edgeIds: string[] }) => {
    setSelectedNodeIds((current) => (sameSelectedNodeIds(current, nodeIds) ? current : nodeIds))
  }, [])

  const handleReactFlowInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowRef.current = instance
  }, [])

  const addNode = useCallback(
    (nodeType: GrowthAutomationCanvasNodeType) => {
      if (readOnly) return
      const id = crypto.randomUUID()
      const nextNode = createCanvasNode({
        id,
        nodeType,
        position: { x: 120 + nodes.length * 40, y: 120 + (nodes.length % 4) * 90 },
      })
      updateCanvas([...nodes, nextNode], edges)
    },
    [edges, nodes, readOnly, updateCanvas],
  )

  const runValidation = useCallback(async () => {
    setValidating(true)
    try {
      const res = await fetch(`/api/platform/growth/automation/${flowId}/validate`, { method: "POST" })
      const data = (await res.json()) as { validation: GrowthAutomationValidationResult }
      if (res.ok) {
        setValidation(data.validation)
        updateCanvas(applyValidationOverlays(nodes, data.validation), edges, false)
      }
    } finally {
      setValidating(false)
    }
  }, [edges, flowId, nodes, updateCanvas])

  const runCompilePreview = useCallback(async () => {
    setCompiling(true)
    try {
      const res = await fetch(`/api/platform/growth/automation/${flowId}/compile`, { method: "POST" })
      const data = (await res.json()) as { compile?: GrowthAutomationCompileResult }
      if (res.ok && data.compile) setCompile(data.compile)
    } finally {
      setCompiling(false)
    }
  }, [flowId])

  const runSimulationPreview = useCallback(
    async (simulationInput: GrowthAutomationSimulationInput) => {
      setSimulating(true)
      try {
        const res = await fetch(`/api/platform/growth/automation/${flowId}/simulate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trigger_event: simulationInput.triggerEvent,
            scenario: simulationInput.scenario,
            condition_overrides: simulationInput.conditionOverrides,
            lead_attributes: simulationInput.leadAttributes,
            share_page_attributes: simulationInput.sharePageAttributes,
            media_attributes: simulationInput.mediaAttributes,
            booking_attributes: simulationInput.bookingAttributes,
            high_intent_attributes: simulationInput.highIntentAttributes,
            trigger_fixtures: simulationInput.triggerFixtures,
          }),
        })
        const data = (await res.json()) as { simulation?: GrowthAutomationSimulationResult }
        if (data.simulation) setSimulation(data.simulation)
      } finally {
        setSimulating(false)
      }
    },
    [flowId],
  )

  const saveCanvas = useCallback(async () => {
    if (readOnly) return
    setSaving(true)
    setMessage(null)
    try {
      const persistence = reactFlowToPersistence({ nodes, edges })

      for (const node of persistence.nodes) {
        if (node.persistenceId) {
          await fetch(`/api/platform/growth/automation/${flowId}/nodes`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              node_id: node.persistenceId,
              label: node.label,
              position_x: node.positionX,
              position_y: node.positionY,
              config_json: node.configJson,
            }),
          })
        } else {
          const res = await fetch(`/api/platform/growth/automation/${flowId}/nodes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              node_type: node.nodeType,
              label: node.label,
              position_x: node.positionX,
              position_y: node.positionY,
              config_json: node.configJson,
            }),
          })
          const data = (await res.json()) as { node?: GrowthAutomationNode }
          if (data.node) {
            const canvasNode = nodes.find((entry) => entry.id === node.clientId)
            if (canvasNode) {
              canvasNode.data.persistenceNodeId = data.node.id
            }
          }
        }
      }

      for (const edge of persistence.edges) {
        if (edge.persistenceId) continue
        const fromNode = nodes.find((entry) => entry.id === edge.fromNodeId)
        const toNode = nodes.find((entry) => entry.id === edge.toNodeId)
        const fromId = fromNode?.data.persistenceNodeId ?? fromNode?.id
        const toId = toNode?.data.persistenceNodeId ?? toNode?.id
        if (!fromId || !toId) continue
        await fetch(`/api/platform/growth/automation/${flowId}/edges`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            from_node_id: fromId,
            to_node_id: toId,
            edge_type: edge.edgeType,
          }),
        })
      }

      setMessage("Canvas saved.")
    } catch {
      setMessage("Save failed.")
    } finally {
      setSaving(false)
    }
  }, [edges, flowId, nodes, readOnly])

  const handleAutoLayout = useCallback(
    (mode: GrowthAutomationCanvasLayoutMode) => {
      updateCanvas(autoLayoutCanvasNodes(nodes, edges, mode), edges)
      reactFlowRef.current?.fitView({ padding: 0.2 })
    },
    [edges, nodes, updateCanvas],
  )

  const handleExport = useCallback(() => {
    const payload = exportCanvasState({ nodes, edges })
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `${flow.name.replace(/\s+/g, "-").toLowerCase()}-canvas.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }, [edges, flow.name, nodes])

  const handleImport = useCallback(async () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "application/json"
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const text = await file.text()
      const imported = importCanvasState(JSON.parse(text))
      updateCanvas(imported.nodes, imported.edges)
    }
    input.click()
  }, [updateCanvas])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (readOnly) return
      const meta = event.metaKey || event.ctrlKey
      if (meta && event.key === "z" && !event.shiftKey) {
        event.preventDefault()
        undo()
      }
      if ((meta && event.key === "z" && event.shiftKey) || (meta && event.key === "y")) {
        event.preventDefault()
        redo()
      }
      if (meta && event.key === "c") {
        const selected = nodes.filter((node) => selectedNodeIds.includes(node.id))
        if (selected.length === 0) return
        clipboardRef.current = cloneCanvasState({ nodes: selected, edges: [] })
      }
      if (meta && event.key === "v" && clipboardRef.current) {
        event.preventDefault()
        const pasted = clipboardRef.current.nodes.map((node) =>
          createCanvasNode({
            id: crypto.randomUUID(),
            nodeType: node.data.canvasNodeType,
            position: { x: node.position.x + 40, y: node.position.y + 40 },
            label: `${node.data.label} copy`,
            description: node.data.description,
            config: node.data.config,
          }),
        )
        updateCanvas([...nodes, ...pasted], edges)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [edges, nodes, readOnly, redo, selectedNodeIds, undo, updateCanvas])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/growth/automation">
            <ArrowLeft className="size-4" />
            Back to library
          </Link>
        </Button>
        <p className="text-xs text-muted-foreground" data-qa-marker={GROWTH_AUTOMATION_CANVAS_QA_MARKER}>
          Visual builder · {GROWTH_AUTOMATION_CANVAS_SAFETY_FLAGS.no_sequence_execution ? "no execution" : ""}
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium">{flow.name}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <GrowthAutomationPublishStatusBadge status={flow.status} />
              <span className="text-xs text-muted-foreground">v{version.versionNumber}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={readOnly || saving} onClick={() => void saveCanvas()}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={handleExport}>
              <Download className="size-4" />
              Export JSON
            </Button>
            <Button size="sm" variant="outline" disabled={readOnly} onClick={() => void handleImport()}>
              <Upload className="size-4" />
              Import JSON
            </Button>
          </div>
        </div>
        {message ? <p className="mt-2 text-sm text-muted-foreground">{message}</p> : null}
      </div>

      <GrowthAutomationNodeToolbar
        disabled={readOnly}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        onAutoLayout={handleAutoLayout}
      />

      <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)_300px]">
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-medium">Add nodes</h3>
            <div className="mt-3">
              <GrowthAutomationNodeCreationMenu disabled={readOnly} onAddNode={addNode} />
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-medium">Edge type</h3>
            <div className="mt-3">
              <GrowthAutomationEdgeToolbar
                selectedEdgeType={selectedEdgeType}
                disabled={readOnly}
                onSelectEdgeType={setSelectedEdgeType}
              />
            </div>
          </div>
          <Input placeholder="Search nodes…" value={search} onChange={(event) => setSearch(event.target.value)} />
          {search ? (
            <p className="text-xs text-muted-foreground">{visibleNodes.length} matching nodes</p>
          ) : null}
        </div>

        <GrowthAutomationReactFlow
          nodes={nodes}
          edges={edges}
          readOnly={readOnly}
          defaultEdgeType={selectedEdgeType}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onSelectionChange={handleSelectionChange}
          onInit={handleReactFlowInit}
        />

        <div className="flex flex-col gap-4">
          <GrowthAutomationNodeInspector node={mapInspectorNode(selectedNode)} />
          <GrowthAutomationValidationPanel
            validation={validation}
            loading={validating}
            onValidate={() => void runValidation()}
          />
          <GrowthAutomationCompilerPanel
            flowId={flowId}
            compile={compile}
            loading={compiling}
            onCompile={() => void runCompilePreview()}
          />
          <GrowthAutomationSimulationPanel
            flowId={flowId}
            simulation={simulation}
            loading={simulating}
            onSimulate={(input) => void runSimulationPreview(input)}
          />
          <GrowthAutomationPublishPanel flowId={flowId} versionId={version.id} />
          <GrowthAutomationRuntimePreviewPanel flowId={flowId} versionId={version.id} />
          <GrowthAutomationRuntimeStatusPanel flowId={flowId} />
          <GrowthAutomationObservabilityPanel flowId={flowId} />
          <GrowthAutomationAnalyticsPanel flowId={flowId} />
          <GrowthAutomationEnrollmentPanel
            flowId={flowId}
            runtimeActive={flow.status === "runtime_active"}
          />
          <div className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
            <Copy className="mb-1 inline size-3.5" /> Cmd/Ctrl+C/V copy/paste · Delete removes selection ·{" "}
            {GROWTH_AUTOMATION_API_SAFETY_FLAGS.read_only_runtime ? "read-only runtime" : ""}
          </div>
        </div>
      </div>
    </div>
  )
}

export function GrowthAutomationCanvasLayout({
  flowId,
  flow,
  version,
  nodes,
  edges,
  readOnly = false,
}: {
  flowId: string
  flow: GrowthAutomationFlow
  version: GrowthAutomationFlowVersion
  nodes: GrowthAutomationNode[]
  edges: GrowthAutomationEdge[]
  readOnly?: boolean
}) {
  const initial = useMemo(() => flowToReactFlow({ nodes, edges }), [edges, nodes])

  return (
    <GrowthAutomationHistoryProvider initialSnapshot={initial}>
      <CanvasEditorInner flowId={flowId} flow={flow} version={version} readOnly={readOnly} />
    </GrowthAutomationHistoryProvider>
  )
}
