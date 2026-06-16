"use client"

import { useCallback, useState } from "react"
import { Loader2, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  GROWTH_AUTOMATION_ENROLLMENT_SUPPORTED_TRIGGERS,
  GROWTH_AUTOMATION_ENROLLMENT_SAFETY_FLAGS,
  type GrowthAutomationRuntimeMatch,
} from "@/lib/growth/automation/growth-automation-enrollment-types"

type Props = {
  compact?: boolean
}

type MatchResponse = {
  ok?: boolean
  match?: {
    ok: boolean
    matches: GrowthAutomationRuntimeMatch[]
    warnings: Array<{ message: string }>
    errors: Array<{ message: string }>
  }
}

export function GrowthAutomationTriggerMatchPanel({ compact = false }: Props) {
  const [triggerSource, setTriggerSource] = useState("manual.enrollment")
  const [leadId, setLeadId] = useState("")
  const [matches, setMatches] = useState<GrowthAutomationRuntimeMatch[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const runMatch = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch("/api/platform/growth/automation/trigger-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          triggerSource,
          leadId: leadId.trim() || null,
        }),
      })
      const data = (await res.json()) as MatchResponse
      setMatches(data.match?.matches ?? [])
      if (!res.ok) {
        setMessage("Trigger match request failed.")
      } else if ((data.match?.matches.length ?? 0) === 0) {
        setMessage(data.match?.warnings[0]?.message ?? "No active runtimes matched this trigger.")
      } else {
        setMessage(`${data.match?.matches.length ?? 0} runtime(s) matched.`)
      }
    } finally {
      setLoading(false)
    }
  }, [leadId, triggerSource])

  return (
    <div className={compact ? "space-y-3" : "rounded-xl border border-border bg-card p-4"}>
      {!compact ? (
        <div>
          <h3 className="text-sm font-medium">Trigger match preview</h3>
          <p className="text-xs text-muted-foreground">Read-only matcher · no enrollment writes</p>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
        {GROWTH_AUTOMATION_ENROLLMENT_SAFETY_FLAGS.enrollment_execution_enabled ? (
          <span>enrollment enabled</span>
        ) : null}
        {GROWTH_AUTOMATION_ENROLLMENT_SAFETY_FLAGS.sequence_execution_enabled === false ? (
          <span>no execution</span>
        ) : null}
      </div>

      <div className="mt-3 grid gap-2">
        <label className="text-xs text-muted-foreground">
          Trigger source
          <select
            className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={triggerSource}
            onChange={(event) => setTriggerSource(event.target.value)}
          >
            {GROWTH_AUTOMATION_ENROLLMENT_SUPPORTED_TRIGGERS.map((trigger) => (
              <option key={trigger} value={trigger}>
                {trigger}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          Lead ID (optional)
          <Input
            className="mt-1"
            placeholder="Optional lead scope"
            value={leadId}
            onChange={(event) => setLeadId(event.target.value)}
          />
        </label>
      </div>

      <Button size="sm" variant="outline" disabled={loading} onClick={() => void runMatch()}>
        {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
        Match runtimes
      </Button>

      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}

      {matches.length > 0 ? (
        <ul className="space-y-2 text-xs">
          {matches.map((match) => (
            <li key={`${match.flowId}-${match.compiledPatternId}`} className="rounded-md border border-border/70 p-2">
              <p className="font-medium">{match.flowName}</p>
              <p className="text-muted-foreground">{match.entryReason}</p>
              <p className="mt-1 font-mono text-[10px]">{match.compiledPatternId}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
