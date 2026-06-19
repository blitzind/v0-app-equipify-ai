"use client"

import { useState } from "react"
import { Copy } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { GrowthAutomationAnalyticsPanel } from "@/components/growth/automation/growth-automation-analytics-panel"
import { GrowthAutomationApprovalQueue } from "@/components/growth/automation/growth-automation-approval-queue"
import { GrowthAutomationCompilerPanel } from "@/components/growth/automation/growth-automation-compiler-panel"
import { GrowthAutomationEnrollmentPanel } from "@/components/growth/automation/growth-automation-enrollment-panel"
import { GrowthAutomationNodeInspector } from "@/components/growth/automation/growth-automation-node-inspector"
import { GrowthAutomationVideoAttachmentPicker } from "@/components/growth/automation/growth-automation-video-attachment-picker"
import { GrowthAutomationObservabilityPanel } from "@/components/growth/automation/growth-automation-observability-panel"
import { GrowthAutomationPublishPanel } from "@/components/growth/automation/growth-automation-publish-panel"
import { GrowthAutomationRuntimePreviewPanel } from "@/components/growth/automation/growth-automation-runtime-preview-panel"
import { GrowthAutomationRuntimeStatusPanel } from "@/components/growth/automation/growth-automation-runtime-status-panel"
import { GrowthAutomationSimulationPanel } from "@/components/growth/automation/growth-automation-simulation-panel"
import { GrowthAutomationValidationPanel } from "@/components/growth/automation/growth-automation-validation-panel"
import { GROWTH_AUTOMATION_API_SAFETY_FLAGS } from "@/lib/growth/automation/growth-automation-types"
import type { GrowthAutomationCompileResult } from "@/lib/growth/automation/growth-automation-compiler-types"
import type { GrowthAutomationSimulationInput, GrowthAutomationSimulationResult } from "@/lib/growth/automation/growth-automation-simulation-types"
import type { GrowthAutomationNode, GrowthAutomationValidationResult } from "@/lib/growth/automation/growth-automation-types"

type InspectorTab = "build" | "test" | "runtime" | "monitor"

type Props = {
  flowId: string
  versionId: string
  runtimeActive: boolean
  inspectorNode: GrowthAutomationNode | null
  validation: GrowthAutomationValidationResult | null
  validating: boolean
  onValidate: () => void
  compile: GrowthAutomationCompileResult | null
  compiling: boolean
  onCompile: () => void
  simulation: GrowthAutomationSimulationResult | null
  simulating: boolean
  onSimulate: (input: GrowthAutomationSimulationInput) => void
}

export function GrowthAutomationInspectorSidebar({
  flowId,
  versionId,
  runtimeActive,
  inspectorNode,
  validation,
  validating,
  onValidate,
  compile,
  compiling,
  onCompile,
  simulation,
  simulating,
  onSimulate,
}: Props) {
  const [activeTab, setActiveTab] = useState<InspectorTab>("build")

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-border bg-card">
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as InspectorTab)}
        className="flex h-full min-h-0 flex-col gap-0"
      >
        <div className="shrink-0 border-b border-border px-3 py-2">
          <TabsList className="grid h-auto w-full grid-cols-4 gap-1 p-1">
            <TabsTrigger value="build" className="px-1.5 py-1.5 text-xs">
              Build
            </TabsTrigger>
            <TabsTrigger value="test" className="px-1.5 py-1.5 text-xs">
              Test
            </TabsTrigger>
            <TabsTrigger value="runtime" className="px-1.5 py-1.5 text-xs">
              Runtime
            </TabsTrigger>
            <TabsTrigger value="monitor" className="px-1.5 py-1.5 text-xs">
              Monitor
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <TabsContent value="build" className="mt-0 space-y-3">
            {activeTab === "build" ? (
              <>
                <GrowthAutomationNodeInspector node={inspectorNode} />
                <GrowthAutomationVideoAttachmentPicker flowId={flowId} node={inspectorNode} />
                <GrowthAutomationValidationPanel
                  validation={validation}
                  loading={validating}
                  onValidate={onValidate}
                />
              </>
            ) : null}
          </TabsContent>

          <TabsContent value="test" className="mt-0 space-y-3">
            {activeTab === "test" ? (
              <>
                <GrowthAutomationCompilerPanel
                  flowId={flowId}
                  compile={compile}
                  loading={compiling}
                  onCompile={onCompile}
                />
                <GrowthAutomationSimulationPanel
                  flowId={flowId}
                  simulation={simulation}
                  loading={simulating}
                  onSimulate={onSimulate}
                />
              </>
            ) : null}
          </TabsContent>

          <TabsContent value="runtime" className="mt-0 space-y-3">
            {activeTab === "runtime" ? (
              <>
                <GrowthAutomationPublishPanel flowId={flowId} versionId={versionId} />
                <GrowthAutomationRuntimePreviewPanel flowId={flowId} versionId={versionId} />
                <GrowthAutomationRuntimeStatusPanel flowId={flowId} />
                <GrowthAutomationEnrollmentPanel flowId={flowId} runtimeActive={runtimeActive} />
              </>
            ) : null}
          </TabsContent>

          <TabsContent value="monitor" className="mt-0 space-y-3">
            {activeTab === "monitor" ? (
              <>
                <GrowthAutomationObservabilityPanel flowId={flowId} />
                <GrowthAutomationAnalyticsPanel flowId={flowId} />
                <GrowthAutomationApprovalQueue flowId={flowId} />
              </>
            ) : null}
          </TabsContent>
        </div>
      </Tabs>

      <div className="shrink-0 border-t border-dashed border-border px-3 py-2 text-[11px] text-muted-foreground">
        <Copy className="mb-0.5 inline size-3" /> Cmd/Ctrl+C/V · Delete removes selection ·{" "}
        {GROWTH_AUTOMATION_API_SAFETY_FLAGS.read_only_runtime ? "read-only runtime" : ""}
      </div>
    </div>
  )
}
