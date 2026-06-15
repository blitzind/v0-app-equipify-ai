"use client"

import { useCallback, useEffect, useState } from "react"
import { BookOpen, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import {
  KNOWLEDGE_CATEGORY_LABELS,
  KNOWLEDGE_CATEGORIES,
  type KnowledgeCategory,
} from "@/lib/growth/knowledge-center/knowledge-document-types"
import {
  KNOWLEDGE_CONSUMER_LABELS,
  type KnowledgeConsumer,
} from "@/lib/growth/knowledge-center/knowledge-retrieval-types"
import {
  KNOWLEDGE_CONTEXT_QA_MARKER,
  type KnowledgeConsumerContext,
} from "@/lib/growth/knowledge-center/knowledge-context-types"

export function GrowthKnowledgeContextSection({
  consumer,
  title,
  leadId,
  companyId,
  industry,
  defaultQuery,
  compact = false,
}: {
  consumer: KnowledgeConsumer
  title: string
  leadId?: string | null
  companyId?: string | null
  industry?: string | null
  defaultQuery?: string
  compact?: boolean
}) {
  const [query, setQuery] = useState(defaultQuery ?? "")
  const [category, setCategory] = useState<KnowledgeCategory | "">("")
  const [tag, setTag] = useState("")
  const [loading, setLoading] = useState(false)
  const [context, setContext] = useState<KnowledgeConsumerContext | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/platform/growth/knowledge/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consumer,
          query: query.trim() || undefined,
          categories: category ? [category] : undefined,
          tags: tag.trim() ? [tag.trim()] : undefined,
          lead_id: leadId ?? undefined,
          company_id: companyId ?? undefined,
          industry: industry ?? undefined,
          include_private: Boolean(leadId),
          limit: compact ? 6 : 12,
        }),
      })
      const data = (await res.json()) as KnowledgeConsumerContext & { ok?: boolean }
      setContext(res.ok ? data : null)
    } catch {
      setContext(null)
    } finally {
      setLoading(false)
    }
  }, [category, companyId, compact, consumer, industry, leadId, query, tag])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <GrowthEngineCard
      title={title}
      icon={<BookOpen className="h-4 w-4" />}
      data-qa-marker={KNOWLEDGE_CONTEXT_QA_MARKER}
      data-knowledge-consumer={consumer}
    >
      <p className="mb-3 text-xs text-muted-foreground">
        Read-only knowledge context for {KNOWLEDGE_CONSUMER_LABELS[consumer]} — active documents only, no generation.
      </p>

      {!compact ? (
        <div className="mb-3 grid gap-2 md:grid-cols-3">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Query keywords" />
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as KnowledgeCategory | "")}
            className="rounded-md border border-border bg-background px-2 py-2 text-sm"
          >
            <option value="">All categories</option>
            {KNOWLEDGE_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {KNOWLEDGE_CATEGORY_LABELS[value]}
              </option>
            ))}
          </select>
          <Input value={tag} onChange={(event) => setTag(event.target.value)} placeholder="Tag filter" />
        </div>
      ) : null}

      <Button size="sm" variant="outline" disabled={loading} onClick={() => void load()}>
        {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
        Refresh context
      </Button>

      {loading && !context ? (
        <p className="mt-3 text-sm text-muted-foreground">Loading knowledge context…</p>
      ) : null}

      {context ? (
        <div className="mt-4 space-y-3 rounded-xl border border-border bg-muted/20 p-3">
          <div className="flex flex-wrap gap-2">
            <GrowthBadge tone="healthy">Relevance {context.relevance_score}</GrowthBadge>
            <GrowthBadge tone="neutral">{context.counts.total} documents</GrowthBadge>
            {context.matched_categories.map((value) => (
              <GrowthBadge key={value} tone="attention">
                {value}
              </GrowthBadge>
            ))}
          </div>

          <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3 lg:grid-cols-6">
            <span>Playbooks: {context.counts.playbooks}</span>
            <span>Objections: {context.counts.objections}</span>
            <span>Competitors: {context.counts.competitors}</span>
            <span>Case studies: {context.counts.case_studies}</span>
            <span>FAQs: {context.counts.faqs}</span>
            <span>Pricing: {context.counts.pricing_notes}</span>
          </div>

          {context.warnings.length > 0 ? (
            <p className="text-xs text-amber-700">{context.warnings.join(" ")}</p>
          ) : null}

          {!compact ? (
            <pre className="overflow-x-auto rounded-md bg-background p-2 text-[11px] text-muted-foreground">
              {JSON.stringify(context.consumer_context, null, 2)}
            </pre>
          ) : null}

          <div className="space-y-2">
            {context.documents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active knowledge documents matched.</p>
            ) : (
              context.documents.map((doc) => (
                <div key={doc.knowledge_document_id} className="rounded-lg border border-border bg-background p-2">
                  <p className="text-sm font-medium">{doc.title}</p>
                  <p className="text-xs text-muted-foreground">{doc.summary}</p>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </GrowthEngineCard>
  )
}
