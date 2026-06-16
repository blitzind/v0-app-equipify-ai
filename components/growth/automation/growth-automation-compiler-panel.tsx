"use client"

import { Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthAutomationCompiledArtifactPreview } from "@/components/growth/automation/growth-automation-compiled-artifact-preview"
import type { GrowthAutomationCompileResult } from "@/lib/growth/automation/growth-automation-compiler-types"
import { GROWTH_AUTOMATION_COMPILER_SAFETY_FLAGS } from "@/lib/growth/automation/growth-automation-compiler-types"

type Props = {
  flowId: string
  compile: GrowthAutomationCompileResult | null
  loading?: boolean
  onCompile?: () => void
}

export function GrowthAutomationCompilerPanel({ flowId, compile, loading, onCompile }: Props) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">SR-3 compile preview</h3>
          <p className="text-xs text-muted-foreground">
            Preview-only compiler · no pattern writes · no runtime activation
          </p>
        </div>
        <Button size="sm" variant="outline" disabled={loading} onClick={onCompile}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          Compile preview
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
        {GROWTH_AUTOMATION_COMPILER_SAFETY_FLAGS.compile_preview_only ? <span>preview only</span> : null}
        {GROWTH_AUTOMATION_COMPILER_SAFETY_FLAGS.no_sequence_pattern_writes ? (
          <span>no pattern writes</span>
        ) : null}
        {GROWTH_AUTOMATION_COMPILER_SAFETY_FLAGS.no_sequence_execution ? <span>no execution</span> : null}
      </div>

      <div className="mt-4">
        <GrowthAutomationCompiledArtifactPreview compile={compile} loading={loading} />
      </div>

      <p className="mt-3 text-[10px] text-muted-foreground">Flow {flowId.slice(0, 8)}… · publish not available in S5-D</p>
    </div>
  )
}
