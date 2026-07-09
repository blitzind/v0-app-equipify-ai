"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { GrowthTrainingSectionCard } from "@/components/growth/training/growth-training-section-card"
import {
  ensureBusinessProfileDraftFromApproved,
  profileApiPath,
  useGrowthTrainingProfileWorkspace,
} from "@/components/growth/training/use-growth-training-profile-workspace"
import type { GrowthBusinessProfileApiResponse } from "@/lib/growth/business-profile/business-profile-api-contract"
import { GROWTH_BUSINESS_PROFILE_APPROVE_LABEL } from "@/lib/growth/business-profile/business-profile-api-contract"
import type { BusinessStrategyContent } from "@/lib/growth/training/growth-business-strategy-types"
import {
  createEmptyBusinessStrategyContent,
  resolveBusinessStrategyContent,
} from "@/lib/growth/training/growth-business-strategy-types"
import {
  GROWTH_TRAINING_BUSINESS_STRATEGY_TITLE,
  GROWTH_TRAINING_COMPANY_PROFILE_ROUTE,
  GROWTH_TRAINING_STRATEGY_SAVE_SUCCESS_COPY,
} from "@/lib/growth/training/growth-training-workspace-types"

function listLines(values: string[]): string {
  return values.join("\n")
}

function parseLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

function StrategyEditorBlock({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-3 rounded-xl border border-border/60 bg-background/80 p-4">
      <h4 className="text-sm font-semibold">{title}</h4>
      {children}
    </div>
  )
}

