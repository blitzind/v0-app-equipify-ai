"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Archive, BookOpen, Loader2, Plus, RefreshCw, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import {
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_CATEGORY_LABELS,
  KNOWLEDGE_CENTER_QA_MARKER,
  KNOWLEDGE_DOCUMENT_STATUSES,
  KNOWLEDGE_FUTURE_CONSUMERS,
  KNOWLEDGE_SOURCE_TYPE_LABELS,
  KNOWLEDGE_SOURCE_TYPES,
  KNOWLEDGE_VISIBILITY_LEVELS,
  type KnowledgeCategory,
  type KnowledgeDocument,
  type KnowledgeDocumentStatus,
  type KnowledgeSearchHit,
  type KnowledgeSourceType,
  type KnowledgeVisibility,
} from "@/lib/growth/knowledge-center/knowledge-document-types"
import {
  KNOWLEDGE_CONSUMER_LABELS,
  KNOWLEDGE_CONSUMERS,
  KNOWLEDGE_RETRIEVAL_QA_MARKER,
  type KnowledgeConsumer,
  type KnowledgeRetrievalResult,
} from "@/lib/growth/knowledge-center/knowledge-retrieval-types"

type SectionKey = "documents" | "faqs" | "notes" | "urls" | "categories" | "tags"

const SECTION_SOURCE: Record<Exclude<SectionKey, "documents" | "categories" | "tags">, KnowledgeSourceType> = {
  faqs: "faq",
  notes: "text",
  urls: "url",
}

const STATUS_TONE: Record<KnowledgeDocumentStatus, "healthy" | "attention" | "neutral" | "blocked"> = {
  active: "healthy",
  draft: "attention",
  archived: "blocked",
}

function formatWhen(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString()
}

