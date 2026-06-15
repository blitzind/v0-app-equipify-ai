"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, GitBranch, Loader2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import { GrowthKnowledgeContextSection } from "@/components/growth/growth-knowledge-context-section"
import { GrowthKnowledgeRecommendationsSection } from "@/components/growth/growth-knowledge-recommendations-section"
import { GrowthConversationalPlaybooksPanel } from "@/components/growth/growth-conversational-playbooks-panel"
import { GrowthSmartFollowUpPoliciesPanel } from "@/components/growth/growth-smart-follow-up-policies-panel"
import { GrowthCampaignReadinessPanel } from "@/components/growth/growth-campaign-readiness-panel"
import { formatSequenceChannelLabel } from "@/lib/growth/sequence-enrollment/sequence-enrollment-ui"
import type { GrowthSequencePattern, GrowthSequencePatternStep } from "@/lib/growth/sequence-types"
import {
  GROWTH_SEQUENCE_VOICE_DROP_VD_3_QA_MARKER,
  VOICE_DROP_SEQUENCE_COMPLIANCE_WARNING,
  isGrowthSequencePatternVoiceDropOperatorReady,
  listVoiceDropStepsMissingCampaign,
} from "@/lib/growth/sequences/sequence-voice-drop-pattern-readiness"
import type { VoiceDropCampaignPublicView } from "@/lib/voice/voice-drops/types"

type ApprovedCampaignsResponse = {
  ok?: boolean
  campaigns?: VoiceDropCampaignPublicView[]
  message?: string
}

type PatternsResponse = {
  ok?: boolean
  patterns?: GrowthSequencePattern[]
  message?: string
}

