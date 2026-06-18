"use client"

import { useCallback, useEffect, useState } from "react"
import { BookOpen, CheckCircle2, ExternalLink, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import { GrowthEngineHonestEmptyState } from "@/components/growth/growth-engine-honest-empty-state"
import { GrowthEnginePanelResilience } from "@/components/growth/growth-engine-panel-resilience"
import { GrowthHumanInterventionsPanel } from "@/components/growth/growth-human-interventions-panel"
import { GrowthSmartFollowUpPoliciesPanel } from "@/components/growth/growth-smart-follow-up-policies-panel"
import {
  CONVERSATIONAL_PLAYBOOK_CONSUMER_LABELS,
  CONVERSATIONAL_PLAYBOOK_QA_MARKER,
  CONVERSATIONAL_PLAYBOOK_TYPE_LABELS,
  type ConversationalPlaybook,
  type ConversationalPlaybookConsumer,
  type ConversationalPlaybookSection,
} from "@/lib/growth/conversational-playbooks/conversational-playbook-types"
import { useGrowthRealtimeRefresh } from "@/lib/growth/realtime-events/use-growth-realtime-refresh"
import { fetchPlatformGrowthClient } from "@/lib/growth/platform-growth-client-fetch"

function confidenceTone(score: number): "healthy" | "attention" | "critical" | "neutral" {
  if (score >= 70) return "healthy"
  if (score >= 40) return "attention"
  return "critical"
}

export function GrowthConversationalPlaybooksPanel({
  consumer,
  title = "Conversational Playbook",
  leadId,
  companyId,
  industry,
  defaultQuery,
  compact = false,
  includeOrchestrationSurfaces = false,
  useInboxConcurrencyLimit = false,
  enableRealtimeRefresh = true,
  loadOnMount = true,
}: {
  consumer: ConversationalPlaybookConsumer
  title?: string
  leadId?: string | null
  companyId?: string | null
  industry?: string | null
  defaultQuery?: string
  compact?: boolean
  includeOrchestrationSurfaces?: boolean
  useInboxConcurrencyLimit?: boolean
  enableRealtimeRefresh?: boolean
  loadOnMount?: boolean
}) {
  const [query, setQuery] = useState(defaultQuery ?? "")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [acting, setActing] = useState(false)
  const [playbook, setPlaybook] = useState<ConversationalPlaybook | null>(null)
  const [expanded, setExpanded] = useState(!compact)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchPlatformGrowthClient("/api/platform/growth/conversational-playbooks/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consumer,
          query: query.trim() || undefined,
          lead_id: leadId ?? undefined,
          company_id: companyId ?? undefined,
          industry: industry ?? undefined,
          include_private: Boolean(leadId),
          persist_audit: true,
        }),
        useInboxConcurrencyLimit,
      })
      const data = (await res.json()) as { ok?: boolean; playbook?: ConversationalPlaybook }
      if (res.ok && data.playbook) {
        setPlaybook(data.playbook)
        void fetch("/api/platform/growth/conversational-playbooks/actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "view_playbook", playbook: data.playbook }),
        })
      } else {
        setError("Playbook generation returned no results")
        setPlaybook(null)
      }
    } catch {
      setError("Conversational playbooks unavailable")
      setPlaybook(null)
    } finally {
      setLoading(false)
    }
  }, [companyId, consumer, industry, leadId, query, useInboxConcurrencyLimit])

  useEffect(() => {
    if (!loadOnMount) return
    void load()
  }, [load, loadOnMount])

  useGrowthRealtimeRefresh({
    subscriber: "conversational_playbooks",
    onRefresh: () => void load(),
    enabled: enableRealtimeRefresh,
  })

  async function markReviewed() {
    if (!playbook) return
    setActing(true)
    try {
      await fetch("/api/platform/growth/conversational-playbooks/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_reviewed", playbook }),
      })
      setPlaybook({ ...playbook, review_status: "reviewed" })
    } finally {
      setActing(false)
    }
  }

  function openDocument(documentId: string) {
    window.open(`/admin/growth/knowledge?document=${encodeURIComponent(documentId)}`, "_blank", "noopener,noreferrer")
  }

  function renderSection(section: ConversationalPlaybookSection) {
    return (
      <div key={section.section_id} className="rounded-lg border border-border bg-muted/20 p-3">
        <p className="mb-2 text-sm font-medium">{section.title}</p>
        <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
          {section.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        {section.citations.length > 0 && !compact ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {section.citations.map((citation) => (
              <Button
                key={citation.document_id}
                size="sm"
                variant="link"
                className="h-auto px-0 text-xs"
                onClick={() => openDocument(citation.document_id)}
              >
                <ExternalLink className="mr-1 h-3 w-3" />
                {citation.title}
              </Button>
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <>
    <GrowthEngineCard
      title={title}
      icon={<BookOpen className="h-4 w-4" />}
      data-qa-marker={CONVERSATIONAL_PLAYBOOK_QA_MARKER}
      data-conversational-playbook-consumer={consumer}
    >
      <p className="mb-3 text-xs text-muted-foreground">
        Knowledge-augmented coaching for {CONVERSATIONAL_PLAYBOOK_CONSUMER_LABELS[consumer]} — guidance only. Human
        review required. No send, reply, or autonomous execution.
      </p>

      {!compact ? (
        <div className="mb-3">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Situation keywords (e.g. ServiceTitan objection, pricing pushback)"
          />
        </div>
      ) : null}

      <div className="mb-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={loading} onClick={() => void load()}>
          {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
          Refresh playbook
        </Button>
        {playbook ? (
          <Button size="sm" variant="ghost" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Collapse" : "View Playbook"}
          </Button>
        ) : null}
      </div>

      {loading && !playbook ? (
        <p className="text-sm text-muted-foreground">Generating conversational playbook…</p>
      ) : null}

      {playbook ? (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <GrowthBadge tone="neutral">
              {CONVERSATIONAL_PLAYBOOK_TYPE_LABELS[playbook.playbook_type]}
            </GrowthBadge>
            <GrowthBadge tone={confidenceTone(playbook.confidence_score)}>
              Confidence {playbook.confidence_score}
            </GrowthBadge>
            {playbook.review_status === "reviewed" ? (
              <GrowthBadge tone="healthy">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Reviewed
              </GrowthBadge>
            ) : (
              <GrowthBadge tone="attention">Pending review</GrowthBadge>
            )}
          </div>

          {expanded ? (
            <div className="space-y-3">
              {playbook.sections.map(renderSection)}

              {playbook.recommendations.length > 0 ? (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Recommendations
                  </p>
                  <ul className="space-y-2">
                    {playbook.recommendations.map((rec) => (
                      <li key={rec.recommendation_id} className="rounded-lg border border-border p-2 text-sm">
                        <GrowthBadge tone={rec.priority === "high" ? "attention" : "neutral"}>
                          {rec.priority}
                        </GrowthBadge>
                        <p className="mt-1 font-medium">{rec.title}</p>
                        <p className="text-xs text-muted-foreground">{rec.description}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {playbook.citations.length > 0 ? (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Citations</p>
                  <div className="flex flex-wrap gap-2">
                    {playbook.citations.map((citation) => (
                      <Button
                        key={citation.document_id}
                        size="sm"
                        variant="outline"
                        onClick={() => openDocument(citation.document_id)}
                      >
                        <ExternalLink className="mr-1 h-3 w-3" />
                        {citation.title}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setExpanded(true)}>
              View Playbook
            </Button>
            {playbook.review_status !== "reviewed" ? (
              <Button size="sm" variant="secondary" disabled={acting} onClick={() => void markReviewed()}>
                Mark Reviewed
              </Button>
            ) : null}
          </div>
        </>
      ) : loading ? (
        <GrowthEnginePanelResilience
          loading
          isEmpty={false}
          emptyKind="no_playbooks"
          onRetry={() => void load()}
        >
          {null}
        </GrowthEnginePanelResilience>
      ) : error ? (
        <GrowthEnginePanelResilience
          loading={false}
          error={error}
          isEmpty={false}
          emptyKind="no_playbooks"
          onRetry={() => void load()}
        >
          {null}
        </GrowthEnginePanelResilience>
      ) : (
        <GrowthEngineHonestEmptyState kind="no_playbooks" />
      )}
    </GrowthEngineCard>
    {includeOrchestrationSurfaces && leadId ? (
      <GrowthHumanInterventionsPanel title="Human Interventions" leadId={leadId} compact={compact} />
    ) : null}
    {includeOrchestrationSurfaces && leadId ? (
      <GrowthSmartFollowUpPoliciesPanel title="Smart Follow-Up Policies" leadId={leadId} compact={compact} />
    ) : null}
    </>
  )
}
