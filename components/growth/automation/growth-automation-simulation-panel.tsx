"use client"

import { useMemo, useState } from "react"
import { Loader2, PlayCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { GrowthAutomationSimulationTimeline } from "@/components/growth/automation/growth-automation-simulation-timeline"
import {
  GROWTH_AUTOMATION_SIMULATION_SAFETY_FLAGS,
  type GrowthAutomationSimulationInput,
  type GrowthAutomationSimulationResult,
} from "@/lib/growth/automation/growth-automation-simulation-types"
import { SEQUENCE_BRANCH_SIMULATION_SCENARIOS } from "@/lib/growth/sequences/conditions/sequence-branch-simulation-types"

type Props = {
  flowId: string
  simulation: GrowthAutomationSimulationResult | null
  loading?: boolean
  onSimulate?: (input: GrowthAutomationSimulationInput) => void
}

const DEFAULT_FIXTURE = `{
  "trigger_event": "share_page.viewed",
  "scenario": "immediate",
  "condition_overrides": {}
}`

export function GrowthAutomationSimulationPanel({ flowId, simulation, loading, onSimulate }: Props) {
  const [fixtureText, setFixtureText] = useState(DEFAULT_FIXTURE)
  const [fixtureError, setFixtureError] = useState<string | null>(null)

  const parsedFixture = useMemo(() => {
    try {
      const parsed = JSON.parse(fixtureText) as Record<string, unknown>
      setFixtureError(null)
      return parsed
    } catch {
      return null
    }
  }, [fixtureText])

  const handleRun = () => {
    if (!parsedFixture) {
      setFixtureError("Fixture JSON is invalid.")
      return
    }
    setFixtureError(null)
    onSimulate?.({
      triggerEvent: typeof parsedFixture.trigger_event === "string" ? parsedFixture.trigger_event : undefined,
      scenario:
        typeof parsedFixture.scenario === "string" &&
        (SEQUENCE_BRANCH_SIMULATION_SCENARIOS as readonly string[]).includes(parsedFixture.scenario)
          ? (parsedFixture.scenario as GrowthAutomationSimulationInput["scenario"])
          : undefined,
      conditionOverrides:
        parsedFixture.condition_overrides && typeof parsedFixture.condition_overrides === "object"
          ? (parsedFixture.condition_overrides as Record<string, boolean>)
          : undefined,
      leadAttributes:
        parsedFixture.lead_attributes && typeof parsedFixture.lead_attributes === "object"
          ? (parsedFixture.lead_attributes as Record<string, unknown>)
          : undefined,
      sharePageAttributes:
        parsedFixture.share_page_attributes && typeof parsedFixture.share_page_attributes === "object"
          ? (parsedFixture.share_page_attributes as Record<string, unknown>)
          : undefined,
      mediaAttributes:
        parsedFixture.media_attributes && typeof parsedFixture.media_attributes === "object"
          ? (parsedFixture.media_attributes as Record<string, unknown>)
          : undefined,
    })
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">Execution simulation</h3>
          <p className="text-xs text-muted-foreground">
            Deterministic preview · fixtures only · no runtime execution
          </p>
        </div>
        <Button size="sm" variant="outline" disabled={loading} onClick={handleRun}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <PlayCircle className="size-4" />}
          Run simulation
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
        {GROWTH_AUTOMATION_SIMULATION_SAFETY_FLAGS.simulation_preview_only ? <span>preview only</span> : null}
        {GROWTH_AUTOMATION_SIMULATION_SAFETY_FLAGS.no_sequence_execution ? <span>no execution</span> : null}
        {GROWTH_AUTOMATION_SIMULATION_SAFETY_FLAGS.no_background_jobs ? <span>no jobs</span> : null}
      </div>

      <div className="mt-4 space-y-2">
        <label className="text-xs font-medium">Fixture editor</label>
        <Textarea
          value={fixtureText}
          onChange={(event) => setFixtureText(event.target.value)}
          rows={6}
          className="font-mono text-xs"
        />
        {fixtureError ? <p className="text-xs text-destructive">{fixtureError}</p> : null}
        <Input
          readOnly
          value={flowId}
          className="text-xs"
          aria-label="Flow id"
        />
      </div>

      {simulation ? (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-md border border-border/70 p-2">
              <p className="text-muted-foreground">Status</p>
              <p className="font-medium">{simulation.status}</p>
            </div>
            <div className="rounded-md border border-border/70 p-2">
              <p className="text-muted-foreground">Timeline</p>
              <p className="font-medium">{simulation.stats.timelineCount}</p>
            </div>
            <div className="rounded-md border border-border/70 p-2">
              <p className="text-muted-foreground">Branches</p>
              <p className="font-medium">{simulation.stats.branchDecisionCount}</p>
            </div>
            <div className="rounded-md border border-border/70 p-2">
              <p className="text-muted-foreground">Waits</p>
              <p className="font-medium">{simulation.stats.waitCount}</p>
            </div>
          </div>

          {simulation.errors.length > 0 ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
              {simulation.errors.map((issue) => (
                <p key={`${issue.ruleCode}-${issue.message}`}>{issue.message}</p>
              ))}
            </div>
          ) : null}

          {simulation.warnings.length > 0 ? (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-700 dark:text-amber-300">
              {simulation.warnings.map((issue) => (
                <p key={`${issue.ruleCode}-${issue.message}`}>{issue.message}</p>
              ))}
            </div>
          ) : null}

          {simulation.branchDecisions.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-medium">Branch decisions</p>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {simulation.branchDecisions.map((decision) => (
                  <li key={`${decision.edgeId}-${decision.decision}`}>
                    {decision.decision}: {decision.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {simulation.waitStates.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-medium">Wait states</p>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {simulation.waitStates.map((wait) => (
                  <li key={wait.nodeId}>
                    {wait.waitKind} · {wait.resolution} · {wait.detail}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {simulation.approvalGates.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-medium">Approval gates</p>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {simulation.approvalGates.map((gate) => (
                  <li key={gate.nodeId}>
                    requires approval · approved={String(gate.approved)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <GrowthAutomationSimulationTimeline simulation={simulation} loading={loading} />
        </div>
      ) : (
        <div className="mt-4">
          <GrowthAutomationSimulationTimeline simulation={null} loading={loading} />
        </div>
      )}

      <p className="mt-3 text-[10px] text-muted-foreground">
        Flow {flowId.slice(0, 8)}… · compileId {simulation?.compileId?.slice(0, 8) ?? "—"} · execution disabled in S5-E
      </p>
    </div>
  )
}