export function GrowthKnowledgeCenterDashboard() {
  const [section, setSection] = useState<SectionKey>("documents")
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([])
  const [searchHits, setSearchHits] = useState<KnowledgeSearchHit[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterCategory, setFilterCategory] = useState<KnowledgeCategory | "">("")
  const [filterTag, setFilterTag] = useState("")
  const [filterStatus, setFilterStatus] = useState<KnowledgeDocumentStatus | "">("")
  const [filterVisibility, setFilterVisibility] = useState<KnowledgeVisibility | "">("")
  const [actionId, setActionId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [createSourceType, setCreateSourceType] = useState<KnowledgeSourceType>("text")
  const [createTitle, setCreateTitle] = useState("")
  const [createContent, setCreateContent] = useState("")
  const [createUrl, setCreateUrl] = useState("")
  const [createFilename, setCreateFilename] = useState("")
  const [createFaqQuestion, setCreateFaqQuestion] = useState("")
  const [createFaqAnswer, setCreateFaqAnswer] = useState("")
  const [previewConsumer, setPreviewConsumer] = useState<KnowledgeConsumer>("reply_intelligence")
  const [previewQuery, setPreviewQuery] = useState("")
  const [previewCategory, setPreviewCategory] = useState<KnowledgeCategory | "">("")
  const [previewTag, setPreviewTag] = useState("")
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewResult, setPreviewResult] = useState<KnowledgeRetrievalResult | null>(null)

  async function runRetrievalPreview() {
    setPreviewLoading(true)
    try {
      const res = await fetch("/api/platform/growth/knowledge/retrieve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consumer: previewConsumer,
          query: previewQuery.trim() || undefined,
          categories: previewCategory ? [previewCategory] : undefined,
          tags: previewTag.trim() ? [previewTag.trim()] : undefined,
          limit: 12,
        }),
      })
      const data = (await res.json()) as KnowledgeRetrievalResult & { ok?: boolean }
      setPreviewResult(res.ok ? data : null)
    } catch {
      setPreviewResult(null)
    } finally {
      setPreviewLoading(false)
    }
  }

  const loadDocuments = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterStatus) params.set("status", filterStatus)
      if (filterVisibility) params.set("visibility", filterVisibility)
      const res = await fetch(`/api/platform/growth/knowledge/documents?${params.toString()}`, { cache: "no-store" })
      const data = (await res.json()) as { ok?: boolean; documents?: KnowledgeDocument[] }
      setDocuments(res.ok && data.documents ? data.documents : [])
    } catch {
      setDocuments([])
    } finally {
      setLoading(false)
    }
  }, [filterStatus, filterVisibility])

  const runSearch = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchQuery.trim()) params.set("q", searchQuery.trim())
      if (filterCategory) params.set("category", filterCategory)
      if (filterTag.trim()) params.set("tags", filterTag.trim())
      if (filterStatus) params.set("status", filterStatus)
      if (filterVisibility) params.set("visibility", filterVisibility)
      const res = await fetch(`/api/platform/growth/knowledge/search?${params.toString()}`, { cache: "no-store" })
      const data = (await res.json()) as { ok?: boolean; search?: { hits: KnowledgeSearchHit[] } }
      setSearchHits(res.ok && data.search ? data.search.hits : [])
    } catch {
      setSearchHits([])
    } finally {
      setLoading(false)
    }
  }, [filterCategory, filterStatus, filterTag, filterVisibility, searchQuery])

  useEffect(() => {
    if (searchQuery.trim() || filterCategory || filterTag.trim()) {
      void runSearch()
    } else {
      void loadDocuments()
    }
  }, [filterCategory, filterTag, filterStatus, filterVisibility, loadDocuments, runSearch, searchQuery])

  const filteredDocuments = useMemo(() => {
    const base = searchQuery.trim() || filterCategory || filterTag.trim()
      ? searchHits.map((hit) => hit.document)
      : documents

    if (section === "documents") return base
    if (section === "categories") return base
    if (section === "tags") return base
    const sourceType = SECTION_SOURCE[section as keyof typeof SECTION_SOURCE]
    return base.filter((doc) => doc.source_type === sourceType)
  }, [documents, filterCategory, filterTag, searchHits, searchQuery, section])

  const stats = useMemo(() => {
    const active = documents.filter((doc) => doc.status === "active").length
    const draft = documents.filter((doc) => doc.status === "draft").length
    const archived = documents.filter((doc) => doc.status === "archived").length
    const tagCount = new Set(documents.flatMap((doc) => doc.tags)).size
    return { total: documents.length, active, draft, archived, tagCount }
  }, [documents])

  const allTags = useMemo(
    () => [...new Set(documents.flatMap((doc) => doc.tags))].sort(),
    [documents],
  )

  async function createDocument() {
    setActionId("create")
    try {
      const body: Record<string, unknown> = {
        source_type: createSourceType,
        title: createTitle.trim(),
        content: createContent.trim() || undefined,
        status: "draft",
        visibility: "organization",
      }
      if (createSourceType === "url") body.source_url = createUrl.trim() || undefined
      if (createSourceType === "file") body.source_filename = createFilename.trim() || undefined
      if (createSourceType === "faq") {
        body.faq_question = createFaqQuestion.trim() || createTitle.trim()
        body.faq_answer = createFaqAnswer.trim()
      }

      const res = await fetch("/api/platform/growth/knowledge/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error("Create failed")
      setShowCreate(false)
      setCreateTitle("")
      setCreateContent("")
      setCreateUrl("")
      setCreateFilename("")
      setCreateFaqQuestion("")
      setCreateFaqAnswer("")
      await loadDocuments()
    } finally {
      setActionId(null)
    }
  }

  async function patchDocument(
    knowledge_document_id: string,
    patch: { status?: KnowledgeDocumentStatus; title?: string; content?: string },
  ) {
    setActionId(knowledge_document_id)
    try {
      await fetch("/api/platform/growth/knowledge/documents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ knowledge_document_id, ...patch }),
      })
      if (searchQuery.trim() || filterCategory || filterTag.trim()) {
        await runSearch()
      } else {
        await loadDocuments()
      }
    } finally {
      setActionId(null)
    }
  }

  return (
    <div className="space-y-6" data-qa-marker={KNOWLEDGE_CENTER_QA_MARKER}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile label="Documents" value={String(stats.total)} />
        <StatTile label="Active" value={String(stats.active)} />
        <StatTile label="Draft" value={String(stats.draft)} />
        <StatTile label="Archived" value={String(stats.archived)} />
        <StatTile label="Tags" value={String(stats.tagCount)} />
      </div>

      <GrowthEngineCard title="Future AI Consumers" icon={<BookOpen className="h-4 w-4" />}>
        <p className="mb-3 text-xs text-muted-foreground">
          Planned integrations — display only in GS-3A. No embeddings, no autonomous agents, human review required.
        </p>
        <div className="flex flex-wrap gap-2">
          {KNOWLEDGE_FUTURE_CONSUMERS.map((consumer) => (
            <GrowthBadge key={consumer} tone="neutral">
              {consumer}
            </GrowthBadge>
          ))}
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Retrieval Preview" icon={<Search className="h-4 w-4" />}>
        <p className="mb-3 text-xs text-muted-foreground" data-qa-marker={KNOWLEDGE_RETRIEVAL_QA_MARKER}>
          Preview deterministic retrieval for active documents only. Display only — no generation or autonomous actions.
        </p>
        <div className="mb-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <select
            value={previewConsumer}
            onChange={(event) => setPreviewConsumer(event.target.value as KnowledgeConsumer)}
            className="rounded-md border border-border bg-background px-2 py-2 text-sm"
          >
            {KNOWLEDGE_CONSUMERS.map((consumer) => (
              <option key={consumer} value={consumer}>
                {KNOWLEDGE_CONSUMER_LABELS[consumer]}
              </option>
            ))}
          </select>
          <select
            value={previewCategory}
            onChange={(event) => setPreviewCategory(event.target.value as KnowledgeCategory | "")}
            className="rounded-md border border-border bg-background px-2 py-2 text-sm"
          >
            <option value="">All categories</option>
            {KNOWLEDGE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {KNOWLEDGE_CATEGORY_LABELS[category]}
              </option>
            ))}
          </select>
          <Input
            value={previewTag}
            onChange={(event) => setPreviewTag(event.target.value)}
            placeholder="Tag filter"
          />
          <Input
            value={previewQuery}
            onChange={(event) => setPreviewQuery(event.target.value)}
            placeholder="Query keywords"
          />
        </div>
        <Button size="sm" disabled={previewLoading} onClick={() => void runRetrievalPreview()}>
          {previewLoading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Search className="mr-1 h-4 w-4" />}
          Preview retrieval
        </Button>

        {previewResult ? (
          <div className="mt-4 space-y-3 rounded-xl border border-border bg-muted/20 p-4">
            <div className="flex flex-wrap gap-2">
              <GrowthBadge tone="healthy">Relevance {previewResult.relevance_score}</GrowthBadge>
              {previewResult.matched_categories.map((category) => (
                <GrowthBadge key={category} tone="attention">
                  {category}
                </GrowthBadge>
              ))}
              {previewResult.matched_tags.map((tag) => (
                <GrowthBadge key={tag} tone="neutral">
                  #{tag}
                </GrowthBadge>
              ))}
            </div>
            {previewResult.warnings.length > 0 ? (
              <p className="text-xs text-amber-700">{previewResult.warnings.join(" ")}</p>
            ) : null}
            <pre className="overflow-x-auto rounded-md bg-background p-3 text-[11px] text-muted-foreground">
              {JSON.stringify(previewResult.consumer_context, null, 2)}
            </pre>
            <div className="space-y-2">
              {previewResult.documents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active documents matched this retrieval scope.</p>
              ) : (
                previewResult.documents.map((doc) => (
                  <div key={doc.knowledge_document_id} className="rounded-lg border border-border bg-background p-3">
                    <p className="font-medium text-sm">{doc.title}</p>
                    <p className="text-xs text-muted-foreground">{doc.summary}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}
      </GrowthEngineCard>

      <GrowthEngineCard title="Knowledge Center">
        <div className="mb-4 flex flex-wrap gap-2">
          {(["documents", "faqs", "notes", "urls", "categories", "tags"] as SectionKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setSection(key)}
              className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
                section === key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {key}
            </button>
          ))}
        </div>

        <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_auto_auto_auto_auto]">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search title, tags, categories, keywords…"
              className="pl-9"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(event) => setFilterCategory(event.target.value as KnowledgeCategory | "")}
            className="rounded-md border border-border bg-background px-2 py-2 text-sm"
          >
            <option value="">All categories</option>
            {KNOWLEDGE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {KNOWLEDGE_CATEGORY_LABELS[category]}
              </option>
            ))}
          </select>
          <Input
            value={filterTag}
            onChange={(event) => setFilterTag(event.target.value)}
            placeholder="Filter tag"
          />
          <select
            value={filterStatus}
            onChange={(event) => setFilterStatus(event.target.value as KnowledgeDocumentStatus | "")}
            className="rounded-md border border-border bg-background px-2 py-2 text-sm"
          >
            <option value="">All statuses</option>
            {KNOWLEDGE_DOCUMENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <select
            value={filterVisibility}
            onChange={(event) => setFilterVisibility(event.target.value as KnowledgeVisibility | "")}
            className="rounded-md border border-border bg-background px-2 py-2 text-sm"
          >
            <option value="">All visibility</option>
            {KNOWLEDGE_VISIBILITY_LEVELS.map((visibility) => (
              <option key={visibility} value={visibility}>
                {visibility}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setShowCreate((value) => !value)}>
            <Plus className="mr-1 h-4 w-4" />
            Create
          </Button>
          <Button size="sm" variant="outline" onClick={() => void loadDocuments()}>
            <RefreshCw className="mr-1 h-4 w-4" />
            Refresh
          </Button>
        </div>

        {showCreate ? (
          <div className="mb-6 space-y-3 rounded-xl border border-border bg-muted/20 p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <select
                value={createSourceType}
                onChange={(event) => setCreateSourceType(event.target.value as KnowledgeSourceType)}
                className="rounded-md border border-border bg-background px-2 py-2 text-sm"
              >
                {KNOWLEDGE_SOURCE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {KNOWLEDGE_SOURCE_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
              <Input value={createTitle} onChange={(event) => setCreateTitle(event.target.value)} placeholder="Title" />
            </div>
            {createSourceType === "url" ? (
              <Input value={createUrl} onChange={(event) => setCreateUrl(event.target.value)} placeholder="Source URL" />
            ) : null}
            {createSourceType === "file" ? (
              <Input
                value={createFilename}
                onChange={(event) => setCreateFilename(event.target.value)}
                placeholder="Filename (e.g. playbook.pdf)"
              />
            ) : null}
            {createSourceType === "faq" ? (
              <>
                <Input
                  value={createFaqQuestion}
                  onChange={(event) => setCreateFaqQuestion(event.target.value)}
                  placeholder="FAQ question"
                />
                <Textarea
                  value={createFaqAnswer}
                  onChange={(event) => setCreateFaqAnswer(event.target.value)}
                  placeholder="FAQ answer"
                  rows={4}
                />
              </>
            ) : (
              <Textarea
                value={createContent}
                onChange={(event) => setCreateContent(event.target.value)}
                placeholder="Reviewed content (required before activation)"
                rows={5}
              />
            )}
            <Button
              size="sm"
              disabled={!createTitle.trim() || actionId === "create"}
              onClick={() => void createDocument()}
            >
              {actionId === "create" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Save draft
            </Button>
          </div>
        ) : null}

        {section === "categories" ? (
          <div className="mb-4 flex flex-wrap gap-2">
            {KNOWLEDGE_CATEGORIES.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setFilterCategory(category)}
                className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted"
              >
                {KNOWLEDGE_CATEGORY_LABELS[category]} (
                {documents.filter((doc) => doc.categories.includes(category)).length})
              </button>
            ))}
          </div>
        ) : null}

        {section === "tags" ? (
          <div className="mb-4 flex flex-wrap gap-2">
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setFilterTag(tag)}
                className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted"
              >
                #{tag}
              </button>
            ))}
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading knowledge documents…
          </div>
        ) : filteredDocuments.length === 0 ? (
          <p className="py-8 text-sm text-muted-foreground">
            No knowledge documents yet. Create a draft URL, file metadata, FAQ, or note to begin.
          </p>
        ) : (
          <div className="space-y-3">
            {filteredDocuments.map((doc) => (
              <div key={doc.knowledge_document_id} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{doc.title}</p>
                      <GrowthBadge tone={STATUS_TONE[doc.status]}>{doc.status}</GrowthBadge>
                      <GrowthBadge tone="neutral">{KNOWLEDGE_SOURCE_TYPE_LABELS[doc.source_type]}</GrowthBadge>
                      <GrowthBadge tone="attention">{KNOWLEDGE_CATEGORY_LABELS[doc.classification.category]}</GrowthBadge>
                    </div>
                    <p className="text-sm text-muted-foreground">{doc.summary}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {doc.tags.slice(0, 6).map((tag) => (
                        <span key={tag} className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                          #{tag}
                        </span>
                      ))}
                    </div>
                    {doc.source_url ? (
                      <Link href={doc.source_url} className="text-xs text-primary hover:underline" target="_blank">
                        {doc.source_url}
                      </Link>
                    ) : null}
                    {doc.source_filename ? (
                      <p className="text-xs text-muted-foreground">File: {doc.source_filename}</p>
                    ) : null}
                    <p className="text-[11px] text-muted-foreground">
                      Updated {formatWhen(doc.updated_at)} · Visibility {doc.visibility}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {doc.status !== "active" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionId === doc.knowledge_document_id}
                        onClick={() => void patchDocument(doc.knowledge_document_id, { status: "active" })}
                      >
                        Activate
                      </Button>
                    ) : null}
                    {doc.status !== "archived" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionId === doc.knowledge_document_id}
                        onClick={() => void patchDocument(doc.knowledge_document_id, { status: "archived" })}
                      >
                        <Archive className="mr-1 h-3.5 w-3.5" />
                        Archive
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </GrowthEngineCard>
    </div>
  )
}