export function GrowthSequencePatternBuilder() {
  const [patterns, setPatterns] = useState<GrowthSequencePattern[]>([])
  const [campaigns, setCampaigns] = useState<VoiceDropCampaignPublicView[]>([])
  const [selectedPatternId, setSelectedPatternId] = useState<string | null>(null)
  const [draftCampaignByStepId, setDraftCampaignByStepId] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [savingStepId, setSavingStepId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [patternsRes, campaignsRes] = await Promise.all([
        fetch("/api/platform/growth/sequences/patterns", { cache: "no-store" }),
        fetch("/api/platform/growth/voice/voice-drops/campaigns/approved", { cache: "no-store" }),
      ])
      const patternsData = (await patternsRes.json().catch(() => ({}))) as PatternsResponse
      const campaignsData = (await campaignsRes.json().catch(() => ({}))) as ApprovedCampaignsResponse
      if (!patternsRes.ok || !patternsData.ok) {
        throw new Error(patternsData.message ?? "Failed to load sequence patterns.")
      }
      const loadedPatterns = patternsData.patterns ?? []
      setPatterns(loadedPatterns)
      setCampaigns(campaignsRes.ok ? campaignsData.campaigns ?? [] : [])

      const voiceDropTemplate =
        loadedPatterns.find((entry) => entry.key === "multichannel_with_voice_drop") ?? loadedPatterns[0] ?? null
      setSelectedPatternId(voiceDropTemplate?.id ?? null)

      const initialDraft: Record<string, string> = {}
      for (const pattern of loadedPatterns) {
        for (const step of pattern.steps) {
          if (step.channel === "voice_drop" && step.voiceDropCampaignId) {
            initialDraft[step.id] = step.voiceDropCampaignId
          }
        }
      }
      setDraftCampaignByStepId(initialDraft)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const selectedPattern = useMemo(
    () => patterns.find((entry) => entry.id === selectedPatternId) ?? null,
    [patterns, selectedPatternId],
  )

  const voiceDropSteps = useMemo(
    () => (selectedPattern?.steps ?? []).filter((step) => step.channel === "voice_drop"),
    [selectedPattern],
  )

  async function saveStep(step: GrowthSequencePatternStep, activatePattern: boolean) {
    if (!selectedPattern) return
    const voiceDropCampaignId = draftCampaignByStepId[step.id]
    if (!voiceDropCampaignId) {
      setError("Select an approved Voice Drop campaign before saving.")
      return
    }

    setSavingStepId(step.id)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch(
        `/api/platform/growth/sequences/patterns/${selectedPattern.id}/steps/${step.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ voiceDropCampaignId, activatePattern }),
        },
      )
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Save failed.")
      setNotice(
        activatePattern
          ? "Voice Drop campaign linked and pattern activated."
          : "Voice Drop campaign linked to sequence step.",
      )
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.")
    } finally {
      setSavingStepId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading sequence builder…
      </div>
    )
  }

  return (
    <div className="space-y-6" data-sequence-voice-drop-builder-qa={GROWTH_SEQUENCE_VOICE_DROP_VD_3_QA_MARKER}>
      <GrowthEngineCard title="Sequence Builder — Voice Drop Steps" icon={<GitBranch className="size-4" />}>
        <p className="mb-3 text-sm text-muted-foreground">
          Link approved Voice Drop campaigns to sequence pattern steps. Campaigns are managed in the Voice Drop module —
          this builder does not create campaigns.
        </p>

        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>{VOICE_DROP_SEQUENCE_COMPLIANCE_WARNING}</p>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/growth/voice/voice-drops">Manage Voice Drop campaigns</Link>
          </Button>
          <GrowthBadge label={GROWTH_SEQUENCE_VOICE_DROP_VD_3_QA_MARKER} tone="neutral" />
        </div>

        {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
        {notice ? <p className="mb-3 text-sm text-emerald-700">{notice}</p> : null}

        <div className="mb-4 max-w-md">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Sequence pattern</label>
          <Select value={selectedPatternId ?? undefined} onValueChange={setSelectedPatternId}>
            <SelectTrigger>
              <SelectValue placeholder="Select pattern" />
            </SelectTrigger>
            <SelectContent>
              {patterns.map((pattern) => (
                <SelectItem key={pattern.id} value={pattern.id}>
                  {pattern.label}
                  {!pattern.isActive ? " (inactive)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!selectedPattern ? (
          <p className="text-sm text-muted-foreground">No sequence patterns available.</p>
        ) : voiceDropSteps.length === 0 ? (
          <p className="text-sm text-muted-foreground">This pattern has no Voice Drop steps.</p>
        ) : (
          <div className="space-y-4">
            {selectedPattern.steps.map((step) => (
              <div key={step.id} className="rounded-lg border border-border px-4 py-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <GrowthBadge label={`Step ${step.stepOrder}`} tone="neutral" />
                  <GrowthBadge label={formatSequenceChannelLabel(step.channel)} tone="medium" />
                  <span className="text-xs text-muted-foreground">
                    Delay {step.delayDaysMin}–{step.delayDaysMax} days
                  </span>
                </div>

                {step.channel === "voice_drop" ? (
                  <VoiceDropStepEditor
                    step={step}
                    campaigns={campaigns}
                    value={draftCampaignByStepId[step.id] ?? step.voiceDropCampaignId ?? ""}
                    onChange={(campaignId) =>
                      setDraftCampaignByStepId((current) => ({ ...current, [step.id]: campaignId }))
                    }
                    onSave={(activate) => void saveStep(step, activate)}
                    saving={savingStepId === step.id}
                    patternReady={isGrowthSequencePatternVoiceDropOperatorReady(selectedPattern)}
                    missingCount={listVoiceDropStepsMissingCampaign(selectedPattern.steps).length}
                  />
                ) : step.instructions ? (
                  <p className="text-xs text-muted-foreground">{step.instructions}</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </GrowthEngineCard>

      <GrowthCampaignReadinessPanel title="Campaign Readiness" compact />

      <GrowthKnowledgeContextSection consumer="sequence_builder" title="Messaging References" compact />
      <GrowthKnowledgeRecommendationsSection consumer="sequence_builder" title="Recommended Messaging" compact />

      <GrowthKnowledgeContextSection consumer="voice_drop" title="Script References" compact />
      <GrowthKnowledgeRecommendationsSection consumer="voice_drop" title="Recommended Script Angles" compact />
      <GrowthConversationalPlaybooksPanel consumer="voice_drop" title="Voice Drop Playbook" compact />
      <GrowthSmartFollowUpPoliciesPanel title="Smart Follow-Up Policies" compact />
    </div>
  )
}

function VoiceDropStepEditor({
  step,
  campaigns,
  value,
  onChange,
  onSave,
  saving,
  patternReady,
  missingCount,
}: {
  step: GrowthSequencePatternStep
  campaigns: VoiceDropCampaignPublicView[]
  value: string
  onChange: (campaignId: string) => void
  onSave: (activatePattern: boolean) => void
  saving: boolean
  patternReady: boolean
  missingCount: number
}) {
  const selected = campaigns.find((entry) => entry.id === value) ?? null

  return (
    <div className="space-y-3">
      <div className="max-w-lg">
        <label className="mb-1 block text-xs font-medium">Approved Voice Drop campaign</label>
        <Select value={value || undefined} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select approved campaign" />
          </SelectTrigger>
          <SelectContent>
            {campaigns.length === 0 ? (
              <SelectItem value="__none__" disabled>
                No approved campaigns — create and approve in Voice Drop module
              </SelectItem>
            ) : (
              campaigns.map((campaign) => (
                <SelectItem key={campaign.id} value={campaign.id}>
                  {campaign.name} · {campaign.campaignType} · {campaign.voiceProvider}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      {selected ? (
        <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">{selected.name}</span> · status {selected.status} · provider{" "}
            {selected.voiceProvider}
          </p>
          <p className="mt-1 line-clamp-2">{selected.messageTemplate}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={saving || !value} onClick={() => onSave(false)}>
          {saving ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <Save className="mr-1 size-3.5" />}
          Save campaign link
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={saving || !value || (missingCount > 1 && !step.voiceDropCampaignId)}
          onClick={() => onSave(true)}
        >
          Save &amp; activate pattern
        </Button>
        {step.voiceDropCampaignId ? (
          <GrowthBadge label="Campaign linked" tone="healthy" />
        ) : (
          <GrowthBadge label="Campaign required" tone="attention" />
        )}
        {patternReady ? <GrowthBadge label="Pattern ready" tone="healthy" /> : null}
      </div>
    </div>
  )
}
