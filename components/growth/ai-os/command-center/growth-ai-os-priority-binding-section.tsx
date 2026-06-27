"use client"

import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import type { GrowthPriorityEngineBindingReadModel } from "@/lib/growth/aios/priority/growth-priority-engine-binding-types"
import { GROWTH_PRIORITY_ENGINE_BINDING_QA_MARKER } from "@/lib/growth/aios/priority/growth-priority-engine-binding-types"

type Props = {
  priorityBinding: GrowthPriorityEngineBindingReadModel
}

function statusVariant(status: string) {
  if (status === "ready") return "secondary" as const
  if (status === "needs_approval" || status === "starved") return "destructive" as const
  if (status === "blocked") return "destructive" as const
  return "outline" as const
}

export function GrowthAiOsPriorityBindingSection({ priorityBinding }: Props) {
  if (priorityBinding.qaMarker !== GROWTH_PRIORITY_ENGINE_BINDING_QA_MARKER) return null

  return (
    <section data-qa-section="priority-binding" className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Priority Engine Binding</h3>
          <p className="text-xs text-muted-foreground">
            Mission priority connected to objectives and recommendations — read-only, no execution.
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {priorityBinding.summary.total} bound
        </Badge>
      </div>

      {priorityBinding.topBindings.length === 0 ? (
        <p className="text-sm text-muted-foreground">No priority bindings in the current read model.</p>
      ) : (
        <ul className="space-y-3">
          {priorityBinding.topBindings.map((binding) => (
            <li key={binding.id} className="rounded-md border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <p className="text-sm font-medium">{binding.title}</p>
                  <p className="text-xs text-muted-foreground">{binding.summary}</p>
                  <p className="text-xs text-muted-foreground">
                    Next: {binding.recommendedNextStep.replaceAll("_", " ")} · Agent:{" "}
                    {binding.workflowAgent.replaceAll("_", " ")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="secondary">Score {binding.priorityScore}</Badge>
                  <Badge variant={statusVariant(binding.status)}>{binding.status.replaceAll("_", " ")}</Badge>
                  {binding.blockers.some((blocker) => blocker.type === "approval") ? (
                    <Badge variant="destructive">Approval required</Badge>
                  ) : null}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{binding.evidence.length} evidence item(s)</span>
                {binding.blockers.length > 0 ? (
                  <span>· {binding.blockers.length} blocker(s)</span>
                ) : null}
              </div>
              {binding.route ? (
                <Link
                  href={binding.route}
                  className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
                >
                  Open workspace
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {priorityBinding.sourcesFailed.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Partial read — {priorityBinding.sourcesFailed.length} source(s) skipped without failing the read model.
        </p>
      ) : null}
    </section>
  )
}
