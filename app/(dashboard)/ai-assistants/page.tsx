"use client"

import { useCallback, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  Bot,
  Cpu,
  Loader2,
  RefreshCw,
  Sparkles,
  Clock,
  Zap,
} from "lucide-react"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { useBillingAccess } from "@/lib/billing-access-context"
import { aiFeatureUpgradeMessage } from "@/lib/billing/feature-access"
import {
  ASSISTANT_UI,
  OPERATIONAL_ASSISTANT_IDS,
  type OperationalAssistantCard,
  type OperationalAssistantId,
} from "@/lib/ai/operational-assistants/client"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type RunMeta = {
  task: string
  provider: string
  model: string
  escalated: boolean
  cacheHit: boolean
  durationMs: number
}

type CardState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "queued"; jobId: string }
  | { status: "error"; message: string }
  | { status: "ok"; card: OperationalAssistantCard; meta: RunMeta }

function severityStyles(sev?: string) {
  switch (sev) {
    case "critical":
      return "border-red-200 bg-red-50 text-red-950"
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-950"
    default:
      return "border-zinc-200 bg-zinc-50 text-zinc-800"
  }
}

function AssistantCard({
  id,
  organizationId,
  insightsAllowed,
  state,
  onRefresh,
  onEnqueue,
}: {
  id: OperationalAssistantId
  organizationId: string
  insightsAllowed: boolean
  state: CardState
  onRefresh: () => void
  onEnqueue: () => void
}) {
  const ui = ASSISTANT_UI[id]
  const loading = state.status === "loading"

  return (
    <div className="rounded-2xl border border-zinc-200/90 bg-white shadow-sm overflow-hidden flex flex-col">
      <div
        className="px-5 py-4 border-b border-zinc-100 flex items-start justify-between gap-3"
        style={{ borderLeftWidth: 4, borderLeftColor: ui.accent }}
      >
        <div>
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-zinc-700 shrink-0" />
            <h2 className="text-lg font-semibold text-zinc-900">{ui.title}</h2>
          </div>
          <p className="text-sm text-zinc-500 mt-1">{ui.description}</p>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <Button
            type="button"
            size="sm"
            variant="default"
            disabled={loading || !organizationId || !insightsAllowed}
            onClick={onRefresh}
            className="gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={loading || !organizationId || !insightsAllowed}
            onClick={onEnqueue}
            title="Queue a background run (processed by AI jobs cron)"
            className="gap-1 text-xs"
          >
            <Clock className="w-3.5 h-3.5" />
            Queue job
          </Button>
        </div>
      </div>

      <div className="p-5 flex-1 flex flex-col gap-4 text-sm">
        {state.status === "idle" && (
          <p className="text-zinc-500">
            Run this assistant to get prioritized recommendations from your live operational data.
          </p>
        )}
        {state.status === "queued" && (
          <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-violet-900 text-xs">
            Queued job <span className="font-mono">{state.jobId.slice(0, 8)}…</span> — results appear when the AI jobs worker runs.
          </div>
        )}
        {state.status === "error" && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-900 text-xs">{state.message}</div>
        )}
        {state.status === "ok" && (
          <>
            <div>
              <p className="text-zinc-800 leading-relaxed">{state.card.summary}</p>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-zinc-500">Confidence</span>
                <div className="flex-1 min-w-[120px] h-2 rounded-full bg-zinc-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${Math.round(state.card.confidence * 100)}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-zinc-700">{Math.round(state.card.confidence * 100)}%</span>
                {state.meta.cacheHit ? (
                  <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600">
                    Cached
                  </span>
                ) : null}
              </div>
              <p className="text-[11px] text-zinc-400 mt-1 font-mono">
                {state.meta.task} · {state.meta.model}
                {state.meta.durationMs ? ` · ${state.meta.durationMs}ms` : ""}
              </p>
            </div>

            {state.card.alerts.length > 0 ? (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5" /> Alerts
                </h3>
                <ul className="space-y-2">
                  {state.card.alerts.map((a, i) => (
                    <li
                      key={`${a.title}-${i}`}
                      className={cn("rounded-lg border px-3 py-2 text-xs", severityStyles(a.severity))}
                    >
                      <div className="font-semibold">{a.title}</div>
                      {a.detail ? <div className="mt-0.5 opacity-90">{a.detail}</div> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {state.card.recommendations.length > 0 ? (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">Recommendations</h3>
                <ul className="space-y-2">
                  {state.card.recommendations.map((r, i) => (
                    <li key={`${r.title}-${i}`} className="rounded-lg border border-zinc-100 bg-zinc-50/80 px-3 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium text-zinc-900">{r.title}</span>
                        {r.priority ? (
                          <span className="text-[10px] uppercase font-semibold text-zinc-500 shrink-0">{r.priority}</span>
                        ) : null}
                      </div>
                      {r.rationale ? <p className="text-xs text-zinc-600 mt-1">{r.rationale}</p> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {state.card.actions.length > 0 ? (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">Actions</h3>
                <div className="flex flex-wrap gap-2">
                  {state.card.actions.map((a, i) => {
                    const href = a.href?.trim()
                    const internal = href?.startsWith("/")
                    return internal && href ? (
                      <Link
                        key={`${a.label}-${i}`}
                        href={href}
                        className="inline-flex items-center rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 transition-colors"
                      >
                        {a.label}
                      </Link>
                    ) : (
                      <span
                        key={`${a.label}-${i}`}
                        className="inline-flex items-center rounded-lg border border-dashed border-zinc-200 px-3 py-1.5 text-xs text-zinc-600"
                      >
                        {a.label}
                      </span>
                    )
                  })}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

export default function AiAssistantsPage() {
  const org = useActiveOrganization()
  const organizationId = org.status === "ready" ? org.organizationId : null
  const { insightsAllowed } = useBillingAccess()

  const [states, setStates] = useState<Record<OperationalAssistantId, CardState>>(() => {
    const init = {} as Record<OperationalAssistantId, CardState>
    for (const id of OPERATIONAL_ASSISTANT_IDS) init[id] = { status: "idle" }
    return init
  })

  const runAssistant = useCallback(
    async (id: OperationalAssistantId) => {
      if (!organizationId) return
      setStates((s) => ({ ...s, [id]: { status: "loading" } }))
      try {
        const res = await fetch(`/api/organizations/${organizationId}/ai-assistants/${id}/run`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        })
        const data = (await res.json()) as {
          ok?: boolean
          message?: string
          card?: OperationalAssistantCard
          meta?: RunMeta
        }
        if (!res.ok || !data.ok || !data.card || !data.meta) {
          setStates((s) => ({
            ...s,
            [id]: { status: "error", message: data.message ?? `Request failed (${res.status})` },
          }))
          return
        }
        setStates((s) => ({
          ...s,
          [id]: { status: "ok", card: data.card, meta: data.meta },
        }))
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Network error."
        setStates((s) => ({ ...s, [id]: { status: "error", message: msg } }))
      }
    },
    [organizationId],
  )

  const enqueueAssistant = useCallback(
    async (id: OperationalAssistantId) => {
      if (!organizationId) return
      setStates((s) => ({ ...s, [id]: { status: "loading" } }))
      try {
        const res = await fetch(`/api/organizations/${organizationId}/ai-assistants/${id}/enqueue`, {
          method: "POST",
        })
        const data = (await res.json()) as { ok?: boolean; jobId?: string; message?: string }
        if (!res.ok || !data.ok || !data.jobId) {
          setStates((s) => ({
            ...s,
            [id]: { status: "error", message: data.message ?? `Enqueue failed (${res.status})` },
          }))
          return
        }
        setStates((s) => ({ ...s, [id]: { status: "queued", jobId: data.jobId } }))
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Network error."
        setStates((s) => ({ ...s, [id]: { status: "error", message: msg } }))
      }
    },
    [organizationId],
  )

  return (
    <div className="min-h-full flex flex-col">
      {!insightsAllowed && (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100 shrink-0">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <p>
              {aiFeatureUpgradeMessage()}{" "}
              <Link href="/settings/billing" className="font-semibold underline-offset-2 hover:underline">
                View billing
              </Link>
            </p>
          </div>
        </div>
      )}

      <div className="shrink-0 rounded-2xl overflow-hidden mb-6" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #111827 100%)" }}>
        <div className="px-6 py-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                <Cpu size={16} className="text-white" />
              </div>
              <span className="text-xs font-semibold uppercase tracking-widest text-indigo-300">Operational AI</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">AI Assistants</h1>
            <p className="text-sm mt-1 text-slate-400 max-w-xl">
              Structured recommendations—not a chatbot. Each assistant reads your org metrics and returns alerts,
              priorities, and suggested actions (router, usage logs, cache, workflows, and AI jobs).
            </p>
          </div>
          <Link
            href="/insights"
            className="inline-flex items-center gap-2 self-start px-4 py-2 rounded-xl text-sm font-semibold text-white bg-white/10 hover:bg-white/15 border border-white/10 transition-colors"
          >
            <Sparkles size={14} />
            AI Insights hub
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pb-10">
        {OPERATIONAL_ASSISTANT_IDS.map((id) => (
          <AssistantCard
            key={id}
            id={id}
            organizationId={organizationId ?? ""}
            insightsAllowed={insightsAllowed}
            state={states[id] ?? { status: "idle" }}
            onRefresh={() => void runAssistant(id)}
            onEnqueue={() => void enqueueAssistant(id)}
          />
        ))}
      </div>
    </div>
  )
}
