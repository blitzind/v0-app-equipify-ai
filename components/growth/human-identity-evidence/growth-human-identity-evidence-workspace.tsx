"use client"

import { useCallback, useEffect, useState } from "react"
import { ExternalLink, Loader2, ShieldCheck, UserCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import type {
  HumanIdentityEvidenceQueueItem,
  HumanIdentityEvidenceReviewAction,
  HumanIdentityEvidenceWorkspace,
} from "@/lib/growth/human-identity-evidence/human-identity-evidence-types"

export function GrowthHumanIdentityEvidenceWorkspace() {
  const [queue, setQueue] = useState<HumanIdentityEvidenceQueueItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [workspace, setWorkspace] = useState<HumanIdentityEvidenceWorkspace | null>(null)
  const [loadingQueue, setLoadingQueue] = useState(true)
  const [loadingWorkspace, setLoadingWorkspace] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [fullName, setFullName] = useState("")
  const [title, setTitle] = useState("")
  const [reviewNote, setReviewNote] = useState("")

  const loadQueue = useCallback(async () => {
    setLoadingQueue(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/human-identity-evidence/queue", {
        cache: "no-store",
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        queue?: HumanIdentityEvidenceQueueItem[]
        message?: string
      }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not load review queue.")
      setQueue(data.queue ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Queue load failed.")
    } finally {
      setLoadingQueue(false)
    }
  }, [])

  const loadWorkspace = useCallback(async (contactId: string) => {
    setLoadingWorkspace(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch(`/api/platform/growth/human-identity-evidence/contacts/${contactId}`, {
        cache: "no-store",
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        workspace?: HumanIdentityEvidenceWorkspace
        message?: string
      }
      if (!res.ok || !data.ok || !data.workspace) {
        throw new Error(data.message ?? "Could not load review workspace.")
      }
      setWorkspace(data.workspace)
      setFullName(data.workspace.queue_item.full_name)
      setTitle(data.workspace.queue_item.title ?? "")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Workspace load failed.")
      setWorkspace(null)
    } finally {
      setLoadingWorkspace(false)
    }
  }, [])

  useEffect(() => {
    void loadQueue()
  }, [loadQueue])

  useEffect(() => {
    if (selectedId) void loadWorkspace(selectedId)
  }, [selectedId, loadWorkspace])

  async function submitReview(actions: HumanIdentityEvidenceReviewAction[]) {
    if (!selectedId) return
    setSubmitting(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch(
        `/api/platform/growth/human-identity-evidence/contacts/${selectedId}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actions,
            full_name: fullName.trim() || undefined,
            title: title.trim() || undefined,
            review_note: reviewNote.trim() || undefined,
            rerun_phone_discovery: true,
          }),
        },
      )
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        result?: { phone_discovery?: { promoted_count?: number } }
        message?: string
      }
      if (!res.ok || !data.ok) {
        throw new Error(
          (data as { result?: { error?: string } }).result?.error ??
            data.message ??
            "Review submission failed.",
        )
      }
      const promoted = data.result?.phone_discovery?.promoted_count ?? 0
      setMessage(
        promoted > 0
          ? `Review saved. Phone promotion succeeded (${promoted} promoted).`
          : "Review saved. Phone discovery re-ran through existing gates.",
      )
      await loadQueue()
      if (selectedId) await loadWorkspace(selectedId)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <section className="rounded-lg border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">Identity review queue</h2>
        {loadingQueue ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </p>
        ) : queue.length === 0 ? (
          <p className="text-sm text-muted-foreground">No contacts require review.</p>
        ) : (
          <ul className="space-y-2">
            {queue.map((item) => (
              <li key={item.company_contact_id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(item.company_contact_id)}
                  className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${
                    selectedId === item.company_contact_id
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <div className="font-medium">{item.company_name}</div>
                  <div className="text-muted-foreground">{item.full_name}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <GrowthBadge tone="attention">P{item.priority_score}</GrowthBadge>
                    {item.priority_reasons.slice(0, 2).map((r) => (
                      <GrowthBadge key={r} tone="neutral">
                        {r}
                      </GrowthBadge>
                    ))}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border bg-card p-4">
        {!selectedId ? (
          <p className="text-sm text-muted-foreground">Select a contact to review evidence.</p>
        ) : loadingWorkspace || !workspace ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading workspace…
          </p>
        ) : (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">{workspace.queue_item.company_name}</h2>
              <p className="text-sm text-muted-foreground">Human identity evidence review</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <div className="text-xs text-muted-foreground">Phone</div>
                <div className="text-sm">{workspace.queue_item.phone ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Email</div>
                <div className="text-sm">{workspace.queue_item.email ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Contact status</div>
                <div className="text-sm">{workspace.queue_item.contact_status}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Phone status</div>
                <div className="text-sm">{workspace.queue_item.phone_status}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Confidence preview</div>
                <div className="text-sm">{workspace.promotion_confidence_preview.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Canonical person</div>
                <div className="text-sm">
                  {workspace.canonical_person?.full_name ?? "—"}
                </div>
              </div>
            </div>

            {workspace.queue_item.source_url ? (
              <a
                href={workspace.queue_item.source_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary underline"
              >
                Source URL <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}

            <div>
              <h3 className="mb-2 text-sm font-semibold">Source evidence</h3>
              {workspace.source_evidence.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No structured evidence rows — source URL metadata only.
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {workspace.source_evidence.map((ev, i) => (
                    <li key={i} className="rounded border p-2">
                      <div className="font-medium">{ev.claim}</div>
                      <div className="text-muted-foreground">{ev.evidence}</div>
                      {ev.page_url ? (
                        <div className="text-xs text-muted-foreground">{ev.page_url}</div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="text-xs text-muted-foreground">Full name (from evidence)</span>
                <input
                  className="mt-1 w-full rounded border bg-background px-2 py-1"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </label>
              <label className="text-sm">
                <span className="text-xs text-muted-foreground">Title (from evidence)</span>
                <input
                  className="mt-1 w-full rounded border bg-background px-2 py-1"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
            </div>

            <label className="block text-sm">
              <span className="text-xs text-muted-foreground">Review note</span>
              <textarea
                className="mt-1 w-full rounded border bg-background px-2 py-1"
                rows={2}
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={submitting}
                onClick={() =>
                  void submitReview(["mark_contact_verified", "mark_phone_verified"])
                }
              >
                {submitting ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="mr-1 h-4 w-4" />
                )}
                Mark verified (contact + phone)
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={submitting}
                onClick={() =>
                  void submitReview([
                    "update_name_from_evidence",
                    "mark_contact_verified",
                    "mark_phone_verified",
                  ])
                }
              >
                <UserCheck className="mr-1 h-4 w-4" />
                Update name + verify
              </Button>
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          </div>
        )}
      </section>
    </div>
  )
}