export function GrowthTrainingBusinessStrategySection() {
  const { loading, activeApproved, latestDraft, error, reload, setActiveApproved, setLatestDraft } =
    useGrowthTrainingProfileWorkspace()
  const [editing, setEditing] = useState<BusinessStrategyContent>(
    createEmptyBusinessStrategyContent(),
  )
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [mode, setMode] = useState<"view" | "edit">("view")

  const displayStrategy = useMemo(() => {
    const record = latestDraft ?? activeApproved
    return resolveBusinessStrategyContent(record?.profile.businessStrategy)
  }, [activeApproved, latestDraft])

  useEffect(() => {
    if (mode === "edit") {
      setEditing(displayStrategy)
      setEditingDraftId(latestDraft?.id ?? null)
    }
  }, [displayStrategy, latestDraft?.id, mode])

  const beginEditing = useCallback(async () => {
    setLocalError(null)
    setSuccess(null)
    setBusy("prepare")
    try {
      if (latestDraft) {
        setEditing(resolveBusinessStrategyContent(latestDraft.profile.businessStrategy))
        setEditingDraftId(latestDraft.id)
        setMode("edit")
        return
      }
      if (activeApproved) {
        const draft = await ensureBusinessProfileDraftFromApproved(activeApproved)
        setLatestDraft(draft)
        setEditing(resolveBusinessStrategyContent(draft.profile.businessStrategy))
        setEditingDraftId(draft.id)
        setMode("edit")
        return
      }
      setLocalError("Create your Company Profile first — I need to know who you are before how you think.")
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Could not start strategy editing.")
    } finally {
      setBusy(null)
    }
  }, [activeApproved, latestDraft, setLatestDraft])

  async function handleSave() {
    if (!editingDraftId || !latestDraft) return
    setBusy("save")
    setLocalError(null)
    setSuccess(null)
    try {
      const res = await fetch(profileApiPath(editingDraftId), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: {
            ...latestDraft.profile,
            businessStrategy: editing,
          },
        }),
      })
      const payload = (await res.json()) as GrowthBusinessProfileApiResponse
      if (!res.ok || !payload.ok || !payload.profile) {
        throw new Error(payload.message ?? "Could not save Business Strategy.")
      }
      setLatestDraft(payload.profile)
      setSuccess(GROWTH_TRAINING_STRATEGY_SAVE_SUCCESS_COPY)
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Could not save Business Strategy.")
    } finally {
      setBusy(null)
    }
  }

  async function handleApprove() {
    if (!editingDraftId) return
    setBusy("approve")
    setLocalError(null)
    try {
      const res = await fetch(profileApiPath(editingDraftId, "approve"), { method: "POST" })
      const payload = (await res.json()) as GrowthBusinessProfileApiResponse
      if (!res.ok || !payload.ok || !payload.profile) {
        throw new Error(payload.message ?? "Could not approve profile.")
      }
      setActiveApproved(payload.profile)
      setLatestDraft(null)
      setEditingDraftId(null)
      setMode("view")
      setSuccess("I'll use this strategy going forward.")
      await reload()
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Could not approve profile.")
    } finally {
      setBusy(null)
    }
  }

  function updateStrategy(patch: Partial<BusinessStrategyContent>) {
    setEditing((current) => ({ ...current, ...patch }))
  }

  if (loading) {
    return (
      <GrowthTrainingSectionCard title={GROWTH_TRAINING_BUSINESS_STRATEGY_TITLE} qaSection="training-business-strategy">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading Business Strategy…
        </div>
      </GrowthTrainingSectionCard>
    )
  }

  return (
    <GrowthTrainingSectionCard
      title={GROWTH_TRAINING_BUSINESS_STRATEGY_TITLE}
      description="How do we think? One shared strategy for how I research, prioritize, and communicate."
      qaSection="training-business-strategy"
    >
      {error || localError ? <p className="text-sm text-destructive">{error ?? localError}</p> : null}
      {success ? <p className="text-sm text-emerald-700 dark:text-emerald-300">{success}</p> : null}

      {!activeApproved && !latestDraft ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Teach me how you think after I know who you are. Start with your Company Profile.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href={GROWTH_TRAINING_COMPANY_PROFILE_ROUTE}>Go to Company Profile</Link>
          </Button>
        </div>
      ) : null}

      {mode === "view" && (activeApproved || latestDraft) ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-border/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Positioning</p>
              <p className="mt-2 text-sm">{displayStrategy.positioning.pricingPhilosophy || "Not taught yet."}</p>
            </div>
            <div className="rounded-xl border border-border/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tone</p>
              <p className="mt-2 text-sm">{displayStrategy.messaging.tone || "Not taught yet."}</p>
            </div>
          </div>
          {displayStrategy.objections.items.length > 0 ? (
            <div className="rounded-xl border border-border/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Objections</p>
              <ul className="mt-2 space-y-2">
                {displayStrategy.objections.items.slice(0, 5).map((item, index) => (
                  <li key={`${item.objection}:${index}`} className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{item.objection}</span>
                    {item.preferredResponse ? ` — ${item.preferredResponse}` : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <Button onClick={() => void beginEditing()} disabled={busy === "prepare"} size="sm">
            {busy === "prepare" ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Teach me your strategy
          </Button>
          {latestDraft ? (
            <p className="text-xs text-amber-800 dark:text-amber-200">
              You have a draft profile with strategy changes waiting for approval.
            </p>
          ) : null}
        </div>
      ) : null}

      {mode === "edit" ? (
        <div className="space-y-4">
          <StrategyEditorBlock title="Company principles">
            <div className="space-y-2">
              <Label>Mission</Label>
              <Textarea
                value={editing.companyWide.mission}
                onChange={(e) =>
                  updateStrategy({
                    companyWide: { ...editing.companyWide, mission: e.target.value },
                  })
                }
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Core values (one per line)</Label>
              <Textarea
                value={listLines(editing.companyWide.coreValues)}
                onChange={(e) =>
                  updateStrategy({
                    companyWide: { ...editing.companyWide, coreValues: parseLines(e.target.value) },
                  })
                }
                rows={3}
              />
            </div>
          </StrategyEditorBlock>

          <StrategyEditorBlock title="Messaging & tone">
            <div className="space-y-2">
              <Label>Elevator pitch</Label>
              <Textarea
                value={editing.messaging.elevatorPitch}
                onChange={(e) =>
                  updateStrategy({ messaging: { ...editing.messaging, elevatorPitch: e.target.value } })
                }
                rows={3}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Tone</Label>
                <Input
                  value={editing.messaging.tone}
                  onChange={(e) =>
                    updateStrategy({ messaging: { ...editing.messaging, tone: e.target.value } })
                  }
                  placeholder="Educational, direct, warm…"
                />
              </div>
              <div className="space-y-2">
                <Label>Formality</Label>
                <Input
                  value={editing.messaging.formality}
                  onChange={(e) =>
                    updateStrategy({ messaging: { ...editing.messaging, formality: e.target.value } })
                  }
                  placeholder="Professional but approachable"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Words to avoid (one per line)</Label>
              <Textarea
                value={listLines(editing.messaging.wordsToAvoid)}
                onChange={(e) =>
                  updateStrategy({
                    messaging: { ...editing.messaging, wordsToAvoid: parseLines(e.target.value) },
                  })
                }
                rows={3}
              />
            </div>
          </StrategyEditorBlock>

          <StrategyEditorBlock title="Positioning & pricing">
            <div className="space-y-2">
              <Label>Pricing philosophy</Label>
              <Textarea
                value={editing.positioning.pricingPhilosophy}
                onChange={(e) =>
                  updateStrategy({
                    positioning: { ...editing.positioning, pricingPhilosophy: e.target.value },
                  })
                }
                rows={3}
                placeholder="Never compete on price. Lead with response time…"
              />
            </div>
            <div className="space-y-2">
              <Label>Competitive advantages (one per line)</Label>
              <Textarea
                value={listLines(editing.positioning.competitiveAdvantages)}
                onChange={(e) =>
                  updateStrategy({
                    positioning: {
                      ...editing.positioning,
                      competitiveAdvantages: parseLines(e.target.value),
                    },
                  })
                }
                rows={3}
              />
            </div>
          </StrategyEditorBlock>

          <StrategyEditorBlock title="Sales philosophy">
            <div className="space-y-2">
              <Label>Qualification standards (one per line)</Label>
              <Textarea
                value={listLines(editing.salesPhilosophy.qualificationStandards)}
                onChange={(e) =>
                  updateStrategy({
                    salesPhilosophy: {
                      ...editing.salesPhilosophy,
                      qualificationStandards: parseLines(e.target.value),
                    },
                  })
                }
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Discovery questions (one per line)</Label>
              <Textarea
                value={listLines(editing.salesPhilosophy.discoveryQuestions)}
                onChange={(e) =>
                  updateStrategy({
                    salesPhilosophy: {
                      ...editing.salesPhilosophy,
                      discoveryQuestions: parseLines(e.target.value),
                    },
                  })
                }
                rows={3}
              />
            </div>
          </StrategyEditorBlock>

          <StrategyEditorBlock title="Objections">
            <div className="space-y-3">
              {(editing.objections.items.length > 0
                ? editing.objections.items
                : [{ objection: "", preferredResponse: "" }]
              ).map((item, index) => (
                <div key={`objection-${index}`} className="grid gap-2 md:grid-cols-2">
                  <Input
                    value={item.objection}
                    placeholder="Objection"
                    onChange={(e) => {
                      const items = [...editing.objections.items]
                      if (items.length === 0) items.push({ objection: "", preferredResponse: "" })
                      items[index] = { ...items[index], objection: e.target.value }
                      updateStrategy({ objections: { items } })
                    }}
                  />
                  <Input
                    value={item.preferredResponse}
                    placeholder="Preferred response"
                    onChange={(e) => {
                      const items = [...editing.objections.items]
                      if (items.length === 0) items.push({ objection: "", preferredResponse: "" })
                      items[index] = { ...items[index], preferredResponse: e.target.value }
                      updateStrategy({ objections: { items } })
                    }}
                  />
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  updateStrategy({
                    objections: {
                      items: [...editing.objections.items, { objection: "", preferredResponse: "" }],
                    },
                  })
                }
              >
                Add objection
              </Button>
            </div>
          </StrategyEditorBlock>

          <StrategyEditorBlock title="Sales & relationships">
            <Textarea
              value={listLines(editing.salesAndRelationships.principles)}
              onChange={(e) =>
                updateStrategy({
                  salesAndRelationships: {
                    ...editing.salesAndRelationships,
                    principles: parseLines(e.target.value),
                  },
                })
              }
              rows={2}
              placeholder="One principle per line"
            />
          </StrategyEditorBlock>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void handleSave()} disabled={busy === "save"} size="sm">
              {busy === "save" ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Save strategy draft
            </Button>
            {latestDraft ? (
              <Button onClick={() => void handleApprove()} disabled={busy === "approve"} size="sm" variant="secondary">
                {GROWTH_BUSINESS_PROFILE_APPROVE_LABEL}
              </Button>
            ) : null}
            <Button variant="ghost" size="sm" onClick={() => setMode("view")}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </GrowthTrainingSectionCard>
  )
}
